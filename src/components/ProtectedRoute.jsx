import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cargando } from './ui';

export function RequireAuth() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Mercadería FAT: la puede usar un Gerente o Personal de Marca; con
// `soloMarca`, únicamente Personal de Marca (Gestión de pagos, Catálogo). El
// backend valida lo mismo en cada endpoint - esto solo evita mostrar pantallas
// que igual no funcionarían.
export function RequireMercaderia({ soloMarca = false }) {
  const { usuario } = useAuth();
  const permitido = soloMarca ? usuario.personal_marca === true : (usuario.rol === 'GERENTE' || usuario.personal_marca === true);
  if (!permitido) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Uso: <Route element={<RequireRole roles={['ADMIN']} />}>...
export function RequireRole({ roles }) {
  const { usuario } = useAuth();
  if (!roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return <Outlet />;
}
