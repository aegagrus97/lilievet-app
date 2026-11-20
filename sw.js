// LilieVET · service worker: guarda los archivos de la app para que abra rápido.
// Solo guarda archivos de esta misma carpeta. Los datos (Supabase) nunca se guardan aquí.
const VERSION = 'lv-cuota-11';
const ARCHIVOS = [
  './', 'index.html', 'config.js', 'manifest.webmanifest',
  'ds/tokens.css', 'ds/bundle.css', 'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/poppins-latin-600-normal.woff2', 'fonts/poppins-latin-700-normal.woff2', 'ds/bundle.js', 'css/app.css',
  'vendor/react.production.min.js', 'vendor/react-dom.production.min.js', 'vendor/htm.umd.js', 'vendor/supabase.js',
  'js/guardia.js', 'js/main.js', 'js/lib.js', 'js/api.js', 'js/demo.js', 'js/shell.js', 'js/auth.js', 'js/cuenta.js', 'js/legal.js',
  'js/tutor/inicio.js', 'js/tutor/solicitar.js', 'js/tutor/consultas.js',
  'js/mvz/inicio.js', 'js/mvz/agenda.js', 'js/mvz/servicios.js', 'js/admin/panel.js',
  'img/lilievet-logo.svg', 'img/lilievet-corazon.svg', 'icons/icon.svg', 'icons/favicon-32.png', 'icons/icon-192.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase: siempre directo a la red
  // Primero la red (para recibir cambios y correcciones de seguridad); si no hay conexión, lo guardado
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && r.type === 'basic') { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
