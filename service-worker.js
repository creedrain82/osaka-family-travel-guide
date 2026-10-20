/* 오사카 가족여행 오프라인 서비스 워커 v1.18 */
const CACHE_NAME = 'osaka-family-guide-v5.40';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './assets/usj-power-up-band-experience.png',
  './assets/usj-power-up-band-types.png',
  './assets/instagram/donki-best15-solemio.jpg',
  './assets/instagram/donki-gifts-simtohl.jpg',
  './assets/instagram/donki-snacks-hyoooooni.jpg',
  './assets/instagram/drugstore-abode.jpg'
];
const OPTIONAL_EXTERNAL_FILES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES).then(() => Promise.all(OPTIONAL_EXTERNAL_FILES.map(url => cache.add(url).catch(() => null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('osaka-family-guide-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const cacheableAsset = ['style', 'script', 'font', 'image'].includes(request.destination);
  if (!cacheableAsset) return;
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
