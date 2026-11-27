/**
 * ArbaConnect ERP - Offline-First Service Worker (PWA)
 * CV Arba'in Solo Raya
 *
 * Strategi Caching:
 * 1. App Shell (HTML, CSS, JS, Manifest, Icons): Cache-First dengan Stale-While-Revalidate di latar belakang.
 * 2. Google Fonts & Material Symbols: Cache-First agar ikon & tipografi tetap tampil saat offline di lapangan.
 * 3. API Pusat (/api/*): Network-Only (dikelola oleh OfflineSync Queue + IndexedDB di sisi aplikasi).
 */

const CACHE_VERSION = 'arbaconnect-pwa-v24';
const FONT_CACHE = 'arbaconnect-fonts-v1';
const MAP_CACHE = 'arbaconnect-map-tiles-v1';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './css/tokens.css',
  './css/layout.css',
  './css/components.css',
  './css/utilities.css',
  './css/print.css',
  './js/data.js',
  './js/utils.js',
  './js/offlineSync.js',
  './js/store.js',
  './js/auth.js',
  './js/advancedFeatures.js',
  './js/views/executiveDashboard.js',
  './js/views/inventoryLedger.js',
  './js/views/b2bCrm.js',
  './js/views/orderApproval.js',
  './js/views/fieldSalesPwa.js',
  './js/views/userProfileAndAdmin.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        APP_SHELL_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => {
            if (res && res.status === 200) {
              return cache.put(url, res);
            }
          }).catch(() => {})
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION && key !== FONT_CACHE && key !== MAP_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jangan cache endpoint API atau SSE stream
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache Google Fonts, Material Symbols, Leaflet JS/CSS & OpenStreetMap Tiles agar peta & ikon tetap muncul saat offline
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com' ||
    url.origin === 'https://unpkg.com' ||
    url.hostname.endsWith('tile.openstreetmap.org')
  ) {
    const targetCache = url.hostname.endsWith('tile.openstreetmap.org') ? MAP_CACHE : FONT_CACHE;
    event.respondWith(
      caches.open(targetCache).then((cache) => {
        return cache.match(req).then((cached) => {
          const networkFetch = fetch(req).then((res) => {
            if (res && res.status === 200) {
              cache.put(req, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Navigasi halaman HTML -> Network-First (no-store) dengan fallback cache bila offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req.url, { cache: 'no-store' }).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', clone));
        return res;
      }).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // Aset App Shell (CSS, JS, SVG) -> Network-First dengan Fallback Cache Offline-First
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
        const resClone = networkResponse.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(req, { ignoreSearch: true });
    })
  );
});

// Background Sync API: Saat sinyal HP kembali stabil, bangunkan client untuk flush antrean
self.addEventListener('sync', (event) => {
  if (event.tag === 'arba-offline-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});
