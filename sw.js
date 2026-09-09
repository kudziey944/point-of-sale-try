const CACHE_NAME = 'winston-pos-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/db.js',
  './js/pos.js',
  './js/owner.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});