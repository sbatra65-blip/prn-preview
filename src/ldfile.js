// LabelDesk label file (.ldl): the browser gzips the design and the server seals it with AES-256-GCM.
// The key comes from DESIGN_KEY and never leaves the Worker, so a .ldl can only be opened by LabelDesk.
// The additional data binds the readable header (name, printer, size…) to the sealed part: editing either
// makes the file refuse to open. A file can also be locked to one company: then only signed-in members open it.
import { scope, sha256hex } from "./auth.js";

const enc = new TextEncoder();
const b64e = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const J = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX = 30_000_000;

async function fileKey(env) {
  if (!env.DESIGN_KEY || env.DESIGN_KEY.length < 16) return null;
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("ld-file-v1:" + env.DESIGN_KEY)), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function ldfile(request, env, url) {
  if (request.method !== "POST" || request.headers.get("x-ld") !== "1") return J({ error: "Bad request" }, 400);
  const key = await fileKey(env); if (!key) return J({ error: "LabelDesk files need the server key (DESIGN_KEY secret) to be set." }, 503);
  const text = await request.text(); if (text.length > MAX) return J({ error: "This label is too large to save as one file." }, 413);
  let b; try { b = JSON.parse(text); } catch (e) { return J({ error: "Bad JSON" }, 400); }
  const head = String(b.head || ""); if (!head || head.length > 20000) return J({ error: "Missing file header" }, 400);
  let h; try { h = JSON.parse(head); } catch (e) { return J({ error: "Damaged file header" }, 400); }
  let cid = "";
  if (h.lock === "company") {
    const sc = await scope(env, request).catch(() => null);
    if (url.pathname === "/api/ldl/seal") { if (!sc) return J({ error: "Sign in and open a company to lock a file to it." }, 401); if (sc.cid !== h.cid) return J({ error: "The file header names another company." }, 400); }
    else if (!sc || sc.cid !== h.cid) return J({ error: `This label file is locked to ${h.company || "another company"}. Sign in to that company in LabelDesk to open it.`, signin: !sc }, 403);
    cid = h.cid;
  }
  const aad = enc.encode("ldl1|" + await sha256hex(head) + "|" + cid);
  if (url.pathname === "/api/ldl/seal") {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, b64d(String(b.payload || "")));
    return J({ iv: b64e(iv), data: b64e(ct) });
  }
  if (url.pathname === "/api/ldl/open") {
    try { const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(String(b.iv || "")), additionalData: aad }, key, b64d(String(b.data || ""))); return J({ payload: b64e(pt) }); }
    catch (e) { return J({ error: "This label file was changed, damaged, or made by another LabelDesk server, so it was not opened." }, 409); }
  }
  return J({ error: "Not found" }, 404);
}
