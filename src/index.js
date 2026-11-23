import { accounts, scope, aiGate, CAN_EDIT } from "./auth.js";
// prn-preview Worker: serves LabelDesk (labeldesk.app) from ./public, plus the AI, leads and design endpoints.
// Providers tried in order: Claude (ANTHROPIC_API_KEY), Gemini (GEMINI_API_KEY), then Workers AI as last resort.
const CLAUDE_MODEL = "claude-sonnet-5-5";
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash"];
const CF_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

const SYSTEM = `You convert photos of product, shipping and compliance labels into a structured layout for a thermal label printer.
Reply with one JSON object only. No prose, no markdown fences.`;

function userPrompt(b) {
  const size = b.width_mm && b.height_mm
    ? `The real label is ${b.width_mm} mm wide and ${b.height_mm} mm tall.`
    : "The label size is unknown: estimate width_mm and height_mm from typical label sizes and the size of the text.";
  const hints = Array.isArray(b.barcodes) && b.barcodes.length
    ? `Barcodes already decoded from the photo (position in percent of the whole photo): ${JSON.stringify(b.barcodes).slice(0, 2000)}. Use these values as the barcode data.`
    : "";
  return `Read this label photo and return its layout as JSON with exactly this shape:
{"label":{"width_mm":number,"height_mm":number,"box_2d":[ymin,xmin,ymax,xmax]},"elements":[ ... ]}
All box_2d values are integers 0-1000, normalized to the WHOLE PHOTO (0,0 = photo top-left, 1000,1000 = photo bottom-right), in the order [ymin, xmin, ymax, xmax].
label.box_2d is the outline of the label itself inside the photo (use [0,0,1000,1000] if the label fills the photo).
Each element has "type" ("text", "barcode", "line" or "box") and a tight "box_2d" around what is printed:
- text: one element per printed line. "text" = the exact characters (keep case, digits and punctuation), "bold": true or false. box_2d covers just that line of text.
- barcode: "symbology" is one of code128, ean13, upca, code39, gs1-128, qrcode, datamatrix, pdf417. "data" = the encoded value; if you cannot decode it, use the human-readable digits printed under it. box_2d covers the bars only; do not add the printed digits again as a separate text element.
- line: a printed rule, with "thickness_mm".
- box: a printed rectangular frame, with "thickness_mm".
${size}
${hints}
List every printed line of text, top to bottom. Never invent text that is not printed.`;
}

function extractJSON(v) {
  if (typeof v !== "string") v = JSON.stringify(v ?? "");
  v = v.replace(/```(?:json)?/gi, "");
  const a = v.indexOf("{"), z = v.lastIndexOf("}");
  if (a < 0 || z <= a) return null;
  try { return JSON.parse(v.slice(a, z + 1)); } catch { return null; }
}

async function pic2labelRun(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  if (env.LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") || "anon";
    const { success } = await env.LIMITER.limit({ key: ip });
    if (!success) return json({ error: "Too many conversions in a minute. Wait a moment and try again." }, 429);
  }
  let b;
  try { b = await request.json(); } catch { return json({ error: "Send JSON" }, 400); }
  const img = String(b.image || "");
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return json({ error: "image must be a JPEG, PNG or WebP data URL" }, 400);
  if (img.length > 4_000_000) return json({ error: "Image too large; send at most about 3 MB" }, 413);
  const num = v => (Number.isFinite(+v) && +v > 0 && +v < 1000 ? +v : null);
  const body = { width_mm: num(b.width_mm), height_mm: num(b.height_mm), barcodes: b.barcodes };
  const prompt = userPrompt(body);
  const [, mime, b64] = img.match(/^data:(image\/\w+);base64,(.*)$/s);
  const providers = [];
  if (env.ANTHROPIC_API_KEY) providers.push(["claude", () => viaClaude(env, env.CLAUDE_MODEL || CLAUDE_MODEL, prompt, mime, b64)]);
  if (env.GEMINI_API_KEY) for (const m of (env.GEMINI_MODEL ? [env.GEMINI_MODEL] : GEMINI_MODELS)) providers.push(["gemini", () => viaGemini(env, m, prompt, mime, b64)]);
  if (env.AI) providers.push(["workers-ai", () => viaWorkersAI(env, prompt, img)]);
  const only = typeof b.provider === "string" ? b.provider : null; // for testing one provider
  const errors = [], started = Date.now();
  for (const [name, run] of providers.filter(([n]) => !only || n === only)) {
    // keep the whole request under ~60 s: stop trying slow Gemini models, but always give the backup a go
    if (name !== "workers-ai" && Date.now() - started > 25000) { errors.push(`${name}: skipped, time budget used`); continue; }
    try {
      const { text, model } = await run();
      const layout = extractJSON(text);
      if (layout && Array.isArray(layout.elements)) return json({ layout, provider: name, model, errors });
      errors.push(`${name}: reply was not a label layout`);
    } catch (e) { errors.push(`${name}: ${String(e && e.message || e).slice(0, 200)}`); }
  }
  return json({ error: "No AI service could read this photo. " + errors.join(" | ") }, 502);
}

async function viaClaude(env, model, prompt, mime, b64) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 4096, system: SYSTEM,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
        { type: "text", text: prompt },
      ] }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error && j.error.message || ""}`);
  return { text: (j.content || []).filter(c => c.type === "text").map(c => c.text).join(""), model };
}

async function viaGemini(env, model, prompt, mime, b64) {
  try { return await geminiOnce(env, model, prompt, mime, b64); }
  catch (e) { // free tier often returns 503/429 for a moment: wait and retry once
    if (!/HTTP (503|429|500)/.test(e.message)) throw e; // timeouts are not retried
    await new Promise(r => setTimeout(r, 2500));
    return geminiOnce(env, model, prompt, mime, b64);
  }
}
async function geminiOnce(env, model, prompt, mime, b64) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
    }),
    signal: AbortSignal.timeout(22000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error && j.error.message || ""}`);
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  return { text: parts.filter(p => p.text && !p.thought).map(p => p.text).join(""), model };
}

async function viaWorkersAI(env, prompt, img) {
  const r = await Promise.race([new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 35000)), env.AI.run(CF_MODEL, {
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: img } }] },
    ],
    max_tokens: 3000, temperature: 0.1,
  })]);
  const v = r && (r.response ?? r.result ?? r);
  return { text: typeof v === "string" ? v : JSON.stringify(v), model: CF_MODEL };
}

/* ---------- leads: enquiries from the site, kept in D1 ---------- */
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
async function saveLead(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!env.LEADS) return json({ error: "Lead storage is not set up" }, 503);
  if (env.LEAD_LIMITER) { const { success } = await env.LEAD_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") || "anon" }); if (!success) return json({ error: "Too many requests; try again in a minute." }, 429); }
  let b; try { b = await request.json(); } catch { return json({ error: "Send JSON" }, 400); }
  if (b.website) return json({ ok: true }); // honeypot: bots fill every field
  const phone = clip(b.phone, 30), email = clip(b.email, 120).toLowerCase();
  if (!/\d{7,}/.test(phone.replace(/\D/g, "")) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Give a phone number or an email address." }, 400);
  const ctx = clip(JSON.stringify(b.context || {}), 2000);
  const r = await env.LEADS.prepare("INSERT INTO leads (name, phone, email, company, city, need, message, source, context, country) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)")
    .bind(clip(b.name, 80), phone, email, clip(b.company, 120), clip(b.city, 60), clip(b.need, 60), clip(b.message, 1000), clip(b.source, 60), ctx, request.cf && request.cf.country || "").run();
  return json({ ok: true, id: r.meta && r.meta.last_row_id });
}
function isAdmin(request, env) {
  const key = request.headers.get("x-admin-key") || new URL(request.url).searchParams.get("key") || "";
  return env.ADMIN_KEY && key.length >= 12 && key === env.ADMIN_KEY;
}
async function listLeads(request, env) {
  if (!env.ADMIN_KEY) return json({ error: "Set the ADMIN_KEY secret on the Worker first." }, 503);
  if (!isAdmin(request, env)) return json({ error: "Wrong key" }, 401);
  const url = new URL(request.url);
  if (request.method === "POST") { // update status
    const b = await request.json().catch(() => ({}));
    if (!["new", "contacted", "quoted", "won", "lost"].includes(b.status)) return json({ error: "Bad status" }, 400);
    await env.LEADS.prepare("UPDATE leads SET status = ?1 WHERE id = ?2").bind(b.status, +b.id || 0).run();
    return json({ ok: true });
  }
  const { results } = await env.LEADS.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 1000").all();
  if (url.searchParams.get("format") === "csv") {
    const cols = ["id", "created_at", "status", "name", "phone", "email", "company", "city", "need", "message", "source", "country", "context"];
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...results.map(r => cols.map(c => esc(r[c])).join(","))].join("\r\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=pic2label-leads.csv", "cache-control": "no-store" } });
  }
  return new Response(JSON.stringify({ leads: results }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}


/* ---------- cloud designs: AES-256-GCM at rest, owner-scoped ---------- */
// The key comes from the DESIGN_KEY secret and never leaves the Worker. GCM's tag means any change to a
// stored design (or moving it to another row/owner, via the additional data) makes it fail to open.
const b64e = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256hex(t) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function designKey(env) {
  if (!env.DESIGN_KEY || env.DESIGN_KEY.length < 16) return null;
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("p2l-designs-v1:" + env.DESIGN_KEY));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(key, id, owner, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id + "|" + owner) }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64e(iv), data: b64e(ct) };
}
async function unseal(key, row) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(row.iv), additionalData: new TextEncoder().encode(row.id + "|" + row.owner) }, key, b64d(row.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
const MAX_DESIGN = 1200000; // keeps a row under D1's size limit after encryption and base64
async function designs(request, env, url) {
  if (!env.LEADS) return json({ error: "Cloud storage is not set up" }, 503);
  const key = await designKey(env);
  if (!key) return json({ error: "Cloud saving is not switched on yet (the DESIGN_KEY secret is missing)." }, 503);
  // Signed in: designs belong to the open company. Otherwise the older per-browser workspace key.
  let sc = null; try { sc = await scope(env, request); } catch (e) {}
  const tok = request.headers.get("x-owner") || "", id = url.pathname.split("/")[3] || "", m = request.method;
  if (!sc && !/^[A-Za-z0-9_-]{32,128}$/.test(tok)) return json({ error: "Please sign in." , signin: true }, 401);
  const owner = sc ? sc.owner : await sha256hex("owner:" + tok);
  if (env.DESIGN_LIMITER) { const { success } = await env.DESIGN_LIMITER.limit({ key: owner }); if (!success) return json({ error: "Too many saves; wait a minute." }, 429); }
  if (sc && m !== "GET" && !sc.csrf) return json({ error: "Bad request" }, 400);
  if (sc && m !== "GET" && !(id === "backup" && m === "GET") && !CAN_EDIT.includes(sc.role)) return json({ error: "Your role can open and print designs but not change them." }, 403);
  const roomFor = async extra => {
    if (!sc || !sc.plan.designs) return true;
    const r = await env.LEADS.prepare("SELECT COUNT(*) AS n FROM designs WHERE owner = ?1").bind(owner).first();
    return r.n + extra <= sc.plan.designs;
  };
  const full = () => json({ error: `The ${sc.plan.name} plan keeps ${sc.plan.designs} designs. Add a licence for unlimited designs, or delete one first.`, quota: true }, 402);
  // Move this browser's older workspace designs into the signed-in company (re-sealed for the company)
  if (id === "adopt" && m === "POST") {
    if (!sc) return json({ error: "Please sign in." }, 401);
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(tok)) return json({ moved: 0 });
    const old = await sha256hex("owner:" + tok), { results } = await env.LEADS.prepare("SELECT * FROM designs WHERE owner = ?1").bind(old).all();
    let moved = 0, skipped = 0;
    for (const row of results) {
      if (!await roomFor(1)) { skipped++; continue; }
      try { const d = await unseal(key, row), sl = await seal(key, row.id, owner, d);
        await env.LEADS.prepare("UPDATE designs SET owner = ?1, iv = ?2, data = ?3 WHERE id = ?4 AND owner = ?5").bind(owner, sl.iv, sl.data, row.id, old).run(); moved++; } catch (e) { skipped++; }
    }
    return json({ moved, skipped });
  }
  // Backup: every design of this workspace in one file, encrypted and sealed by the server (any edit makes it refuse to restore)
  if (id === "backup" && m === "GET") {
    const { results } = await env.LEADS.prepare("SELECT * FROM designs WHERE owner = ?1 ORDER BY updated DESC LIMIT 2000").bind(owner).all();
    const list = [];
    for (const row of results) { try { list.push({ id: row.id, name: row.name, updated: row.updated, design: await unseal(key, row) }); } catch (e) {} }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode("p2l-backup-v1") }, key, new TextEncoder().encode(JSON.stringify({ made: new Date().toISOString(), designs: list })));
    return new Response(JSON.stringify({ app: "LabelDesk", kind: "design-backup", v: 1, count: list.length, iv: b64e(iv), data: b64e(ct) }), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="label-designs-backup-${new Date().toISOString().slice(0, 10)}.p2lbak"`, "cache-control": "no-store" } });
  }
  if (id === "backup" && m === "POST") {
    const text = await request.text(); if (text.length > 30000000) return json({ error: "Backup file is too large" }, 413);
    let b, inner; try { b = JSON.parse(text); } catch (e) { return json({ error: "That is not a backup file" }, 400); }
    if (b.kind !== "design-backup" || !b.iv || !b.data) return json({ error: "That is not a backup file" }, 400);
    try { inner = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(b.iv), additionalData: new TextEncoder().encode("p2l-backup-v1") }, key, b64d(b.data)))); }
    catch (e) { return json({ error: "This backup was changed or made for another site, so it was not restored." }, 409); }
    let added = 0, replaced = 0, skipped = 0;
    for (const d of inner.designs || []) {
      if (!d.design || !Array.isArray(d.design.items)) continue;
      if (!await roomFor(1) && !(/^[A-Za-z0-9]{12}$/.test(d.id || "") && await env.LEADS.prepare("SELECT 1 FROM designs WHERE id = ?1 AND owner = ?2").bind(d.id, owner).first())) { skipped++; continue; }
      const mine = /^[A-Za-z0-9]{12}$/.test(d.id || "") && await env.LEADS.prepare("SELECT id FROM designs WHERE id = ?1 AND owner = ?2").bind(d.id, owner).first();
      const did = mine ? d.id : [...crypto.getRandomValues(new Uint8Array(12))].map(x => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[x % 56]).join("");
      const sl = await seal(key, did, owner, d.design), size = JSON.stringify(d.design).length, name = String(d.name || "Restored label").slice(0, 80);
      if (mine) { await env.LEADS.prepare("UPDATE designs SET name = ?1, iv = ?2, data = ?3, size = ?4, updated = datetime('now') WHERE id = ?5 AND owner = ?6").bind(name, sl.iv, sl.data, size, did, owner).run(); replaced++; }
      else { await env.LEADS.prepare("INSERT INTO designs (id, owner, name, iv, data, size) VALUES (?1,?2,?3,?4,?5,?6)").bind(did, owner, name, sl.iv, sl.data, size).run(); added++; }
    }
    return json({ ok: true, added, replaced, skipped });
  }
  if (id && id !== "backup" && id !== "adopt" && !/^[A-Za-z0-9]{12}$/.test(id)) return json({ error: "Bad design id" }, 400);
  if (!id && m === "GET") {
    const { results } = await env.LEADS.prepare("SELECT id, name, size, updated FROM designs WHERE owner = ?1 ORDER BY updated DESC LIMIT 2000").bind(owner).all();
    return json({ designs: results });
  }
  if (m === "GET" || m === "DELETE") {
    const row = await env.LEADS.prepare("SELECT * FROM designs WHERE id = ?1 AND owner = ?2").bind(id, owner).first();
    if (!row) return json({ error: "Design not found" }, 404);
    if (m === "DELETE") { await env.LEADS.prepare("DELETE FROM designs WHERE id = ?1 AND owner = ?2").bind(id, owner).run(); return json({ ok: true }); }
    try { return json({ id, name: row.name, updated: row.updated, design: await unseal(key, row) }); }
    catch (e) { return json({ error: "This design failed its integrity check and was not opened." }, 409); }
  }
  if (m === "POST" || m === "PUT") {
    const text = await request.text();
    if (text.length > MAX_DESIGN) return json({ error: "Design is too large to save (images make it big: use smaller images)." }, 413);
    let b; try { b = JSON.parse(text); } catch (e) { return json({ error: "Bad JSON" }, 400); }
    if (!b.design || !Array.isArray(b.design.items)) return json({ error: "Not a label design" }, 400);
    const name = String(b.name || "Untitled label").slice(0, 80);
    if (m === "PUT") {
      const ok = await env.LEADS.prepare("SELECT id FROM designs WHERE id = ?1 AND owner = ?2").bind(id, owner).first();
      if (!ok) return json({ error: "Design not found" }, 404);
      const sl = await seal(key, id, owner, b.design);
      await env.LEADS.prepare("UPDATE designs SET name = ?1, iv = ?2, data = ?3, size = ?4, updated = datetime('now') WHERE id = ?5 AND owner = ?6").bind(name, sl.iv, sl.data, text.length, id, owner).run();
      return json({ id, name });
    }
    if (!await roomFor(1)) return full();
    const nid = [...crypto.getRandomValues(new Uint8Array(12))].map(b => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[b % 56]).join("");
    const sl = await seal(key, nid, owner, b.design);
    await env.LEADS.prepare("INSERT INTO designs (id, owner, name, iv, data, size) VALUES (?1,?2,?3,?4,?5,?6)").bind(nid, owner, name, sl.iv, sl.data, text.length).run();
    return json({ id: nid, name });
  }
  return json({ error: "Method not allowed" }, 405);
}


/* ---------- design by prompt: text (or speech) -> label design in the designer's own format ---------- */
const DESIGN_SYSTEM = `You design thermal-printer labels. Reply with JSON only, no prose outside it:
{"reply": "<one short sentence saying what you made or changed>",
 "label": {"w": <label width mm>, "h": <label height mm>, "across": <labels across, default 1>},
 "items": [ ...objects... ]}
All positions and sizes are in millimetres from the label's top-left corner. Every object must sit fully inside the label with at least 1.5 mm margin.
Object types (use only these fields):
- {"type":"text","x","y","h": glyph height mm (min 1.6; headings 4-8),"text","bold"?:bool,"rot"?:0|90|180|270,"curve"?: -360..360 arc degrees,"path"?:"circle"|"ellipse"|"rect"|"star"|"wave","pw"?,"ph"?}
  A text's width is about 0.5 * h * number of characters (condensed bold font); keep it inside the label.
- {"type":"barcode","symbology":"code128"|"gs1-128"|"ean13"|"upca"|"code39"|"qrcode"|"datamatrix","data","x","y","w","h","rot"?}
  Linear barcodes: w at least 25 mm, h 8-20 mm (the human-readable digits print inside h). EAN-13 data = 12 or 13 digits. GS1 data uses (AI) brackets, e.g. (01)08901234567890(17)271231(10)AB12. QR/DataMatrix: square, w = h, at least 12 mm for QR.
  A contact-card QR: {"type":"barcode","symbology":"qrcode","qrKind":"contact","contact":{"name","org","title","tel","email","url","adr"},"x","y","w","h"}
- {"type":"line","x","y","w","h","thickness"}: horizontal line has h = thickness (0.3-0.6), vertical has w = thickness.
- {"type":"box","x","y","w","h","thickness"}
- {"type":"shape","kind":"rect"|"round"|"ellipse"|"triangle"|"diamond"|"hexagon"|"star","x","y","w","h","thickness","fill":bool,"text","align":"center"} (text inside a shape is wrapped and sized automatically; thickness 0 hides the outline)
Optional on any object: "color": "#rrggbb" (only if the user asks for colour).
Good layout: clear hierarchy (one large heading), aligned left edges, consistent gaps, nothing overlapping.
For retail packs sold in India follow the Legal Metrology (Packaged Commodities) Rules when relevant: name and address of manufacturer/packer, commodity name, net quantity, month and year of manufacture, MRP "inclusive of all taxes", consumer care details; letters at least 1.5 mm on small labels. Use realistic placeholder values when the user gives none, and never invent real company names, GTINs or licence numbers; use obvious placeholders like 8901234567890.
When a current design is given, apply the user's change to it and return the complete updated design (keep objects the user did not mention, unchanged).`;
async function geminiText(env, model, system, prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } } }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error && j.error.message || ""}`);
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  return parts.filter(p => p.text && !p.thought).map(p => p.text).join("");
}
async function designAIRun(request, env) {
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!env.GEMINI_API_KEY) return json({ error: "AI is not set up on this site" }, 503);
  if (env.LIMITER) { const { success } = await env.LIMITER.limit({ key: request.headers.get("cf-connecting-ip") || "anon" }); if (!success) return json({ error: "Too many requests; wait a minute." }, 429); }
  let b; try { b = await request.json(); } catch (e) { return json({ error: "Bad JSON" }, 400); }
  const ask = String(b.prompt || "").trim().slice(0, 2000); if (!ask) return json({ error: "Say what label you want" }, 400);
  const cur = b.design ? JSON.stringify(b.design).slice(0, 30000) : "";
  const prompt = (cur ? `Current design (label ${b.design.label ? JSON.stringify(b.design.label) : ""}):\n${cur}\n\n` : "") + `Printer: ${b.printer || "203 dpi thermal"}.\nRequest: ${ask}`;
  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    try {
      const out = extractJSON(await geminiText(env, model, DESIGN_SYSTEM, prompt));
      if (out && Array.isArray(out.items)) return json(Object.assign(out, { model }));
      lastErr = "The AI reply was not a design";
    } catch (e) { lastErr = e.message; }
  }
  return json({ error: "AI could not design that just now: " + lastErr.slice(0, 160) }, 502);
}

// AI is counted per company: sign-in required, monthly allowance by plan (see auth.js PLANS).
async function aiCounted(request, env, run) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!env.DESIGN_KEY) return run(request, env); // sign-in not switched on yet: AI stays open, limited per IP as before
  let g; try { g = await aiGate(env, request); } catch (e) { g = { error: "Sign-in is being set up; AI is not available yet.", status: 503 }; }
  if (!g.ok) return json({ error: g.error, signin: g.status === 401, quota: g.status === 402 }, g.status);
  const r = await run(request, env);
  if (r.status !== 200) return r;
  await g.count();
  const h = new Headers(r.headers); h.set("x-ai-left", String(g.left));
  return new Response(r.body, { status: 200, headers: h });
}
const pic2label = (r, e) => aiCounted(r, e, pic2labelRun);
const designAI = (r, e) => aiCounted(r, e, designAIRun);

// QZ Tray (local print helper): hand out LabelDesk's certificate and sign print requests with its key,
// so QZ Tray prints without asking. Secrets QZ_CERT (PEM) and QZ_PRIVATE_KEY (PKCS#8 PEM) come from QZ Industries.
async function qzTray(request, env, url) {
  if (url.pathname === "/api/qz/cert") return new Response(env.QZ_CERT || "", { status: env.QZ_CERT ? 200 : 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  if (url.pathname !== "/api/qz/sign" || request.method !== "POST" || request.headers.get("x-ld") !== "1") return json({ error: "Bad request" }, 400);
  if (!env.QZ_PRIVATE_KEY) return json({ signature: "" });
  if (env.DESIGN_KEY) { let sc = null; try { sc = await scope(env, request); } catch (e) {} if (!sc) return json({ error: "Please sign in." }, 401); }
  let b; try { b = await request.json(); } catch (e) { return json({ error: "Bad JSON" }, 400); }
  const msg = String(b.request || ""); if (!msg || msg.length > 200000) return json({ error: "Nothing to sign" }, 400);
  const der = Uint8Array.from(atob(env.QZ_PRIVATE_KEY.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }, false, ["sign"]);
  return json({ signature: b64e(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(msg))) });
}

const APP_HOST = "labeldesk.app", OLD_HOST = "labels.infinitesolutions.co.in";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // LabelDesk lives on labeldesk.app. www goes to the bare domain. The old address sends every
    // page except the app itself (which carries the browser's workspace key across) and the API.
    if (url.hostname === "www." + APP_HOST) return Response.redirect(`https://${APP_HOST}${url.pathname}${url.search}`, 301);
    if (url.hostname === OLD_HOST && !url.pathname.startsWith("/api/") && url.pathname !== "/" && url.pathname !== "/index.html")
      return Response.redirect(`https://${APP_HOST}${url.pathname}${url.search}`, 301);
    if (url.pathname === "/api/pic2label") return pic2label(request, env);
    if (url.pathname === "/api/lead") return saveLead(request, env);
    if (url.pathname === "/api/leads") return listLeads(request, env);
    if (url.pathname === "/api/design-ai") return designAI(request, env);
    if (url.pathname === "/api/designs" || url.pathname.startsWith("/api/designs/")) return designs(request, env, url);
    if (url.pathname.startsWith("/api/qz/")) return qzTray(request, env, url);
    if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/company") || url.pathname.startsWith("/api/admin/")) return accounts(request, env, url);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
