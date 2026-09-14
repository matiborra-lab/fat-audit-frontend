import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';
import BuscadorResponsable from '../components/BuscadorResponsable';

const MOTIVO_LABEL = { VACACIONES: 'Vacaciones', SALUD: 'Salud', FAMILIAR: 'Asuntos familiares', OTRO: 'Otro' };
const MOTIVO_ICONO = { VACACIONES: '🌴', SALUD: '🩺', FAMILIAR: '👪', OTRO: '📄' };

function aClaveDia(d) {
  return d.toISOString().slice(0, 10);
}
function hoyISO() {
  return aClaveDia(new Date());
}
function formatearFecha(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatearRango(desde, hasta) {
  return desde === hasta ? formatearFecha(desde) : `${formatearFecha(desde)} — ${formatearFecha(hasta)}`;
}

// Administración de licencias (vacaciones/salud/asuntos familiares) - la
// carga un Admin/Gerente para un Gerente o Colaborador de su alcance, nunca
// el propio interesado. Tres bloques: Activas y Pendientes siempre
// desplegados (lo urgente/próximo a la vista), Historial colapsado con
// filtros (ver pedido: "no hace falta que se vean todas constantemente").
export default function Licencias() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === 'ADMIN';
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState(esAdmin ? '' : String(usuario.sucursal_id));
  const [licencias, setLicencias] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (esAdmin) api.get('/api/sucursales').then(setSucursales);
  }, [esAdmin]);

  function recargar() {
    if (!sucursalId) return;
    api.get(`/api/licencias?sucursal_id=${sucursalId}`).then(setLicencias).catch((e) => setError(e.message));
  }
  useEffect(recargar, [sucursalId]);

  async function eliminar(id) {
    try {
      await api.del(`/api/licencias/${id}`);
      setToast('Licencia eliminada');
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  if (esAdmin && !sucursalId) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Licencias</h1>
        <Select label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Elegí una sucursal</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Select>
      </div>
    );
  }

  if (!licencias) return <Cargando />;

  const hoy = hoyISO();
  const activas = licencias.filter((l) => l.fecha_desde <= hoy && l.fecha_hasta >= hoy);
  const pendientes = licencias.filter((l) => l.fecha_desde > hoy);
  const historialBase = licencias.filter((l) => l.fecha_hasta < hoy);
  const usuariosDisponibles = [...new Map(licencias.map((l) => [l.usuario_id, l.usuario_nombre])).entries()];
  const historial = historialBase
    .filter((l) => !filtroUsuario || String(l.usuario_id) === filtroUsuario)
    .filter((l) => !filtroMotivo || l.motivo === filtroMotivo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Licencias</h1>
          {esAdmin && <button className="text-xs text-fat-bordo-600 hover:underline mt-0.5" onClick={() => setSucursalId('')}>Cambiar sucursal</button>}
        </div>
        <Boton ancho="w-auto" onClick={() => setModalAbierto(true)}>+ Agregar licencia</Boton>
      </div>

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      <BloqueLicencias titulo="Activas" licencias={activas} vacio="No hay licencias activas hoy." onEliminar={eliminar} />
      <BloqueLicencias titulo="Pendientes" licencias={pendientes} vacio="No hay licencias programadas todavía." onEliminar={eliminar} />

      <Tarjeta className="overflow-hidden">
        <button className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setMostrarHistorial((v) => !v)}>
          <span className="text-sm font-medium text-gray-900">Historial ({historialBase.length})</span>
          <span className="text-gray-400 text-xs">{mostrarHistorial ? '▲' : '▼'}</span>
        </button>
        {mostrarHistorial && (
          <div className="border-t border-gray-100">
            <div className="p-3 flex flex-wrap gap-2">
              <Select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
                <option value="">Todos los colaboradores</option>
                {usuariosDisponibles.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
              </Select>
              <Select value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value)}>
                <option value="">Todos los motivos</option>
                {Object.entries(MOTIVO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            {historial.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-gray-400">Sin licencias en el historial.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {historial.map((l) => <FilaLicencia key={l.id} l={l} onEliminar={eliminar} />)}
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {modalAbierto && (
        <ModalNuevaLicencia
          sucursalId={sucursalId}
          onClose={() => setModalAbierto(false)}
          onCreada={() => { setModalAbierto(false); setToast('Licencia guardada'); recargar(); }}
        />
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function BloqueLicencias({ titulo, licencias, vacio, onEliminar }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{titulo} ({licencias.length})</h2>
      <Tarjeta className="overflow-hidden">
        {licencias.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">{vacio}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {licencias.map((l) => <FilaLicencia key={l.id} l={l} onEliminar={onEliminar} />)}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

function FilaLicencia({ l, onEliminar }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {MOTIVO_ICONO[l.motivo]} {l.usuario_nombre} <span className="text-xs text-gray-400 font-normal">· {MOTIVO_LABEL[l.motivo]}</span>
        </p>
        <p className="text-xs text-gray-400">{formatearRango(l.fecha_desde, l.fecha_hasta)}{l.detalle ? ` · ${l.detalle}` : ''}</p>
      </div>
      <button onClick={() => onEliminar(l.id)} className="text-xs text-gray-400 hover:text-fat-bordo-600 shrink-0">Eliminar</button>
    </div>
  );
}

function ModalNuevaLicencia({ sucursalId, onClose, onCreada }) {
  const [responsable, setResponsable] = useState(null);
  const [motivo, setMotivo] = useState('VACACIONES');
  const [detalle, setDetalle] = useState('');
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!responsable) { setError('Elegí un gerente o colaborador'); return; }
    if (fechaHasta < fechaDesde) { setError('La fecha hasta no puede ser anterior a la fecha desde'); return; }
    setError('');
    setGuardando(true);
    try {
      await api.post('/api/licencias', {
        usuario_id: responsable.id, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, motivo, detalle: detalle.trim() || null,
      });
      onCreada();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Agregar licencia" onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <BuscadorResponsable sucursalId={sucursalId} label="Gerente o colaborador" nombreValue={responsable?.nombre} onChange={(_id, u) => setResponsable(u)} />
        <Select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {Object.entries(MOTIVO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Desde" type="date" required value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <Campo label="Hasta" type="date" required value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <Campo label="Detalle (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Aclaración adicional" />
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Guardar</Boton>
      </form>
    </Modal>
  );
}
