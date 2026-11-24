// Print queue: a phone sends a ready-made printer file (PRN) to a "print station", a PC browser running
// LabelDesk with QZ Tray. The station token is a long random secret held by the PC and shared to phones
// through a QR code; only its SHA-256 is stored. Jobs are kept for a day at most.
const J = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const hex = async t => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ld-station:" + t)))].map(b => b.toString(16).padStart(2, "0")).join("");
const rid = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, "0")).join("");
const MAX_PRN = 4_000_000, MAX_PENDING = 30, ONLINE_MS = 30_000, KEEP_MS = 86_400_000;

export async function queue(request, env, url) {
  if (!env.LEADS) return J({ error: "Print queue is not set up" }, 503);
  const tok = request.headers.get("x-station") || "";
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(tok)) return J({ error: "Pair this device with a print station first." }, 401);
  const m = request.method, op = url.pathname.split("/")[3] || "";
  if (m === "POST" && request.headers.get("x-ld") !== "1") return J({ error: "Bad request" }, 400);
  const st = await hex(tok), now = Date.now(), db = env.LEADS;
  const body = async () => { try { return await request.json(); } catch (e) { return {}; } };

  if (op === "hello" && m === "POST") { // the PC says it is online and names its printer
    const b = await body(), name = String(b.name || "Print station").slice(0, 120);
    await db.prepare("INSERT INTO print_stations (id, name, seen) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET name = ?2, seen = ?3").bind(st, name, now).run();
    return J({ ok: true });
  }
  if (op === "pull" && m === "POST") { // the PC takes up to 5 waiting jobs; taking them first stops two tabs printing twice
    await db.prepare("UPDATE print_stations SET seen = ?2 WHERE id = ?1").bind(st, now).run();
    if (Math.random() < 0.05) await db.prepare("DELETE FROM print_jobs WHERE created < ?1").bind(now - KEEP_MS).run();
    const { results } = await db.prepare("UPDATE print_jobs SET status = 'taken' WHERE id IN (SELECT id FROM print_jobs WHERE station = ?1 AND status = 'pending' ORDER BY created LIMIT 5) RETURNING id, title, prn, labels, created").bind(st).all();
    return J({ jobs: (results || []).sort((a, b) => a.created - b.created) });
  }
  if (op === "done" && m === "POST") {
    const b = await body(); if (!/^[0-9a-f]{24}$/.test(b.id || "")) return J({ error: "Bad job" }, 400);
    await db.prepare("UPDATE print_jobs SET status = ?3, note = ?4, done = ?5, prn = '' WHERE id = ?1 AND station = ?2").bind(b.id, st, b.ok ? "printed" : "failed", String(b.note || "").slice(0, 300), now).run();
    return J({ ok: true });
  }
  if (op === "send" && m === "POST") { // a phone adds a job
    if (env.DESIGN_LIMITER) { const { success } = await env.DESIGN_LIMITER.limit({ key: "q:" + st }); if (!success) return J({ error: "Too many print jobs; wait a minute." }, 429); }
    const b = await body(), prn = String(b.prn || "");
    if (!prn || prn.length > MAX_PRN || !/^[A-Za-z0-9+/=]+$/.test(prn)) return J({ error: prn ? "This print job is too large; print fewer labels at a time." : "Nothing to print" }, 400);
    const s = await db.prepare("SELECT name, seen FROM print_stations WHERE id = ?1").bind(st).first();
    if (!s) return J({ error: "That print station is not set up any more. Scan its QR code again." }, 404);
    const p = await db.prepare("SELECT COUNT(*) AS n FROM print_jobs WHERE station = ?1 AND status = 'pending'").bind(st).first();
    if (p.n >= MAX_PENDING) return J({ error: `${p.n} jobs are already waiting. Check the print station PC is on.` }, 429);
    const id = rid();
    await db.prepare("INSERT INTO print_jobs (id, station, title, prn, labels, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(id, st, String(b.title || "Labels").slice(0, 120), prn, Math.max(1, Math.min(99999, +b.labels || 1)), now).run();
    return J({ id, station: s.name, online: now - s.seen < ONLINE_MS });
  }
  if (op === "info" && m === "GET") { // a phone checks the station and, optionally, one of its jobs
    const s = await db.prepare("SELECT name, seen FROM print_stations WHERE id = ?1").bind(st).first();
    if (!s) return J({ error: "That print station is not set up any more. Scan its QR code again." }, 404);
    const id = url.searchParams.get("job") || "", out = { station: s.name, online: now - s.seen < ONLINE_MS, waiting: 0 };
    if (/^[0-9a-f]{24}$/.test(id)) { const j = await db.prepare("SELECT status, note FROM print_jobs WHERE id = ?1 AND station = ?2").bind(id, st).first(); if (j) out.job = j; }
    out.waiting = (await db.prepare("SELECT COUNT(*) AS n FROM print_jobs WHERE station = ?1 AND status = 'pending'").bind(st).first()).n;
    return J(out);
  }
  return J({ error: "Not found" }, 404);
}
