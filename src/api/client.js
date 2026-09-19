const API_URL = import.meta.env.VITE_API_URL;

function obtenerToken() {
  return localStorage.getItem('fataudit_token');
}

export function guardarToken(token) {
  localStorage.setItem('fataudit_token', token);
}

export function borrarToken() {
  localStorage.removeItem('fataudit_token');
}

async function pedido(metodo, ruta, body, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = obtenerToken();
    if (token) headers.Authorization = 'Bearer ' + token;
  }

  let resp;
  try {
    resp = await fetch(API_URL + ruta, {
      method: metodo,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // fetch tira un TypeError ("Failed to fetch") sin más detalle cuando la
    // request ni siquiera llega a completarse (sin conexión, CORS, servidor
    // caído) - se lo reemplaza acá por un mensaje que el usuario entienda,
    // en vez de dejar pasar el texto crudo del navegador.
    const error = new Error('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
    error.status = 0;
    error.original = err;
    throw error;
  }

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const error = new Error(data?.error || 'Error de red (' + resp.status + ')');
    error.status = resp.status;
    error.data = data;
    throw error;
  }
  return data;
}

// Sube un archivo directo al bucket con una URL firmada (PUT). Navegador y
// bucket hablan sin pasar por el backend, así que una falla acá (CORS,
// conexión) llega como un TypeError opaco ("Load failed" en Safari, "Failed
// to fetch" en Chrome) - se traduce a un mensaje claro y se valida el
// status de la respuesta (un 4xx del bucket no tira excepción en fetch).
export async function subirArchivoFirmado(uploadUrl, archivo, contentType = archivo.type) {
  let resp;
  try {
    resp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: archivo });
  } catch (err) {
    throw new Error('No se pudo subir el archivo (falló la conexión con el almacenamiento) - probá de nuevo.');
  }
  if (!resp.ok) throw new Error('El almacenamiento rechazó el archivo (error ' + resp.status + ') - probá de nuevo.');
}

export const api = {
  get: (ruta, opciones) => pedido('GET', ruta, null, opciones),
  post: (ruta, body, opciones) => pedido('POST', ruta, body, opciones),
  put: (ruta, body, opciones) => pedido('PUT', ruta, body, opciones),
  patch: (ruta, body, opciones) => pedido('PATCH', ruta, body, opciones),
  del: (ruta, body, opciones) => pedido('DELETE', ruta, body, opciones),
};
