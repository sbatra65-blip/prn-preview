// LabelDesk service worker: network first, so updates arrive at once; the last copy opens when offline.
const C = "ld-shell-v1";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/icons/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate" && u.pathname === "/") { e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put("/", cp)); return res; }).catch(() => caches.match("/"))); return; }
  if (u.pathname.startsWith("/icons/")) e.respondWith(caches.match(r).then(m => m || fetch(r)));
});
