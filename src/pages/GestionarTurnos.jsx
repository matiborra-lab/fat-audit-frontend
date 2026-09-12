import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando, SelectorDias } from '../components/ui';
import BuscadorResponsable from '../components/BuscadorResponsable';

const PUESTOS = ['COCINA', 'CAJA', 'REFUERZO_COCINA'];
const PUESTO_LABEL = { COCINA: 'Cocina', CAJA: 'Caja', REFUERZO_COCINA: 'Refuerzo cocina' };
const TURNO_LABEL = { DIURNO: 'Diurno', NOCTURNO: 'Nocturno' };
const FERIADO_TIPO_LABEL = { inamovible: 'Feriado nacional', trasladable: 'Feriado trasladable', puente: 'Puente turístico' };
const ICONO_EVENTO_ESPECIAL_DEFAULT = '🎉';
// Lun..Dom en la UI -> Date#getDay() (0=domingo..6=sábado), que es lo que
// espera el backend. Una sola letra (no "Lun"/"Dom") para que las 7 entren
// en una fila dentro de un círculo chico sin saltar de línea en mobile.
const DIAS_SEMANA_UI = [
  { label: 'L', valor: 1 }, { label: 'M', valor: 2 }, { label: 'X', valor: 3 },
  { label: 'J', valor: 4 }, { label: 'V', valor: 5 }, { label: 'S', valor: 6 }, { label: 'D', valor: 0 },
];

function aClaveDia(d) {
  return d.toISOString().slice(0, 10);
}
function hoyISO() {
  return aClaveDia(new Date());
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
function generarGrillaMes(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const diaSemana = (primero.getDay() + 6) % 7;
  const inicio = new Date(anio, mes, 1 - diaSemana);
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

export default function GestionarTurnos() {
  const { usuario } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState(usuario.rol === 'GERENTE' ? usuario.sucursal_id : '');
  const [horarios, setHorarios] = useState(null); // Map 'dia|turno' -> {habilitado}, ver Sucursales > Horario de turnos

  const [vista, setVista] = useState('SEMANA'); // SEMANA | MES
  const [ancla, setAncla] = useState(new Date());

  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [solicitudes, setSolicitudes] = useState(null);
  const [turnos, setTurnos] = useState(null);

  const [celdaAbierta, setCeldaAbierta] = useState(null); // { fecha, turnoTipo }
  const [formAlta, setFormAlta] = useState({ responsable: null, puesto: '' });
  const [guardandoAlta, setGuardandoAlta] = useState(false);

  const [formProgramar, setFormProgramar] = useState({
    responsable: null, puesto: '', turnoTipo: 'DIURNO', diasSemana: [], fechaDesde: hoyISO(), fechaHasta: '',
  });
  const [guardandoProgramar, setGuardandoProgramar] = useState(false);

  const [notificarAlAsignar, setNotificarAlAsignar] = useState(true);
  const [asignando, setAsignando] = useState(false);
  const [fallidosNotificacion, setFallidosNotificacion] = useState([]);
  const [reintentando, setReintentando] = useState(false);

  const semana = useMemo(() => generarSemana(lunesDeSemana(ancla)), [ancla]);
  const grillaMes = useMemo(() => generarGrillaMes(ancla.getFullYear(), ancla.getMonth()), [ancla]);
  const diasVisibles = vista === 'SEMANA' ? semana : grillaMes;

  useEffect(() => {
    if (usuario.rol === 'ADMIN') api.get('/api/sucursales').then(setSucursales);
  }, [usuario.rol]);

  useEffect(() => {
    if (!sucursalId) { setHorarios(null); return; }
    api.get(`/api/sucursales/${sucursalId}/horario-turnos`).then((rows) => {
      setHorarios(new Map(rows.map((r) => [`${r.dia_semana}|${r.turno_tipo}`, r.habilitado])));
    }).catch(() => setHorarios(new Map()));
  }, [sucursalId]);

  function recargar() {
    if (!sucursalId) return;
    api.get('/api/calendario/solicitudes').then(setSolicitudes).catch(() => setSolicitudes([]));
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    api.get(`/api/calendario?sucursal_id=${sucursalId}&tipo=TURNO&desde=${desde}&hasta=${hasta}`).then(setTurnos).catch(() => setTurnos([]));
  }
  useEffect(recargar, [sucursalId, vista, ancla.getMonth(), ancla.getFullYear(), ancla.getDate()]);

  // Overlay de solo lectura (feriados/cumpleaños/eventos especiales) para que
  // el gerente vea qué hay en cada día al gestionar turnos - mismas fuentes
  // que el calendario, sin estado de pendiente (un evento especial no es una
  // tarea que pueda quedar pendiente).
  const [feriados, setFeriados] = useState([]);
  useEffect(() => {
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    api.get(`/api/feriados?desde=${desde}&hasta=${hasta}`).then(setFeriados).catch(() => setFeriados([]));
  }, [vista, ancla.getMonth(), ancla.getFullYear(), ancla.getDate()]);
  const feriadosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const f of feriados) {
      if (!mapa.has(f.fecha)) mapa.set(f.fecha, []);
      mapa.get(f.fecha).push(f);
    }
    return mapa;
  }, [feriados]);

  const [cumpleanos, setCumpleanos] = useState([]);
  useEffect(() => {
    if (!sucursalId) { setCumpleanos([]); return; }
    const anios = new Set([diasVisibles[0].getFullYear(), diasVisibles[diasVisibles.length - 1].getFullYear()]);
    Promise.all([...anios].map((anio) => api.get(`/api/sucursales/${sucursalId}/cumpleanos?anio=${anio}`).catch(() => [])))
      .then((listas) => setCumpleanos(listas.flat()));
  }, [sucursalId, vista, ancla.getMonth(), ancla.getFullYear(), ancla.getDate()]);
  const cumpleanosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const c of cumpleanos) {
      if (!mapa.has(c.fecha)) mapa.set(c.fecha, []);
      mapa.get(c.fecha).push(c);
    }
    return mapa;
  }, [cumpleanos]);

  const [eventosEspeciales, setEventosEspeciales] = useState([]);
  useEffect(() => {
    if (!sucursalId) { setEventosEspeciales([]); return; }
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    api.get(`/api/calendario?sucursal_id=${sucursalId}&tipo=EVENTO_ESPECIAL&desde=${desde}&hasta=${hasta}`).then(setEventosEspeciales).catch(() => setEventosEspeciales([]));
  }, [sucursalId, vista, ancla.getMonth(), ancla.getFullYear(), ancla.getDate()]);
  const eventosEspecialesPorDia = useMemo(() => {
    const mapa = new Map();
    for (const e of eventosEspeciales) {
      const clave = e.fecha_hora.slice(0, 10);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(e);
    }
    return mapa;
  }, [eventosEspeciales]);

  function novedadesDelDia(claveFecha) {
    return {
      feriados: feriadosPorDia.get(claveFecha) || [],
      cumpleanos: cumpleanosPorDia.get(claveFecha) || [],
      eventosEspeciales: eventosEspecialesPorDia.get(claveFecha) || [],
    };
  }

  const turnosPorDia = useMemo(() => {
    // clave = 'YYYY-MM-DD|DIURNO|COCINA'
    const mapa = new Map();
    for (const t of turnos || []) {
      const clave = `${t.fecha_hora.slice(0, 10)}|${t.turno_tipo}|${t.puesto}`;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(t);
    }
    return mapa;
  }, [turnos]);

  const totalesPorDia = useMemo(() => {
    const mapa = new Map();
    for (const t of turnos || []) {
      const dia = t.fecha_hora.slice(0, 10);
      if (!mapa.has(dia)) mapa.set(dia, { DIURNO: 0, NOCTURNO: 0 });
      mapa.get(dia)[t.turno_tipo]++;
    }
    return mapa;
  }, [turnos]);

  function abrirAlta(fecha, turnoTipo) {
    setCeldaAbierta({ fecha, turnoTipo });
    setFormAlta({ responsable: null, puesto: '' });
  }

  async function confirmarAlta() {
    if (!formAlta.responsable || !formAlta.puesto) { setError('Elegí un colaborador (el puesto se completa solo)'); return; }
    setGuardandoAlta(true);
    setError('');
    try {
      await api.post('/api/calendario/turnos', {
        sucursal_id: Number(sucursalId), fecha: celdaAbierta.fecha, turno_tipo: celdaAbierta.turnoTipo,
        responsable_user_id: formAlta.responsable.id, puesto: formAlta.puesto,
      });
      setCeldaAbierta(null);
      setToast('Turno agregado - pendiente de confirmar con "Asignar turnos"');
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoAlta(false);
    }
  }

  async function eliminarTurno(id) {
    try {
      await api.del(`/api/calendario/${id}`);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resolverSolicitud(id) {
    try {
      await api.post(`/api/calendario/${id}/resolver-solicitud`);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function enviarProgramacion(e) {
    e.preventDefault();
    setError('');
    if (!formProgramar.responsable) { setError('Elegí un colaborador'); return; }
    if (!formProgramar.puesto) { setError('Elegí un puesto'); return; }
    if (!formProgramar.diasSemana.length) { setError('Elegí al menos un día de la semana'); return; }
    setGuardandoProgramar(true);
    try {
      const resultado = await api.post('/api/calendario/turnos/programar', {
        sucursal_id: Number(sucursalId), responsable_user_id: formProgramar.responsable.id, puesto: formProgramar.puesto,
        turno_tipo: formProgramar.turnoTipo, dias_semana: formProgramar.diasSemana,
        fecha_desde: formProgramar.fechaDesde, fecha_hasta: formProgramar.fechaHasta || null,
      });
      setToast(`${resultado.creados} turnos programados, pendientes de confirmar` + (resultado.ventanaSinFin ? ` (próximos ${resultado.ventanaSinFin} días - sin fecha hasta, hay que volver a programar más adelante)` : ''));
      setFormProgramar({ responsable: null, puesto: '', turnoTipo: 'DIURNO', diasSemana: [], fechaDesde: hoyISO(), fechaHasta: '' });
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoProgramar(false);
    }
  }

  const pendientes = (turnos || []).filter((t) => !t.asignacion_confirmada);

  async function asignarTurnos() {
    setAsignando(true);
    setError('');
    setFallidosNotificacion([]);
    try {
      const desde = aClaveDia(diasVisibles[0]);
      const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
      const resultado = await api.post('/api/calendario/turnos/asignar', {
        sucursal_id: Number(sucursalId), desde, hasta, notificar: notificarAlAsignar,
      });
      setFallidosNotificacion(resultado.fallidos || []);
      let msg = `${resultado.confirmados} turno(s) asignado(s)`;
      if (notificarAlAsignar && resultado.notificados?.length) msg += ` · ${resultado.notificados.length} notificado(s)`;
      if (resultado.fallidos?.length) msg += ` · no se pudo notificar a ${resultado.fallidos.length}`;
      setToast(msg);
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setAsignando(false);
    }
  }

  async function reintentarNotificacion() {
    setReintentando(true);
    try {
      const ids = fallidosNotificacion.flatMap((f) => f.evento_ids);
      const resultado = await api.post('/api/calendario/turnos/notificar', { ids });
      setFallidosNotificacion(resultado.fallidos || []);
      setToast(resultado.fallidos?.length ? `Todavía no se pudo notificar a ${resultado.fallidos.length}` : 'Notificación reenviada correctamente');
    } catch (err) {
      setError(err.message);
    } finally {
      setReintentando(false);
    }
  }

  function navegar(delta) {
    const nueva = new Date(ancla);
    if (vista === 'SEMANA') nueva.setDate(nueva.getDate() + delta * 7);
    else nueva.setMonth(nueva.getMonth() + delta);
    setAncla(nueva);
  }

  function irAHoy() {
    setAncla(new Date());
  }

  // Chips compactos de solo lectura - sin acciones ni estado (ver
  // novedadesDelDia): un feriado/cumpleaños/evento especial no se "gestiona"
  // acá, solo informa al gerente qué hay ese día.
  function NovedadesDia({ claveFecha, compacto }) {
    const { feriados: f, cumpleanos: c, eventosEspeciales: e } = novedadesDelDia(claveFecha);
    if (!f.length && !c.length && !e.length) return null;
    return (
      <div className={`flex flex-wrap gap-0.5 ${compacto ? 'mt-0.5' : 'mb-1'}`}>
        {f.map((item) => (
          <span key={`f-${item.fecha}-${item.nombre}`} title={`${FERIADO_TIPO_LABEL[item.tipo] || 'Feriado'}: ${item.nombre}`}
            className="inline-flex items-center gap-0.5 text-[10px] bg-sky-100 text-sky-800 rounded px-1 py-0.5">
            🇦🇷{!compacto && ` ${item.nombre}`}
          </span>
        ))}
        {c.map((item) => (
          <span key={`c-${item.usuario_id}`} title={`Cumpleaños de ${item.nombre || item.email}`}
            className="inline-flex items-center gap-0.5 text-[10px] bg-fuchsia-100 text-fuchsia-800 rounded px-1 py-0.5">
            🎁{!compacto && ` ${(item.nombre || item.email || '').split(' ')[0]}`}
          </span>
        ))}
        {e.map((item) => (
          <span key={`e-${item.id}`} title={item.titulo}
            className="inline-flex items-center gap-0.5 text-[10px] bg-pink-100 text-pink-700 rounded px-1 py-0.5">
            {item.icono || ICONO_EVENTO_ESPECIAL_DEFAULT}{!compacto && ` ${item.titulo}`}
          </span>
        ))}
      </div>
    );
  }

  // Tocar el turno abre un modal para elegir a quién agregar (ver
  // celdaAbierta más abajo) en vez de expandir un formulario adentro de esta
  // celda chica - las celdas achicadas para entrar 7 en una fila en mobile
  // no tienen lugar para eso. El "+" queda igual, solo cambia dónde se
  // completa el alta. El turno directamente no se renderiza si no está
  // habilitado ese día (ver los `diurnoHabilitado`/`nocturnoHabilitado` de
  // más arriba) - antes se dibujaba un placeholder "No disponible".
  function CeldaTurno({ fecha, turnoTipo }) {
    const claveFecha = aClaveDia(fecha);
    return (
      <div className="border border-gray-100 rounded-lg p-1 sm:p-1.5 bg-gray-50/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase truncate">{TURNO_LABEL[turnoTipo]}</span>
          <button onClick={() => abrirAlta(claveFecha, turnoTipo)} className="text-fat-bordo-600 hover:bg-fat-bordo-50 rounded w-4 h-4 leading-none text-sm font-bold shrink-0">+</button>
        </div>
        <div className="space-y-1">
          {PUESTOS.map((p) => {
            const lista = turnosPorDia.get(`${claveFecha}|${turnoTipo}|${p}`) || [];
            return (
              <div key={p} className="text-[9px] sm:text-[10px]">
                <span className="text-gray-400">{PUESTO_LABEL[p]} ({lista.length})</span>
                {lista.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {lista.map((t) => (
                      <span
                        key={t.id}
                        title={t.asignacion_confirmada ? 'Asignado' : 'Pendiente de confirmar'}
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded ${
                          t.solicitud_revision_estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-700'
                          : !t.asignacion_confirmada ? 'bg-gray-100 text-gray-500'
                          : 'bg-white border border-gray-200 text-gray-700'
                        }`}
                      >
                        {!t.asignacion_confirmada ? '🕒 ' : '✓ '}{t.responsable_nombre?.split(' ')[0] || '—'}
                        <button onClick={() => eliminarTurno(t.id)} className="text-gray-300 hover:text-fat-bordo-600 leading-none">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Gestionar turnos</h1>

      {usuario.rol === 'ADMIN' && (
        <Select label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Elegí una sucursal</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Select>
      )}

      {!sucursalId && usuario.rol === 'ADMIN' && <p className="text-sm text-gray-400">Elegí una sucursal para empezar.</p>}

      {sucursalId && (
        <>
          <p className="text-xs text-gray-400">
            El horario y los días habilitados de cada turno se configuran desde{' '}
            <Link to="/configuracion" className="text-fat-bordo-600 hover:underline">Sucursales</Link>.
          </p>

          {solicitudes && solicitudes.length > 0 && (
            <Tarjeta className="p-4 border-yellow-200 bg-yellow-50/50">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Solicitudes de revisión pendientes</h2>
              <div className="space-y-2">
                {solicitudes.map((s) => (
                  <div key={s.id} className="text-sm bg-white rounded-lg border border-yellow-200 p-2.5">
                    <p className="font-medium text-gray-900">{s.responsable_nombre} · {PUESTO_LABEL[s.puesto] || s.puesto}</p>
                    <p className="text-xs text-gray-500">{new Date(s.fecha_hora).toLocaleString('es-AR', { hour12: false })}</p>
                    <p className="text-xs text-gray-600 italic mt-1">"{s.solicitud_revision_motivo}"</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1">
                        <BuscadorResponsable sucursalId={sucursalId} label="Reasignar a" onChange={async (id) => { if (id) { await api.patch(`/api/calendario/${s.id}`, { responsable_user_id: id }); recargar(); } }} />
                      </div>
                      <button onClick={() => resolverSolicitud(s.id)} className="text-xs text-gray-500 hover:text-fat-bordo-600 shrink-0">Descartar</button>
                    </div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}

          <Tarjeta className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 rounded-lg border border-gray-300 text-sm" onClick={() => navegar(-1)}>←</button>
                <p className="text-sm font-medium text-gray-800 min-w-[160px] text-center">
                  {vista === 'SEMANA'
                    ? `${semana[0].toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} — ${semana[6].toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`
                    : ancla.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                </p>
                <button className="px-2 py-1 rounded-lg border border-gray-300 text-sm" onClick={() => navegar(1)}>→</button>
                <button className="text-sm text-fat-bordo-600 hover:underline ml-1" onClick={irAHoy}>Hoy</button>
              </div>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                <button onClick={() => setVista('SEMANA')} className={`px-3 py-1 ${vista === 'SEMANA' ? 'bg-fat-bordo-500 text-white' : 'bg-white text-gray-600'}`}>Semana</button>
                <button onClick={() => setVista('MES')} className={`px-3 py-1 ${vista === 'MES' ? 'bg-fat-bordo-500 text-white' : 'bg-white text-gray-600'}`}>Mes</button>
              </div>
            </div>

            {!turnos && <Cargando />}

            {turnos && vista === 'SEMANA' && (
              <div className="grid grid-cols-7 gap-1">
                {semana.map((d) => {
                  const diaSemana = d.getDay();
                  const diurnoHabilitado = horarios?.get(`${diaSemana}|DIURNO`);
                  const nocturnoHabilitado = horarios?.get(`${diaSemana}|NOCTURNO`);
                  return (
                    <div key={aClaveDia(d)} className="min-w-0">
                      <p className="text-[11px] sm:text-xs font-medium text-gray-700 text-center mb-1 truncate">
                        {d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' })}
                      </p>
                      <NovedadesDia claveFecha={aClaveDia(d)} compacto />
                      <div className="space-y-1">
                        {diurnoHabilitado && <CeldaTurno fecha={d} turnoTipo="DIURNO" />}
                        {nocturnoHabilitado && <CeldaTurno fecha={d} turnoTipo="NOCTURNO" />}
                        {!diurnoHabilitado && !nocturnoHabilitado && (
                          <p className="text-[9px] text-gray-300 text-center">Sin turnos</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {turnos && vista === 'MES' && (
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-1.5">{d}</div>
                ))}
                {grillaMes.map((d, i) => {
                  const delMes = d.getMonth() === ancla.getMonth();
                  const totales = totalesPorDia.get(aClaveDia(d)) || { DIURNO: 0, NOCTURNO: 0 };
                  return (
                    <button
                      key={i}
                      onClick={() => { setAncla(d); setVista('SEMANA'); }}
                      className={`bg-white min-h-[64px] p-1.5 text-left hover:bg-gray-50 ${!delMes ? 'opacity-40' : ''}`}
                    >
                      <span className="text-xs text-gray-600">{d.getDate()}</span>
                      <NovedadesDia claveFecha={aClaveDia(d)} compacto />
                      {(totales.DIURNO > 0 || totales.NOCTURNO > 0) && (
                        <div className="mt-1 space-y-0.5">
                          {totales.DIURNO > 0 && <p className="text-[10px] bg-fat-amarillo-100 text-fat-amarillo-800 rounded px-1">D: {totales.DIURNO}</p>}
                          {totales.NOCTURNO > 0 && <p className="text-[10px] bg-fat-celeste-100 text-fat-celeste-800 rounded px-1">N: {totales.NOCTURNO}</p>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Tarjeta>

          {pendientes.length > 0 && (
            <Tarjeta className="p-4 border-fat-bordo-200 bg-fat-bordo-50/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">🕒 {pendientes.length} turno{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de confirmar</p>
                  <label className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                    <input type="checkbox" checked={notificarAlAsignar} onChange={(e) => setNotificarAlAsignar(e.target.checked)} />
                    Notificar colaboradores
                  </label>
                </div>
                <Boton ancho="w-auto" cargando={asignando} onClick={asignarTurnos}>✓ Asignar turnos</Boton>
              </div>
            </Tarjeta>
          )}

          {fallidosNotificacion.length > 0 && (
            <Tarjeta className="p-3 border-yellow-200 bg-yellow-50/50">
              <p className="text-xs text-yellow-800 mb-2">No se pudo notificar a: {fallidosNotificacion.map((f) => f.nombre || 'colaborador').join(', ')}</p>
              <Boton ancho="w-auto" variante="secundario" cargando={reintentando} onClick={reintentarNotificacion}>Reintentar notificación</Boton>
            </Tarjeta>
          )}

          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

          <Tarjeta className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Programar asignaciones</h2>
            <p className="text-xs text-gray-400">Asigná a alguien de forma recurrente, sin tener que repetirlo cada semana a mano.</p>
            <form onSubmit={enviarProgramacion} className="space-y-3">
              <BuscadorResponsable
                sucursalId={sucursalId} label="Colaborador" nombreValue={formProgramar.responsable?.nombre}
                onChange={(id, u) => setFormProgramar({ ...formProgramar, responsable: u, puesto: u?.puesto || formProgramar.puesto })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Puesto" value={formProgramar.puesto} onChange={(e) => setFormProgramar({ ...formProgramar, puesto: e.target.value })}>
                  <option value="">Elegí un puesto</option>
                  {PUESTOS.map((p) => <option key={p} value={p}>{PUESTO_LABEL[p]}</option>)}
                </Select>
                <Select label="Turno" value={formProgramar.turnoTipo} onChange={(e) => setFormProgramar({ ...formProgramar, turnoTipo: e.target.value })}>
                  <option value="DIURNO">Diurno</option>
                  <option value="NOCTURNO">Nocturno</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días de la semana</label>
                <SelectorDias opciones={DIAS_SEMANA_UI} seleccionados={formProgramar.diasSemana} onChange={(v) => setFormProgramar({ ...formProgramar, diasSemana: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Desde" type="date" required value={formProgramar.fechaDesde} onChange={(e) => setFormProgramar({ ...formProgramar, fechaDesde: e.target.value })} />
                <Campo label="Hasta (opcional)" type="date" value={formProgramar.fechaHasta} onChange={(e) => setFormProgramar({ ...formProgramar, fechaHasta: e.target.value })} />
              </div>
              <Boton type="submit" ancho="w-auto" cargando={guardandoProgramar}>Programar</Boton>
            </form>
          </Tarjeta>
        </>
      )}

      {celdaAbierta && (
        <Modal
          titulo={`Agregar · ${TURNO_LABEL[celdaAbierta.turnoTipo]} · ${new Date(`${celdaAbierta.fecha}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' })}`}
          onClose={() => setCeldaAbierta(null)}
        >
          <div className="space-y-3">
            <BuscadorResponsable
              sucursalId={sucursalId} label="Colaborador" nombreValue={formAlta.responsable?.nombre}
              onChange={(id, u) => setFormAlta({ responsable: u, puesto: u?.puesto || '' })}
            />
            <Select label="Puesto" value={formAlta.puesto} onChange={(e) => setFormAlta({ ...formAlta, puesto: e.target.value })}>
              <option value="">Elegí un puesto</option>
              {PUESTOS.map((p) => <option key={p} value={p}>{PUESTO_LABEL[p]}</option>)}
            </Select>
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <div className="flex gap-2">
              <Boton ancho="w-auto" cargando={guardandoAlta} onClick={confirmarAlta}>Agregar</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => setCeldaAbierta(null)}>Cancelar</Boton>
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
