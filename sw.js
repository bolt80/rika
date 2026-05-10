// ════════════════════════════════════════════════════
//  Teh Rika — Camera Confidence Program
//  Service Worker  |  SAE+ Bandung
//  Strategy: Cache First for assets, Network First for pages
// ════════════════════════════════════════════════════

const CACHE_NAME = 'teh-rika-v1';
const STATIC_CACHE = 'teh-rika-static-v1';
const DYNAMIC_CACHE = 'teh-rika-dynamic-v1';

// Assets to cache on install (app shell)
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon.png',
  // Google Fonts — will be cached dynamically on first visit
];

// External origins to cache dynamically
const CACHEABLE_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ─── INSTALL ─────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing Teh Rika Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] App shell cached ✓');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => console.warn('[SW] Pre-cache failed (ok in dev):', err))
  );
});

// ─── ACTIVATE ────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating Teh Rika Service Worker...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => {
        console.log('[SW] Activated & old caches cleaned ✓');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// ─── FETCH ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s)
  if (!request.url.startsWith('http')) return;

  // Strategy: Cache First for fonts & static assets
  if (
    CACHEABLE_ORIGINS.some(origin => url.hostname.includes(origin)) ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    request.destination === 'style'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy: Network First for HTML pages
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: Stale While Revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// ─── STRATEGIES ──────────────────────────────────────

/**
 * Cache First — serve from cache, fallback to network then cache it
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    return offlineFallback(request);
  }
}

/**
 * Network First — try network, fallback to cache
 */
async function networkFirst(request) {
  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

/**
 * Stale While Revalidate — serve cache immediately, update in background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || networkFetch;
}

/**
 * Offline Fallback — return a friendly offline page
 */
function offlineFallback(request) {
  if (request.destination === 'document') {
    return new Response(offlineHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offline — Teh Rika</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: #1A1A1A; color: white;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 24px;
  }
  .icon { font-size: 80px; margin-bottom: 24px; }
  h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
  h1 em { color: #FF5C5C; font-style: italic; }
  p { color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; max-width: 320px; margin: 0 auto 32px; }
  button {
    background: #FF5C5C; color: white; border: none;
    padding: 14px 32px; border-radius: 100px; font-size: 15px; font-weight: 600;
    cursor: pointer;
  }
  button:hover { opacity: 0.9; }
  .tip { margin-top: 24px; font-size: 13px; color: rgba(255,255,255,0.35); }
</style>
</head>
<body>
  <div>
    <div class="icon">📷</div>
    <h1>Teh <em>Rika</em></h1>
    <p>Kamu sedang offline. Tapi tetap semangat ya! Koneksi internet dibutuhkan untuk memuat program.</p>
    <button onclick="location.reload()">🔄 Coba Lagi</button>
    <p class="tip">Progress tugas kamu tetap aman tersimpan di perangkat 💾</p>
  </div>
</body>
</html>`;
}

// ─── BACKGROUND SYNC (bonus: kirim notif pengingat) ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── PUSH NOTIFICATIONS (siap dipakai jika perlu) ────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Teh Rika 📷';
  const options = {
    body: data.body || 'Jangan lupa rekam video hari ini ya!',
    icon: './icon.png',
    badge: './icon.png',
    tag: 'daily-reminder',
    renotify: true,
    data: { url: data.url || './' },
    actions: [
      { action: 'open', title: '🎬 Mulai Rekam' },
      { action: 'dismiss', title: 'Nanti dulu' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          if (clientList.length > 0) return clientList[0].focus();
          return clients.openWindow(event.notification.data?.url || './');
        })
    );
  }
});

console.log('[SW] Teh Rika Service Worker loaded ✦ SAE+ Bandung');
