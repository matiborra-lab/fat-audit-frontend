// Chrome puede disparar "beforeinstallprompt" muy temprano, antes incluso
// de que React termine de montar el arbol - si el listener recien se
// registra en el useEffect de un componente, ese primer disparo se pierde
// y el boton de instalar nunca se habilita en esa carga de pagina. Por eso
// este modulo se importa de entrada en main.jsx (antes de renderizar la
// app) y engancha el listener a nivel de modulo, guardando el evento
// capturado para que cualquier componente lo pueda leer despues, llegue
// tarde o no. (Mismo patron que coteja-frontend/src/utils/pwaInstall.js)
let promptCapturado = null;
const suscriptores = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promptCapturado = e;
  suscriptores.forEach((cb) => cb(e));
});

window.addEventListener('appinstalled', () => {
  promptCapturado = null;
});

export function obtenerPromptCapturado() {
  return promptCapturado;
}

export function suscribirsePrompt(cb) {
  suscriptores.add(cb);
  return () => suscriptores.delete(cb);
}
