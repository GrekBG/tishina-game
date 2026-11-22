const CACHE_NAME = 'tishina-prototype-0-3-2-hd-ui';
const FILES = ['./','./index.html','./manifest.webmanifest','./src/main.js','./src/pbr-surfaces.js','./src/world-expansion.js','./src/story.js','./src/sky-weather.js','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if(e.request.method !== 'GET') return; e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match('./index.html')))); });
