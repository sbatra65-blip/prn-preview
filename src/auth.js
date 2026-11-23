// LabelDesk accounts: sign-up, password + authenticator-app two-factor (TOTP), sessions,
// companies (code + name), roles, invites, plans and licence keys, plus the owner's admin API.
//
// Security notes
// - Passwords: PBKDF2-SHA256, 100,000 rounds, 16-byte salt per user.
// - 2FA secrets: AES-256-GCM with a key derived from the DESIGN_KEY secret, bound to the user id.
// - Sessions: random 256-bit token in an HttpOnly, Secure, SameSite=Lax cookie; only its SHA-256 is stored.
//   A password-only session can do nothing but finish 2FA (10 minutes). Full sessions last 7 days.
// - Every state-changing call must carry the header "x-ld: 1" (a cross-site form or image cannot add it).
// - 5 wrong passwords or codes lock the account for 15 minutes; requests are also rate-limited per IP.
// - Backup codes are stored as hashes and work once each. A TOTP code cannot be reused.

const enc = new TextEncoder(), dec = new TextDecoder();
const now = () => Math.floor(Date.now() / 1000);
const b64e = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64u = buf => b64e(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const rid = (n = 16) => b64u(rand(n));
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const pick = n => [...rand(n)].map(x => ALNUM[x % ALNUM.length]).join("");
export async function sha256hex(t) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(t)))].map(b => b.toString(16).padStart(2, "0")).join(""); }
function same(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const today = (addDays = 0) => new Date(Date.now() + addDays * 864e5).toISOString().slice(0, 10);
function addMonths(iso, m) { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); }

const COOKIE = "ld_s";
const FULL_TTL = 7 * 86400, TWOFA_TTL = 600, SETUP_TTL = 1800;
const ROLES = ["owner", "admin", "designer", "approver", "printer"];
export const CAN_EDIT = ["owner", "admin", "designer"];
const MANAGE = ["owner", "admin"];

// Plans: users and printers allowed, designs kept (0 = unlimited), AI labels per calendar month.
// A lapsed licence falls back to Free. The 14-day trial gets Business limits but TRIAL_AI AI labels in total.
export const PLANS = {
  free: { name: "Free", users: 1, printers: 1, designs: 3, ai: 10 },
  starter: { name: "Starter", users: 2, printers: 1, designs: 0, ai: 100 },
  business: { name: "Business", users: 10, printers: 5, designs: 0, ai: 500 },
  automation: { name: "Automation", users: 25, printers: 15, designs: 0, ai: 2000 },
  enterprise: { name: "Enterprise", users: 500, printers: 500, designs: 0, ai: 10000 },
};
export const TRIAL_AI = 50;
const month = () => new Date().toISOString().slice(0, 7);
export function planOf(co) {
  const live = co.plan && co.plan !== "free" && co.valid_until && co.valid_until >= today();
  const key = live ? co.plan : "free", p = PLANS[key] || PLANS.free;
  return { key, name: p.name + (live && co.trial ? " trial" : ""), users: live && co.users_max ? co.users_max : p.users, printers: live && co.printers_max ? co.printers_max : p.printers,
    designs: p.designs, ai: live && co.trial ? TRIAL_AI : p.ai, trial: !!(live && co.trial), valid_until: co.plan === "free" ? null : co.valid_until, lapsed: !!(co.plan && co.plan !== "free" && !live), bought: co.plan };
}

function J(body, status = 200, cookie) {
  const h = { "content-type": "application/json", "cache-control": "no-store" };
  if (cookie) h["set-cookie"] = cookie;
  return new Response(JSON.stringify(body), { status, headers: h });
}
const setCookie = (tok, age) => `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const ipOf = r => r.headers.get("cf-connecting-ip") || "local";

/* ---------- crypto helpers ---------- */
async function secretKey(env) {
  if (!env.DESIGN_KEY || env.DESIGN_KEY.length < 16) return null;
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("ld-auth-v1:" + env.DESIGN_KEY)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function sealSecret(key, uid, bytes) { const iv = rand(12); return b64e(iv) + "." + b64e(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode("totp|" + uid) }, key, bytes)); }
async function openSecret(key, uid, s) { const [iv, ct] = s.split("."); return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(iv), additionalData: enc.encode("totp|" + uid) }, key, b64d(ct))); }
async function pwHash(pw, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return b64e(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, k, 256));
}
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32(bytes) { let bits = 0, val = 0, out = ""; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
async function hotp(secret, counter) {
  const k = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8), dv = new DataView(msg); dv.setUint32(0, Math.floor(counter / 2 ** 32)); dv.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg)), o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}
async function totpStep(secret, code, lastStep) {
  const t = Math.floor(now() / 30);
  for (const d of [-1, 0, 1]) if (t + d > (lastStep || 0) && same(await hotp(secret, t + d), code)) return t + d;
  return 0;
}
async function newBackup() {
  const codes = Array.from({ length: 10 }, () => pick(4) + "-" + pick(4));
  return { codes, stored: JSON.stringify(await Promise.all(codes.map(c => sha256hex("bk:" + c)))) };
}

/* ---------- sessions ---------- */
function cookieTok(req) { const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)ld_s=([A-Za-z0-9_-]{20,80})/); return m ? m[1] : ""; }
async function startSession(env, req, uid, stage, ttl, cid = null) {
  const tok = rid(32), t = now();
  await env.LEADS.prepare("INSERT INTO sessions (id, user_id, stage, company_id, created, expires, ip, ua) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)")
    .bind(await sha256hex("s:" + tok), uid, stage, cid, t, t + ttl, ipOf(req), (req.headers.get("user-agent") || "").slice(0, 160)).run();
  return setCookie(tok, ttl);
}
export async function session(env, req) {
  const tok = cookieTok(req); if (!tok || !env.LEADS) return null;
  const sid = await sha256hex("s:" + tok);
  const s = await env.LEADS.prepare("SELECT s.id, s.user_id, s.stage, s.company_id, s.expires, u.email, u.name, u.totp_on FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1").bind(sid).first();
  if (!s) return null;
  if (s.expires < now()) { await env.LEADS.prepare("DELETE FROM sessions WHERE id = ?1").bind(sid).run(); return null; }
  return s;
}
// For other modules: the signed-in company and role, or null.
export async function scope(env, req) {
  const s = await session(env, req);
  if (!s || s.stage !== "full" || !s.company_id) return null;
  const m = await env.LEADS.prepare("SELECT m.role, c.* FROM members m JOIN companies c ON c.id = m.company_id WHERE m.company_id = ?1 AND m.user_id = ?2").bind(s.company_id, s.user_id).first();
  if (!m) return null;
  return { uid: s.user_id, cid: s.company_id, role: m.role, plan: planOf(m), owner: "co:" + s.company_id, csrf: req.headers.get("x-ld") === "1" };
}
async function audit(env, req, cid, uid, action, detail = "") {
  try { await env.LEADS.prepare("INSERT INTO audit (company_id, user_id, action, detail, ip) VALUES (?1,?2,?3,?4,?5)").bind(cid, uid, action, String(detail).slice(0, 300), ipOf(req)).run(); } catch (e) {}
}
async function limited(env, req, what) {
  if (!env.AUTH_LIMITER) return false;
  const { success } = await env.AUTH_LIMITER.limit({ key: what + ":" + ipOf(req) });
  return !success;
}
async function fail(env, u) {
  const f = (u.fails || 0) + 1, lock = f >= 5 ? now() + 900 : 0;
  await env.LEADS.prepare("UPDATE users SET fails = ?1, locked_until = ?2 WHERE id = ?3").bind(lock ? 0 : f, lock, u.id).run();
  return lock;
}
const lockedMsg = u => `Too many wrong tries. This account is locked for ${Math.max(1, Math.ceil((u.locked_until - now()) / 60))} more minute(s).`;

async function companyInfo(env, cid, role) {
  const c = await env.LEADS.prepare("SELECT * FROM companies WHERE id = ?1").bind(cid).first();
  if (!c) return null;
  return { id: c.id, code: c.code, name: c.name, gstin: c.gstin || "", role, plan: planOf(c), ai: await aiUsage(env, c) };
}
// AI labels: monthly count per company (the trial counts its whole 14 days as one allowance).
async function aiUsage(env, co) {
  const pl = planOf(co), period = pl.trial ? "trial" : month();
  const r = await env.LEADS.prepare("SELECT n FROM ai_usage WHERE company_id = ?1 AND period = ?2").bind(co.id, period).first();
  const used = r ? r.n : 0;
  return { used, limit: pl.ai, left: Math.max(0, pl.ai - used), period: pl.trial ? "trial" : "month" };
}
// Called by the AI endpoints: null if allowed, else the reason. count() records one use after success.
export async function aiGate(env, req) {
  const sc = await scope(env, req);
  if (!sc) return { error: "Sign in at labeldesk.app to use AI. A free account includes 10 AI labels a month; new companies get 50 in their 14-day trial.", status: 401 };
  const co = await env.LEADS.prepare("SELECT * FROM companies WHERE id = ?1").bind(sc.cid).first(), u = await aiUsage(env, co);
  if (u.left <= 0) return { error: `You have used all ${u.limit} AI labels ${u.period === "trial" ? "in your trial" : "for this month"}. Add a licence for more, or keep designing by hand.`, status: 402 };
  const period = planOf(co).trial ? "trial" : month();
  return { ok: true, count: () => env.LEADS.prepare("INSERT INTO ai_usage (company_id, period, n) VALUES (?1,?2,1) ON CONFLICT(company_id, period) DO UPDATE SET n = n + 1").bind(sc.cid, period).run(), left: u.left - 1 };
}
async function companiesOf(env, uid) {
  const { results } = await env.LEADS.prepare("SELECT c.id, c.code, c.name, c.plan, c.valid_until, c.trial, m.role FROM members m JOIN companies c ON c.id = m.company_id WHERE m.user_id = ?1 ORDER BY c.name").bind(uid).all();
  return results.map(c => ({ id: c.id, code: c.code, name: c.name, role: c.role, plan: planOf(c).name }));
}
async function selectCompany(env, s, cid) {
  const m = await env.LEADS.prepare("SELECT role FROM members WHERE company_id = ?1 AND user_id = ?2").bind(cid, s.user_id).first();
  if (!m) return null;
  await env.LEADS.batch([
    env.LEADS.prepare("UPDATE sessions SET company_id = ?1 WHERE id = ?2").bind(cid, s.id),
    env.LEADS.prepare("UPDATE users SET last_company = ?1 WHERE id = ?2").bind(cid, s.user_id),
  ]);
  return companyInfo(env, cid, m.role);
}
const cleanCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
async function uniqueCode(env, name) {
  const base = (cleanCode(name).replace(/[0-9]/g, "") || "CO").slice(0, 4).padEnd(3, "X");
  for (let i = 0; i < 20; i++) {
    const c = base + String(1 + Math.floor(Math.random() * 98)).padStart(2, "0");
    if (!await env.LEADS.prepare("SELECT 1 FROM companies WHERE code = ?1").bind(c).first()) return c;
  }
  return base + pick(4);
}
const licNorm = k => String(k || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const isAdmin = (req, env) => { const k = req.headers.get("x-admin-key") || ""; return !!env.ADMIN_KEY && k.length >= 12 && same(k, env.ADMIN_KEY); };

/* ---------- the API ---------- */
export async function accounts(request, env, url) {
  if (!env.LEADS) return J({ error: "Accounts are not set up (database missing)." }, 503);
  const p = url.pathname, m = request.method;
  if (m !== "GET" && request.headers.get("x-ld") !== "1") return J({ error: "Bad request" }, 400);
  let b = {};
  if (m === "POST") { try { b = await request.json(); } catch (e) { b = {}; } }

  /* ----- owner's admin API (ADMIN_KEY) ----- */
  if (p.startsWith("/api/admin/")) {
    if (!env.ADMIN_KEY) return J({ error: "Set the ADMIN_KEY secret on the Worker first." }, 503);
    if (!isAdmin(request, env)) return J({ error: "Wrong admin key" }, 401);
    if (p === "/api/admin/companies" && m === "GET") {
      const { results } = await env.LEADS.prepare(`SELECT c.*, (SELECT COUNT(*) FROM members WHERE company_id = c.id) AS users,
        (SELECT COUNT(*) FROM designs WHERE owner = 'co:' || c.id) AS designs,
        (SELECT u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.company_id = c.id AND m.role = 'owner' LIMIT 1) AS owner_email
        FROM companies c ORDER BY c.created DESC LIMIT 1000`).all();
      return J({ companies: results.map(c => Object.assign(c, { effective: planOf(c) })) });
    }
    if (p === "/api/admin/company" && m === "POST") {
      const c = await env.LEADS.prepare("SELECT id FROM companies WHERE id = ?1 OR code = ?2").bind(String(b.id || ""), cleanCode(b.code)).first();
      if (!c) return J({ error: "Company not found" }, 404);
      if (b.plan && !PLANS[b.plan]) return J({ error: "Unknown plan" }, 400);
      if (b.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(b.valid_until)) return J({ error: "Date must be YYYY-MM-DD" }, 400);
      await env.LEADS.prepare("UPDATE companies SET plan = COALESCE(?1, plan), valid_until = COALESCE(?2, valid_until), users_max = ?3, printers_max = ?4, trial = 0 WHERE id = ?5")
        .bind(b.plan || null, b.valid_until || null, Number(b.users_max) || null, Number(b.printers_max) || null, c.id).run();
      return J({ ok: true });
    }
    if (p === "/api/admin/licences" && m === "POST") {
      if (!PLANS[b.plan] || b.plan === "free") return J({ error: "Pick a paid plan" }, 400);
      const months = Math.max(1, Math.min(60, Number(b.months) || 12)), count = Math.max(1, Math.min(50, Number(b.count) || 1));
      const keys = [], stmts = [];
      for (let i = 0; i < count; i++) {
        const raw = pick(20), key = "LD-" + raw.match(/.{5}/g).join("-");
        keys.push(key);
        stmts.push(env.LEADS.prepare("INSERT INTO licences (id, hint, plan, months, users_max, printers_max, note) VALUES (?1,?2,?3,?4,?5,?6,?7)")
          .bind(await sha256hex("lic:" + "LD" + raw), raw.slice(-5), b.plan, months, Number(b.users_max) || null, Number(b.printers_max) || null, String(b.note || "").slice(0, 120)));
      }
      await env.LEADS.batch(stmts);
      return J({ keys, plan: b.plan, months });
    }
    if (p === "/api/admin/licences" && m === "GET") {
      const { results } = await env.LEADS.prepare("SELECT l.hint, l.plan, l.months, l.users_max, l.printers_max, l.note, l.created, l.redeemed_at, c.code AS company_code, c.name AS company_name FROM licences l LEFT JOIN companies c ON c.id = l.company_id ORDER BY l.created DESC LIMIT 1000").all();
      return J({ licences: results });
    }
    return J({ error: "Not found" }, 404);
  }

  const key = await secretKey(env);
  if (!key) return J({ error: "Sign-in is not switched on yet: add the DESIGN_KEY secret to the Worker." }, 503);

  /* ----- not signed in ----- */
  if (p === "/api/auth/signup" && m === "POST") {
    if (await limited(env, request, "signup")) return J({ error: "Too many tries; wait a minute." }, 429);
    const email = String(b.email || "").trim().toLowerCase(), name = String(b.name || "").trim().slice(0, 80), pw = String(b.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return J({ error: "Enter a valid email address." }, 400);
    if (!name) return J({ error: "Enter your name." }, 400);
    if (pw.length < 10 || /^\d+$/.test(pw) || pw.toLowerCase().includes(email.split("@")[0])) return J({ error: "Use a password of at least 10 characters that is not just numbers or your email name." }, 400);
    if (await env.LEADS.prepare("SELECT 1 FROM users WHERE email = ?1").bind(email).first()) return J({ error: "An account with this email already exists. Sign in instead." }, 409);
    const uid = rid(12), salt = rand(16);
    await env.LEADS.prepare("INSERT INTO users (id, email, name, pw, salt) VALUES (?1,?2,?3,?4,?5)").bind(uid, email, name, await pwHash(pw, salt), b64e(salt)).run();
    return J({ next: "setup" }, 200, await startSession(env, request, uid, "setup", SETUP_TTL));
  }
  if (p === "/api/auth/login" && m === "POST") {
    if (await limited(env, request, "login")) return J({ error: "Too many tries; wait a minute." }, 429);
    const email = String(b.email || "").trim().toLowerCase(), pw = String(b.password || "");
    const u = await env.LEADS.prepare("SELECT * FROM users WHERE email = ?1").bind(email).first();
    if (!u) { await pwHash(pw, rand(16)); return J({ error: "Wrong email or password." }, 401); }
    if (u.locked_until > now()) return J({ error: lockedMsg(u) }, 423);
    if (!same(await pwHash(pw, b64d(u.salt)), u.pw)) { const l = await fail(env, u); return J({ error: l ? lockedMsg({ locked_until: l }) : "Wrong email or password." }, l ? 423 : 401); }
    await env.LEADS.prepare("UPDATE users SET fails = 0 WHERE id = ?1").bind(u.id).run();
    if (u.totp_on) return J({ next: "2fa" }, 200, await startSession(env, request, u.id, "2fa", TWOFA_TTL));
    return J({ next: "setup" }, 200, await startSession(env, request, u.id, "setup", SETUP_TTL));
  }

  const s = await session(env, request);
  if (p === "/api/auth/me") {
    if (!s) return J({ signedIn: false });
    const out = { signedIn: true, stage: s.stage, user: { email: s.email, name: s.name } };
    if (s.stage === "full") {
      out.companies = await companiesOf(env, s.user_id);
      if (s.company_id) { const r = out.companies.find(c => c.id === s.company_id); if (r) out.company = await companyInfo(env, s.company_id, r.role); }
    }
    return J(out);
  }
  if (p === "/api/auth/logout" && m === "POST") {
    if (s) { await env.LEADS.prepare("DELETE FROM sessions WHERE id = ?1").bind(s.id).run(); if (s.company_id) await audit(env, request, s.company_id, s.user_id, "sign-out"); }
    return J({ ok: true }, 200, clearCookie());
  }
  if (!s) return J({ error: "Please sign in.", signin: true }, 401);

  /* ----- 2FA set-up (right after sign-up, or a login without 2FA) ----- */
  if (p === "/api/auth/2fa/setup" && m === "POST") {
    if (s.stage !== "setup") return J({ error: "Two-factor is already set up." }, 400);
    const sec = rand(20);
    await env.LEADS.prepare("UPDATE users SET totp = ?1, totp_on = 0 WHERE id = ?2").bind(await sealSecret(key, s.user_id, sec), s.user_id).run();
    const label = encodeURIComponent("LabelDesk:" + s.email);
    return J({ secret: b32(sec), uri: `otpauth://totp/${label}?secret=${b32(sec)}&issuer=LabelDesk&algorithm=SHA1&digits=6&period=30` });
  }
  if (p === "/api/auth/2fa/enable" && m === "POST") {
    if (s.stage !== "setup") return J({ error: "Two-factor is already set up." }, 400);
    if (await limited(env, request, "2fa")) return J({ error: "Too many tries; wait a minute." }, 429);
    const u = await env.LEADS.prepare("SELECT * FROM users WHERE id = ?1").bind(s.user_id).first();
    if (!u.totp) return J({ error: "Start the set-up again." }, 400);
    const step = await totpStep(await openSecret(key, u.id, u.totp), String(b.code || "").replace(/\D/g, ""), 0);
    if (!step) return J({ error: "That code did not match. Check the time on your phone and try the newest code." }, 401);
    const bk = await newBackup();
    await env.LEADS.batch([
      env.LEADS.prepare("UPDATE users SET totp_on = 1, last_step = ?1, backup = ?2, fails = 0, last_login = datetime('now') WHERE id = ?3").bind(step, bk.stored, u.id),
      env.LEADS.prepare("DELETE FROM sessions WHERE id = ?1").bind(s.id),
    ]);
    return J({ backup: bk.codes, next: "company" }, 200, await startSession(env, request, u.id, "full", FULL_TTL));
  }
  if (p === "/api/auth/2fa" && m === "POST") {
    if (s.stage !== "2fa") return J({ error: "Sign in again." }, 400);
    if (await limited(env, request, "2fa")) return J({ error: "Too many tries; wait a minute." }, 429);
    const u = await env.LEADS.prepare("SELECT * FROM users WHERE id = ?1").bind(s.user_id).first();
    if (u.locked_until > now()) return J({ error: lockedMsg(u) }, 423);
    const raw = String(b.code || "").trim().toUpperCase();
    let ok = false, step = u.last_step, backup = u.backup, usedBackup = false;
    if (/^\d{6}$/.test(raw.replace(/\s/g, ""))) { const st = await totpStep(await openSecret(key, u.id, u.totp), raw.replace(/\s/g, ""), u.last_step); if (st) { ok = true; step = st; } }
    else if (/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(raw)) {
      const h = await sha256hex("bk:" + raw.replace("-", "").replace(/^(.{4})/, "$1-")), list = JSON.parse(u.backup || "[]"), i = list.indexOf(h);
      if (i >= 0) { list.splice(i, 1); backup = JSON.stringify(list); ok = true; usedBackup = true; }
    }
    if (!ok) { const l = await fail(env, u); return J({ error: l ? lockedMsg({ locked_until: l }) : "That code did not match." }, l ? 423 : 401); }
    await env.LEADS.batch([
      env.LEADS.prepare("UPDATE users SET fails = 0, last_step = ?1, backup = ?2, last_login = datetime('now') WHERE id = ?3").bind(step, backup, u.id),
      env.LEADS.prepare("DELETE FROM sessions WHERE id = ?1").bind(s.id),
    ]);
    // reopen the company used last time, if the user still belongs to it
    let cid = null;
    if (u.last_company && await env.LEADS.prepare("SELECT 1 FROM members WHERE company_id = ?1 AND user_id = ?2").bind(u.last_company, u.id).first()) cid = u.last_company;
    if (cid) await audit(env, request, cid, u.id, "sign-in", usedBackup ? "with a backup code" : "");
    const left = usedBackup ? JSON.parse(backup).length : null;
    return J({ next: "company", backupLeft: left }, 200, await startSession(env, request, u.id, "full", FULL_TTL, cid));
  }
  if (s.stage !== "full") return J({ error: "Finish two-factor sign-in first.", signin: true }, 401);

  /* ----- signed in: companies ----- */
  if (p === "/api/auth/select" && m === "POST") {
    const info = await selectCompany(env, s, String(b.id || ""));
    if (!info) return J({ error: "You are not a member of that company." }, 403);
    await audit(env, request, info.id, s.user_id, "open company");
    return J({ company: info });
  }
  if (p === "/api/auth/companies" && m === "POST") {
    const name = String(b.name || "").trim().slice(0, 80); if (name.length < 2) return J({ error: "Enter the company name." }, 400);
    const own = await env.LEADS.prepare("SELECT COUNT(*) AS n FROM members WHERE user_id = ?1 AND role = 'owner'").bind(s.user_id).first();
    if (own.n >= 10) return J({ error: "You already own 10 companies. Ask us to raise the limit." }, 403);
    let code = cleanCode(b.code);
    if (code) { if (code.length < 3) return J({ error: "Company code needs 3 to 12 letters or digits." }, 400); if (await env.LEADS.prepare("SELECT 1 FROM companies WHERE code = ?1").bind(code).first()) return J({ error: `Company code ${code} is taken. Try another.` }, 409); }
    else code = await uniqueCode(env, name);
    const gstin = String(b.gstin || "").toUpperCase().replace(/\s/g, "").slice(0, 15);
    if (gstin && !/^\d{2}[A-Z0-9]{13}$/.test(gstin)) return J({ error: "GSTIN should be 15 characters, starting with the 2-digit state code." }, 400);
    const cid = rid(9);
    await env.LEADS.batch([
      env.LEADS.prepare("INSERT INTO companies (id, code, name, gstin, plan, valid_until, trial, created_by) VALUES (?1,?2,?3,?4,'business',?5,1,?6)").bind(cid, code, name, gstin || null, today(14), s.user_id),
      env.LEADS.prepare("INSERT INTO members (company_id, user_id, role) VALUES (?1,?2,'owner')").bind(cid, s.user_id),
    ]);
    await audit(env, request, cid, s.user_id, "company created", code + " " + name);
    return J({ company: await selectCompany(env, s, cid) });
  }
  if (p === "/api/auth/join" && m === "POST") {
    const inv = await env.LEADS.prepare("SELECT * FROM invites WHERE id = ?1").bind(await sha256hex("inv:" + String(b.token || ""))).first();
    if (!inv || inv.used || inv.expires < now()) return J({ error: "This invite has expired or was already used. Ask for a new one." }, 404);
    if (inv.email && inv.email !== s.email) return J({ error: `This invite is for ${inv.email}. Sign in with that email.` }, 403);
    const co = await env.LEADS.prepare("SELECT * FROM companies WHERE id = ?1").bind(inv.company_id).first();
    const have = await env.LEADS.prepare("SELECT COUNT(*) AS n FROM members WHERE company_id = ?1").bind(co.id).first();
    const already = await env.LEADS.prepare("SELECT 1 FROM members WHERE company_id = ?1 AND user_id = ?2").bind(co.id, s.user_id).first();
    if (!already && have.n >= planOf(co).users) return J({ error: `${co.name} has used all ${planOf(co).users} user places on its plan. Ask its owner to upgrade.` }, 402);
    await env.LEADS.batch([
      env.LEADS.prepare("INSERT OR IGNORE INTO members (company_id, user_id, role) VALUES (?1,?2,?3)").bind(co.id, s.user_id, inv.role),
      env.LEADS.prepare("UPDATE invites SET used = 1 WHERE id = ?1").bind(inv.id),
    ]);
    await audit(env, request, co.id, s.user_id, "joined", inv.role);
    return J({ company: await selectCompany(env, s, co.id) });
  }
  if (p === "/api/auth/password" && m === "POST") {
    const u = await env.LEADS.prepare("SELECT * FROM users WHERE id = ?1").bind(s.user_id).first(), nw = String(b.new || "");
    if (!same(await pwHash(String(b.old || ""), b64d(u.salt)), u.pw)) { await fail(env, u); return J({ error: "Your current password is wrong." }, 401); }
    if (nw.length < 10 || /^\d+$/.test(nw)) return J({ error: "Use at least 10 characters, not just numbers." }, 400);
    const salt = rand(16);
    await env.LEADS.batch([
      env.LEADS.prepare("UPDATE users SET pw = ?1, salt = ?2, fails = 0 WHERE id = ?3").bind(await pwHash(nw, salt), b64e(salt), u.id),
      env.LEADS.prepare("DELETE FROM sessions WHERE user_id = ?1 AND id != ?2").bind(u.id, s.id),
    ]);
    if (s.company_id) await audit(env, request, s.company_id, u.id, "password changed");
    return J({ ok: true });
  }
  if (p === "/api/auth/backup" && m === "POST") {
    const u = await env.LEADS.prepare("SELECT * FROM users WHERE id = ?1").bind(s.user_id).first();
    const st = await totpStep(await openSecret(key, u.id, u.totp), String(b.code || "").replace(/\D/g, ""), u.last_step);
    if (!st) { await fail(env, u); return J({ error: "That authenticator code did not match." }, 401); }
    const bk = await newBackup();
    await env.LEADS.prepare("UPDATE users SET backup = ?1, last_step = ?2 WHERE id = ?3").bind(bk.stored, st, u.id).run();
    return J({ backup: bk.codes });
  }

  /* ----- the open company ----- */
  if (!p.startsWith("/api/company")) return J({ error: "Not found" }, 404);
  if (!s.company_id) return J({ error: "Pick a company first." }, 400);
  const me = await env.LEADS.prepare("SELECT role FROM members WHERE company_id = ?1 AND user_id = ?2").bind(s.company_id, s.user_id).first();
  if (!me) return J({ error: "You are no longer a member of this company." }, 403);
  const cid = s.company_id, manage = MANAGE.includes(me.role);
  const co = await env.LEADS.prepare("SELECT * FROM companies WHERE id = ?1").bind(cid).first();

  if (p === "/api/company" && m === "GET") {
    const [mem, dz, lic] = await env.LEADS.batch([
      env.LEADS.prepare("SELECT u.id, u.email, u.name, m.role, m.created, u.last_login FROM members m JOIN users u ON u.id = m.user_id WHERE m.company_id = ?1 ORDER BY m.created").bind(cid),
      env.LEADS.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS bytes FROM designs WHERE owner = ?1").bind("co:" + cid),
      env.LEADS.prepare("SELECT hint, plan, months, redeemed_at FROM licences WHERE company_id = ?1 ORDER BY redeemed_at DESC").bind(cid),
    ]);
    return J({ company: await companyInfo(env, cid, me.role), me: s.user_id, members: mem.results, usage: { designs: dz.results[0].n, bytes: dz.results[0].bytes, users: mem.results.length }, licences: lic.results });
  }
  if (p === "/api/company/audit" && m === "GET") {
    if (!manage) return J({ error: "Only the owner or an admin can see the activity log." }, 403);
    const { results } = await env.LEADS.prepare("SELECT a.at, a.action, a.detail, a.ip, u.email FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.company_id = ?1 ORDER BY a.id DESC LIMIT 200").bind(cid).all();
    return J({ audit: results });
  }
  if (m !== "POST") return J({ error: "Not found" }, 404);
  if (p === "/api/company/redeem") {
    if (!manage) return J({ error: "Only the owner or an admin can add a licence." }, 403);
    if (await limited(env, request, "lic")) return J({ error: "Too many tries; wait a minute." }, 429);
    const n = licNorm(b.key); if (!/^LD[A-Z0-9]{20}$/.test(n)) return J({ error: "Licence keys look like LD-XXXXX-XXXXX-XXXXX-XXXXX." }, 400);
    const lic = await env.LEADS.prepare("SELECT * FROM licences WHERE id = ?1").bind(await sha256hex("lic:" + n)).first();
    if (!lic) return J({ error: "That licence key was not found." }, 404);
    if (lic.company_id) return J({ error: "That licence key has already been used." }, 409);
    const cur = planOf(co), base = !cur.lapsed && co.plan === lic.plan && !co.trial && co.valid_until > today() ? co.valid_until : today();
    const until = addMonths(base, lic.months);
    await env.LEADS.batch([
      env.LEADS.prepare("UPDATE companies SET plan = ?1, valid_until = ?2, users_max = ?3, printers_max = ?4, trial = 0 WHERE id = ?5").bind(lic.plan, until, lic.users_max, lic.printers_max, cid),
      env.LEADS.prepare("UPDATE licences SET company_id = ?1, redeemed_at = datetime('now'), redeemed_by = ?2 WHERE id = ?3 AND company_id IS NULL").bind(cid, s.user_id, lic.id),
    ]);
    await audit(env, request, cid, s.user_id, "licence added", `${PLANS[lic.plan].name}, ${lic.months} months, …${lic.hint}`);
    return J({ company: await companyInfo(env, cid, me.role) });
  }
  if (!manage) return J({ error: "Only the owner or an admin can change company settings." }, 403);
  if (p === "/api/company/update") {
    const name = String(b.name || "").trim().slice(0, 80), gstin = String(b.gstin || "").toUpperCase().replace(/\s/g, "").slice(0, 15);
    if (name.length < 2) return J({ error: "Enter the company name." }, 400);
    if (gstin && !/^\d{2}[A-Z0-9]{13}$/.test(gstin)) return J({ error: "GSTIN should be 15 characters, starting with the 2-digit state code." }, 400);
    await env.LEADS.prepare("UPDATE companies SET name = ?1, gstin = ?2 WHERE id = ?3").bind(name, gstin || null, cid).run();
    await audit(env, request, cid, s.user_id, "company details changed", name);
    return J({ company: await companyInfo(env, cid, me.role) });
  }
  if (p === "/api/company/invite") {
    const role = ROLES.includes(b.role) ? b.role : "designer";
    if (role === "owner" && me.role !== "owner") return J({ error: "Only an owner can invite another owner." }, 403);
    const have = await env.LEADS.prepare("SELECT COUNT(*) AS n FROM members WHERE company_id = ?1").bind(cid).first(), pl = planOf(co);
    if (have.n >= pl.users) return J({ error: `Your ${pl.name} plan allows ${pl.users} user(s), and all are taken. Add a licence for more users.` }, 402);
    const email = String(b.email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return J({ error: "Enter a valid email, or leave it empty." }, 400);
    const tok = rid(18);
    await env.LEADS.prepare("INSERT INTO invites (id, company_id, role, email, created, expires, created_by) VALUES (?1,?2,?3,?4,?5,?6,?7)")
      .bind(await sha256hex("inv:" + tok), cid, role, email || null, now(), now() + 7 * 86400, s.user_id).run();
    await audit(env, request, cid, s.user_id, "invite made", role + (email ? " for " + email : ""));
    return J({ token: tok, link: `https://${url.host}/#join=${tok}`, role, expires_days: 7 });
  }
  if (p === "/api/company/member") {
    const t = await env.LEADS.prepare("SELECT role FROM members WHERE company_id = ?1 AND user_id = ?2").bind(cid, String(b.user || "")).first();
    if (!t) return J({ error: "Not a member" }, 404);
    if (t.role === "owner" && me.role !== "owner") return J({ error: "Only an owner can change another owner." }, 403);
    if (b.role && !ROLES.includes(b.role)) return J({ error: "Unknown role" }, 400);
    if (b.role === "owner" && me.role !== "owner") return J({ error: "Only an owner can make someone an owner." }, 403);
    if (t.role === "owner" && (b.remove || b.role !== "owner")) {
      const o = await env.LEADS.prepare("SELECT COUNT(*) AS n FROM members WHERE company_id = ?1 AND role = 'owner'").bind(cid).first();
      if (o.n <= 1) return J({ error: "A company needs at least one owner." }, 400);
    }
    if (b.remove) {
      await env.LEADS.batch([
        env.LEADS.prepare("DELETE FROM members WHERE company_id = ?1 AND user_id = ?2").bind(cid, b.user),
        env.LEADS.prepare("UPDATE sessions SET company_id = NULL WHERE user_id = ?1 AND company_id = ?2").bind(b.user, cid),
      ]);
      await audit(env, request, cid, s.user_id, "member removed", b.user);
    } else {
      await env.LEADS.prepare("UPDATE members SET role = ?1 WHERE company_id = ?2 AND user_id = ?3").bind(b.role, cid, b.user).run();
      await audit(env, request, cid, s.user_id, "role changed", b.user + " → " + b.role);
    }
    return J({ ok: true });
  }
  return J({ error: "Not found" }, 404);
}
