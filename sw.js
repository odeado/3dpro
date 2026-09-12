// Service worker minimo: solo lo necesario para que Chrome considere la
// app "instalable" y para que abra sin red una vez que ya se visito una
// vez (cachea los archivos propios, no hace falta nada mas sofisticado
// para este editor).
const CACHE_NAME = 'editor3d-v1';
const ASSETS = [
  './', './index.html', './main.js',
  './vendor/three.module.js', './vendor/three.core.js',
  './vendor/three-addons/OrbitControls.js', './vendor/three-addons/TransformControls.js',
  './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
