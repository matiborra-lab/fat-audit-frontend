import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth, RequireRole } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import OlvideClave from './pages/OlvideClave';
import DefinirClave from './pages/DefinirClave';
import Dashboard from './pages/Dashboard';
import Historial from './pages/Historial';
import HistorialDetalle from './pages/HistorialDetalle';
import Ejecutar from './pages/Ejecutar';
import Ejecucion from './pages/Ejecucion';
import Auditorias from './pages/Auditorias';
import AuditoriaConstructor from './pages/AuditoriaConstructor';
import Sucursales from './pages/Sucursales';
import Usuarios from './pages/Usuarios';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/olvide-clave" element={<OlvideClave />} />
          <Route path="/definir-clave" element={<DefinirClave />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/historial" element={<Historial />} />
              <Route path="/historial/:id" element={<HistorialDetalle />} />
              <Route path="/ejecutar" element={<Ejecutar />} />
              <Route path="/ejecucion/:id" element={<Ejecucion />} />

              <Route element={<RequireRole roles={['ADMIN', 'AUDITOR']} />}>
                <Route path="/auditorias" element={<Auditorias />} />
                <Route path="/auditorias/:id" element={<AuditoriaConstructor />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN']} />}>
                <Route path="/sucursales" element={<Sucursales />} />
                <Route path="/usuarios" element={<Usuarios />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
