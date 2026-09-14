import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { soportaPush, suscripcionActual, activarPush, desactivarPush } from '../utils/push';
import InstalarApp from './InstalarApp';

// Misma apariencia en la barra lateral de escritorio y en el panel de
// celular - ambas son listas verticales, a diferencia del viejo menú
// horizontal del header.
const linkClassSidebar = ({ isActive }) =>
  'block px-3 py-2 rounded-lg text-sm font-medium ' +
  (isActive ? 'bg-fat-bordo-50 text-fat-bordo-700' : 'text-gray-600 hover:bg-gray-100');

// Orden general (todos los roles): Calendario primero (pantalla de entrada
// de la app), Tareas justo después, Turnos y Auditorías después (uso
// diario), Historial, Dashboard cerca del final (ya no es la pantalla de
// entrada) y Configuración siempre último.
function itemsDeNav(rol) {
  // Un Colaborador solo ve su calendario, sus tareas y el dashboard de su
  // propia sucursal - nada de historial ni gestión - pero sí sus
  // preferencias de notificación (personales, no requieren permisos de
  // gestión).
  if (rol === 'COLABORADOR') {
    return [
      { to: '/calendario', label: 'Calendario' },
      { to: '/tareas', label: 'Tareas' },
      { to: '/dashboard', label: 'Dashboard' },
      { label: 'Configuración', children: [{ to: '/configuracion/notificaciones', label: 'Notificaciones' }] },
    ];
  }

  const items = [
    { to: '/calendario', label: 'Calendario' },
    { to: '/tareas', label: 'Tareas' },
  ];

  // Turnos: exclusivo de Admin y Gerente (Auditor no gestiona turnos de
  // sucursal, Colaborador ni ve este bloque - vuelve arriba antes).
  if (rol === 'ADMIN' || rol === 'GERENTE') {
    items.push({ label: 'Turnos', children: [
      // end: true - si no, NavLink marca "Gestionar turnos" activo también
      // estando en /turnos/licencias (que empieza con el mismo prefijo).
      { to: '/turnos', label: 'Gestionar turnos', end: true },
      { to: '/turnos/licencias', label: 'Licencias' },
    ] });
  }

  const children = [{ to: '/ejecutar', label: 'Nueva auditoría' }];
  if (rol === 'ADMIN' || rol === 'AUDITOR') children.push({ to: '/auditorias', label: 'Plantillas' });
  children.push({ to: '/reportes-programados', label: 'Reportes' });
  items.push({ label: 'Auditorías', children });

  items.push({ to: '/historial', label: 'Historial' });
  items.push({ to: '/dashboard', label: 'Dashboard' });

  // Sucursales/Usuarios/Tareas solo para quien gestiona (Admin/Gerente);
  // Notificaciones (preferencias personales) para cualquiera que llegue
  // hasta acá (incluido Auditor, que no tiene el resto de Configuración).
  const hijosConfig = [];
  if (rol === 'ADMIN' || rol === 'GERENTE') {
    hijosConfig.push({ to: '/configuracion/sucursales', label: 'Sucursales' });
    hijosConfig.push({ to: '/configuracion/usuarios', label: rol === 'GERENTE' ? 'Colaboradores' : 'Usuarios' });
    if (rol === 'ADMIN') hijosConfig.push({ to: '/configuracion/tareas', label: 'Tareas' });
  }
  hijosConfig.push({ to: '/configuracion/notificaciones', label: 'Notificaciones' });
  items.push({ label: 'Configuración', children: hijosConfig });
  return items;
}

function CampanaNotificaciones({ abrirHaciaArriba = false }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [abierto, setAbierto] = useState(false);
  // 'no_soportado' | 'desactivado' | 'activado' | 'activando'
  const [estadoPush, setEstadoPush] = useState('desactivado');
  const [errorPush, setErrorPush] = useState('');

  function recargar() {
    api.get('/api/notificaciones').then(setNotificaciones).catch(() => {});
  }
  useEffect(() => {
    recargar();
    const id = setInterval(recargar, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!soportaPush()) { setEstadoPush('no_soportado'); return; }
    suscripcionActual().then((s) => setEstadoPush(s ? 'activado' : 'desactivado')).catch(() => setEstadoPush('desactivado'));
  }, []);

  const sinLeer = notificaciones.filter((n) => !n.leida_en).length;

  async function marcarLeida(n) {
    if (!n.leida_en) await api.post(`/api/notificaciones/${n.id}/leida`);
    recargar();
  }

  async function alternarPush() {
    setErrorPush('');
    setEstadoPush('activando');
    try {
      if (estadoPush === 'activado') {
        await desactivarPush();
        setEstadoPush('desactivado');
      } else {
        await activarPush();
        setEstadoPush('activado');
      }
    } catch (err) {
      setErrorPush(err.message);
      setEstadoPush(estadoPush === 'activado' ? 'activado' : 'desactivado');
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setAbierto((a) => !a)} className="relative text-gray-500 hover:text-gray-700 p-1.5" aria-label="Notificaciones">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM8.5 17a1.5 1.5 0 003 0h-3z" />
        </svg>
        {sinLeer > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-fat-bordo-600 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>
      {abierto && (
        <div className={`absolute ${abrirHaciaArriba ? 'bottom-full left-0 mb-2' : 'right-0 mt-2'} w-80 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50`}>
          {notificaciones.length === 0 && <p className="text-sm text-gray-400 p-4">No tenés notificaciones.</p>}
          {notificaciones.map((n) => (
            <button key={n.id} onClick={() => marcarLeida(n)} className={`w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${!n.leida_en ? 'bg-fat-bordo-50/40' : ''}`}>
              <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
              {n.cuerpo && <p className="text-xs text-gray-500 mt-0.5">{n.cuerpo}</p>}
              <p className="text-[10px] text-gray-400 mt-1">{new Date(n.creado_en).toLocaleString('es-AR', { hour12: false })}</p>
            </button>
          ))}
          {estadoPush !== 'no_soportado' && (
            <div className="p-2.5 bg-gray-50/70">
              <button
                onClick={alternarPush}
                disabled={estadoPush === 'activando'}
                className="w-full text-xs font-medium text-fat-bordo-600 hover:underline disabled:opacity-50 text-left"
              >
                {estadoPush === 'activado' && 'Notificaciones push activadas - desactivar'}
                {estadoPush === 'desactivado' && 'Activar notificaciones push en este dispositivo'}
                {estadoPush === 'activando' && 'Un momento…'}
              </button>
              {errorPush && <p className="text-[10px] text-fat-bordo-600 mt-1">{errorPush}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Ítem de nav que puede ser un link simple o un grupo desplegable
// ({label, children:[...]}) - usado tanto en la barra lateral de escritorio
// como en el panel de celular, con el mismo estado de apertura.
function ItemNav({ item, gruposAbiertos, alternarGrupo }) {
  if (!item.children) {
    return <NavLink to={item.to} end={item.end} className={linkClassSidebar}>{item.label}</NavLink>;
  }
  const abierto = gruposAbiertos.has(item.label);
  return (
    <div>
      <button
        onClick={() => alternarGrupo(item.label)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        {item.label}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className={`transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {abierto && (
        <div className="pl-3 mt-0.5 space-y-1">
          {item.children.map((c) => (
            <NavLink key={c.to} to={c.to} end={c.end} className={linkClassSidebar}>{c.label}</NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// Recordatorio para habilitar notificaciones push - solo aparece si el
// navegador las soporta y todavía no hay una suscripción activa (nunca a
// quien ya las tiene habilitadas). Cerrarlo lo oculta por el resto de esta
// pestaña (sessionStorage) - no lo descarta para siempre, así sigue
// insistiendo en una sesión nueva mientras de verdad no estén activadas.
function AvisoNotificaciones() {
  const [mostrar, setMostrar] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!soportaPush()) return;
    let cerrado = false;
    try { cerrado = sessionStorage.getItem('fataudit_aviso_push_cerrado') === '1'; } catch { /* noop */ }
    if (cerrado) return;
    suscripcionActual().then((s) => { if (!s) setMostrar(true); }).catch(() => {});
  }, []);

  async function activar() {
    setActivando(true);
    setError('');
    try {
      await activarPush();
      setMostrar(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setActivando(false);
    }
  }

  function cerrar() {
    try { sessionStorage.setItem('fataudit_aviso_push_cerrado', '1'); } catch { /* noop */ }
    setMostrar(false);
  }

  if (!mostrar) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-fat-bordo-200 bg-fat-bordo-50/60 px-4 py-3">
      <span className="text-xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">Activá las notificaciones</p>
        <p className="text-xs text-gray-600 mt-0.5">Recordá habilitarlas para enterarte de tus turnos, tareas y novedades apenas pasen.</p>
        {error && <p className="text-xs text-fat-bordo-600 mt-1">{error}</p>}
        <button
          onClick={activar}
          disabled={activando}
          className="mt-2 text-xs font-medium bg-fat-bordo-500 hover:bg-fat-bordo-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          {activando ? 'Un momento…' : 'Habilitar notificaciones'}
        </button>
      </div>
      <button onClick={cerrar} aria-label="Cerrar aviso" className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">&times;</button>
    </div>
  );
}

export default function Layout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const items = itemsDeNav(usuario.rol);
  const [gruposAbiertos, setGruposAbiertos] = useState(() => {
    // Auto-expandir el grupo cuyo hijo coincide con la ruta actual al montar.
    const grupo = items.find((it) => it.children?.some((c) => location.pathname.startsWith(c.to)));
    return new Set(grupo ? [grupo.label] : []);
  });

  function alternarGrupo(label) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-fat-marfil-suave md:flex">
      {/* Barra lateral - solo escritorio, reemplaza el viejo menú horizontal
          del header. Muestra únicamente los módulos permitidos para el rol
          (ver itemsDeNav), igual que el panel de celular de más abajo. */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-4 border-b border-gray-100 shrink-0">
          <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="h-9" />
        </div>
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {items.map((it) => (
            <ItemNav key={it.to || it.label} item={it} gruposAbiertos={gruposAbiertos} alternarGrupo={alternarGrupo} />
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-1 px-1">
            <CampanaNotificaciones abrirHaciaArriba />
            <InstalarApp />
          </div>
          <p className="text-xs text-gray-500 truncate px-1">{usuario.nombre || usuario.email} · {usuario.rol}</p>
          <button onClick={logout} className="text-xs text-fat-bordo-600 hover:underline px-1">Salir</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Encabezado - solo celular: hamburguesa a la izquierda que abre el
            panel lateral (ver más abajo), logo y campana. */}
        <header className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="text-gray-500 hover:text-gray-700 -ml-1 p-1">
                <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 5h14a1 1 0 100-2H3a1 1 0 000 2zm0 6h14a1 1 0 100-2H3a1 1 0 000 2zm0 6h14a1 1 0 100-2H3a1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
              <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="h-8" />
            </div>
            <div className="flex items-center gap-1">
              <CampanaNotificaciones />
              <InstalarApp />
            </div>
          </div>
        </header>

        {menuAbierto && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
                <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="h-8" />
                <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
                {items.map((it) => (
                  <ItemNav key={it.to || it.label} item={it} gruposAbiertos={gruposAbiertos} alternarGrupo={alternarGrupo} />
                ))}
              </nav>
              <div className="border-t border-gray-100 p-4 space-y-2 text-sm shrink-0">
                <p className="text-gray-500 truncate">{usuario.nombre || usuario.email} · {usuario.rol}</p>
                <button onClick={logout} className="text-fat-bordo-600 hover:underline">Salir</button>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-[1400px] mx-auto px-4 py-6 md:py-8">
          <AvisoNotificaciones />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
