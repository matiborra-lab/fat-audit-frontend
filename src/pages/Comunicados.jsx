import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Select, Boton, Modal, Toast, Leyenda, Cargando } from '../components/ui';

const ROL_LABEL = { ADMIN: 'Admin', AUDITOR: 'Auditor', GERENTE: 'Gerente', COLABORADOR: 'Colaborador' };
const PUESTOS = ['COCINA', 'CAJA', 'REFUERZO_COCINA'];
const PUESTO_LABEL = { COCINA: 'Cocina', CAJA: 'Caja', REFUERZO_COCINA: 'Refuerzo cocina' };
const VARIABLES = [
  { token: '{nombre}', label: 'Nombre' },
  { token: '{apellido}', label: 'Apellido' },
  { token: '{nombre_completo}', label: 'Nombre completo' },
  { token: '{usuario}', label: 'Usuario' },
  { token: '{sucursal}', label: 'Sucursal' },
  { token: '{fecha}', label: 'Fecha' },
];

// Inserta `token` en la posición del cursor del campo (no al final a lo
// bruto). Restaurar el cursor justo después del token NO puede hacerse con
// requestAnimationFrame (corre en cualquier momento respecto del commit de
// React - a veces antes de que el <textarea> controlado ya tenga el nuevo
// value, y el navegador termina reseteando el cursor a 0). `avisarCursorPendiente`
// deja la posición pedida para que un useEffect la aplique DESPUÉS del
// commit, con orden garantizado.
function insertarEnCampo(ref, valorActual, setValor, token, avisarCursorPendiente) {
  const el = ref.current;
  const inicio = el?.selectionStart ?? valorActual.length;
  const fin = el?.selectionEnd ?? valorActual.length;
  const nuevo = valorActual.slice(0, inicio) + token + valorActual.slice(fin);
  avisarCursorPendiente({ ref, pos: inicio + token.length });
  setValor(nuevo);
}

function BarraVariables({ campoRef, valor, setValor, avisarCursorPendiente }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      <span className="text-[11px] text-gray-400 self-center">Insertar:</span>
      {VARIABLES.map((v) => (
        <button
          key={v.token}
          type="button"
          onClick={() => insertarEnCampo(campoRef, valor, setValor, v.token, avisarCursorPendiente)}
          className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-fat-bordo-50 hover:text-fat-bordo-700"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function etiquetaMiembro(m) {
  return `${ROL_LABEL[m.rol] || m.rol}${m.puesto ? ` · ${PUESTO_LABEL[m.puesto]}` : ''}${m.sucursal_nombre ? ` · ${m.sucursal_nombre}` : ''}`;
}

function formatearFechaHora(valor) {
  return new Date(valor).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Reconstruye la etiqueta legible de un criterio de audiencia guardado
// (audiencia_json no guarda el label, solo lo que necesita el backend) -
// se usa al Duplicar un comunicado para poder mostrar los chips de nuevo.
// `miembros` es lo último que se cargó en el selector de integrantes -
// alcanza para resolver el nombre de una PERSONA si esa persona pertenece
// a la sucursal filtrada en ese momento; si no se encuentra, cae a un
// texto genérico en vez de trabar la duplicación.
function etiquetaCriterio(c, sucursales, miembros) {
  const nombreSuc = (id) => sucursales.find((s) => String(s.id) === String(id))?.nombre || 'esa sucursal';
  switch (c.tipo) {
    case 'PERSONA': {
      const m = miembros.find((m) => m.id === Number(c.user_id));
      return m ? `${m.nombre || m.email} · ${etiquetaMiembro(m)}` : `Persona #${c.user_id}`;
    }
    case 'TODOS': return 'Todos los integrantes (todas las sucursales)';
    case 'GERENTES': return 'Gerentes (todas las sucursales)';
    case 'TODOS_SUCURSAL': return `Todos los integrantes de ${nombreSuc(c.sucursal_id)}`;
    case 'GERENTES_SUCURSAL': return `Gerentes de ${nombreSuc(c.sucursal_id)}`;
    case 'PUESTO': return `Responsables de ${PUESTO_LABEL[c.puesto]} (${nombreSuc(c.sucursal_id)}) - turno del día`;
    default: return 'Destinatario';
  }
}

export default function Comunicados() {
  const [sucursales, setSucursales] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState(''); // '' = todas
  const [miembros, setMiembros] = useState([]);
  // audiencia: [{ criterio, label }] - criterio es lo que se manda al backend,
  // label es solo para mostrar el chip. Se mantiene entre cambios de filtro
  // así se puede combinar gente de distintas sucursales en un mismo envío.
  const [audiencia, setAudiencia] = useState([]);
  const [cantidadDestinatarios, setCantidadDestinatarios] = useState(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState(null);
  // URL de una imagen YA subida (viene de Duplicar un comunicado anterior) -
  // separada de `archivo` (un File nuevo todavía sin subir) para no
  // resubir la misma foto de nuevo si el usuario no la cambia.
  const [imagenUrlPrevia, setImagenUrlPrevia] = useState(null);
  const [enlace, setEnlace] = useState('');
  const [enlaceNombre, setEnlaceNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');

  const [comunicados, setComunicados] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [verComunicado, setVerComunicado] = useState(null); // detalle + destinatarios, o null
  const [cargandoVer, setCargandoVer] = useState(false);
  const [errorVer, setErrorVer] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null); // comunicado a confirmar, o null

  const tituloRef = useRef(null);
  const descripcionRef = useRef(null);
  const archivoInputRef = useRef(null);
  const formRef = useRef(null);
  const cursorPendienteRef = useRef(null);
  function avisarCursorPendiente(pendiente) { cursorPendienteRef.current = pendiente; }
  // Corre DESPUÉS de que título/descripción ya se renderizaron con el nuevo
  // valor (a diferencia de requestAnimationFrame, que puede disparar antes)
  // - recién ahí tiene sentido reposicionar el cursor del campo.
  useEffect(() => {
    const pendiente = cursorPendienteRef.current;
    if (!pendiente) return;
    cursorPendienteRef.current = null;
    const el = pendiente.ref.current;
    if (el) { el.focus(); el.setSelectionRange(pendiente.pos, pendiente.pos); }
  }, [titulo, descripcion]);

  useEffect(() => { api.get('/api/sucursales').then(setSucursales); }, []);

  function recargarComunicados() {
    api.get('/api/comunicados').then(setComunicados).catch(() => setComunicados([]));
  }
  useEffect(recargarComunicados, []);

  useEffect(() => {
    const query = filtroSucursal ? `sucursal_id=${filtroSucursal}` : 'todas=true';
    api.get(`/api/comunicados/miembros?${query}`).then(setMiembros).catch(() => setMiembros([]));
  }, [filtroSucursal]);

  // Vista previa de "a cuántos les llegaría" - se recalcula cada vez que
  // cambia la audiencia elegida (con un pequeño debounce para no pegarle al
  // backend en cada click seguido).
  useEffect(() => {
    if (!audiencia.length) { setCantidadDestinatarios(null); return; }
    const id = setTimeout(() => {
      api.post('/api/comunicados/contar-destinatarios', { audiencia: audiencia.map((a) => a.criterio) })
        .then((r) => setCantidadDestinatarios(r.cantidad))
        .catch(() => setCantidadDestinatarios(null));
    }, 300);
    return () => clearTimeout(id);
  }, [audiencia]);

  const nombreSucursalActual = filtroSucursal ? sucursales.find((s) => String(s.id) === String(filtroSucursal))?.nombre : 'todas las sucursales';

  function tieneCriterio(pred) {
    return audiencia.some((a) => pred(a.criterio));
  }
  function agregarCriterio(criterio, label) {
    setAudiencia((prev) => [...prev, { criterio, label }]);
  }
  function quitarCriterioPor(pred) {
    setAudiencia((prev) => prev.filter((a) => !pred(a.criterio)));
  }
  function quitarCriterio(i) {
    setAudiencia((prev) => prev.filter((_, j) => j !== i));
  }

  function alternarTodos() {
    const esTodasSucursales = !filtroSucursal;
    const pred = esTodasSucursales ? (c) => c.tipo === 'TODOS' : (c) => c.tipo === 'TODOS_SUCURSAL' && String(c.sucursal_id) === String(filtroSucursal);
    if (tieneCriterio(pred)) { quitarCriterioPor(pred); return; }
    if (esTodasSucursales) agregarCriterio({ tipo: 'TODOS' }, 'Todos los integrantes (todas las sucursales)');
    else agregarCriterio({ tipo: 'TODOS_SUCURSAL', sucursal_id: Number(filtroSucursal) }, `Todos los integrantes de ${nombreSucursalActual}`);
  }
  function alternarGerentes() {
    const esTodasSucursales = !filtroSucursal;
    const pred = esTodasSucursales ? (c) => c.tipo === 'GERENTES' : (c) => c.tipo === 'GERENTES_SUCURSAL' && String(c.sucursal_id) === String(filtroSucursal);
    if (tieneCriterio(pred)) { quitarCriterioPor(pred); return; }
    if (esTodasSucursales) agregarCriterio({ tipo: 'GERENTES' }, 'Gerentes (todas las sucursales)');
    else agregarCriterio({ tipo: 'GERENTES_SUCURSAL', sucursal_id: Number(filtroSucursal) }, `Gerentes de ${nombreSucursalActual}`);
  }
  function alternarSector(puesto) {
    const pred = (c) => c.tipo === 'PUESTO' && c.puesto === puesto && String(c.sucursal_id) === String(filtroSucursal);
    if (tieneCriterio(pred)) { quitarCriterioPor(pred); return; }
    agregarCriterio({ tipo: 'PUESTO', puesto, sucursal_id: Number(filtroSucursal) }, `Responsables de ${PUESTO_LABEL[puesto]} (${nombreSucursalActual}) - turno del día`);
  }
  function alternarMiembro(m) {
    const pred = (c) => c.tipo === 'PERSONA' && Number(c.user_id) === m.id;
    if (tieneCriterio(pred)) { quitarCriterioPor(pred); return; }
    agregarCriterio({ tipo: 'PERSONA', user_id: m.id }, `${m.nombre || m.email} · ${etiquetaMiembro(m)}`);
  }

  const estaTodos = tieneCriterio(filtroSucursal ? (c) => c.tipo === 'TODOS_SUCURSAL' && String(c.sucursal_id) === String(filtroSucursal) : (c) => c.tipo === 'TODOS');
  const estaGerentes = tieneCriterio(filtroSucursal ? (c) => c.tipo === 'GERENTES_SUCURSAL' && String(c.sucursal_id) === String(filtroSucursal) : (c) => c.tipo === 'GERENTES');

  function quitarFoto() {
    setArchivo(null);
    setImagenUrlPrevia(null);
    if (archivoInputRef.current) archivoInputRef.current.value = '';
  }

  async function subirImagenSiHaceFalta() {
    if (!archivo) return imagenUrlPrevia || null;
    const { uploadUrl, publicUrl } = await api.post('/api/comunicados/imagen/url-subida', { content_type: archivo.type });
    let resp;
    try {
      resp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': archivo.type }, body: archivo });
    } catch (err) {
      throw new Error('No se pudo subir la foto (revisá tu conexión) - probá de nuevo o sacala y mandalo sin foto.');
    }
    if (!resp.ok) throw new Error('No se pudo subir la foto (el servidor de archivos devolvió un error) - probá de nuevo.');
    return publicUrl;
  }

  function limpiarFormulario() {
    setTitulo(''); setDescripcion(''); setEnlace(''); setEnlaceNombre('');
    setFecha(''); setHora(''); setAudiencia([]);
    quitarFoto();
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!titulo.trim()) { setError('Falta el título'); return; }
    if (!audiencia.length) { setError('Elegí al menos un destinatario'); return; }
    setEnviando(true);
    try {
      const imagenUrl = await subirImagenSiHaceFalta();
      const creado = await api.post('/api/comunicados', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        imagen_url: imagenUrl,
        enlace: enlace.trim() || null,
        enlace_nombre: enlaceNombre.trim() || null,
        audiencia: audiencia.map((a) => a.criterio),
        fecha_envio: fecha || null,
        hora_envio: hora || null,
      });
      setToast(creado.enviado_en ? `Enviado a ${creado.cantidad_enviados} persona(s)` : 'Comunicado programado');
      limpiarFormulario();
      recargarComunicados();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarEliminar() {
    if (!confirmandoEliminar) return;
    try {
      await api.del(`/api/comunicados/${confirmandoEliminar.id}`);
      setConfirmandoEliminar(null);
      if (verComunicado?.id === confirmandoEliminar.id) setVerComunicado(null);
      recargarComunicados();
    } catch (err) {
      setError(err.message);
    }
  }

  async function abrirVer(c) {
    setErrorVer('');
    setCargandoVer(true);
    setVerComunicado({ id: c.id }); // abre el modal ya, con el detalle cargando adentro
    try {
      const detalle = await api.get(`/api/comunicados/${c.id}`);
      setVerComunicado(detalle);
    } catch (err) {
      setErrorVer(err.message);
    } finally {
      setCargandoVer(false);
    }
  }

  // Precarga el formulario de arriba con el contenido de un comunicado ya
  // mandado (mismos destinatarios, mismo texto) para poder mandarlo de
  // nuevo tal cual (mismos destinatarios) o retocarlo antes de reenviar.
  function duplicar(c) {
    setTitulo(c.titulo || '');
    setDescripcion(c.descripcion || '');
    setEnlace(c.enlace || '');
    setEnlaceNombre(c.enlace_nombre || '');
    setArchivo(null);
    setImagenUrlPrevia(c.imagen_url || null);
    setFecha(''); setHora('');
    const criterios = c.audiencia_json || [];
    setAudiencia(criterios.map((criterio) => ({ criterio, label: etiquetaCriterio(criterio, sucursales, miembros) })));
    setVerComunicado(null);
    setToast('Comunicado copiado abajo - revisalo y mandalo cuando quieras');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const esSoloPush = !descripcion.trim() && !archivo && !imagenUrlPrevia && !enlace.trim();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Comunicados</h1>
      <Leyenda>
        Mandá un aviso push a quien elijas: responsables de un sector, personas puntuales, toda una sucursal o todas.
        Con solo el título es un aviso rápido; si agregás descripción, foto o enlace, se puede abrir para ver el comunicado completo.
      </Leyenda>

      <Tarjeta className="p-4 space-y-4">
        <form ref={formRef} onSubmit={enviar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título / encabezado push</label>
            <input
              ref={tituloRef}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Turnos de {fecha} ya publicados"
            />
            <BarraVariables campoRef={tituloRef} valor={titulo} setValor={setTitulo} avisarCursorPendiente={avisarCursorPendiente} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <textarea
              ref={descripcionRef}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Hola {nombre}, te escribimos desde {sucursal}…"
            />
            <BarraVariables campoRef={descripcionRef} valor={descripcion} setValor={setDescripcion} avisarCursorPendiente={avisarCursorPendiente} />
            <p className="text-[11px] text-gray-400 mt-1">
              {esSoloPush
                ? 'Sin descripción, foto ni enlace: es solo un aviso push, al tocarlo no abre nada más.'
                : 'Con descripción, foto o enlace, al tocar el aviso se puede abrir para ver el comunicado completo.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto (opcional)</label>
              {(archivo || imagenUrlPrevia) ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
                  <img
                    src={archivo ? URL.createObjectURL(archivo) : imagenUrlPrevia}
                    alt=""
                    className="w-9 h-9 rounded object-cover shrink-0"
                  />
                  <p className="text-sm text-gray-600 truncate flex-1">{archivo ? archivo.name : 'Foto del comunicado original'}</p>
                  <button type="button" onClick={quitarFoto} className="text-xs text-gray-400 hover:text-fat-bordo-600 shrink-0">Quitar</button>
                </div>
              ) : (
                <input
                  ref={archivoInputRef}
                  type="file" accept="image/*"
                  className="w-full text-sm"
                  onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Enlace (opcional)" type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre del botón" value={enlaceNombre} onChange={(e) => setEnlaceNombre(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">Si no completás fecha y hora, se envía apenas confirmes.</p>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Destinatarios</label>
            <Select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>

            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={estaTodos} onChange={alternarTodos} />
                Todos los integrantes de {nombreSucursalActual}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={estaGerentes} onChange={alternarGerentes} />
                Gerentes de {nombreSucursalActual}
              </label>
            </div>

            {filtroSucursal && (
              <div className="flex flex-wrap gap-3 text-sm">
                {PUESTOS.map((p) => {
                  const activo = tieneCriterio((c) => c.tipo === 'PUESTO' && c.puesto === p && String(c.sucursal_id) === String(filtroSucursal));
                  return (
                    <label key={p} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={activo} onChange={() => alternarSector(p)} />
                      Responsables de {PUESTO_LABEL[p]} (turno del día)
                    </label>
                  );
                })}
              </div>
            )}

            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
              {miembros.length === 0 && <p className="text-sm text-gray-400 p-3">No hay integrantes para este filtro.</p>}
              {miembros.map((m) => {
                const activo = tieneCriterio((c) => c.tipo === 'PERSONA' && Number(c.user_id) === m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={activo} onChange={() => alternarMiembro(m)} />
                    <div className="min-w-0">
                      <p className="text-gray-900 truncate">{m.nombre || m.email}</p>
                      <p className="text-xs text-gray-400 truncate">{etiquetaMiembro(m)}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {audiencia.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {audiencia.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-fat-bordo-50 text-fat-bordo-700 text-xs font-medium pl-2 pr-1 py-1 rounded-full">
                    {a.label}
                    <button type="button" onClick={() => quitarCriterio(i)} className="hover:bg-fat-bordo-100 rounded-full w-4 h-4 leading-none">&times;</button>
                  </span>
                ))}
              </div>
            )}
            {cantidadDestinatarios != null && (
              <p className="text-xs text-gray-500">Le llegaría a {cantidadDestinatarios} persona(s) en este momento.</p>
            )}
          </div>

          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <Boton type="submit" cargando={enviando}>{fecha && hora ? 'Programar comunicado' : 'Enviar ahora'}</Boton>
        </form>
      </Tarjeta>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Comunicados enviados y programados</h2>
        {!comunicados ? <Cargando /> : (
          <Tarjeta className="overflow-hidden">
            {comunicados.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no se mandó ningún comunicado.</p>}
            <div className="divide-y divide-gray-100">
              {comunicados.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => abrirVer(c)}>
                    <p className="text-sm font-medium text-gray-900 truncate hover:text-fat-bordo-600">{c.titulo}</p>
                    <p className="text-xs text-gray-400">
                      {c.enviado_en
                        ? `Enviado ${formatearFechaHora(c.enviado_en)} · ${c.cantidad_enviados ?? 0} persona(s)`
                        : `Programado para ${formatearFechaHora(c.fecha_envio)}`}
                      {c.creado_por_nombre && ` · por ${c.creado_por_nombre}`}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <button onClick={() => abrirVer(c)} className="text-gray-400 hover:text-fat-bordo-600">Ver</button>
                    <button onClick={() => duplicar(c)} className="text-gray-400 hover:text-fat-bordo-600">Duplicar</button>
                    <button onClick={() => setConfirmandoEliminar(c)} className="text-gray-400 hover:text-fat-bordo-600">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}
      </div>

      {verComunicado && (
        <Modal titulo="Comunicado" onClose={() => setVerComunicado(null)} ancho="max-w-lg">
          {cargandoVer && <Cargando />}
          {errorVer && <p className="text-sm text-fat-bordo-600">{errorVer}</p>}
          {!cargandoVer && !errorVer && verComunicado.titulo && (
            <div className="space-y-4">
              {verComunicado.imagen_url && (
                <img src={verComunicado.imagen_url} alt="" className="w-full max-h-48 object-cover rounded-lg" />
              )}
              <div>
                <p className="font-medium text-gray-900">{verComunicado.titulo}</p>
                {verComunicado.descripcion && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{verComunicado.descripcion}</p>}
                {verComunicado.enlace && (
                  <p className="text-xs text-fat-bordo-600 mt-1">🔗 {verComunicado.enlace_nombre || 'Ver más'}: {verComunicado.enlace}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {verComunicado.enviado_en
                    ? `Enviado ${formatearFechaHora(verComunicado.enviado_en)}`
                    : `Programado para ${formatearFechaHora(verComunicado.fecha_envio)}`}
                  {verComunicado.creado_por_nombre && ` · por ${verComunicado.creado_por_nombre}`}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Destinatarios ({verComunicado.destinatarios.length}) · {verComunicado.destinatarios.filter((d) => d.leida_en).length} lo abrieron
                </p>
                <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {verComunicado.destinatarios.length === 0 && <p className="text-sm text-gray-400 p-3">Todavía no le llegó a nadie.</p>}
                  {verComunicado.destinatarios.map((d) => (
                    <div key={d.usuario_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-gray-800 truncate">{d.nombre || d.email}</span>
                      <span className={`text-xs shrink-0 ${d.leida_en ? 'text-green-600' : 'text-gray-400'}`}>
                        {d.leida_en ? `✓ Abierto ${formatearFechaHora(d.leida_en)}` : 'No abierto'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Boton ancho="w-auto" variante="secundario" onClick={() => duplicar(verComunicado)}>Duplicar y reenviar</Boton>
                <Boton ancho="w-auto" variante="peligro" onClick={() => setConfirmandoEliminar(verComunicado)}>Eliminar</Boton>
              </div>
            </div>
          )}
        </Modal>
      )}

      {confirmandoEliminar && (
        <Modal titulo="Eliminar comunicado" onClose={() => setConfirmandoEliminar(null)} ancho="max-w-sm">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              ¿Eliminar <strong>{confirmandoEliminar.titulo}</strong> del historial? Si ya se envió, esto no le retira la notificación a quien ya se la mandó, solo lo saca de esta lista.
            </p>
            <div className="flex gap-2">
              <Boton ancho="w-auto" variante="peligro" onClick={confirmarEliminar}>Sí, eliminar</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => setConfirmandoEliminar(null)}>Cancelar</Boton>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
