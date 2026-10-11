// SW léger : cache l'interface (app shell), réseau d'abord pour les données.
const CACHE = 'garage2-v1'
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg']
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || !url.pathname.includes(self.registration.scope.replace(location.origin, ''))) return
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); return r }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))))
})
