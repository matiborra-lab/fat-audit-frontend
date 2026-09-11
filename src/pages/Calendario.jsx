import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TIPO_COLOR = {
  AUDITORIA: 'bg-fat-bordo-100 text-fat-bordo-700',
  SEGUIMIENTO: 'bg-orange-100 text-orange-700',
  TAREA: 'bg-fat-celeste-100 text-fat-celeste-800',
};
const TIPO_LABEL = { AUDITORIA: 'Auditoría', SEGUIMIENTO: 'Seguimiento', TAREA: 'Tarea' };

function aClaveDia(d) {
  return d.toISOString().slice(0, 10);
}

// Grilla de 42 dias (6 semanas) que arranca el lunes on/antes del dia 1 del
// mes, para que el mes quede siempre completo visualmente.
function generarGrilla(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const diaSemana = (primero.getDay() + 6) % 7; // 0=lunes
  const inicio = new Date(anio, mes, 1 - diaSemana);
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

export default function Calendario() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [eventos, setEventos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const grilla = useMemo(() => generarGrilla(anio, mes), [anio, mes]);
  const puedeEditar = usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR';

  function recargar() {
    const desde = aClaveDia(grilla[0]);
    const hasta = aClaveDia(grilla[grilla.length - 1]);
    const params = new URLSearchParams({ desde, hasta });
    if (filtroSucursal) params.set('sucursal_id', filtroSucursal);
    if (filtroTipo) params.set('tipo', filtroTipo);
    api.get(`/api/calendario?${params}`).then(setEventos).catch((e) => setError(e.message));
  }
  useEffect(recargar, [anio, mes, filtroSucursal, filtroTipo]);

  useEffect(() => {
    if (usuario.rol !== 'GERENTE') api.get('/api/sucursales').then(setSucursales);
    api.get('/api/plantillas?estado=PUBLICADA').then(setPlantillas);
  }, [usuario.rol]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const e of eventos || []) {
      const clave = e.fecha_hora.slice(0, 10);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(e);
    }
    return mapa;
  }, [eventos]);

  function cambiarMes(delta) {
    const nueva = new Date(anio, mes + delta, 1);
    setAnio(nueva.getFullYear());
    setMes(nueva.getMonth());
  }

  if (!eventos) return <Cargando />;

  const eventosDelDiaSeleccionado = diaSeleccionado ? eventosPorDia.get(aClaveDia(diaSeleccionado)) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Calendario</h1>
        {puedeEditar && <Boton ancho="w-auto" onClick={() => setModalNuevo(true)}>+ Nuevo evento</Boton>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded-lg border border-gray-300 text-sm" onClick={() => cambiarMes(-1)}>←</button>
          <p className="text-sm font-medium text-gray-800 w-40 text-center capitalize">
            {new Date(anio, mes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </p>
          <button className="px-2 py-1 rounded-lg border border-gray-300 text-sm" onClick={() => cambiarMes(1)}>→</button>
        </div>
        <button className="text-sm text-fat-bordo-600 hover:underline" onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()); }}>Hoy</button>
        {usuario.rol !== 'GERENTE' && (
          <Select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        )}
        <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="AUDITORIA">Auditoría</option>
          <option value="SEGUIMIENTO">Seguimiento</option>
          <option value="TAREA">Tarea</option>
        </Select>
      </div>

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
        {grilla.map((d, i) => {
          const delMes = d.getMonth() === mes;
          const esHoy = aClaveDia(d) === aClaveDia(hoy);
          const eventosDia = eventosPorDia.get(aClaveDia(d)) || [];
          return (
            <button
              key={i}
              onClick={() => setDiaSeleccionado(d)}
              className={`bg-white min-h-[84px] p-1.5 text-left align-top ${!delMes ? 'opacity-40' : ''} hover:bg-gray-50`}
            >
              <span className={`text-xs inline-flex items-center justify-center w-5 h-5 rounded-full ${esHoy ? 'bg-fat-bordo-500 text-white font-semibold' : 'text-gray-600'}`}>
                {d.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {eventosDia.slice(0, 2).map((e) => (
                  <p key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${TIPO_COLOR[e.tipo]}`}>{e.titulo}</p>
                ))}
                {eventosDia.length > 2 && <p className="text-[10px] text-gray-400">+{eventosDia.length - 2} más</p>}
              </div>
            </button>
          );
        })}
      </div>

      {diaSeleccionado && (
        <Modal titulo={diaSeleccionado.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setDiaSeleccionado(null)}>
          <DiaDetalle
            eventos={eventosDelDiaSeleccionado}
            puedeEditar={puedeEditar}
            onCambio={() => { recargar(); setToast('Actualizado'); }}
            onIniciarRun={(runId) => navigate(`/ejecucion/${runId}`)}
          />
        </Modal>
      )}

      {modalNuevo && (
        <ModalNuevoEvento
          sucursales={sucursales}
          plantillas={plantillas}
          usuario={usuario}
          onClose={() => setModalNuevo(false)}
          onCreado={() => { setModalNuevo(false); recargar(); setToast('Evento creado'); }}
        />
      )}

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function DiaDetalle({ eventos, puedeEditar, onCambio, onIniciarRun }) {
  if (eventos.length === 0) return <p className="text-sm text-gray-400">No hay eventos este día.</p>;
  return (
    <div className="space-y-3">
      {eventos.map((e) => (
        <EventoItem key={e.id} evento={e} puedeEditar={puedeEditar} onCambio={onCambio} onIniciarRun={onIniciarRun} />
      ))}
    </div>
  );
}

function EventoItem({ evento, puedeEditar, onCambio, onIniciarRun }) {
  const [completando, setCompletando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function iniciar() {
    setIniciando(true);
    setError('');
    try {
      const run = await api.post(`/api/calendario/${evento.id}/iniciar`);
      onIniciarRun(run.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIniciando(false);
    }
  }

  async function completar() {
    setGuardando(true);
    setError('');
    try {
      await api.post(`/api/calendario/${evento.id}/completar`, { comentario });
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(serie) {
    try {
      await api.del(`/api/calendario/${evento.id}${serie ? '?serie=true' : ''}`);
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TIPO_COLOR[evento.tipo]}`}>{TIPO_LABEL[evento.tipo]}</span>
          <p className="text-sm font-medium text-gray-900 mt-1">{evento.titulo}</p>
          <p className="text-xs text-gray-400">
            {evento.sucursal_nombre} · {new Date(evento.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {evento.responsable_nombre && ` · ${evento.responsable_nombre}`}
          </p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
          evento.estado_efectivo === 'COMPLETADA' ? 'bg-green-100 text-green-700'
          : evento.estado_efectivo === 'VENCIDA' ? 'bg-fat-bordo-100 text-fat-bordo-700'
          : evento.estado_efectivo === 'OMITIDA' ? 'bg-gray-100 text-gray-500'
          : 'bg-yellow-100 text-yellow-700'
        }`}>{evento.estado_efectivo}</span>
      </div>

      {evento.estado === 'PENDIENTE' && (
        <div className="mt-2">
          {evento.tipo === 'TAREA' ? (
            completando ? (
              <div className="space-y-2">
                <input className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                <div className="flex gap-2">
                  <Boton ancho="w-auto" cargando={guardando} onClick={completar}>Confirmar cumplimiento</Boton>
                  <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(false)}>Cancelar</Boton>
                </div>
              </div>
            ) : (
              <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(true)}>Marcar cumplida</Boton>
            )
          ) : (
            <Boton ancho="w-auto" cargando={iniciando} onClick={iniciar}>Iniciar auditoría</Boton>
          )}
        </div>
      )}

      {evento.run_id && <p className="text-xs text-gray-400 mt-1">Ya iniciada</p>}
      {evento.completado_comentario && <p className="text-xs text-gray-600 mt-1 italic">"{evento.completado_comentario}"</p>}
      {error && <p className="text-xs text-fat-bordo-600 mt-1">{error}</p>}

      {puedeEditar && (
        <div className="flex gap-3 mt-2">
          <button className="text-xs text-gray-400 hover:text-fat-bordo-600" onClick={() => eliminar(false)}>Eliminar</button>
          {evento.serie_id && <button className="text-xs text-gray-400 hover:text-fat-bordo-600" onClick={() => eliminar(true)}>Eliminar esta y futuras de la serie</button>}
        </div>
      )}
    </div>
  );
}

function ModalNuevoEvento({ sucursales, plantillas, usuario, onClose, onCreado }) {
  const [form, setForm] = useState({
    sucursal_id: usuario.rol === 'GERENTE' ? usuario.sucursal_id : '',
    tipo: 'AUDITORIA', template_id: '', titulo: '', fecha: '', hora: '10:00',
    recurrenciaTipo: 'NINGUNA', recurrenciaHasta: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function crear(e) {
    e.preventDefault();
    setError('');
    if (!form.fecha) { setError('Elegí una fecha'); return; }
    setGuardando(true);
    try {
      await api.post('/api/calendario', {
        sucursal_id: Number(form.sucursal_id),
        tipo: form.tipo,
        template_id: form.tipo !== 'TAREA' ? Number(form.template_id) : null,
        titulo: form.tipo === 'TAREA' ? form.titulo : null,
        fecha_hora: `${form.fecha}T${form.hora}:00`,
        recurrencia: form.recurrenciaTipo === 'NINGUNA' ? null : { tipo: form.recurrenciaTipo, hasta: form.recurrenciaHasta },
      });
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo evento" onClose={onClose}>
      <form onSubmit={crear} className="space-y-3">
        <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          <option value="AUDITORIA">Auditoría</option>
          <option value="SEGUIMIENTO">Seguimiento</option>
          <option value="TAREA">Tarea rutinaria</option>
        </Select>

        {usuario.rol !== 'GERENTE' && (
          <Select label="Sucursal" required value={form.sucursal_id} onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
            <option value="">Elegí una sucursal</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        )}

        {form.tipo !== 'TAREA' ? (
          <Select label="Plantilla" required value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
            <option value="">Elegí una plantilla</option>
            {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
        ) : (
          <Campo label="Título de la tarea" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha" type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          <Campo label="Hora" type="time" required value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
        </div>

        <Select label="Repetir" value={form.recurrenciaTipo} onChange={(e) => setForm({ ...form, recurrenciaTipo: e.target.value })}>
          <option value="NINGUNA">No se repite</option>
          <option value="DIARIA">Todos los días</option>
          <option value="SEMANAL">Todas las semanas</option>
          <option value="MENSUAL">Todos los meses</option>
        </Select>
        {form.recurrenciaTipo !== 'NINGUNA' && (
          <Campo label="Repetir hasta" type="date" required value={form.recurrenciaHasta} onChange={(e) => setForm({ ...form, recurrenciaHasta: e.target.value })} />
        )}

        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Crear</Boton>
      </form>
    </Modal>
  );
}
