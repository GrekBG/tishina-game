
const CACHE_NAME = 'tishina-0-3-2-static-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/pbr-surfaces.js',
  './src/world-expansion.js',
  './src/story.js',
  './src/sky-weather.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('./index.html');

          return cached || new Response(
            'Страница недоступна офлайн. Подключитесь к интернету и обновите игру.',
            {
              status: 503,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8'
              }
            }
          );
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});
