import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';

const DIAS_SEMANA = [
  { label: 'Domingo', valor: 0 }, { label: 'Lunes', valor: 1 }, { label: 'Martes', valor: 2 },
  { label: 'Miércoles', valor: 3 }, { label: 'Jueves', valor: 4 }, { label: 'Viernes', valor: 5 }, { label: 'Sábado', valor: 6 },
];

function cuando(r) {
  const hora = r.hora.slice(0, 5);
  if (r.frecuencia === 'SEMANAL') return `Todos los ${DIAS_SEMANA.find((d) => d.valor === r.dia_semana)?.label} a las ${hora}`;
  return `El día ${r.dia_mes} de cada mes a las ${hora}`;
}

function formVacio(usuario) {
  return {
    nombre: '', sucursal_id: usuario.rol === 'GERENTE' ? String(usuario.sucursal_id) : '',
    frecuencia: 'SEMANAL', dia_semana: 1, dia_mes: 1, hora: '08:00', destinatarios: '',
  };
}

export default function ReportesProgramados() {
  const { usuario } = useAuth();
  const esGerente = usuario.rol === 'GERENTE';
  const [lista, setLista] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVacio(usuario));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState('');
  const [enviandoId, setEnviandoId] = useState(null);

  function recargar() {
    api.get('/api/reportes-programados').then(setLista).catch((e) => setError(e.message));
  }
  useEffect(() => {
    recargar();
    if (!esGerente) api.get('/api/sucursales').then(setSucursales);
  }, []);

  function abrirNuevo() {
    setError('');
    setEditando(null);
    setForm(formVacio(usuario));
    setModalAbierto(true);
  }

  function abrirEdicion(r) {
    setError('');
    setEditando(r);
    setForm({
      nombre: r.nombre, sucursal_id: r.sucursal_id ? String(r.sucursal_id) : '',
      frecuencia: r.frecuencia, dia_semana: r.dia_semana ?? 1, dia_mes: r.dia_mes ?? 1,
      hora: r.hora.slice(0, 5), destinatarios: r.destinatarios.join(', '),
    });
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre,
        sucursal_id: esGerente ? Number(usuario.sucursal_id) : (form.sucursal_id ? Number(form.sucursal_id) : null),
        frecuencia: form.frecuencia,
        dia_semana: form.frecuencia === 'SEMANAL' ? Number(form.dia_semana) : undefined,
        dia_mes: form.frecuencia === 'MENSUAL' ? Number(form.dia_mes) : undefined,
        hora: form.hora,
        destinatarios: form.destinatarios.split(/[,\n]/).map((d) => d.trim()).filter(Boolean),
      };
      if (editando) await api.patch(`/api/reportes-programados/${editando.id}`, body);
      else await api.post('/api/reportes-programados', body);
      setModalAbierto(false);
      setToast(editando ? 'Reporte actualizado' : 'Reporte programado creado');
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(r) {
    await api.patch(`/api/reportes-programados/${r.id}`, { activo: !r.activo });
    recargar();
  }

  async function eliminar(r) {
    await api.del(`/api/reportes-programados/${r.id}`);
    recargar();
  }

  async function enviarAhora(r) {
    setEnviandoId(r.id);
    try {
      const resultado = await api.post(`/api/reportes-programados/${r.id}/enviar-ahora`);
      setToast(`Enviado (${resultado.cantidad} auditorías incluidas)`);
      recargar();
    } catch (err) {
      setToast('Error: ' + err.message);
    } finally {
      setEnviandoId(null);
    }
  }

  if (!lista) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Reportes programados</h1>
        <Boton ancho="w-auto" onClick={abrirNuevo}>+ Nuevo reporte</Boton>
      </div>
      <p className="text-sm text-gray-500">
        Mandan por mail un resumen de las auditorías completadas desde el último envío, de forma automática.
      </p>

      <Tarjeta className="overflow-hidden">
        {lista.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay reportes programados.</p>}
        <div className="divide-y divide-gray-100">
          {lista.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <button className="min-w-0 text-left" onClick={() => abrirEdicion(r)}>
                <p className="text-sm font-medium text-gray-900 truncate">{r.nombre}</p>
                <p className="text-xs text-gray-400 truncate">
                  {r.sucursal_nombre || 'Todas las sucursales'} · {cuando(r)} · {r.destinatarios.length} destinatario(s)
                  {r.ultimo_envio_en && ` · último envío ${new Date(r.ultimo_envio_en).toLocaleString('es-AR')}`}
                </p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <Boton ancho="w-auto" variante="secundario" cargando={enviandoId === r.id} onClick={() => enviarAhora(r)}>Enviar ahora</Boton>
                <button
                  onClick={() => alternarActivo(r)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {r.activo ? 'Activo' : 'Pausado'}
                </button>
                <button onClick={() => eliminar(r)} className="text-gray-400 hover:text-fat-bordo-600 text-xs">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>

      {modalAbierto && (
        <Modal titulo={editando ? 'Editar reporte' : 'Nuevo reporte programado'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={guardar} className="space-y-4">
            <Campo label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
            {!esGerente && (
              <Select label="Sucursal" value={form.sucursal_id} onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
                <option value="">Todas las sucursales</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            )}
            <Select label="Frecuencia" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}>
              <option value="SEMANAL">Semanal</option>
              <option value="MENSUAL">Mensual</option>
            </Select>
            {form.frecuencia === 'SEMANAL' ? (
              <Select label="Día de la semana" value={form.dia_semana} onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}>
                {DIAS_SEMANA.map((d) => <option key={d.valor} value={d.valor}>{d.label}</option>)}
              </Select>
            ) : (
              <Campo label="Día del mes (1 a 28)" type="number" min="1" max="28" required value={form.dia_mes} onChange={(e) => setForm({ ...form, dia_mes: e.target.value })} />
            )}
            <Campo label="Hora" type="time" required value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinatarios</label>
              <textarea
                required rows={2} placeholder="uno@ejemplo.com, otro@ejemplo.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
                value={form.destinatarios} onChange={(e) => setForm({ ...form, destinatarios: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">Separados por coma o uno por línea.</p>
            </div>
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>{editando ? 'Guardar' : 'Crear'}</Boton>
          </form>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
