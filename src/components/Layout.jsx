import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }) =>
  'px-3 py-2 rounded-lg text-sm font-medium ' +
  (isActive ? 'bg-fat-bordo-50 text-fat-bordo-700' : 'text-gray-600 hover:bg-gray-100');

const linkClassDrawer = ({ isActive }) =>
  'block px-3 py-2 rounded-lg text-sm font-medium ' +
  (isActive ? 'bg-fat-bordo-50 text-fat-bordo-700' : 'text-gray-600 hover:bg-gray-100');

function itemsDeNav(rol) {
  const items = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/historial', label: 'Historial' },
    { to: '/ejecutar', label: 'Nueva auditoría' },
  ];
  if (rol === 'ADMIN' || rol === 'AUDITOR') {
    items.push({ to: '/auditorias', label: 'Auditorías' });
  }
  if (rol === 'ADMIN') {
    items.push({ to: '/sucursales', label: 'Sucursales' });
    items.push({ to: '/usuarios', label: 'Usuarios' });
  }
  return items;
}

export default function Layout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const items = itemsDeNav(usuario.rol);

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-fat-marfil-suave">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex md:hidden items-center gap-3">
            <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="text-gray-500 hover:text-gray-700 -ml-1 p-1">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 5h14a1 1 0 100-2H3a1 1 0 000 2zm0 6h14a1 1 0 100-2H3a1 1 0 000 2zm0 6h14a1 1 0 100-2H3a1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
            <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="h-8" />
          </div>

          <div className="hidden md:flex items-center gap-6">
            <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="h-9" />
            <nav className="flex gap-1">
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={linkClass}>{it.label}</NavLink>
              ))}
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm text-gray-500">{usuario.nombre || usuario.email} · {usuario.rol}</span>
            <button onClick={logout} className="text-sm text-fat-bordo-600 hover:underline">Salir</button>
          </div>
        </div>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
              <img src="/brand/fatburger_logo.png" alt="FAT Audit" className="h-8" />
              <button onClick={() => setMenuAbierto(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={linkClassDrawer}>{it.label}</NavLink>
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
        <Outlet />
      </main>
    </div>
  );
}
