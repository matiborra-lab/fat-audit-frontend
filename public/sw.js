// Service worker minimo: solo lo necesario para que el navegador considere
// la app instalable (PWA). Sin cache offline todavia - la ejecucion de una
// auditoria ya guarda su borrador en localStorage (ver AuditoriaEjecucion),
// que no depende de este archivo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
