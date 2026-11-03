// Offline cache for the app shell. The deploy workflow replaces __BUILD__ with the
// commit SHA, so every deploy installs fresh files. If you deploy by hand, change
// the value below each time you upload new files.
const VERSION = "rt-prep-__BUILD__";
const SHELL = [
  "./", "index.html", "app.css", "app.js", "questions.js", "config.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache Supabase API or auth traffic.
  if (url.hostname.endsWith(".supabase.co") || url.pathname.includes("/rest/v1/") || url.pathname.includes("/auth/v1/")) return;

  // Google Fonts: cache after first use so typography works offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(VERSION + "-fonts").then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App shell: cache first, fall back to network; navigations fall back to index.html offline.
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === "navigate" ? caches.match("index.html") : Response.error())));
});
