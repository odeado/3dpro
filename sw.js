// Service worker: intenta siempre la red primero (para que un push nuevo
// se vea al toque) y solo si no hay conexion usa lo que tenga guardado en
// cache -- al reves de "cache primero" (que fue lo que hizo que la version
// vieja se quedara pegada la primera vez). Cada vez que se cambian estos
// archivos hay que subir el numero de CACHE_NAME una vez mas, asi el
// activate() de abajo tira a la basura la cache anterior.
const CACHE_NAME = 'editor3d-v21';
const ASSETS = [
  './', './index.html', './main.js',
  './vendor/three.module.js', './vendor/three.core.js',
  './vendor/three-addons/OrbitControls.js', './vendor/three-addons/TransformControls.js',
  './vendor/three-addons/loaders/FontLoader.js', './vendor/three-addons/geometries/TextGeometry.js',
  './vendor/fonts/helvetiker_regular.typeface.json', './vendor/fonts/helvetiker_bold.typeface.json',
  './vendor/fonts/optimer_regular.typeface.json', './vendor/fonts/gentilis_regular.typeface.json',
  './vendor/fonts/droid_sans_regular.typeface.json',
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
    fetch(e.request)
      .then(res => {
        // Se guarda una copia fresca en cache de paso, para el dia que
        // se abra sin internet.
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
