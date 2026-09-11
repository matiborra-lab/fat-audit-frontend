import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';
import BuscadorResponsable from '../components/BuscadorResponsable';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// El color de AUDITORIA distingue de marca vs interna una vez que se conoce
// la plantilla (ver colorEvento) - acá quedan los defaults por tipo.
const TIPO_COLOR = {
  AUDITORIA: 'bg-fat-bordo-100 text-fat-bordo-700',
  AUDITORIA_INTERNA: 'bg-fat-celeste-100 text-fat-celeste-800',
  SEGUIMIENTO: 'bg-orange-100 text-orange-700',
  TAREA: 'bg-fat-amarillo-100 text-fat-amarillo-800',
  TURNO: 'bg-purple-100 text-purple-700',
};
const TIPO_LABEL = { AUDITORIA: 'Auditoría de marca', AUDITORIA_INTERNA: 'Auditoría interna', SEGUIMIENTO: 'Seguimiento', TAREA: 'Tarea', TURNO: 'Turno' };
const TIPOS_FILTRO = [
  { valor: 'AUDITORIA', label: 'Auditoría' },
  { valor: 'SEGUIMIENTO', label: 'Seguimiento' },
  { valor: 'TAREA', label: 'Tarea' },
  { valor: 'TURNO', label: 'Turno' },
];
const MOTIVOS_PRESET = ['Baja por malestar', 'Problemas personales', 'Evento especial'];

function colorEvento(e) {
  if (e.tipo === 'AUDITORIA' && e.plantilla_tipo === 'INTERNA') return TIPO_COLOR.AUDITORIA_INTERNA;
  return TIPO_COLOR[e.tipo] || 'bg-gray-100 text-gray-600';
}
function etiquetaEvento(e) {
  if (e.tipo === 'AUDITORIA' && e.plantilla_tipo === 'INTERNA') return TIPO_LABEL.AUDITORIA_INTERNA;
  return TIPO_LABEL[e.tipo];
}

function aClaveDia(d) {
  return d.toISOString().slice(0, 10);
}
function lunesDeSemana(d) {
  const dia = d.getDay();
  const delta = dia === 0 ? -6 : 1 - dia;
  const l = new Date(d);
  l.setDate(l.getDate() + delta);
  return l;
}
function generarSemana(lunes) {
  return Array.from({ length: 7 }, (_, i) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i));
}

// Grilla de 42 dias (6 semanas) que arranca el lunes on/antes del dia 1 del
// mes, para que el mes quede siempre completo visualmente.
function generarGrilla(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const diaSemana = (primero.getDay() + 6) % 7; // 0=lunes
  const inicio = new Date(anio, mes, 1 - diaSemana);
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

// Dropdown de checkboxes - filtro multi-select de tipos de evento.
function SelectorTiposMultiple({ seleccionados, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function alClickAfuera(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, []);
  function alternar(valor) {
    onChange(seleccionados.includes(valor) ? seleccionados.filter((v) => v !== valor) : [...seleccionados, valor]);
  }
  const etiqueta = seleccionados.length === 0 || seleccionados.length === TIPOS_FILTRO.length
    ? 'Todos los tipos'
    : seleccionados.map((v) => TIPOS_FILTRO.find((t) => t.valor === v)?.label).join(', ');
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700 max-w-[220px] truncate">
        {etiqueta}
      </button>
      {abierto && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1 min-w-[180px]">
          {TIPOS_FILTRO.map((t) => (
            <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700 px-1 py-0.5 hover:bg-gray-50 rounded cursor-pointer">
              <input type="checkbox" checked={seleccionados.includes(t.valor)} onChange={() => alternar(t.valor)} />
              {t.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {Object.entries(TIPO_LABEL).map(([clave, label]) => (
        <span key={clave} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className={`w-2.5 h-2.5 rounded-full ${(TIPO_COLOR[clave] || '').split(' ')[0]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function Calendario() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const hoy = new Date();
  const [vista, setVista] = useState('MES'); // MES | SEMANA
  const [ancla, setAncla] = useState(hoy);
  const [eventos, setEventos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroTipos, setFiltroTipos] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const grilla = useMemo(() => generarGrilla(ancla.getFullYear(), ancla.getMonth()), [ancla]);
  const semana = useMemo(() => generarSemana(lunesDeSemana(ancla)), [ancla]);
  const diasVisibles = vista === 'MES' ? grilla : semana;
  const puedeCrear = usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR' || usuario.rol === 'GERENTE';
  const veTodasSucursales = usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR';

  function recargar() {
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    const params = new URLSearchParams({ desde, hasta });
    if (filtroSucursal) params.set('sucursal_id', filtroSucursal);
    if (filtroTipos.length) params.set('tipo', filtroTipos.join(','));
    api.get(`/api/calendario?${params}`).then(setEventos).catch((e) => setError(e.message));
  }
  useEffect(recargar, [vista, ancla.getFullYear(), ancla.getMonth(), ancla.getDate(), filtroSucursal, filtroTipos]);

  useEffect(() => {
    if (veTodasSucursales) api.get('/api/sucursales').then(setSucursales);
    if (puedeCrear) api.get(`/api/plantillas?estado=PUBLICADA${usuario.rol === 'GERENTE' ? '&tipo=INTERNA' : ''}`).then(setPlantillas);
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

  function navegar(delta) {
    const nueva = new Date(ancla);
    if (vista === 'MES') nueva.setMonth(nueva.getMonth() + delta);
    else nueva.setDate(nueva.getDate() + delta * 7);
    setAncla(nueva);
  }

  if (!eventos) return <Cargando />;

  const eventosDelDiaSeleccionado = diaSeleccionado ? eventosPorDia.get(aClaveDia(diaSeleccionado)) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Calendario</h1>
        {puedeCrear && <Boton ancho="w-auto" onClick={() => setModalNuevo(true)}>+ Nuevo evento</Boton>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded-lg border border-gray-300 text-sm" onClick={() => navegar(-1)}>←</button>
          <p className="text-sm font-medium text-gray-800 min-w-[160px] text-center capitalize">
            {vista === 'MES'
              ? ancla.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
              : `${semana[0].toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} — ${semana[6].toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`}
          </p>
          <button className="px-2 py-1 rounded-lg border border-gray-300 text-sm" onClick={() => navegar(1)}>→</button>
        </div>
        <button className="text-sm text-fat-bordo-600 hover:underline" onClick={() => setAncla(new Date())}>Hoy</button>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button onClick={() => setVista('MES')} className={`px-3 py-1 ${vista === 'MES' ? 'bg-fat-bordo-500 text-white' : 'bg-white text-gray-600'}`}>Mes</button>
          <button onClick={() => setVista('SEMANA')} className={`px-3 py-1 ${vista === 'SEMANA' ? 'bg-fat-bordo-500 text-white' : 'bg-white text-gray-600'}`}>Semana</button>
        </div>
        {veTodasSucursales && (
          <Select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        )}
        <SelectorTiposMultiple seleccionados={filtroTipos} onChange={setFiltroTipos} />
      </div>

      <Leyenda />

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      <div className={`grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200`}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
        {diasVisibles.map((d, i) => {
          const delMes = vista === 'MES' ? d.getMonth() === ancla.getMonth() : true;
          const esHoy = aClaveDia(d) === aClaveDia(hoy);
          const eventosDia = eventosPorDia.get(aClaveDia(d)) || [];
          const maxVisibles = vista === 'SEMANA' ? 6 : 2;
          return (
            <button
              key={i}
              onClick={() => setDiaSeleccionado(d)}
              className={`bg-white text-left align-top hover:bg-gray-50 ${vista === 'SEMANA' ? 'min-h-[220px] p-2' : 'min-h-[84px] p-1.5'} ${!delMes ? 'opacity-40' : ''}`}
            >
              <span className={`text-xs inline-flex items-center justify-center w-5 h-5 rounded-full ${esHoy ? 'bg-fat-bordo-500 text-white font-semibold' : 'text-gray-600'}`}>
                {d.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {eventosDia.slice(0, maxVisibles).map((e) => (
                  <p key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${colorEvento(e)}`} title={etiquetaEvento(e)}>{e.titulo}</p>
                ))}
                {eventosDia.length > maxVisibles && <p className="text-[10px] text-gray-400">+{eventosDia.length - maxVisibles} más</p>}
              </div>
            </button>
          );
        })}
      </div>

      {diaSeleccionado && (
        <Modal titulo={diaSeleccionado.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setDiaSeleccionado(null)}>
          <DiaDetalle
            eventos={eventosDelDiaSeleccionado}
            usuario={usuario}
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

// Refleja la misma regla que el backend (ver puedeGestionarEvento en
// calendario.js): Admin/Auditor todo; Gerente sus turnos y lo que el mismo
// programó (auditorías internas/tareas); nadie más.
function puedeGestionarEvento(usuario, evento) {
  if (usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR') return true;
  if (evento.tipo === 'TURNO') return usuario.rol === 'GERENTE';
  if (usuario.rol === 'GERENTE') return evento.creado_por === usuario.id;
  return false;
}

function DiaDetalle({ eventos, usuario, onCambio, onIniciarRun }) {
  if (eventos.length === 0) return <p className="text-sm text-gray-400">No hay eventos este día.</p>;
  return (
    <div className="space-y-3">
      {eventos.map((e) => (
        <EventoItem key={e.id} evento={e} usuario={usuario} puedeEditar={puedeGestionarEvento(usuario, e)} onCambio={onCambio} onIniciarRun={onIniciarRun} />
      ))}
    </div>
  );
}

function EventoItem({ evento, usuario, puedeEditar, onCambio, onIniciarRun }) {
  const [completando, setCompletando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [motivo, setMotivo] = useState('');
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

  async function solicitarRevision() {
    if (!motivo.trim()) { setError('Elegí o escribí un motivo'); return; }
    setGuardando(true);
    setError('');
    try {
      await api.post(`/api/calendario/${evento.id}/solicitar-revision`, { motivo });
      setSolicitando(false);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const esMiTurno = usuario.rol === 'COLABORADOR' && evento.tipo === 'TURNO' && evento.responsable_user_id === usuario.id;

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorEvento(evento)}`}>{etiquetaEvento(evento)}</span>
          <p className="text-sm font-medium text-gray-900 mt-1">{evento.titulo}{evento.puesto ? ` · ${evento.puesto}` : ''}</p>
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

      {evento.estado === 'PENDIENTE' && evento.tipo === 'TAREA' && (
        <div className="mt-2">
          {completando ? (
            <div className="space-y-2">
              <input className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
              <div className="flex gap-2">
                <Boton ancho="w-auto" cargando={guardando} onClick={completar}>Confirmar cumplimiento</Boton>
                <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(false)}>Cancelar</Boton>
              </div>
            </div>
          ) : (
            <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(true)}>Marcar cumplida</Boton>
          )}
        </div>
      )}

      {evento.estado === 'PENDIENTE' && (evento.tipo === 'AUDITORIA' || evento.tipo === 'SEGUIMIENTO') && (
        <div className="mt-2">
          <Boton ancho="w-auto" cargando={iniciando} onClick={iniciar}>Iniciar auditoría</Boton>
        </div>
      )}

      {evento.run_id && <p className="text-xs text-gray-400 mt-1">Ya iniciada</p>}
      {evento.completado_comentario && <p className="text-xs text-gray-600 mt-1 italic">"{evento.completado_comentario}"</p>}

      {evento.tipo === 'TURNO' && evento.solicitud_revision_estado === 'PENDIENTE' && (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-2 italic">
          Revisión pendiente: "{evento.solicitud_revision_motivo}"
        </p>
      )}

      {esMiTurno && evento.solicitud_revision_estado !== 'PENDIENTE' && (
        <div className="mt-2">
          {solicitando ? (
            <div className="space-y-2">
              <select className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Elegí un motivo…</option>
                {MOTIVOS_PRESET.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__otro">Otro (escribir)</option>
              </select>
              {motivo === '__otro' && (
                <input className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" placeholder="Motivo" onChange={(e) => setMotivo(e.target.value)} />
              )}
              <div className="flex gap-2">
                <Boton ancho="w-auto" cargando={guardando} onClick={solicitarRevision}>Enviar solicitud</Boton>
                <Boton ancho="w-auto" variante="secundario" onClick={() => setSolicitando(false)}>Cancelar</Boton>
              </div>
            </div>
          ) : (
            <Boton ancho="w-auto" variante="secundario" onClick={() => setSolicitando(true)}>No puedo asistir</Boton>
          )}
        </div>
      )}

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
  const esGerente = usuario.rol === 'GERENTE';
  const [form, setForm] = useState({
    sucursal_id: esGerente ? usuario.sucursal_id : '',
    tipo: 'AUDITORIA', template_id: '', titulo: '', responsable_user_id: '', responsable_nombre: '', fecha: '', hora: '10:00',
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
        responsable_user_id: form.responsable_user_id || null,
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
          <option value="AUDITORIA">Auditoría{esGerente ? ' interna' : ''}</option>
          {!esGerente && <option value="SEGUIMIENTO">Seguimiento</option>}
          <option value="TAREA">Tarea rutinaria</option>
        </Select>

        {!esGerente && (
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

        <BuscadorResponsable
          sucursalId={form.sucursal_id}
          nombreValue={form.responsable_nombre}
          onChange={(id, u) => setForm({ ...form, responsable_user_id: id, responsable_nombre: u ? (u.nombre || u.email) : '' })}
        />

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
