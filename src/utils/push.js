import { api } from '../api/client';

export function soportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// La applicationServerKey de PushManager.subscribe necesita la clave VAPID
// como Uint8Array, no como el string base64url que da el backend.
function base64UrlAUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64);
  return Uint8Array.from([...binario].map((c) => c.charCodeAt(0)));
}

export async function suscripcionActual() {
  if (!soportaPush()) return null;
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

// Pide permiso al navegador (si hace falta) y suscribe este dispositivo,
// mandando la suscripción al backend para que quede asociada al usuario
// logueado (ver POST /api/push/suscripciones).
export async function activarPush() {
  if (!soportaPush()) throw new Error('Este navegador no soporta notificaciones push');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No se dio permiso para las notificaciones');

  const { publicKey } = await api.get('/api/push/vapid-public-key');
  if (!publicKey) throw new Error('El servidor todavía no tiene configurado el push');

  const registro = await navigator.serviceWorker.ready;
  let suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) {
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8Array(publicKey),
    });
  }
  await api.post('/api/push/suscripciones', suscripcion.toJSON());
  return suscripcion;
}

export async function desactivarPush() {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return;
  await api.post('/api/push/desuscribirse', { endpoint: suscripcion.endpoint }).catch(() => {});
  await suscripcion.unsubscribe();
}
