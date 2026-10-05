// Coded by OpenAI Codex. Only the versioned application shell is cached, never API traffic.
const CACHE = "tiyf-shell-__BUILD_HASH__";
const ASSETS = __PRECACHE_ASSETS__;
self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
    // Let existing sessions finish on their own version; do not reload a learner's work.
});
self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) {
            if (key.startsWith("tiyf-shell-") && key !== CACHE) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});
self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
    const asset = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!ASSETS.includes(asset)) return;
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(asset)) || fetch(event.request)));
});
