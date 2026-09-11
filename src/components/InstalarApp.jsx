import { useEffect, useState } from 'react';
import { Modal } from './ui';
import { obtenerPromptCapturado, suscribirsePrompt } from '../utils/pwaInstall';

function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function yaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Botón de "descargar/instalar como app" (mismo patrón que coteja-frontend/
// src/components/InstalarApp.jsx). En Chrome/Edge (escritorio y Android) el
// click dispara el instalador nativo del navegador vía beforeinstallprompt -
// no hace falta UI propia. iOS Safari nunca dispara ese evento, así que ahí
// el click muestra el paso a paso manual (Compartir -> Agregar a pantalla de
// inicio). Si no hay prompt nativo disponible y no es iOS (navegador sin
// soporte, o ya instalada), el botón no se muestra.
export default function InstalarApp() {
  const [prompt, setPrompt] = useState(() => obtenerPromptCapturado());
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false);
  const [instalada, setInstalada] = useState(true);

  useEffect(() => {
    setInstalada(yaInstalada());
    return suscribirsePrompt(setPrompt);
  }, []);

  if (instalada) return null;
  if (!prompt && !esIOS()) return null;

  async function onClick() {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else {
      setMostrarInstrucciones(true);
    }
  }

  return (
    <>
      <button
        onClick={onClick}
        aria-label="Descargar app"
        title="Descargar FAT Audit como app"
        className="text-gray-500 hover:text-gray-700 p-1.5"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 16a4 4 0 01-.5-7.97A5 5 0 0116.9 6.34 4 4 0 0118 14h-1" />
          <path d="M12 12v6" />
          <path d="M9 15l3 3 3-3" />
        </svg>
      </button>

      {mostrarInstrucciones && (
        <Modal titulo="Descargar FAT Audit" onClose={() => setMostrarInstrucciones(false)}>
          <div className="space-y-4 text-sm text-gray-700">
            <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="w-14 h-14 rounded-xl mx-auto object-contain" />
            <p className="text-center">Instalá FAT Audit en tu pantalla de inicio para acceder más rápido, como una app.</p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-fat-bordo-100 text-fat-bordo-800 text-xs font-semibold">1</span>
                <span>Tocá el ícono <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) en la barra del navegador.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-fat-bordo-100 text-fat-bordo-800 text-xs font-semibold">2</span>
                <span>Deslizá hacia abajo y tocá <strong>"Agregar a pantalla de inicio"</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-fat-bordo-100 text-fat-bordo-800 text-xs font-semibold">3</span>
                <span>Tocá <strong>"Agregar"</strong> para confirmar.</span>
              </li>
            </ol>
          </div>
        </Modal>
      )}
    </>
  );
}
