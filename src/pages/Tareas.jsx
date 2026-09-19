import { useEffect, useMemo, useState } from 'react';
import { api, subirArchivo } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Boton, Select, Modal, Toast, Cargando, BotonCamara } from '../components/ui';
import BuscadorResponsable from '../components/BuscadorResponsable';

function aClaveDia(d) {
  return d.toISOString().slice(0, 10);
}

// Clave de día en horario LOCAL del navegador (a diferencia de aClaveDia,
// que es UTC y sirve para los parámetros desde/hasta del backend) - se usa
// para decidir qué es "hoy" al agrupar pendientes, evitando que un evento de
// la tarde en Argentina (UTC-3) quede mal clasificado por el corte UTC.
function claveDiaLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatearFechaHora(evento) {
  const f = new Date(evento.fecha_hora);
  const fecha = f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return evento.hora_definida ? `${fecha} · ${f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : fecha;
}

// "A tiempo" vs "con demora" - comparando contra la hora exacta si la tarea
// tiene horario definido, o contra el día (sin hora puntual) si no.
function calcularObservacion(evento) {
  const prog = new Date(evento.fecha_hora);
  const comp = new Date(evento.completado_en);
  if (evento.hora_definida) {
    const diffMs = comp - prog;
    if (diffMs <= 0) return 'Cumplida a tiempo';
    const horas = Math.round(diffMs / 3600000);
    return horas < 1 ? 'Cumplida con menos de 1h de demora' : `Cumplida con ${horas}h de demora`;
  }
  const progDia = aClaveDia(prog);
  const compDia = aClaveDia(comp);
  if (compDia <= progDia) return 'Cumplida a tiempo';
  const dias = Math.round((new Date(compDia) - new Date(progDia)) / 86400000);
  return `Cumplida con ${dias} día(s) de demora`;
}

// Mismo criterio que puedeGestionarEvento en calendario.js: Admin/Auditor
// pueden editar/eliminar cualquier tarea; un Gerente solo las que él mismo
// programó (sin importar a quién se la haya asignado - a otra persona o a
// sí mismo).
function puedeGestionarTarea(usuario, evento) {
  if (usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR') return true;
  if (usuario.rol === 'GERENTE') return evento.creado_por === usuario.id;
  return false;
}

const VENTANA_DIAS = 90;
const OTRO_TIPO_TAREA = '__otro'; // tareas "Otro" (sin tipo de tarea del catálogo)

export default function Tareas() {
  const { usuario } = useAuth();
  const veTodasSucursales = usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR';
  const esGerente = usuario.rol === 'GERENTE';
  const esColaborador = usuario.rol === 'COLABORADOR';
  const [sucursales, setSucursales] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState(''); // '' = todas
  const [filtroTipoTarea, setFiltroTipoTarea] = useState('');
  const [filtroResponsable, setFiltroResponsable] = useState(''); // '' = mi equipo (Gerente) / todos (Admin-Auditor)
  const [eventos, setEventos] = useState(null);
  const [tareaEnEdicion, setTareaEnEdicion] = useState(null);
  const [semanaAbierta, setSemanaAbierta] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (veTodasSucursales) api.get('/api/sucursales').then(setSucursales);
  }, [veTodasSucursales]);

  // Lista de responsables para el filtro de asignación - equipo propio si es
  // Gerente, o el universo elegible según la sucursal ya filtrada (o todas)
  // si es Admin/Auditor. El Colaborador nunca la pide (no ve el filtro).
  useEffect(() => {
    if (esColaborador) return;
    if (esGerente) {
      api.get(`/api/usuarios/buscar?sucursal_id=${usuario.sucursal_id}`).then(setResponsables).catch(() => setResponsables([]));
    } else if (veTodasSucursales) {
      const query = filtroSucursal ? `sucursal_id=${filtroSucursal}` : 'todas=true';
      api.get(`/api/usuarios/buscar?${query}`).then(setResponsables).catch(() => setResponsables([]));
    }
  }, [esGerente, esColaborador, veTodasSucursales, filtroSucursal, usuario.sucursal_id]);

  // Si Admin/Auditor cambia de sucursal, el responsable elegido puede haber
  // quedado fuera de alcance - se reinicia a "todos" en vez de dejar un
  // filtro que silenciosamente no devuelve nada.
  useEffect(() => { if (veTodasSucursales) setFiltroResponsable(''); }, [filtroSucursal]);

  function recargar() {
    const hoy = new Date();
    const desde = aClaveDia(new Date(hoy.getTime() - VENTANA_DIAS * 86400000));
    const hasta = aClaveDia(new Date(hoy.getTime() + VENTANA_DIAS * 86400000));
    const params = new URLSearchParams({ tipo: 'TAREA', desde, hasta });
    if (filtroSucursal) params.set('sucursal_id', filtroSucursal);
    if (filtroResponsable) params.set('responsable_id', filtroResponsable);
    api.get(`/api/calendario?${params}`).then(setEventos).catch((e) => setError(e.message));
  }
  useEffect(recargar, [filtroSucursal, filtroResponsable]);

  function manejarCambio(mensaje) {
    recargar();
    setToast(mensaje);
  }

  // Tipos de tarea presentes en lo ya cargado - evita pedirle el catálogo
  // completo al backend (que además es admin-only) solo para armar el filtro.
  const tiposTareaDisponibles = useMemo(() => {
    const mapa = new Map();
    let hayOtro = false;
    for (const e of eventos || []) {
      if (e.tipo_tarea_id) mapa.set(e.tipo_tarea_id, e.tipo_tarea_nombre);
      else hayOtro = true;
    }
    const lista = [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (hayOtro) lista.push({ id: OTRO_TIPO_TAREA, nombre: 'Otro' });
    return lista;
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    if (!filtroTipoTarea) return eventos || [];
    return (eventos || []).filter((e) => (filtroTipoTarea === OTRO_TIPO_TAREA ? !e.tipo_tarea_id : String(e.tipo_tarea_id) === filtroTipoTarea));
  }, [eventos, filtroTipoTarea]);

  const { demoradas, pendientesHoy, pendientesSemana, historial } = useMemo(() => {
    const hoyKey = claveDiaLocal(new Date());
    const d = [];
    const ph = [];
    const ps = [];
    const h = [];
    for (const e of eventosFiltrados) {
      if (e.estado_efectivo === 'COMPLETADA') h.push(e);
      else if (e.estado_efectivo === 'DEMORADA') d.push(e);
      else if (e.estado_efectivo === 'PENDIENTE') {
        if (claveDiaLocal(new Date(e.fecha_hora)) === hoyKey) ph.push(e);
        else ps.push(e);
      }
    }
    const porFecha = (a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora);
    d.sort(porFecha); ph.sort(porFecha); ps.sort(porFecha);
    h.sort((a, b) => new Date(b.completado_en) - new Date(a.completado_en));
    return { demoradas: d, pendientesHoy: ph, pendientesSemana: ps, historial: h };
  }, [eventosFiltrados]);

  if (!eventos) return <Cargando />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
        <div className="flex flex-wrap gap-2">
          {veTodasSucursales && (
            <Select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          )}
          {tiposTareaDisponibles.length > 0 && (
            <Select value={filtroTipoTarea} onChange={(e) => setFiltroTipoTarea(e.target.value)}>
              <option value="">Todos los tipos de tarea</option>
              {tiposTareaDisponibles.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Select>
          )}
          {(esGerente || veTodasSucursales) && (
            <Select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)}>
              <option value="">{esGerente ? 'Asignado a mi equipo' : 'Todos los responsables'}</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre || r.email}{r.sucursal_nombre ? ` · ${r.sucursal_nombre}` : ''}</option>
              ))}
            </Select>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {demoradas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-fat-bordo-600 uppercase mb-2">Demoradas ({demoradas.length})</h2>
          <Tarjeta className="overflow-hidden">
            <div className="divide-y divide-gray-100">
              {demoradas.map((e) => (
                <FilaTareaPendiente key={e.id} evento={e} puedeGestionar={puedeGestionarTarea(usuario, e)}
                  onCambio={manejarCambio} onEditar={() => setTareaEnEdicion(e)} />
              ))}
            </div>
          </Tarjeta>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pendientes de hoy ({pendientesHoy.length})</h2>
        <Tarjeta className="overflow-hidden">
          {pendientesHoy.length === 0 && <p className="p-4 text-sm text-gray-400">No tenés tareas pendientes para hoy.</p>}
          <div className="divide-y divide-gray-100">
            {pendientesHoy.map((e) => (
              <FilaTareaPendiente key={e.id} evento={e} puedeGestionar={puedeGestionarTarea(usuario, e)}
                onCambio={manejarCambio} onEditar={() => setTareaEnEdicion(e)} />
            ))}
          </div>
        </Tarjeta>
      </div>

      <div>
        <button type="button" onClick={() => setSemanaAbierta((a) => !a)} className="w-full flex items-center justify-between text-sm font-semibold text-gray-500 uppercase mb-2">
          <span>Pendientes de la semana ({pendientesSemana.length})</span>
          <span className="text-gray-400 normal-case text-xs font-normal">{semanaAbierta ? '▲ ocultar' : '▼ ver'}</span>
        </button>
        {semanaAbierta && (
          <Tarjeta className="overflow-hidden">
            {pendientesSemana.length === 0 && <p className="p-4 text-sm text-gray-400">No hay más pendientes esta semana.</p>}
            <div className="divide-y divide-gray-100">
              {pendientesSemana.map((e) => (
                <FilaTareaPendiente key={e.id} evento={e} puedeGestionar={puedeGestionarTarea(usuario, e)}
                  onCambio={manejarCambio} onEditar={() => setTareaEnEdicion(e)} />
              ))}
            </div>
          </Tarjeta>
        )}
      </div>

      <div>
        <button type="button" onClick={() => setHistorialAbierto((a) => !a)} className="w-full flex items-center justify-between text-sm font-semibold text-gray-500 uppercase mb-2">
          <span>Historial ({historial.length})</span>
          <span className="text-gray-400 normal-case text-xs font-normal">{historialAbierto ? '▲ ocultar' : '▼ ver'}</span>
        </button>
        {historialAbierto && (
          <Tarjeta className="overflow-hidden">
            {historial.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no se completó ninguna tarea.</p>}
            <div className="divide-y divide-gray-100">
              {historial.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                  {e.evidencia_url && (
                    <button onClick={() => setFotoAmpliada(e.evidencia_url)} className="shrink-0">
                      <img src={e.evidencia_url} alt="Evidencia" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{e.titulo}{e.sucursal_nombre ? ` · ${e.sucursal_nombre}` : ''}</p>
                    <p className="text-xs text-gray-400">
                      Programada: {formatearFechaHora(e)} · Completada: {new Date(e.completado_en).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                    <p className="text-xs text-gray-500 italic mt-0.5">{calcularObservacion(e)}</p>
                    {e.completado_comentario && <p className="text-xs text-gray-600 mt-0.5">"{e.completado_comentario}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}
      </div>

      {tareaEnEdicion && (
        <ModalEditarTarea
          evento={tareaEnEdicion}
          onClose={() => setTareaEnEdicion(null)}
          onGuardado={() => { setTareaEnEdicion(null); manejarCambio('Tarea actualizada'); }}
        />
      )}

      {fotoAmpliada && (
        <Modal titulo="Evidencia" onClose={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="Evidencia" className="w-full rounded-lg" />
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function FilaTareaPendiente({ evento, puedeGestionar, onCambio, onEditar }) {
  const [completando, setCompletando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState('');

  const puedeCompletar = new Date(evento.fecha_hora) <= new Date();

  async function confirmar() {
    if (evento.evidencia_obligatoria && !archivo) { setError('Esta tarea requiere una foto de evidencia'); return; }
    setGuardando(true);
    setError('');
    try {
      let evidenciaUrl = null;
      if (archivo) {
        evidenciaUrl = await subirArchivo({ rutaUrlSubida: `/api/calendario/${evento.id}/evidencia/url-subida`, carpeta: 'tareas', referencia: `tarea-${evento.id}`, archivo });
      }
      await api.post(`/api/calendario/${evento.id}/completar`, {
        comentario: comentario || null,
        evidencia_url: evidenciaUrl,
        evidencia_tipo: evidenciaUrl ? 'FOTO' : null,
      });
      onCambio('Tarea completada');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    setEliminando(true);
    setError('');
    try {
      await api.del(`/api/calendario/${evento.id}`);
      onCambio('Tarea eliminada');
    } catch (err) {
      setError(err.message);
      setEliminando(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{evento.titulo}{evento.sucursal_nombre ? ` · ${evento.sucursal_nombre}` : ''}</p>
          <p className="text-xs text-gray-400">
            Asignó: {evento.creado_por_nombre || '—'} · Programada: {formatearFechaHora(evento)}
            {evento.responsable_nombre && ` · ${evento.responsable_nombre}`}
          </p>
          {evento.tarea_descripcion && <p className="text-xs text-gray-500 mt-1">{evento.tarea_descripcion}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${evento.estado_efectivo === 'DEMORADA' ? 'bg-fat-bordo-100 text-fat-bordo-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {evento.estado_efectivo === 'DEMORADA' ? 'Demorada' : 'Pendiente'}
          </span>
          {!completando && (
            <div title={!puedeCompletar ? 'Todavía no llegó la fecha/hora programada' : undefined}>
              <Boton ancho="w-auto" variante="secundario" disabled={!puedeCompletar} onClick={() => setCompletando(true)}>Marcar cumplida</Boton>
            </div>
          )}
        </div>
      </div>

      {completando && (
        <div className="mt-2 space-y-2">
          <input className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          {evento.evidencia_obligatoria && (
            <div className="flex items-center gap-2">
              <BotonCamara archivo={archivo} onArchivo={setArchivo} />
              <span className="text-xs text-gray-400">Esta tarea requiere foto de evidencia (solo cámara).</span>
            </div>
          )}
          {error && <p className="text-xs text-fat-bordo-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Boton ancho="w-auto" cargando={guardando} onClick={confirmar}>Confirmar cumplimiento</Boton>
            <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(false)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {!completando && (evento.tarea_enlace || puedeGestionar) && (
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {evento.tarea_enlace && (
            <a href={evento.tarea_enlace} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium rounded-lg py-2 px-4 transition bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
              {evento.tarea_enlace_nombre || 'Ir a página web'}
            </a>
          )}
          {puedeGestionar && <button type="button" onClick={onEditar} className="text-xs text-fat-bordo-600 hover:underline">Editar</button>}
          {puedeGestionar && (
            <button type="button" onClick={eliminar} disabled={eliminando} className="text-xs text-gray-400 hover:text-fat-bordo-600 disabled:opacity-50">
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
        </div>
      )}
      {!completando && error && <p className="text-xs text-fat-bordo-600 mt-1">{error}</p>}
    </div>
  );
}

// Editar nombre/fecha/hora y, si la tarea está asignada a una persona
// puntual (no "por sector"), reasignarla - mismos campos que soporta
// PATCH /api/calendario/:id.
function ModalEditarTarea({ evento, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(evento.titulo);
  const [fecha, setFecha] = useState(evento.fecha_hora.slice(0, 10));
  const [hora, setHora] = useState(evento.hora_definida ? evento.fecha_hora.slice(11, 16) : '');
  const [responsableId, setResponsableId] = useState(evento.responsable_user_id || '');
  const [responsableNombre, setResponsableNombre] = useState(evento.responsable_nombre || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const puedeElegirResponsable = !!evento.responsable_user_id;

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (!fecha) { setError('Elegí una fecha'); return; }
    setGuardando(true);
    setError('');
    try {
      const fechaHora = evento.hora_definida && hora ? `${fecha}T${hora}:00` : `${fecha}T00:00:00`;
      const body = { titulo: nombre.trim(), fecha_hora: fechaHora };
      if (puedeElegirResponsable && responsableId) body.responsable_user_id = Number(responsableId);
      await api.patch(`/api/calendario/${evento.id}`, body);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Editar tarea" onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <div className={evento.hora_definida ? 'grid grid-cols-2 gap-3' : ''}>
          <Campo label="Fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          {evento.hora_definida && (
            <Campo label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          )}
        </div>
        {puedeElegirResponsable && (
          <BuscadorResponsable
            sucursalId={evento.sucursal_id}
            value={responsableId}
            nombreValue={responsableNombre}
            onChange={(id, u) => { setResponsableId(id); setResponsableNombre(u ? (u.nombre || u.email) : ''); }}
          />
        )}
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Aplicar cambios</Boton>
      </form>
    </Modal>
  );
}
