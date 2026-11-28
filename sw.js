/* Offline shell: the app opens without internet; data calls go to the network (Apps Script). */
const CACHE = 'sds-v23';
const SHELL = ['./', 'index.html', 'app.js', 'building.js', 'students.js', 'attendance.js', 'staffing.js', 'timetable.js', 'impl.js', 'dash.js', 'scheme.js', 'pdf.js', 'challan.js', 'marks.js', 'vendor/jspdf.umd.min.js', 'vendor/qrcode.js', 'fonts/plex-400.woff2', 'fonts/plex-500.woff2', 'fonts/plex-600.woff2', 'fonts/naskh.woff2', 'fonts/naskh-b.woff2', 'config.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // API calls: straight to network
  // network first (gets updates), cache when offline
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
