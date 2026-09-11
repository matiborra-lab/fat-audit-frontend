import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cargando } from './ui';

export function RequireAuth() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Uso: <Route element={<RequireRole roles={['ADMIN']} />}>...
export function RequireRole({ roles }) {
  const { usuario } = useAuth();
  if (!roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return <Outlet />;
}
