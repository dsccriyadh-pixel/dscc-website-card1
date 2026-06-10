// DSCC Digital Cards — service worker for offline support.
// Strategy:
//  - Navigations: network-first, fall back to the cached app shell when offline
//    (so fresh deploys appear immediately while online, but the app still opens
//    with no connection).
//  - Hashed build assets (/assets/*): cache-first — they are content-hashed and
//    immutable, so once cached they never change.
//  - Other same-origin GETs (icons, manifest, fonts): stale-while-revalidate.

const VERSION = "dscc-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(SHELL_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the API or share routes — those must always hit the network.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/c/")) return;

  // App navigations → network-first with shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(SHELL_URL, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match(SHELL_URL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Content-hashed build assets (e.g. /assets/index-4f3a2b1c.js) → cache-first.
  // They are immutable: a new build emits a new filename, so the old entry can
  // be served forever. Non-hashed files under /assets/ (seed images, etc.) fall
  // through to stale-while-revalidate so they still update.
  const isHashedAsset =
    url.pathname.startsWith("/assets/") &&
    /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i.test(url.pathname);
  if (isHashedAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Everything else same-origin → stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((fresh) => {
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
