import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth, RequireRole, RequireMercaderia } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import OlvideClave from './pages/OlvideClave';
import DefinirClave from './pages/DefinirClave';
import Dashboard from './pages/Dashboard';
import Historial from './pages/Historial';
import HistorialDetalle from './pages/HistorialDetalle';
import Calendario from './pages/Calendario';
import GestionarTurnos from './pages/GestionarTurnos';
import Licencias from './pages/Licencias';
import Ejecutar from './pages/Ejecutar';
import Ejecucion from './pages/Ejecucion';
import Auditorias from './pages/Auditorias';
import AuditoriaConstructor from './pages/AuditoriaConstructor';
import Configuracion from './pages/Configuracion';
import Tareas from './pages/Tareas';
import ReportesProgramados from './pages/ReportesProgramados';
import CentroAyuda from './pages/CentroAyuda';
import Comunicados from './pages/Comunicados';
import ComunicadoDetalle from './pages/ComunicadoDetalle';
import MercNuevoPedido from './pages/MercNuevoPedido';
import MercHistorial from './pages/MercHistorial';
import MercPedidoDetalle from './pages/MercPedidoDetalle';
import MercPagos from './pages/MercPagos';
import MercCatalogo from './pages/MercCatalogo';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/olvide-clave" element={<OlvideClave />} />
          <Route path="/definir-clave" element={<DefinirClave />} />

          <Route element={<RequireAuth />}>
            {/* Fuera del Layout a propósito: "modo concentración" (sin
                sidebar ni menú) mientras se ejecuta una auditoría - ver
                doc V2, Experiencia móvil. Ejecucion.jsx arma su propio
                encabezado mínimo. */}
            {/* Colaborador incluido: puede ejecutar una auditoría que le
                asignaron (ver POST /api/calendario/:id/iniciar). */}
            <Route element={<RequireRole roles={['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR']} />}>
              <Route path="/ejecucion/:id" element={<Ejecucion />} />
            </Route>

            <Route element={<Layout />}>
              {/* Calendario es la pantalla de entrada para todos los roles -
                  antes era Dashboard, ahora Dashboard vive en su propia ruta
                  y se accede desde el menú (ver Layout.jsx). */}
              <Route path="/" element={<Navigate to="/calendario" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/calendario" element={<Calendario />} />
              <Route path="/tareas" element={<Tareas />} />
              {/* Sin gate de rol: Configuracion.jsx arma sus propias pestañas
                  según el rol - "Notificaciones" (preferencias personales)
                  es la única que ven Auditor/Colaborador. */}
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/configuracion/:tab" element={<Configuracion />} />
              {/* Sin gate de rol: el Centro de ayuda filtra sus propias
                  categorías/artículos según el rol (ver ayudaContenido.js). */}
              <Route path="/ayuda" element={<CentroAyuda />} />
              {/* Sin gate de rol: cualquiera puede abrir un comunicado que le
                  llegó a él (el backend ya scopea a la propia notificación en
                  /api/notificaciones/:id) - armar y mandar uno nuevo sí es
                  solo Admin, ver más abajo. */}
              <Route path="/comunicados/:notificacionId" element={<ComunicadoDetalle />} />

              <Route element={<RequireRole roles={['ADMIN']} />}>
                <Route path="/comunicados" element={<Comunicados />} />
              </Route>

              {/* Mercadería FAT: Gerente y Personal de Marca; pagos y catálogo,
                  solo Personal de Marca (el backend lo valida igual). */}
              <Route element={<RequireMercaderia />}>
                <Route path="/mercaderia/nuevo" element={<MercNuevoPedido />} />
                <Route path="/mercaderia/historial" element={<MercHistorial />} />
                <Route path="/mercaderia/pedidos/:id" element={<MercPedidoDetalle />} />
              </Route>
              <Route element={<RequireMercaderia soloMarca />}>
                <Route path="/mercaderia/pagos" element={<MercPagos />} />
                <Route path="/mercaderia/catalogo" element={<MercCatalogo />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN', 'AUDITOR', 'GERENTE']} />}>
                <Route path="/historial" element={<Historial />} />
                <Route path="/historial/:id" element={<HistorialDetalle />} />
                <Route path="/ejecutar" element={<Ejecutar />} />
                <Route path="/reportes-programados" element={<ReportesProgramados />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN', 'GERENTE']} />}>
                <Route path="/turnos" element={<GestionarTurnos />} />
                <Route path="/turnos/licencias" element={<Licencias />} />
              </Route>

              <Route element={<RequireRole roles={['ADMIN', 'AUDITOR']} />}>
                <Route path="/auditorias" element={<Auditorias />} />
                <Route path="/auditorias/:id" element={<AuditoriaConstructor />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
