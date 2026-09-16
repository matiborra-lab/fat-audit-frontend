import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { pasosTour } from '../data/ayudaContenido';
import { Modal, Boton, Toast } from './ui';

const MENSAJE_CIERRE = 'Recordá que todos los tutoriales de uso se encuentran en el centro de ayuda';

const OnboardingContext = createContext(null);

// Lo usa CentroAyuda.jsx para el botón "Volver a ver el tutorial guiado" -
// arranca el mismo recorrido que la bienvenida, sin tocar
// tutorial_completado_en (eso solo lo marca la primera vez, ver abajo).
export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding debe usarse dentro de <OnboardingProvider>');
  return ctx;
}

// Vive montado en Layout.jsx (siempre presente mientras hay sesión), así el
// tour sobrevive a la navegación entre páginas - cada "Siguiente" hace
// navigate() a la ruta del próximo paso y el overlay se queda fijo arriba.
export function OnboardingProvider({ children }) {
  const { usuario, actualizarUsuario } = useAuth();
  const navigate = useNavigate();
  const [bienvenidaAbierta, setBienvenidaAbierta] = useState(false);
  const [pasoActual, setPasoActual] = useState(-1); // -1 = tour no está corriendo
  const [toast, setToast] = useState('');

  // Se muestra una sola vez por usuario - cuando todavía no completó ni
  // omitió el tutorial (tutorial_completado_en null). No dispara si el tour
  // ya está corriendo (evita reabrirse por un remount del provider).
  useEffect(() => {
    if (usuario && !usuario.tutorial_completado_en && pasoActual === -1) {
      setBienvenidaAbierta(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const pasos = usuario ? pasosTour(usuario.rol) : [];

  async function marcarCompletado() {
    try {
      await api.post('/api/auth/tutorial-completado');
    } catch {
      // Si falla la escritura no hay drama: en la próxima sesión se vuelve
      // a ofrecer la bienvenida, no bloquea nada acá.
    }
    actualizarUsuario({ tutorial_completado_en: new Date().toISOString() });
  }

  function iniciarTour() {
    setBienvenidaAbierta(false);
    setPasoActual(0);
    if (pasos[0]) navigate(pasos[0].path);
  }

  function siguientePaso() {
    const proximo = pasoActual + 1;
    if (proximo >= pasos.length) { finalizarTour(); return; }
    setPasoActual(proximo);
    navigate(pasos[proximo].path);
  }

  function omitirTour() {
    finalizarTour();
  }

  function finalizarTour() {
    setPasoActual(-1);
    marcarCompletado();
    setToast(MENSAJE_CIERRE);
  }

  function omitirBienvenida() {
    setBienvenidaAbierta(false);
    marcarCompletado();
    setToast(MENSAJE_CIERRE);
  }

  const tourActivo = pasoActual >= 0 && !!pasos[pasoActual];
  const paso = tourActivo ? pasos[pasoActual] : null;

  return (
    <OnboardingContext.Provider value={{ iniciarTour }}>
      {children}

      {bienvenidaAbierta && (
        <Modal titulo="¡Bienvenido a FAT Gestión!" onClose={omitirBienvenida}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Acá organizaremos la gestión de turnos, tareas y seguimientos de las auditorías hechas por la marca.
            </p>
            <p className="text-sm text-gray-600">
              ¿Querés conocer todas las funciones? Te mostramos un recorrido rápido por las secciones principales - podés omitirlo en cualquier momento.
            </p>
            <div className="flex flex-wrap gap-2">
              <Boton ancho="w-auto" onClick={iniciarTour}>Iniciar tutorial</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={omitirBienvenida}>Omitir</Boton>
            </div>
          </div>
        </Modal>
      )}

      {tourActivo && (
        <div className="fixed inset-x-4 bottom-4 md:inset-x-auto md:right-4 md:w-96 z-50">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4">
            <p className="text-xs font-medium text-fat-bordo-600 uppercase mb-1">Paso {pasoActual + 1} de {pasos.length}</p>
            <p className="text-sm font-semibold text-gray-900">{paso.titulo}</p>
            <p className="text-sm text-gray-600 mt-1">{paso.descripcion}</p>
            <div className="flex items-center justify-between mt-3">
              <button type="button" onClick={omitirTour} className="text-xs text-gray-400 hover:text-fat-bordo-600">Omitir</button>
              <Boton ancho="w-auto" onClick={siguientePaso}>{pasoActual + 1 >= pasos.length ? 'Finalizar' : 'Siguiente'}</Boton>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} duracion={6000} />}
    </OnboardingContext.Provider>
  );
}
