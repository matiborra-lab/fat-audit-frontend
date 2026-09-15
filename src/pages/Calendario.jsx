import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando, BotonCamara, SelectorEmoji, SelectorSucursalesMultiple, SelectorDias, emojiClima } from '../components/ui';
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
  // Feriados/promos - estilo distintivo (pulso) para que resalte del resto.
  EVENTO_ESPECIAL: 'bg-pink-100 text-pink-700 animate-pulse',
  // Feriados nacionales (ArgentinaDatos) - color e ícono propio, ver TIPO_ICONO.
  FERIADO: 'bg-sky-100 text-sky-800',
  CUMPLEANOS: 'bg-fuchsia-100 text-fuchsia-800',
  LICENCIA: 'bg-teal-100 text-teal-800',
};
const TIPO_ICONO = { AUDITORIA: '📋', AUDITORIA_INTERNA: '📋', SEGUIMIENTO: '📋', FERIADO: '🇦🇷', CUMPLEANOS: '🎁', LICENCIA: '🌴' };
const ICONO_TAREA_DEFAULT = '📝';
const ICONO_EVENTO_ESPECIAL_DEFAULT = '🎉';

// Chips de resumen de la tarjeta del día en vista Semana (agrupa todo lo que
// no sea Turno, que ya tiene su propio ícono sol/luna aparte) - un ícono fijo
// por categoría (no el de cada evento puntual, que puede variar) más un
// singular/plural para el label en desktop.
const RESUMEN_TIPO = {
  TAREA: { icono: '📝', singular: 'tarea', plural: 'tareas', color: 'bg-fat-amarillo-100 text-fat-amarillo-800' },
  AUDITORIA: { icono: '📋', singular: 'auditoría', plural: 'auditorías', color: 'bg-fat-bordo-100 text-fat-bordo-700' },
  SEGUIMIENTO: { icono: '📋', singular: 'seguimiento', plural: 'seguimientos', color: 'bg-orange-100 text-orange-700' },
  EVENTO_ESPECIAL: { icono: '⭐', singular: 'evento', plural: 'eventos', color: 'bg-pink-100 text-pink-700' },
  FERIADO: { icono: '🇦🇷', singular: 'feriado', plural: 'feriados', color: 'bg-sky-100 text-sky-800' },
  CUMPLEANOS: { icono: '🎂', singular: 'cumpleaños', plural: 'cumpleaños', color: 'bg-fuchsia-100 text-fuchsia-800' },
  LICENCIA: { icono: '🌴', singular: 'licencia', plural: 'licencias', color: 'bg-teal-100 text-teal-800' },
};

// Ícono chico "al costado del nombre" del evento: fijo por tipo (Auditoría/
// Seguimiento/Feriado/Cumpleaños), el de una Tarea sale del tipo de tarea
// elegido en Configuración (no se elige al programarla), y el de un Evento
// especial lo elige quien lo crea.
function iconoEvento(e) {
  if (e.tipo === 'EVENTO_ESPECIAL') return e.icono || ICONO_EVENTO_ESPECIAL_DEFAULT;
  if (e.tipo === 'TAREA') return e.tipo_tarea_icono || ICONO_TAREA_DEFAULT;
  return TIPO_ICONO[e.tipo] || '';
}
const FERIADO_TIPO_LABEL = { inamovible: 'Feriado nacional', trasladable: 'Feriado trasladable', puente: 'Puente turístico' };
const TIPO_LABEL = { AUDITORIA: 'Auditoría de marca', AUDITORIA_INTERNA: 'Auditoría interna', SEGUIMIENTO: 'Seguimiento', TAREA: 'Tarea', TURNO: 'Turno', EVENTO_ESPECIAL: 'Evento especial', FERIADO: 'Feriado', CUMPLEANOS: 'Cumpleaños', LICENCIA: 'Licencia' };
const TIPOS_FILTRO = [
  { valor: 'AUDITORIA', label: 'Auditoría' },
  { valor: 'SEGUIMIENTO', label: 'Seguimiento' },
  { valor: 'TAREA', label: 'Tarea' },
  { valor: 'TURNO', label: 'Turno' },
  { valor: 'EVENTO_ESPECIAL', label: 'Evento especial' },
  { valor: 'FERIADO', label: 'Feriado' },
  { valor: 'CUMPLEANOS', label: 'Cumpleaños' },
  { valor: 'LICENCIA', label: 'Licencia' },
];
const MOTIVO_LICENCIA_LABEL = { VACACIONES: 'Vacaciones', SALUD: 'Salud', FAMILIAR: 'Asuntos familiares', OTRO: 'Otro' };
const MOTIVOS_PRESET = ['Baja por malestar', 'Problemas personales', 'Evento especial'];
const PUESTOS = ['COCINA', 'CAJA', 'REFUERZO_COCINA'];
const PUESTO_LABEL = { COCINA: 'Cocina', CAJA: 'Caja', REFUERZO_COCINA: 'Refuerzo cocina' };
const TURNO_TIPO_LABEL = { DIURNO: 'diurno', NOCTURNO: 'nocturno' };
// Lun..Dom en la UI -> Date#getDay() (0=domingo..6=sábado), igual que el resto de la app (ver GestionarTurnos).
const DIAS_SEMANA_UI = [
  { label: 'L', valor: 1 }, { label: 'M', valor: 2 }, { label: 'X', valor: 3 },
  { label: 'J', valor: 4 }, { label: 'V', valor: 5 }, { label: 'S', valor: 6 }, { label: 'D', valor: 0 },
];
const DIAS_DEL_MES = Array.from({ length: 31 }, (_, i) => i + 1);

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
      <button type="button" onClick={() => setAbierto((a) => !a)} className="h-9 flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-700 max-w-[220px] shrink-0">
        <span className="shrink-0">🏷️</span><span className="truncate">{etiqueta}</span>
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

// Tarjeta de un día en la vista Semana (rediseño) - Turno se resume con
// sol/luna en vez de texto (o "Libre" si no hay ninguno programado), y el
// resto de los tipos se agrupa en chips ícono+cantidad (con label en
// desktop, solo el número en mobile - ver RESUMEN_TIPO). Tocar la tarjeta
// no abre nada aparte: solo cambia qué día muestra el panel "Detalle del
// día" de más abajo.
function DiaCardSemana({ dia, etiqueta, esHoy, seleccionado, eventosDia, feriadosDia, cumpleanosDia, licenciasDia, climaDia: climaDiaRaw, usuario, onClick }) {
  const climaDia = climaDiaRaw?.temp_max != null ? climaDiaRaw : null;
  const turnos = eventosDia.filter((e) => e.tipo === 'TURNO');
  const tiposTurno = new Set(turnos.map((t) => t.turno_tipo));
  // El Gerente ve los turnos de todos - si ese día hay turnos (de otros) pero
  // no tiene uno propio, se lo aclara aparte para no confundir "hay gente
  // trabajando" con "yo trabajo".
  const gerenteLibreEseDia = usuario?.rol === 'GERENTE' && tiposTurno.size > 0 && !turnos.some((t) => t.responsable_user_id === usuario.id);
  const conteos = new Map();
  for (const e of eventosDia) {
    if (e.tipo === 'TURNO') continue;
    conteos.set(e.tipo, (conteos.get(e.tipo) || 0) + 1);
  }
  if (feriadosDia.length) conteos.set('FERIADO', (conteos.get('FERIADO') || 0) + feriadosDia.length);
  if (cumpleanosDia.length) conteos.set('CUMPLEANOS', (conteos.get('CUMPLEANOS') || 0) + cumpleanosDia.length);
  if (licenciasDia?.length) conteos.set('LICENCIA', (conteos.get('LICENCIA') || 0) + licenciasDia.length);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 bg-white px-2 py-3 text-center transition-colors ${
        seleccionado ? 'border-fat-bordo-500 bg-fat-bordo-50/50' : 'border-gray-200 hover:border-fat-bordo-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-medium ${seleccionado ? 'text-fat-bordo-700' : 'text-gray-500'}`}>{etiqueta}</span>
        {climaDia && (
          <span className="text-[9px] text-gray-400" title={`${Math.round(climaDia.temp_min)}° / ${Math.round(climaDia.temp_max)}°`}>
            {emojiClima(climaDia.weather_code)}
          </span>
        )}
      </div>
      <span className={`text-lg font-bold ${esHoy ? 'text-fat-bordo-600' : 'text-gray-900'}`}>{dia.getDate()}</span>

      {tiposTurno.size === 0 ? (
        <div className="flex flex-col items-center gap-1">
          <span className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-base leading-none">—</span>
          <span className="text-[10px] text-gray-400">Libre</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            {tiposTurno.has('DIURNO') && (
              <span className="w-9 h-9 rounded-full bg-fat-amarillo-100 flex items-center justify-center text-base" title="Turno diurno">☀️</span>
            )}
            {tiposTurno.has('NOCTURNO') && (
              <span className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-base" title="Turno nocturno">🌙</span>
            )}
          </div>
          {gerenteLibreEseDia && <span className="text-[9px] text-gray-400">(vos: libre)</span>}
        </div>
      )}

      {conteos.size > 0 && (
        <div className="flex flex-col items-center gap-1">
          {[...conteos.entries()].map(([tipo, n]) => {
            const info = RESUMEN_TIPO[tipo];
            if (!info) return null;
            return (
              <span key={tipo} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${info.color}`}>
                {info.icono} {n}<span className="hidden sm:inline">&nbsp;{n === 1 ? info.singular : info.plural}</span>
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

export default function Calendario() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const hoy = new Date();
  const [vista, setVista] = useState('SEMANA'); // MES | SEMANA - Semana es la vista por default (ver pedido de rediseño)
  const [ancla, setAncla] = useState(hoy);
  const [eventos, setEventos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [filtroSucursales, setFiltroSucursales] = useState(null); // null = todas
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
  // Clima: solo tiene sentido mostrarlo cuando se está viendo UNA sucursal
  // puntual (Gerente/Colaborador siempre ven la suya; Admin/Auditor solo si
  // filtraron una) - "todas las sucursales" no muestra clima.
  const sucursalIdVista = veTodasSucursales ? (Array.isArray(filtroSucursales) && filtroSucursales.length === 1 ? filtroSucursales[0] : null) : usuario.sucursal_id;
  const [clima, setClima] = useState([]);
  useEffect(() => {
    if (!sucursalIdVista) { setClima([]); return; }
    api.get(`/api/sucursales/${sucursalIdVista}/clima`).then(setClima).catch(() => setClima([]));
  }, [sucursalIdVista]);
  const climaPorDia = useMemo(() => new Map(clima.map((c) => [c.fecha, c])), [clima]);

  // Horario real de cada turno (hora_desde/hora_hasta) para mostrar el rango
  // completo en el detalle del día en vez de solo la hora de inicio - mismo
  // criterio que el clima: solo tiene sentido con UNA sucursal puntual en vista.
  const [horarios, setHorarios] = useState([]);
  useEffect(() => {
    if (!sucursalIdVista) { setHorarios([]); return; }
    api.get(`/api/sucursales/${sucursalIdVista}/horario-turnos`).then(setHorarios).catch(() => setHorarios([]));
  }, [sucursalIdVista]);
  const horarioPorDiaTurno = useMemo(() => new Map(horarios.map((h) => [`${h.dia_semana}|${h.turno_tipo}`, h])), [horarios]);

  // Cumpleaños: mismo criterio que el clima (solo con una sucursal puntual
  // en vista) - pide el/los años que la grilla visible cruza.
  const [cumpleanos, setCumpleanos] = useState([]);
  useEffect(() => {
    if (!sucursalIdVista) { setCumpleanos([]); return; }
    const anios = new Set([diasVisibles[0].getFullYear(), diasVisibles[diasVisibles.length - 1].getFullYear()]);
    Promise.all([...anios].map((anio) => api.get(`/api/sucursales/${sucursalIdVista}/cumpleanos?anio=${anio}`).catch(() => [])))
      .then((listas) => setCumpleanos(listas.flat()));
  }, [sucursalIdVista, diasVisibles[0]?.getFullYear(), diasVisibles[diasVisibles.length - 1]?.getFullYear()]);
  const cumpleanosVisibles = filtroTipos.length === 0 || filtroTipos.includes('CUMPLEANOS') ? cumpleanos : [];
  const cumpleanosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const c of cumpleanosVisibles) {
      if (!mapa.has(c.fecha)) mapa.set(c.fecha, []);
      mapa.get(c.fecha).push(c);
    }
    return mapa;
  }, [cumpleanosVisibles]);

  // Feriados: nacionales, no de una sucursal - se ven siempre (incluida
  // "todas las sucursales"), respetando el filtro de tipos como cualquier otro.
  const [feriados, setFeriados] = useState([]);
  useEffect(() => {
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    api.get(`/api/feriados?desde=${desde}&hasta=${hasta}`).then(setFeriados).catch(() => setFeriados([]));
  }, [vista, ancla.getFullYear(), ancla.getMonth(), ancla.getDate()]);
  const feriadosVisibles = filtroTipos.length === 0 || filtroTipos.includes('FERIADO') ? feriados : [];
  const feriadosPorDia = useMemo(() => {
    const mapa = new Map();
    for (const f of feriadosVisibles) {
      if (!mapa.has(f.fecha)) mapa.set(f.fecha, []);
      mapa.get(f.fecha).push(f);
    }
    return mapa;
  }, [feriadosVisibles]);

  // Licencias: overlay de solo lectura (mismo criterio que feriados/
  // cumpleaños) - el backend ya scopea a un Colaborador a solo las propias.
  // Cada licencia cubre un rango de días (fecha_desde..fecha_hasta), se
  // expande día por día para armar el mapa igual que los otros overlays.
  const [licencias, setLicencias] = useState([]);
  useEffect(() => {
    if (!sucursalIdVista) { setLicencias([]); return; }
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    api.get(`/api/sucursales/${sucursalIdVista}/licencias?desde=${desde}&hasta=${hasta}`).then(setLicencias).catch(() => setLicencias([]));
  }, [sucursalIdVista, vista, ancla.getFullYear(), ancla.getMonth(), ancla.getDate()]);
  const licenciasVisibles = filtroTipos.length === 0 || filtroTipos.includes('LICENCIA') ? licencias : [];
  const licenciasPorDia = useMemo(() => {
    const mapa = new Map();
    for (const l of licenciasVisibles) {
      const cursor = new Date(`${l.fecha_desde}T00:00:00`);
      const fin = new Date(`${l.fecha_hasta}T00:00:00`);
      while (cursor <= fin) {
        const clave = aClaveDia(cursor);
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push(l);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return mapa;
  }, [licenciasVisibles]);

  function recargar() {
    // Selección manual sin ninguna sucursal tildada: cero eventos, sin
    // pedirle nada al backend (no confundir con filtroSucursales === null,
    // que significa "todas" y no manda el parámetro).
    if (Array.isArray(filtroSucursales) && filtroSucursales.length === 0) { setEventos([]); return; }
    const desde = aClaveDia(diasVisibles[0]);
    const hasta = aClaveDia(diasVisibles[diasVisibles.length - 1]);
    const params = new URLSearchParams({ desde, hasta });
    if (Array.isArray(filtroSucursales)) params.set('sucursal_id', filtroSucursales.join(','));
    if (filtroTipos.length) params.set('tipo', filtroTipos.join(','));
    api.get(`/api/calendario?${params}`).then(setEventos).catch((e) => setError(e.message));
  }
  useEffect(recargar, [vista, ancla.getFullYear(), ancla.getMonth(), ancla.getDate(), filtroSucursales, filtroTipos]);

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

  // El detalle del día ya no es un modal que hay que abrir - vive siempre
  // visible debajo de la grilla, arrancando en hoy (o el primer día visible
  // si hoy quedó fuera del rango) para no mostrar un panel vacío al entrar.
  useEffect(() => {
    if (diaSeleccionado && diasVisibles.some((d) => aClaveDia(d) === aClaveDia(diaSeleccionado))) return;
    const hoyEnRango = diasVisibles.find((d) => aClaveDia(d) === aClaveDia(hoy));
    setDiaSeleccionado(hoyEnRango || diasVisibles[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, ancla.getFullYear(), ancla.getMonth(), ancla.getDate()]);

  if (!eventos) return <Cargando />;

  const eventosDelDiaSeleccionado = diaSeleccionado ? eventosPorDia.get(aClaveDia(diaSeleccionado)) || [] : [];
  const feriadosDelDiaSeleccionado = diaSeleccionado ? feriadosPorDia.get(aClaveDia(diaSeleccionado)) || [] : [];
  const cumpleanosDelDiaSeleccionado = diaSeleccionado ? cumpleanosPorDia.get(aClaveDia(diaSeleccionado)) || [] : [];
  const licenciasDelDiaSeleccionado = diaSeleccionado ? licenciasPorDia.get(aClaveDia(diaSeleccionado)) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Calendario</h1>
        {puedeCrear && <Boton ancho="w-auto" onClick={() => setModalNuevo(true)}>+ Agendar</Boton>}
      </div>

      {/* Todos los controles comparten la misma altura (h-9) y el mismo
          padding vertical, para que al envolver en pantallas chicas cada
          fila quede prolija en vez de una mezcla de tamaños/alturas. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <button className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-gray-300 text-sm" onClick={() => navegar(-1)}>←</button>
          <p className="text-sm font-medium text-gray-800 min-w-[150px] text-center capitalize">
            {vista === 'MES'
              ? ancla.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
              : `${semana[0].toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} — ${semana[6].toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`}
          </p>
          <button className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-gray-300 text-sm" onClick={() => navegar(1)}>→</button>
        </div>
        <button className="h-9 px-3 flex items-center justify-center rounded-lg border border-gray-300 text-sm text-fat-bordo-600 hover:bg-fat-bordo-50 shrink-0" onClick={() => setAncla(new Date())}>Hoy</button>
        <div className="h-9 flex rounded-lg border border-gray-300 overflow-hidden text-sm shrink-0">
          <button onClick={() => setVista('MES')} className={`px-3 h-full ${vista === 'MES' ? 'bg-fat-bordo-500 text-white' : 'bg-white text-gray-600'}`}>Mes</button>
          <button onClick={() => setVista('SEMANA')} className={`px-3 h-full ${vista === 'SEMANA' ? 'bg-fat-bordo-500 text-white' : 'bg-white text-gray-600'}`}>Semana</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {veTodasSucursales && (
            <SelectorSucursalesMultiple icono="🏢" sucursales={sucursales} seleccionadas={filtroSucursales} onChange={setFiltroSucursales} />
          )}
          <SelectorTiposMultiple seleccionados={filtroTipos} onChange={setFiltroTipos} />
        </div>
      </div>

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {vista === 'SEMANA' ? (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {diasVisibles.map((d, i) => (
            <DiaCardSemana
              key={i}
              dia={d}
              etiqueta={DIAS_SEMANA[i]}
              esHoy={aClaveDia(d) === aClaveDia(hoy)}
              seleccionado={diaSeleccionado && aClaveDia(d) === aClaveDia(diaSeleccionado)}
              eventosDia={eventosPorDia.get(aClaveDia(d)) || []}
              feriadosDia={feriadosPorDia.get(aClaveDia(d)) || []}
              cumpleanosDia={cumpleanosPorDia.get(aClaveDia(d)) || []}
              licenciasDia={licenciasPorDia.get(aClaveDia(d)) || []}
              climaDia={climaPorDia.get(aClaveDia(d))}
              usuario={usuario}
              onClick={() => setDiaSeleccionado(d)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
          {diasVisibles.map((d, i) => {
            const delMes = d.getMonth() === ancla.getMonth();
            const esHoy = aClaveDia(d) === aClaveDia(hoy);
            const feriadosDia = feriadosPorDia.get(aClaveDia(d)) || [];
            const cumpleanosDia = cumpleanosPorDia.get(aClaveDia(d)) || [];
            const licenciasDia = licenciasPorDia.get(aClaveDia(d)) || [];
            const eventosDia = eventosPorDia.get(aClaveDia(d)) || [];
            const climaDiaRaw = climaPorDia.get(aClaveDia(d));
            const climaDia = climaDiaRaw?.temp_max != null ? climaDiaRaw : null;
            return (
              <button
                key={i}
                onClick={() => setDiaSeleccionado(d)}
                className={`bg-white text-left align-top hover:bg-gray-50 min-h-[84px] p-1.5 ${!delMes ? 'opacity-40' : ''} ${diaSeleccionado && aClaveDia(d) === aClaveDia(diaSeleccionado) ? 'ring-2 ring-inset ring-fat-bordo-400' : ''}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${esHoy ? 'bg-fat-bordo-500 text-white font-semibold' : 'text-gray-600'}`}>
                    {d.getDate()}
                  </span>
                  {climaDia && (
                    <span className="text-[9px] text-gray-400 truncate" title={`${Math.round(climaDia.temp_min)}° / ${Math.round(climaDia.temp_max)}°`}>
                      {emojiClima(climaDia.weather_code)} {Math.round(climaDia.temp_max)}°
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {feriadosDia.map((f) => (
                    <p key={`feriado-${f.fecha}-${f.nombre}`} className={`text-[10px] px-1 py-0.5 rounded truncate ${TIPO_COLOR.FERIADO}`} title={`${FERIADO_TIPO_LABEL[f.tipo] || 'Feriado'}: ${f.nombre}`}>
                      {TIPO_ICONO.FERIADO} {f.nombre}
                    </p>
                  ))}
                  {cumpleanosDia.map((c) => (
                    <p key={`cumple-${c.usuario_id}`} className={`text-[10px] px-1 py-0.5 rounded truncate ${TIPO_COLOR.CUMPLEANOS}`} title={`Cumpleaños de ${c.nombre || c.email}`}>
                      {TIPO_ICONO.CUMPLEANOS} {c.nombre || c.email}
                    </p>
                  ))}
                  {licenciasDia.map((l) => (
                    <p key={`licencia-${l.id}`} className={`text-[10px] px-1 py-0.5 rounded truncate ${TIPO_COLOR.LICENCIA}`} title={`${MOTIVO_LICENCIA_LABEL[l.motivo]}: ${l.usuario_nombre}`}>
                      {TIPO_ICONO.LICENCIA} {l.usuario_nombre}
                    </p>
                  ))}
                  {eventosDia.slice(0, 2).map((e) => (
                    <p key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${colorEvento(e)}`} title={etiquetaEvento(e)}>{iconoEvento(e)} {e.titulo}</p>
                  ))}
                  {eventosDia.length > 2 && <p className="text-[10px] text-gray-400">+{eventosDia.length - 2} más</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Tarjeta className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-gray-900">Detalle del día</h2>
          <span className="text-sm font-medium text-fat-bordo-600 capitalize">
            {diaSeleccionado?.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <DiaDetalle
          eventos={eventosDelDiaSeleccionado}
          feriados={feriadosDelDiaSeleccionado}
          cumpleanos={cumpleanosDelDiaSeleccionado}
          licencias={licenciasDelDiaSeleccionado}
          horarioPorDiaTurno={horarioPorDiaTurno}
          usuario={usuario}
          onCambio={() => { recargar(); setToast('Actualizado'); }}
          onIniciarRun={(runId) => navigate(`/ejecucion/${runId}`)}
          onEditarTurnos={(sucursalIdTurno) => navigate('/turnos', { state: { fecha: aClaveDia(diaSeleccionado), sucursalId: sucursalIdTurno ?? sucursalIdVista } })}
        />
      </Tarjeta>

      {modalNuevo && (
        <ModalNuevoEvento
          sucursales={sucursales}
          plantillas={plantillas}
          usuario={usuario}
          sucursalEnVista={sucursalIdVista}
          onClose={() => setModalNuevo(false)}
          onCreado={() => { setModalNuevo(false); recargar(); setToast('Agendado'); }}
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

function DiaDetalle({ eventos, feriados, cumpleanos, licencias, horarioPorDiaTurno, usuario, onCambio, onIniciarRun, onEditarTurnos }) {
  const turnos = eventos.filter((e) => e.tipo === 'TURNO');
  const otrosEventos = eventos.filter((e) => e.tipo !== 'TURNO');
  // Agrupa por sucursal Y turno_tipo (no solo turno_tipo) - viendo "todas las
  // sucursales" (Admin/Auditor) puede haber más de una sucursal con turno
  // nocturno el mismo día, y no deben mezclarse en un solo cuadro.
  const turnosPorGrupo = new Map();
  for (const t of turnos) {
    const clave = `${t.sucursal_id}|${t.turno_tipo}`;
    if (!turnosPorGrupo.has(clave)) turnosPorGrupo.set(clave, []);
    turnosPorGrupo.get(clave).push(t);
  }
  const sucursalesDistintas = new Set(turnos.map((t) => t.sucursal_id)).size;
  const gruposDeTurno = [...turnosPorGrupo.values()].sort((a, b) => {
    if (a[0].sucursal_nombre !== b[0].sucursal_nombre) return a[0].sucursal_nombre.localeCompare(b[0].sucursal_nombre);
    return a[0].turno_tipo === b[0].turno_tipo ? 0 : a[0].turno_tipo === 'DIURNO' ? -1 : 1;
  });

  if (eventos.length === 0 && feriados.length === 0 && cumpleanos.length === 0 && licencias.length === 0) return <p className="text-sm text-gray-400">No hay eventos este día.</p>;
  return (
    <div className="space-y-3">
      {feriados.map((f) => (
        <div key={`feriado-${f.fecha}-${f.nombre}`} className={`rounded-lg p-3 ${TIPO_COLOR.FERIADO}`}>
          <span className="text-[10px] font-medium uppercase opacity-70">{TIPO_ICONO.FERIADO} {FERIADO_TIPO_LABEL[f.tipo] || 'Feriado'}</span>
          <p className="text-sm font-medium mt-0.5">{f.nombre}</p>
        </div>
      ))}
      {cumpleanos.map((c) => (
        <div key={`cumple-${c.usuario_id}`} className={`rounded-lg p-3 ${TIPO_COLOR.CUMPLEANOS}`}>
          <span className="text-[10px] font-medium uppercase opacity-70">{TIPO_ICONO.CUMPLEANOS} Cumpleaños</span>
          <p className="text-sm font-medium mt-0.5">{c.nombre || c.email}</p>
        </div>
      ))}
      {licencias.map((l) => (
        <div key={`licencia-${l.id}`} className={`rounded-lg p-3 ${TIPO_COLOR.LICENCIA}`}>
          <span className="text-[10px] font-medium uppercase opacity-70">{TIPO_ICONO.LICENCIA} {MOTIVO_LICENCIA_LABEL[l.motivo]}</span>
          <p className="text-sm font-medium mt-0.5">{l.usuario_nombre}{l.detalle ? ` · ${l.detalle}` : ''}</p>
        </div>
      ))}
      {gruposDeTurno.map((lista) => (
        <TurnoDelDia key={`${lista[0].sucursal_id}-${lista[0].turno_tipo}`} turnoTipo={lista[0].turno_tipo} turnos={lista}
          mostrarSucursal={sucursalesDistintas > 1} horarioPorDiaTurno={horarioPorDiaTurno}
          usuario={usuario} onCambio={onCambio} onEditar={() => onEditarTurnos(lista[0].sucursal_id)} />
      ))}
      {otrosEventos.map((e) => (
        <EventoItem key={e.id} evento={e} usuario={usuario} puedeEditar={puedeGestionarEvento(usuario, e)} onCambio={onCambio} onIniciarRun={onIniciarRun} />
      ))}
    </div>
  );
}

// Un solo cuadro por turno (diurno/nocturno) del día en vez de un bloque por
// cada colaborador asignado - cerrado muestra un resumen ("Cocina (3) ·
// Caja (2)"), abierto lista los nombres agrupados por puesto. Editar
// (agregar/quitar gente) se hace en Gestionar turnos, no acá - ver onEditar.
function TurnoDelDia({ turnoTipo, turnos, mostrarSucursal, horarioPorDiaTurno, usuario, onCambio, onEditar }) {
  const [abierto, setAbierto] = useState(false);
  const puedeEditar = usuario.rol === 'ADMIN' || usuario.rol === 'GERENTE';
  const porPuesto = new Map();
  for (const t of turnos) {
    if (!porPuesto.has(t.puesto)) porPuesto.set(t.puesto, []);
    porPuesto.get(t.puesto).push(t);
  }
  const diaSemana = new Date(turnos[0].fecha_hora).getDay();
  const horario = horarioPorDiaTurno?.get(`${diaSemana}|${turnoTipo}`);
  const hayRevisionPendiente = turnos.some((t) => t.solicitud_revision_estado === 'PENDIENTE');

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="w-full flex items-start justify-between gap-2 text-left">
        <div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TIPO_COLOR.TURNO}`}>Turno</span>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {turnoTipo === 'DIURNO' ? '☀️' : '🌙'} Turno {TURNO_TIPO_LABEL[turnoTipo]}{mostrarSucursal && ` · ${turnos[0].sucursal_nombre}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {horario && `${horario.hora_desde.slice(0, 5)} a ${horario.hora_hasta.slice(0, 5)} · `}
            {[...porPuesto.entries()].map(([p, lista]) => `${PUESTO_LABEL[p] || p} (${lista.length})`).join(' · ')}
          </p>
        </div>
        <span className="text-gray-400 text-xs shrink-0 mt-1">{abierto ? '▲' : '▼'}</span>
      </button>

      {hayRevisionPendiente && !abierto && (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-2 italic">Hay una solicitud de revisión pendiente</p>
      )}

      {abierto && (
        <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-2.5">
          {[...porPuesto.entries()].map(([puesto, lista]) => (
            <div key={puesto}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{PUESTO_LABEL[puesto] || puesto} ({lista.length})</p>
              <div className="mt-1 space-y-2">
                {lista.map((t) => <TurnoPersonaLinea key={t.id} turno={t} usuario={usuario} onCambio={onCambio} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {puedeEditar && (
        <button type="button" onClick={onEditar} className="text-xs text-fat-bordo-600 hover:underline mt-2.5">
          Editar turno
        </button>
      )}
    </div>
  );
}

// Línea de una persona dentro de un TurnoDelDia - solo lleva la acción de
// "no puedo asistir" (si es el propio turno del colaborador); agregar/quitar
// gente vive en Gestionar turnos.
function TurnoPersonaLinea({ turno, usuario, onCambio }) {
  const [solicitando, setSolicitando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esMiTurno = usuario.rol === 'COLABORADOR' && turno.responsable_user_id === usuario.id;

  async function solicitarRevision() {
    if (!motivo.trim()) { setError('Elegí o escribí un motivo'); return; }
    setGuardando(true);
    setError('');
    try {
      await api.post(`/api/calendario/${turno.id}/solicitar-revision`, { motivo });
      setSolicitando(false);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="text-sm">
      <div className="flex items-center gap-1.5">
        {!turno.asignacion_confirmada && <span title="Pendiente de confirmar" className="text-xs">🕒</span>}
        <span className={esMiTurno ? 'font-medium text-fat-bordo-700' : 'text-gray-800'}>{turno.responsable_nombre || '—'}</span>
      </div>
      {turno.solicitud_revision_estado === 'PENDIENTE' ? (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-1 italic">
          Revisión pendiente: "{turno.solicitud_revision_motivo}"
        </p>
      ) : esMiTurno && (
        solicitando ? (
          <div className="space-y-2 mt-1">
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
          <button type="button" onClick={() => setSolicitando(true)} className="text-xs text-fat-bordo-600 hover:underline mt-0.5">No puedo asistir</button>
        )
      )}
      {error && <p className="text-xs text-fat-bordo-600 mt-1">{error}</p>}
    </div>
  );
}

function EventoItem({ evento, usuario, puedeEditar, onCambio, onIniciarRun }) {
  const [completando, setCompletando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [iniciando, setIniciando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const puedeCompletar = new Date(evento.fecha_hora) <= new Date();
  // Gerente/Colaborador no pueden adelantar una auditoría antes de su fecha
  // programada (Admin/Auditor sí, ver POST /api/calendario/:id/iniciar).
  const puedeIniciarAhora = !(usuario.rol === 'GERENTE' || usuario.rol === 'COLABORADOR') || new Date(evento.fecha_hora) <= new Date();

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
    if (evento.evidencia_obligatoria && !archivo) { setError('Esta tarea requiere una foto de evidencia'); return; }
    setGuardando(true);
    setError('');
    try {
      let evidenciaUrl = null;
      if (archivo) {
        const { uploadUrl, publicUrl } = await api.post(`/api/calendario/${evento.id}/evidencia/url-subida`, { content_type: archivo.type });
        await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': archivo.type }, body: archivo });
        evidenciaUrl = publicUrl;
      }
      await api.post(`/api/calendario/${evento.id}/completar`, { comentario, evidencia_url: evidenciaUrl, evidencia_tipo: evidenciaUrl ? 'FOTO' : null });
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
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorEvento(evento)}`}>{etiquetaEvento(evento)}</span>
          <p className="text-sm font-medium text-gray-900 mt-1">{iconoEvento(evento)} {evento.titulo}</p>
          <p className="text-xs text-gray-400">
            {evento.sucursal_nombre}
            {evento.tipo !== 'EVENTO_ESPECIAL' && evento.tipo !== 'SEGUIMIENTO' && ` · ${new Date(evento.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
            {evento.responsable_nombre
              ? ` · ${evento.responsable_nombre}`
              : (evento.tipo === 'TAREA' && evento.puesto)
                ? ` · Colaboradores de ${PUESTO_LABEL[evento.puesto]}${evento.turno_tipo ? ` (turno ${TURNO_TIPO_LABEL[evento.turno_tipo]})` : ''}`
                : ''}
          </p>
          {evento.tarea_descripcion && <p className="text-xs text-gray-500 mt-1">{evento.tarea_descripcion}</p>}
        </div>
        {evento.tipo !== 'EVENTO_ESPECIAL' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
            evento.estado_efectivo === 'COMPLETADA' ? 'bg-green-100 text-green-700'
            : evento.estado_efectivo === 'VENCIDA' || evento.estado_efectivo === 'DEMORADA' ? 'bg-fat-bordo-100 text-fat-bordo-700'
            : evento.estado_efectivo === 'OMITIDA' ? 'bg-gray-100 text-gray-500'
            : 'bg-yellow-100 text-yellow-700'
          }`}>{evento.estado_efectivo}</span>
        )}
      </div>

      {evento.estado === 'PENDIENTE' && evento.tipo === 'TAREA' && (
        <div className="mt-2">
          {completando ? (
            <div className="space-y-2">
              <input className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
              {evento.evidencia_obligatoria && (
                <div className="flex items-center gap-2">
                  <BotonCamara archivo={archivo} onArchivo={setArchivo} />
                  <span className="text-[10px] text-gray-400">Requiere foto de evidencia (solo cámara).</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Boton ancho="w-auto" cargando={guardando} onClick={completar}>Confirmar cumplimiento</Boton>
                <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(false)}>Cancelar</Boton>
                {evento.tarea_enlace && (
                  <a href={evento.tarea_enlace} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium rounded-lg py-2 px-4 transition bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                    {evento.tarea_enlace_nombre || 'Ir a página web'}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div title={!puedeCompletar ? 'Todavía no llegó la fecha/hora programada' : undefined}>
                <Boton ancho="w-auto" variante="secundario" disabled={!puedeCompletar} onClick={() => setCompletando(true)}>Marcar cumplida</Boton>
              </div>
              {evento.tarea_enlace && (
                <a href={evento.tarea_enlace} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium rounded-lg py-2 px-4 transition bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                  {evento.tarea_enlace_nombre || 'Ir a página web'}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {evento.estado === 'PENDIENTE' && (evento.tipo === 'AUDITORIA' || evento.tipo === 'SEGUIMIENTO') && (
        <div className="mt-2" title={!puedeIniciarAhora ? 'Todavía no llegó la fecha/hora programada' : undefined}>
          <Boton ancho="w-auto" cargando={iniciando} disabled={!puedeIniciarAhora} onClick={iniciar}>Iniciar auditoría</Boton>
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

// Bloque grande y seleccionable del paso 1 de "+ Agendar" (elegir tipo) -
// estados default/hover/active vía Tailwind, sin necesidad de guardar un
// estado "seleccionado" propio porque tocar el bloque ya avanza al form.
function BloqueTipoAgendar({ icono, titulo, descripcion, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 text-left transition-colors
                 hover:border-fat-bordo-300 hover:bg-fat-bordo-50
                 active:border-fat-bordo-500 active:bg-fat-bordo-100"
    >
      <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-gray-50 text-2xl shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{titulo}</p>
        <p className="text-xs text-gray-400">{descripcion}</p>
      </div>
    </button>
  );
}

// Opciones fijas "Responsables del sector X" - se mezclan con los resultados
// de personas en el mismo buscador/lista de abajo (ver SelectorResponsablesTarea).
const SECTORES_RESPONSABLE = PUESTOS.map((p) => ({ tipo: 'PUESTO', puesto: p, label: `Responsables del sector ${PUESTO_LABEL[p]}` }));

// Responsable(s) de una TAREA: un solo buscador que mezcla personas puntuales
// (por nombre, vía /api/usuarios/buscar) con las 3 opciones fijas de sector -
// elegir cualquiera de las dos las agrega como chip abajo, sin necesidad de
// alternar entre "modo persona" y "modo sector". El turno de un chip de
// sector se resuelve solo a partir de la hora de la tarea (ver turnoParaHora),
// no se pregunta acá.
function SelectorResponsablesTarea({ sucursalId, seleccionados, onChange }) {
  const [texto, setTexto] = useState('');
  const [personas, setPersonas] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function alClickAfuera(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, []);

  useEffect(() => {
    if (!sucursalId) { setPersonas([]); return; }
    const id = setTimeout(() => {
      const params = new URLSearchParams({ sucursal_id: sucursalId });
      if (texto) params.set('q', texto);
      api.get(`/api/usuarios/buscar?${params}`).then(setPersonas).catch(() => setPersonas([]));
    }, 250);
    return () => clearTimeout(id);
  }, [texto, sucursalId]);

  const sectoresFiltrados = SECTORES_RESPONSABLE.filter((s) => !texto || s.label.toLowerCase().includes(texto.toLowerCase()));
  const sectorYaElegido = (puesto) => seleccionados.some((s) => s.tipo === 'PUESTO' && s.puesto === puesto);
  const personaYaElegida = (id) => seleccionados.some((s) => s.tipo === 'PERSONA' && s.id === id);

  function agregarPersona(u) {
    if (personaYaElegida(u.id)) return;
    onChange([...seleccionados, { tipo: 'PERSONA', id: u.id, nombre: u.nombre || u.email }]);
    setTexto(''); setAbierto(false);
  }
  function agregarSector(s) {
    if (sectorYaElegido(s.puesto)) return;
    onChange([...seleccionados, s]);
    setTexto(''); setAbierto(false);
  }
  function quitar(item) {
    onChange(seleccionados.filter((s) => s !== item));
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
        placeholder={sucursalId ? 'Buscar por nombre, o "sector"…' : 'Elegí primero una sucursal'}
        disabled={!sucursalId}
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
      />
      {abierto && (sectoresFiltrados.length > 0 || personas.length > 0) && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {sectoresFiltrados.map((s) => (
            <button
              key={s.puesto}
              type="button"
              disabled={sectorYaElegido(s.puesto)}
              onClick={() => agregarSector(s)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="font-medium text-gray-900">👥 {s.label}</span>
              <span className="block text-[11px] text-gray-400">Según quién esté trabajando ese sector cada turno</span>
            </button>
          ))}
          {personas.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={personaYaElegida(u.id)}
              onClick={() => agregarPersona(u)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="font-medium text-gray-900">{u.nombre || u.email}</span>
              {u.puesto && <span className="text-xs text-gray-400 ml-1.5">{PUESTO_LABEL[u.puesto] || u.puesto}</span>}
            </button>
          ))}
        </div>
      )}
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {seleccionados.map((s) => (
            <span key={s.tipo === 'PUESTO' ? `sector-${s.puesto}` : `persona-${s.id}`} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full pl-2.5 pr-1 py-1">
              {s.tipo === 'PUESTO' ? `👥 ${s.label}` : s.nombre}
              <button type="button" onClick={() => quitar(s)} className="text-gray-400 hover:text-fat-bordo-600 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// A qué turno (DIURNO/NOCTURNO) corresponde una hora puntual, según el
// horario configurado de la sucursal para el día de semana de `fechaISO`
// (mismo criterio que arma un turno real, ver armarOcurrencia en el
// backend) - null si esa hora no cae dentro de ningún turno habilitado.
function turnoParaHora(horariosSucursal, horaHHMM, fechaISO) {
  if (!horaHHMM || !fechaISO || !horariosSucursal?.length) return null;
  const diaSemana = new Date(`${fechaISO}T00:00:00`).getDay();
  const [h, m] = horaHHMM.split(':').map(Number);
  const minutos = h * 60 + m;
  for (const tipo of ['DIURNO', 'NOCTURNO']) {
    const cfg = horariosSucursal.find((r) => r.dia_semana === diaSemana && r.turno_tipo === tipo && r.habilitado);
    if (!cfg) continue;
    const [hd, md] = cfg.hora_desde.split(':').map(Number);
    const [hh, mh] = cfg.hora_hasta.split(':').map(Number);
    const desde = hd * 60 + md, hasta = hh * 60 + mh;
    const dentro = hasta <= desde ? (minutos >= desde || minutos < hasta) : (minutos >= desde && minutos < hasta);
    if (dentro) return tipo;
  }
  return null;
}

function ModalNuevoEvento({ sucursales, plantillas, usuario, sucursalEnVista, onClose, onCreado }) {
  const esGerente = usuario.rol === 'GERENTE';
  const esAdmin = usuario.rol === 'ADMIN';
  const [form, setForm] = useState({
    sucursal_id: esGerente ? usuario.sucursal_id : '',
    tipo: 'AUDITORIA', template_id: '', titulo: '', descripcion: '', responsable_user_id: '', responsable_nombre: '', fecha: '', hora: '10:00',
    recurrenciaTipo: 'NINGUNA', recurrenciaHasta: '',
    // Específico de TAREA:
    tareaCatalogoId: '', tituloOtro: '', fotoRequerida: false,
    tareaRecurrencia: 'NINGUNA', diasSemana: [], diasMes: [], sinHora: false, fechaHasta: '',
    // Responsable(s) de TAREA - lista mixta de personas puntuales y/o
    // "sectores" (ver SelectorResponsablesTarea); un chip de sector no lleva
    // turno propio, se resuelve solo a partir de la hora (ver turnoParaHora).
    responsablesTarea: [],
    // Específico de EVENTO_ESPECIAL (null = todas las sucursales, array = selección manual):
    sucursalesEspecialesIds: null, icono: ICONO_EVENTO_ESPECIAL_DEFAULT,
  });
  const [tiposTarea, setTiposTarea] = useState([]);
  const [tipoTareaAbierto, setTipoTareaAbierto] = useState(''); // qué tipo está desplegado en el 2do select
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Paso 1: elegir QUÉ se agenda (bloques grandes con ícono) - paso 2: el
  // formulario de siempre, ya con form.tipo fijo. Se pasa directo al elegir
  // un bloque, sin confirmar - por eso no hace falta un botón "Continuar" acá.
  const [mostrarSelector, setMostrarSelector] = useState(true);
  function elegirTipo(tipo) {
    setForm((f) => ({ ...f, tipo }));
    setMostrarSelector(false);
  }

  // Tarea: solo Admin elige sucursal libremente; Gerente ya la tiene fija
  // (la suya) y Auditor la toma fija de la sucursal que esté viendo en el
  // calendario (sin opción de elegir "todas").
  const sucursalId = esGerente
    ? usuario.sucursal_id
    : (form.tipo === 'TAREA' && !esAdmin) ? sucursalEnVista : form.sucursal_id;

  // Al pasar a Tarea como Admin, precarga la sucursal que se estaba viendo
  // en el calendario (si había una sola) en vez de arrancar vacío.
  useEffect(() => {
    if (form.tipo === 'TAREA' && esAdmin && !form.sucursal_id && sucursalEnVista) {
      setForm((f) => ({ ...f, sucursal_id: String(sucursalEnVista) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipo]);

  useEffect(() => {
    if (form.tipo === 'TAREA' && sucursalId) {
      api.get(`/api/tipos-tarea/disponibles?sucursal_id=${sucursalId}`).then(setTiposTarea).catch(() => setTiposTarea([]));
    }
  }, [form.tipo, sucursalId]);

  // Horario de turnos de la sucursal - solo para resolver a qué turno
  // (diurno/nocturno) corresponde la hora elegida, cuando hay algún
  // responsable "por sector" (ver turnoParaHora/payloadResponsablesTarea).
  const [horariosSucursal, setHorariosSucursal] = useState([]);
  useEffect(() => {
    if (form.tipo === 'TAREA' && sucursalId) {
      api.get(`/api/sucursales/${sucursalId}/horario-turnos`).then(setHorariosSucursal).catch(() => setHorariosSucursal([]));
    }
  }, [form.tipo, sucursalId]);

  // El 2do select ("Tarea") muestra las tareas del tipo elegido en el 1er
  // select + una opción fija "Otro" al final - se busca por tipoTareaAbierto
  // (que puede diferir del tipo real de la tarea ya elegida) para no perder
  // la selección de tipo al re-renderizar.
  const tareasDelTipoAbierto = tiposTarea.find((t) => String(t.id) === String(tipoTareaAbierto))?.tareas || [];
  const esOtro = form.tareaCatalogoId === '__otro';

  // Si hay hora (y no "sin horario"), se resuelve a qué turno corresponde y
  // el criterio de sector queda atado a ESE turno puntual. Sin hora, el
  // criterio queda sin turno (turno_tipo null) - aplica a cualquiera que
  // trabaje ese sector ese día, sin importar el turno (ver GET
  // /api/calendario en el backend). No es obligatorio poner hora solo para
  // identificar el turno.
  function payloadResponsablesTarea() {
    const personas = form.responsablesTarea.filter((r) => r.tipo === 'PERSONA');
    const sectores = form.responsablesTarea.filter((r) => r.tipo === 'PUESTO');
    if (!sectores.length) {
      return { responsables: personas.map((p) => ({ tipo: 'PERSONA', user_id: p.id })) };
    }
    const turno = (!form.sinHora && form.hora) ? turnoParaHora(horariosSucursal, form.hora, form.fecha) : null;
    return {
      responsables: [
        ...personas.map((p) => ({ tipo: 'PERSONA', user_id: p.id })),
        ...sectores.map((s) => ({ tipo: 'PUESTO', puesto: s.puesto, turno_tipo: turno })),
      ],
    };
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      if (form.tipo === 'EVENTO_ESPECIAL') {
        if (!form.titulo) throw new Error('Falta el título');
        if (!form.fecha) throw new Error('Elegí una fecha');
        const todas = form.sucursalesEspecialesIds === null;
        if (!todas && !form.sucursalesEspecialesIds.length) throw new Error('Elegí al menos una sucursal');
        await api.post('/api/calendario', {
          tipo: 'EVENTO_ESPECIAL',
          todas_sucursales: todas,
          sucursal_ids: todas ? undefined : form.sucursalesEspecialesIds,
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          responsable_user_id: form.responsable_user_id || null,
          fecha_hora: `${form.fecha}T00:00:00`,
          icono: form.icono || ICONO_EVENTO_ESPECIAL_DEFAULT,
        });
      } else if (form.tipo === 'TAREA' && form.tareaRecurrencia !== 'NINGUNA') {
        if (!sucursalId) throw new Error('Elegí una sucursal');
        if (!esOtro && !form.tareaCatalogoId) throw new Error('Elegí una tarea');
        if (esOtro && !form.tituloOtro) throw new Error('Escribí una descripción');
        if (form.tareaRecurrencia === 'SEMANAL' && !form.diasSemana.length) throw new Error('Elegí al menos un día de la semana');
        if (form.tareaRecurrencia === 'MENSUAL' && !form.diasMes.length) throw new Error('Elegí al menos un día del mes');
        await api.post('/api/calendario/tareas/programar', {
          sucursal_id: Number(sucursalId),
          tarea_catalogo_id: esOtro ? null : Number(form.tareaCatalogoId) || null,
          titulo: esOtro ? form.tituloOtro : null,
          foto_requerida: esOtro ? form.fotoRequerida : undefined,
          ...payloadResponsablesTarea(),
          frecuencia: form.tareaRecurrencia,
          dias_semana: form.tareaRecurrencia === 'SEMANAL' ? form.diasSemana : undefined,
          dias_mes: form.tareaRecurrencia === 'MENSUAL' ? form.diasMes : undefined,
          hora: form.sinHora ? null : form.hora,
          fecha_desde: form.fecha || aClaveDia(new Date()),
          fecha_hasta: form.fechaHasta || null,
        });
      } else {
        if (form.tipo === 'TAREA') {
          if (!sucursalId) throw new Error('Elegí una sucursal');
          if (!esOtro && !form.tareaCatalogoId) throw new Error('Elegí una tarea');
          if (esOtro && !form.tituloOtro) throw new Error('Escribí una descripción');
        } else if (!form.fecha) {
          throw new Error('Elegí una fecha');
        }
        // Para TAREA, sin fecha es "desde el momento" (ahora) - no bloquea.
        const fechaEfectiva = form.fecha || aClaveDia(new Date());
        await api.post('/api/calendario', {
          sucursal_id: Number(sucursalId),
          tipo: form.tipo,
          template_id: form.tipo !== 'TAREA' ? Number(form.template_id) : null,
          tarea_catalogo_id: form.tipo === 'TAREA' && !esOtro ? Number(form.tareaCatalogoId) || null : null,
          titulo: form.tipo === 'TAREA' && esOtro ? form.tituloOtro : null,
          foto_requerida: form.tipo === 'TAREA' && esOtro ? form.fotoRequerida : undefined,
          ...(form.tipo === 'TAREA' ? payloadResponsablesTarea() : { responsable_user_id: form.responsable_user_id || null }),
          fecha_hora: `${fechaEfectiva}T${form.sinHora && form.tipo === 'TAREA' ? '00:00' : form.hora}:00`,
          hora_definida: form.tipo === 'TAREA' ? !form.sinHora : undefined,
          recurrencia: form.tipo !== 'TAREA' && form.recurrenciaTipo !== 'NINGUNA' ? { tipo: form.recurrenciaTipo, hasta: form.recurrenciaHasta } : null,
        });
      }
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (mostrarSelector) {
    return (
      <Modal titulo="¿Qué querés agendar?" onClose={onClose} ancho="max-w-md">
        <p className="text-sm text-gray-500 -mt-1 mb-4">Seleccioná el tipo de actividad que querés programar.</p>
        <div className="space-y-3">
          <BloqueTipoAgendar
            icono={TIPO_ICONO.AUDITORIA}
            titulo={`Auditoría${esGerente ? ' interna' : ''}`}
            descripcion="Checklist con plantilla, para una fecha y hora"
            onClick={() => elegirTipo('AUDITORIA')}
          />
          <BloqueTipoAgendar
            icono={ICONO_TAREA_DEFAULT}
            titulo="Tarea"
            descripcion="Rutina puntual o recurrente para un colaborador"
            onClick={() => elegirTipo('TAREA')}
          />
          {esAdmin && (
            <BloqueTipoAgendar
              icono={ICONO_EVENTO_ESPECIAL_DEFAULT}
              titulo="Evento especial"
              descripcion="Feriado, promoción o aviso para la sucursal"
              onClick={() => elegirTipo('EVENTO_ESPECIAL')}
            />
          )}
        </div>
      </Modal>
    );
  }

  const TITULO_PASO2 = {
    AUDITORIA: `Agendar auditoría${esGerente ? ' interna' : ''}`,
    TAREA: 'Agendar tarea',
    EVENTO_ESPECIAL: 'Agendar evento especial',
  };

  return (
    <Modal titulo={TITULO_PASO2[form.tipo]} onClose={onClose} ancho="max-w-lg">
      <form onSubmit={crear} className="space-y-3">
        <button type="button" onClick={() => setMostrarSelector(true)} className="text-xs text-gray-400 hover:text-fat-bordo-600 -mt-1">
          ← Cambiar tipo
        </button>

        {!esGerente && form.tipo !== 'EVENTO_ESPECIAL' && form.tipo !== 'TAREA' && (
          <Select label="Sucursal" required value={form.sucursal_id} onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
            <option value="">Elegí una sucursal</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        )}

        {/* Tarea: solo Admin la elige - Gerente ya está fija (bloque de
            abajo la usa vía sucursalId) y Auditor la toma fija de la
            sucursal que esté viendo en el calendario, sin poder elegir
            "todas". */}
        {form.tipo === 'TAREA' && !esGerente && (
          esAdmin ? (
            <Select label="Sucursal" required value={form.sucursal_id} onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
              <option value="">Elegí una sucursal</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          ) : sucursalEnVista ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
              <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                {sucursales.find((s) => s.id === sucursalEnVista)?.nombre || `Sucursal #${sucursalEnVista}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-fat-bordo-600">Filtrá el calendario a una sola sucursal para poder crear una tarea.</p>
          )
        )}

        {form.tipo === 'EVENTO_ESPECIAL' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sucursales</label>
            <SelectorSucursalesMultiple
              sucursales={sucursales}
              seleccionadas={form.sucursalesEspecialesIds}
              onChange={(v) => setForm({ ...form, sucursalesEspecialesIds: v })}
            />
          </div>
        )}

        {form.tipo === 'AUDITORIA' && (
          <Select label="Plantilla" required value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
            <option value="">Elegí una plantilla</option>
            {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
        )}

        {form.tipo === 'EVENTO_ESPECIAL' && (
          <>
            <Campo label="Título" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            <Campo label="Descripción (opcional)" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <SelectorEmoji label="Ícono" valor={form.icono} onChange={(v) => setForm({ ...form, icono: v })} />
          </>
        )}

        {form.tipo === 'TAREA' && (
          <div className="space-y-3">
            <Select
              label="Tipo de tarea"
              required={!!sucursalId}
              value={tipoTareaAbierto}
              onChange={(e) => { setTipoTareaAbierto(e.target.value); setForm({ ...form, tareaCatalogoId: '' }); }}
            >
              <option value="">{sucursalId ? 'Elegí un tipo' : 'Elegí primero la sucursal'}</option>
              {tiposTarea.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Select>

            {tipoTareaAbierto && (
              <Select label="Tarea" required value={form.tareaCatalogoId} onChange={(e) => setForm({ ...form, tareaCatalogoId: e.target.value })}>
                <option value="">Elegí una tarea</option>
                {tareasDelTipoAbierto.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.foto_requerida ? ' (requiere foto)' : ''}</option>)}
                <option value="__otro">Otro</option>
              </Select>
            )}

            {esOtro && (
              <>
                <Campo label="Descripción" required value={form.tituloOtro} onChange={(e) => setForm({ ...form, tituloOtro: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.fotoRequerida} onChange={(e) => setForm({ ...form, fotoRequerida: e.target.checked })} />
                  Requiere foto de evidencia (solo cámara) para completarla
                </label>
              </>
            )}
          </div>
        )}

        {form.tipo !== 'TAREA' && (
          <BuscadorResponsable
            sucursalId={sucursalId}
            todasLasSucursales={form.tipo === 'EVENTO_ESPECIAL' && form.sucursalesEspecialesIds === null}
            nombreValue={form.responsable_nombre}
            label={form.tipo === 'EVENTO_ESPECIAL' ? 'Responsable (opcional)' : 'Responsable'}
            onChange={(id, u) => setForm({ ...form, responsable_user_id: id, responsable_nombre: u ? (u.nombre || u.email) : '' })}
          />
        )}

        {form.tipo === 'TAREA' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsable/s</label>
            <SelectorResponsablesTarea sucursalId={sucursalId} seleccionados={form.responsablesTarea} onChange={(v) => setForm({ ...form, responsablesTarea: v })} />
            <p className="text-[11px] text-gray-400 mt-1">
              Opcional. Buscá una o más personas, o elegí "Responsables del sector…" para que la vea quien esté
              trabajando ese sector. Si le ponés hora, queda atado a ese turno (diurno/nocturno); sin hora, aplica
              a cualquiera de ese sector en todo el día.
            </p>
          </div>
        )}

        {form.tipo === 'TAREA' ? (
          <div className="space-y-3">
            <Select label="Repetir" value={form.tareaRecurrencia} onChange={(e) => setForm({ ...form, tareaRecurrencia: e.target.value, diasSemana: [], diasMes: [] })}>
              <option value="NINGUNA">No se repite (una sola vez)</option>
              <option value="DIARIA">Diariamente</option>
              <option value="SEMANAL">Semanalmente, ciertos días</option>
              <option value="MENSUAL">Mensualmente, ciertos días del mes</option>
            </Select>

            <div className={form.tareaRecurrencia === 'NINGUNA' ? '' : 'grid grid-cols-2 gap-3'}>
              <Campo
                label={form.tareaRecurrencia === 'NINGUNA' ? 'Fecha (opcional)' : 'Desde (opcional)'}
                type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
              {form.tareaRecurrencia !== 'NINGUNA' && (
                <Campo label="Hasta (opcional)" type="date" value={form.fechaHasta} onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })} />
              )}
            </div>
            <p className="text-[11px] text-gray-400 -mt-2">Si no ponés {form.tareaRecurrencia === 'NINGUNA' ? 'fecha' : 'desde'}, arranca desde el momento.</p>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.sinHora} onChange={(e) => setForm({ ...form, sinHora: e.target.checked })} />
              Sin horario
            </label>

            {!form.sinHora && (
              <Campo label="Hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            )}

            {form.tareaRecurrencia === 'SEMANAL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días de la semana</label>
                <SelectorDias opciones={DIAS_SEMANA_UI} seleccionados={form.diasSemana} onChange={(v) => setForm({ ...form, diasSemana: v })} />
              </div>
            )}
            {form.tareaRecurrencia === 'MENSUAL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días del mes</label>
                <SelectorDias opciones={DIAS_DEL_MES} seleccionados={form.diasMes} onChange={(v) => setForm({ ...form, diasMes: v })} chico />
              </div>
            )}
          </div>
        ) : form.tipo === 'EVENTO_ESPECIAL' ? (
          <Campo label="Fecha" type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        ) : (
          <>
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
          </>
        )}

        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Agendar</Boton>
      </form>
    </Modal>
  );
}

