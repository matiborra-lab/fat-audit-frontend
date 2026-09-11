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

  const resp = await fetch(API_URL + ruta, {
    method: metodo,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const error = new Error(data?.error || 'Error de red (' + resp.status + ')');
    error.status = resp.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (ruta, opciones) => pedido('GET', ruta, null, opciones),
  post: (ruta, body, opciones) => pedido('POST', ruta, body, opciones),
  put: (ruta, body, opciones) => pedido('PUT', ruta, body, opciones),
  patch: (ruta, body, opciones) => pedido('PATCH', ruta, body, opciones),
  del: (ruta, body, opciones) => pedido('DELETE', ruta, body, opciones),
};
