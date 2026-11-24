// LeeysPremium service worker: makes the store installable and quick to reopen.
// Pages: network first (always fresh), falls back to the cached shell when offline.
// Static files: served from cache, refreshed in the background.
// API, checkout, admin and payments: never cached.
const VERSION = "lp-v25";
const SHELL = ["/", "/styles.css", "/app.js", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  const sameOrigin = url.origin === location.origin;
  if (sameOrigin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin"))) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put("/", copy));
      return res;
    }).catch(async () => (await caches.match("/")) || caches.match("/offline.html")));
    return;
  }
  if (sameOrigin && /\.(js|css|webmanifest)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (sameOrigin || isFont) {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});

// Prize-draw notifications: the push carries no data; we ask the store what to show for this device.
self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let n = { title: "LeeysPremium", body: "There's news about your prize draw ticket.", url: "/#draw" };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch("/api/push/notice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub && sub.endpoint }) });
      const j = await r.json(); if (j && j.title) n = j;
    } catch {}
    await self.registration.showNotification(n.title, { body: n.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: n.url }, tag: "lp-draw" });
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
