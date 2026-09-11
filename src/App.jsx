import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { RequireAuth, RequireRole } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import OlvideClave from './pages/OlvideClave';
import DefinirClave from './pages/DefinirClave';
import Dashboard from './pages/Dashboard';
import Historial from './pages/Historial';
import HistorialDetalle from './pages/HistorialDetalle';
import Calendario from './pages/Calendario';
import GestionarTurnos from './pages/GestionarTurnos';
import Ejecutar from './pages/Ejecutar';
import Ejecucion from './pages/Ejecucion';
import Auditorias from './pages/Auditorias';
import AuditoriaConstructor from './pages/AuditoriaConstructor';
import Sucursales from './pages/Sucursales';
import Usuarios from './pages/Usuarios';
import ReportesProgramados from './pages/ReportesProgramados';

// Un Colaborador no tiene dashboard - su pantalla inicial es el calendario
// (donde ve sus turnos y tareas asignadas).
function Inicio() {
  const { usuario } = useAuth();
  if (usuario.rol === 'COLABORADOR') return <Navigate to="/calendario" replace />;
  return <Dashboard />;
}

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
              <Route path="/" element={<Inicio />} />
              <Route path="/calendario" element={<Calendario />} />

              <Route element={<RequireRole roles={['ADMIN', 'AUDITOR', 'GERENTE']} />}>
                <Route path="/historial" element={<Historial />} />
                <Route path="/historial/:id" element={<HistorialDetalle />} />
                <Route path="/ejecutar" element={<Ejecutar />} />
                <Route path="/ejecucion/:id" element={<Ejecucion />} />
                <Route path="/reportes-programados" element={<ReportesProgramados />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN', 'GERENTE']} />}>
                <Route path="/turnos" element={<GestionarTurnos />} />
                <Route path="/usuarios" element={<Usuarios />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN', 'AUDITOR']} />}>
                <Route path="/auditorias" element={<Auditorias />} />
                <Route path="/auditorias/:id" element={<AuditoriaConstructor />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN', 'GERENTE']} />}>
                <Route path="/sucursales" element={<Sucursales />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
