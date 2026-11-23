// LabelDesk data connectors: item masters from cloud ERPs and web APIs, fetched by the Worker.
// Connection settings (URLs, users, passwords, tokens) are stored per company, AES-256-GCM encrypted with a key
// derived from DESIGN_KEY, and never sent back to the browser. Only owners/admins can add or delete connections.
// On-premise systems (SAP ECC, Oracle EBS, JD Edwards, live Tally, SQL/ODBC) need the LabelDesk agent instead.
import { scope } from "./auth.js";

const enc = new TextEncoder(), dec = new TextDecoder();
const b64e = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const J = (b, status = 200, extra = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });
const MAX_ROWS = 20000, MAX_PAGES = 100;

async function key(env) {
  if (!env.DESIGN_KEY || env.DESIGN_KEY.length < 16) return null;
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("ld-connectors-v1:" + env.DESIGN_KEY)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(k, aad, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv: b64e(iv), data: b64e(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, k, enc.encode(JSON.stringify(obj)))) }; }
async function open(k, aad, row) { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(row.iv), additionalData: enc.encode(aad) }, k, b64d(row.data)))); }
async function hmac(env, msg) { const k = await crypto.subtle.importKey("raw", enc.encode("ld-oauth-state:" + env.DESIGN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64e(await crypto.subtle.sign("HMAC", k, enc.encode(msg))).replace(/[+/=]/g, ""); }

// Only public https endpoints: the Worker must not be pointed at private or local addresses
function safeUrl(u) {
  let url; try { url = new URL(u); } catch (e) { throw new Error("Enter a full https:// address"); }
  if (url.protocol !== "https:") throw new Error("Use an https:// address");
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || /^(10|127|0)\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h) || /^\[?(::1|f[cd]|fe80)/i.test(h))
    throw new Error("That address is on a private network. Use the LabelDesk agent for systems inside your office network.");
  return url;
}
function flat(o, pre = "", out = {}) {
  for (const [k, v] of Object.entries(o || {})) {
    if (k === "__metadata" || k === "__deferred" || k.endsWith("@odata.navigationLink")) continue;
    const key = pre ? pre + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) { if (!v.__deferred) flat(v, key, out); }
    else if (Array.isArray(v)) { if (v.length === 2 && typeof v[0] === "number" && typeof v[1] === "string") out[key] = v[1]; else if (v.every(x => x == null || typeof x !== "object")) out[key] = v.join(", "); }
    else out[key] = v == null ? "" : String(v);
  }
  return out;
}
const firstArray = v => Array.isArray(v) ? v : v && typeof v === "object" ? (v.d && Array.isArray(v.d.results) ? v.d.results : Object.values(v).map(firstArray).find(a => a && a.length && typeof a[0] === "object") || null) : null;
const at = (o, path) => path.split(".").filter(Boolean).reduce((a, k) => a == null ? a : a[k], o);
async function getJSON(url, headers = {}, opts = {}) {
  const r = await fetch(url, { headers: { accept: "application/json", ...headers }, ...opts });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { throw new Error(`${r.status} from ${new URL(url).host}: not JSON${r.ok ? "" : " (" + t.slice(0, 120).replace(/\s+/g, " ") + ")"}`); }
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}: ${String(j.error_description || j.message || (j.error && (j.error.message?.value || j.error.message || j.error)) || "request failed").slice(0, 200)}`);
  return j;
}
const basic = (u, p) => "Basic " + btoa(unescape(encodeURIComponent(`${u}:${p}`)));
const nextOf = (j, base) => { const n = j["@odata.nextLink"] || j["odata.nextLink"] || (j.d && j.d.__next) || j.next || j.nextLink || (Array.isArray(j.links) && (j.links.find(l => l.rel === "next") || {}).href); return n ? new URL(n, base).toString() : null; };

/* ---------- one fetcher per system ---------- */
const KINDS = {
  generic: { name: "Web API (REST / OData)", async rows(c) {
    let url = safeUrl(c.url).toString(); const h = {};
    if (c.auth === "basic") h.authorization = basic(c.user, c.pass); else if (c.auth === "bearer") h.authorization = "Bearer " + c.token; else if (c.auth === "header" && c.header) h[c.header] = c.value;
    const out = [];
    for (let p = 0; url && p < MAX_PAGES && out.length < MAX_ROWS; p++) { const j = await getJSON(url, h), arr = c.path ? at(j, c.path) : firstArray(j); if (!Array.isArray(arr)) throw new Error("No list of records in the reply" + (c.path ? ` at "${c.path}"` : "") + "."); out.push(...arr); url = nextOf(j, url); if (url) safeUrl(url); }
    return out; } },
  sap_s4: { name: "SAP S/4HANA Cloud", async rows(c) {
    const base = safeUrl(c.host).origin, svc = (c.service || "API_PRODUCT_SRV/A_Product").replace(/^\/+/, "");
    let url = `${base}/sap/opu/odata/sap/${svc}${svc.includes("?") ? "&" : "?"}$format=json&$top=1000&$inlinecount=allpages${c.filter ? "&$filter=" + encodeURIComponent(c.filter) : ""}`;
    const h = { authorization: basic(c.user, c.pass) }, out = [];
    for (let p = 0; url && p < MAX_PAGES && out.length < MAX_ROWS; p++) { const j = await getJSON(url, h); out.push(...((j.d && j.d.results) || j.value || [])); url = j.d && j.d.__next ? new URL(j.d.__next, base).toString() : j["@odata.nextLink"] ? new URL(j["@odata.nextLink"], base).toString() : null; }
    return out; } },
  sap_b1: { name: "SAP Business One (Service Layer)", async rows(c) {
    const base = safeUrl(c.url).toString().replace(/\/+$/, "");
    const r = await fetch(base + "/Login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ CompanyDB: c.company, UserName: c.user, Password: c.pass }) });
    if (!r.ok) throw new Error(`SAP B1 login failed (${r.status}): check company database, user and password`);
    const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get("set-cookie") || ""]).map(x => x.split(";")[0]).filter(Boolean).join("; ");
    const sel = c.select || "ItemCode,ItemName,ForeignName,BarCode,ItemsGroupCode,SalesUnit,InventoryUOM,Manufacturer,SWW,ItemPrices";
    let url = `${base}/Items?$select=${encodeURIComponent(sel)}${c.filter ? "&$filter=" + encodeURIComponent(c.filter) : ""}`; const out = [];
    for (let p = 0; url && p < MAX_PAGES && out.length < MAX_ROWS; p++) { const j = await getJSON(url, { cookie, prefer: "odata.maxpagesize=500" }); out.push(...(j.value || [])); url = j["odata.nextLink"] || j["@odata.nextLink"] ? new URL(j["odata.nextLink"] || j["@odata.nextLink"], base + "/").toString() : null; }
    fetch(base + "/Logout", { method: "POST", headers: { cookie } }).catch(() => {});
    return out.map(i => { const price = Array.isArray(i.ItemPrices) && i.ItemPrices.find(p => p.Price) || {}; const o = Object.assign({}, i); delete o.ItemPrices; return Object.assign(o, { Price: price.Price ?? "", PriceList: price.PriceList ?? "" }); }); } },
  oracle_fusion: { name: "Oracle Fusion Cloud (SCM items)", async rows(c) {
    const base = safeUrl(c.host).origin, h = { authorization: basic(c.user, c.pass) }, out = [];
    const q = c.org ? `&q=${encodeURIComponent("OrganizationCode=" + c.org)}` : "";
    for (let off = 0, p = 0; p < MAX_PAGES && out.length < MAX_ROWS; p++, off += 500) {
      const j = await getJSON(`${base}/fscmRestApi/resources/11.13.18.05/itemsV2?onlyData=true&limit=500&offset=${off}${q}`, h); out.push(...(j.items || [])); if (!j.hasMore) break; }
    return out; } },
  bc: { name: "Microsoft Dynamics 365 Business Central", async rows(c) {
    const t = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/token`, { method: "POST", body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.client_id, client_secret: c.client_secret, scope: "https://api.businesscentral.dynamics.com/.default" }) }).then(r => r.json());
    if (!t.access_token) throw new Error("Business Central sign-in failed: " + (t.error_description || t.error || "check tenant, client ID and secret").slice(0, 200));
    const h = { authorization: "Bearer " + t.access_token }, api = `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(c.tenant)}/${encodeURIComponent(c.environment || "production")}/api/v2.0`;
    let cid = c.company_id; if (!cid) { const cs = await getJSON(`${api}/companies`, h); if (!cs.value || !cs.value.length) throw new Error("No companies found"); cid = (cs.value.find(x => !c.company || x.name === c.company) || cs.value[0]).id; }
    let url = `${api}/companies(${cid})/items`; const out = [];
    for (let p = 0; url && p < MAX_PAGES && out.length < MAX_ROWS; p++) { const j = await getJSON(url, h); out.push(...(j.value || [])); url = j["@odata.nextLink"] || null; }
    return out; } },
  odoo: { name: "Odoo", async rows(c) {
    const base = safeUrl(c.url).origin, rpc = async (service, method, args) => { const j = await getJSON(base + "/jsonrpc", { "content-type": "application/json" }, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: 1 }) }); if (j.error) throw new Error("Odoo: " + (j.error.data && j.error.data.message || j.error.message)); return j.result; };
    const uid = await rpc("common", "login", [c.db, c.user, c.key]); if (!uid) throw new Error("Odoo login failed: check database, user and API key");
    return rpc("object", "execute_kw", [c.db, uid, c.key, "product.product", "search_read", [[["active", "=", true]]], { fields: ["default_code", "name", "barcode", "list_price", "standard_price", "uom_id", "categ_id", "description_sale", "weight", "hs_code"].filter(Boolean), limit: MAX_ROWS }]); } },
  hubspot: { name: "HubSpot (forms / contacts)", async rows(c) {
    const h = { authorization: "Bearer " + c.token }, out = [], api = "https://api.hubapi.com";
    if ((c.mode || "form") === "form") {
      const g = String(c.form || "").trim();
      if (!/^[0-9a-f-]{20,}$/i.test(g)) { // no form chosen: list them so the user can copy the ID
        const f = await getJSON(`${api}/marketing/v3/forms?limit=50`, h).catch(() => ({ results: [] }));
        throw new Error("Enter the form ID. Your forms: " + ((f.results || []).map(x => `${x.name} = ${x.id}`).join("; ") || "none found (the private app needs the 'forms' scope)"));
      }
      let after = "";
      for (let p = 0; p < MAX_PAGES && out.length < MAX_ROWS; p++) {
        const j = await getJSON(`${api}/form-integrations/v1/submissions/forms/${encodeURIComponent(g)}?limit=50${after ? "&after=" + encodeURIComponent(after) : ""}`, h);
        for (const r of j.results || []) { const o = { submitted: r.submittedAt ? new Date(r.submittedAt).toISOString().slice(0, 16).replace("T", " ") : "", page: r.pageUrl || "" }; for (const v of r.values || []) o[v.name] = o[v.name] ? o[v.name] + ", " + v.value : v.value; out.push(o); }
        after = j.paging && j.paging.next && j.paging.next.after; if (!after) break;
      }
      return out;
    }
    const props = (c.props || "firstname,lastname,company,email,phone,address,city,state,zip,country").replace(/\s/g, "");
    let after = "";
    for (let p = 0; p < MAX_PAGES && out.length < MAX_ROWS; p++) {
      const j = await getJSON(`${api}/crm/v3/objects/contacts?limit=100&properties=${encodeURIComponent(props)}${after ? "&after=" + encodeURIComponent(after) : ""}`, h);
      out.push(...(j.results || []).map(r => Object.assign({ id: r.id }, r.properties || {}))); after = j.paging && j.paging.next && j.paging.next.after; if (!after) break;
    }
    return out; } },
  zoho: { name: "Zoho Inventory", async rows(c, env) {
    if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET) throw new Error("Zoho is not set up on this server (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET).");
    const t = await fetch(`${c.accounts}/oauth/v2/token`, { method: "POST", body: new URLSearchParams({ refresh_token: c.refresh, client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, grant_type: "refresh_token" }) }).then(r => r.json());
    if (!t.access_token) throw new Error("Zoho sign-in expired or was removed: connect Zoho again.");
    const h = { authorization: "Zoho-oauthtoken " + t.access_token }, out = [];
    for (let page = 1; page <= MAX_PAGES && out.length < MAX_ROWS; page++) { const j = await getJSON(`${c.api}/inventory/v1/items?organization_id=${encodeURIComponent(c.org)}&page=${page}&per_page=200`, h);
      out.push(...(j.items || []).map(i => { const o = Object.assign({}, i); for (const cf of i.custom_fields || []) o["cf_" + String(cf.label || cf.api_name || cf.customfield_id).replace(/\W+/g, "_").toLowerCase()] = cf.value; delete o.custom_fields; return o; }));
      if (!(j.page_context && j.page_context.has_more_page)) break; }
    return out; } },
};
const PUBLIC_FIELDS = { generic: ["url", "auth", "user", "header", "path"], sap_s4: ["host", "user", "service", "filter"], sap_b1: ["url", "company", "user", "select", "filter"], oracle_fusion: ["host", "user", "org"], bc: ["tenant", "environment", "company", "client_id"], odoo: ["url", "db", "user"], hubspot: ["mode", "form", "props"], zoho: ["org", "org_name", "api"] };

export async function connectors(request, env, url) {
  const p = url.pathname, m = request.method;
  if (!env.LEADS) return J({ error: "Database missing" }, 503);
  const k = await key(env); if (!k) return J({ error: "Connections need sign-in switched on (the DESIGN_KEY secret)." }, 503);
  // Zoho OAuth return trip lands here as a normal page load (no x-ld header)
  if (p === "/api/zoho/callback") return zohoCallback(request, env, url, k);
  const sc = await scope(env, request); if (!sc) return J({ error: "Sign in and open a company to use connections.", signin: true }, 401);
  const manage = ["owner", "admin"].includes(sc.role);
  if (p === "/api/zoho/connect") {
    if (!manage) return J({ error: "Only an owner or admin can connect Zoho." }, 403);
    if (!env.ZOHO_CLIENT_ID) return J({ error: "Zoho is not set up on this server yet (ZOHO_CLIENT_ID)." }, 503);
    const dc = /^(com|in|eu|com\.au|jp|ca|sa)$/.test(url.searchParams.get("dc") || "") ? url.searchParams.get("dc") : "in", st = sc.cid + "." + Date.now() + "." + dc;
    const q = new URLSearchParams({ scope: "ZohoInventory.items.READ,ZohoInventory.settings.READ", client_id: env.ZOHO_CLIENT_ID, response_type: "code", access_type: "offline", prompt: "consent", redirect_uri: `https://${url.host}/api/zoho/callback`, state: st + "." + await hmac(env, st) });
    return Response.redirect(`https://accounts.zoho.${dc}/oauth/v2/auth?${q}`, 302);
  }
  if (m !== "GET" && request.headers.get("x-ld") !== "1") return J({ error: "Bad request" }, 400);
  if (p === "/api/connect/list") {
    const { results } = await env.LEADS.prepare("SELECT id, kind, name, pub, updated FROM integrations WHERE company_id = ?1 ORDER BY updated DESC").bind(sc.cid).all();
    return J({ connections: results.map(r => ({ id: r.id, kind: r.kind, kindName: (KINDS[r.kind] || {}).name || r.kind, name: r.name, pub: JSON.parse(r.pub || "{}"), updated: r.updated })), kinds: Object.fromEntries(Object.entries(KINDS).map(([a, b]) => [a, b.name])), zoho: !!env.ZOHO_CLIENT_ID, manage });
  }
  let b = {}; if (m === "POST") { try { b = await request.json(); } catch (e) {} }
  if (p === "/api/connect/save" && m === "POST") {
    if (!manage) return J({ error: "Only an owner or admin can add connections." }, 403);
    const kind = String(b.kind || ""); if (!KINDS[kind] || kind === "zoho") return J({ error: "Unknown connection type" }, 400);
    const cfg = Object.fromEntries(Object.entries(b.cfg || {}).map(([a, v]) => [a, String(v ?? "").trim().slice(0, 2000)]));
    let id = /^[A-Za-z0-9]{10}$/.test(b.id || "") ? b.id : null, old = null;
    if (id) { const r = await env.LEADS.prepare("SELECT * FROM integrations WHERE id = ?1 AND company_id = ?2").bind(id, sc.cid).first(); if (r) { old = await open(k, `${sc.cid}|${id}`, r); for (const s of ["pass", "token", "value", "client_secret", "key"]) if (!cfg[s] && old[s]) cfg[s] = old[s]; } else id = null; }
    let rows; try { rows = await KINDS[kind].rows(cfg, env); } catch (e) { return J({ error: "Test failed: " + e.message }, 400); }
    id = id || [...crypto.getRandomValues(new Uint8Array(10))].map(x => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[x % 56]).join("");
    const name = String(b.name || KINDS[kind].name).slice(0, 80), pub = Object.fromEntries((PUBLIC_FIELDS[kind] || []).map(f => [f, cfg[f] || ""]));
    const sl = await seal(k, `${sc.cid}|${id}`, cfg);
    await env.LEADS.prepare("INSERT INTO integrations (id, company_id, kind, name, pub, iv, data, updated) VALUES (?1,?2,?3,?4,?5,?6,?7,datetime('now')) ON CONFLICT(id) DO UPDATE SET name = ?4, pub = ?5, iv = ?6, data = ?7, updated = datetime('now')")
      .bind(id, sc.cid, kind, name, JSON.stringify(pub), sl.iv, sl.data).run();
    return J({ id, name, count: rows.length, rows: rows.slice(0, 5).map(r => flat(r)) });
  }
  if (p === "/api/connect/fetch" && m === "POST") {
    const r = await env.LEADS.prepare("SELECT * FROM integrations WHERE id = ?1 AND company_id = ?2").bind(String(b.id || ""), sc.cid).first();
    if (!r) return J({ error: "Connection not found" }, 404);
    let cfg; try { cfg = await open(k, `${sc.cid}|${r.id}`, r); } catch (e) { return J({ error: "This connection's settings could not be opened." }, 409); }
    try { const rows = (await KINDS[r.kind].rows(cfg, env)).slice(0, MAX_ROWS).map(x => flat(x)); return J({ name: r.name, kind: (KINDS[r.kind] || {}).name, rows }); }
    catch (e) { return J({ error: e.message }, 502); }
  }
  if (p === "/api/connect/delete" && m === "POST") {
    if (!manage) return J({ error: "Only an owner or admin can delete connections." }, 403);
    await env.LEADS.prepare("DELETE FROM integrations WHERE id = ?1 AND company_id = ?2").bind(String(b.id || ""), sc.cid).run(); return J({ ok: true });
  }
  return J({ error: "Not found" }, 404);
}

async function zohoCallback(request, env, url, k) {
  const back = msg => Response.redirect(`https://${url.host}/?zoho=${encodeURIComponent(msg)}`, 302);
  const st = String(url.searchParams.get("state") || ""), parts = st.split("."), sig = parts.pop(), raw = parts.join(".");
  if (!sig || sig !== await hmac(env, raw)) return back("Zoho sign-in could not be verified. Try again.");
  const [cid, ts, dc] = raw.split("."); if (Date.now() - +ts > 15 * 60e3) return back("Zoho sign-in took too long. Try again.");
  const sc = await scope(env, request); if (!sc || sc.cid !== cid) return back("Open the same company in LabelDesk, then connect Zoho again.");
  if (url.searchParams.get("error")) return back("Zoho access was not given.");
  const accounts = /^https:\/\/accounts\.zoho\.[a-z.]+$/.test(url.searchParams.get("accounts-server") || "") ? url.searchParams.get("accounts-server") : `https://accounts.zoho.${dc}`;
  const t = await fetch(`${accounts}/oauth/v2/token`, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, redirect_uri: `https://${url.host}/api/zoho/callback`, code: String(url.searchParams.get("code") || "") }) }).then(r => r.json()).catch(() => ({}));
  if (!t.refresh_token) return back("Zoho did not return access: " + (t.error || "unknown error"));
  const api = /^https:\/\/www\.zohoapis\.[a-z.]+$/.test(t.api_domain || "") ? t.api_domain : `https://www.zohoapis.${dc}`;
  let orgs = []; try { orgs = (await getJSON(`${api}/inventory/v1/organizations`, { authorization: "Zoho-oauthtoken " + t.access_token })).organizations || []; } catch (e) {}
  if (!orgs.length) return back("No Zoho Inventory organisation found for this Zoho account.");
  for (const o of orgs.slice(0, 5)) {
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map(x => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[x % 56]).join("");
    const cfg = { refresh: t.refresh_token, accounts, api, org: String(o.organization_id), org_name: o.name }, sl = await seal(k, `${cid}|${id}`, cfg);
    await env.LEADS.prepare("DELETE FROM integrations WHERE company_id = ?1 AND kind = 'zoho' AND json_extract(pub, '$.org') = ?2").bind(cid, cfg.org).run();
    await env.LEADS.prepare("INSERT INTO integrations (id, company_id, kind, name, pub, iv, data, updated) VALUES (?1,?2,'zoho',?3,?4,?5,?6,datetime('now'))")
      .bind(id, cid, `Zoho Inventory: ${o.name}`.slice(0, 80), JSON.stringify({ org: cfg.org, org_name: o.name, api }), sl.iv, sl.data).run();
  }
  return back("connected");
}
