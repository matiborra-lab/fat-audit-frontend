// Service worker: instalable como PWA + Web Push. Sin cache offline todavia -
// la ejecucion de una auditoria ya guarda su borrador en localStorage (ver
// AuditoriaEjecucion), que no depende de este archivo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// El payload lo arma enviarPush en el backend (ver src/push) - siempre
// { titulo, cuerpo, tipo, ...payload_json de la notificacion }.
self.addEventListener('push', (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch { datos = { titulo: 'FAT Audit', cuerpo: event.data?.text() }; }
  const titulo = datos.titulo || 'FAT Audit';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || '',
      icon: '/brand/pwa-icon-192.png',
      badge: '/brand/pwa-icon-192.png',
      data: { url: datos.url || '/calendario' },
    })
  );
});

// Al tocar la notificación: si ya hay una pestaña de la app abierta, la
// enfoca; si no, abre una nueva en la url del evento.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
