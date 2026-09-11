import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Boton, Cargando, EtiquetaArea } from '../components/ui';

function claveBorrador(runId) {
  return `fataudit_borrador_${runId}`;
}

// Genera una miniatura liviana (JPEG, ancho máx. 240px) en el propio
// celular antes de subir nada - así la miniatura que se guarda es un
// archivo chico de verdad, no el mismo original con otro nombre. Devuelve
// null si algo falla (formato raro, etc.) - en ese caso la evidencia queda
// sin miniatura y la UI cae al archivo original (ver HistorialDetalle).
function generarMiniaturaImagen(file, maxAncho = 240) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, maxAncho / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Idem para video: toma un frame del primer instante como miniatura.
function generarMiniaturaVideo(file, maxAncho = 240) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.addEventListener('loadeddata', () => {
      const escala = Math.min(1, maxAncho / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
      canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      URL.revokeObjectURL(url);
    }, { once: true });
    video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null); }, { once: true });
    video.src = url;
  });
}

// Misma logica que auth/../scoring/index.js del backend (evaluarCondicion en
// runs.js) - reimplementada acá SOLO para dar feedback inmediato en pantalla
// mientras se completa la auditoría. La validación real y definitiva la hace
// el backend al finalizar.
function evaluarCondicion(operador, valorRespuesta, valorCondicion) {
  if (valorRespuesta == null) return false;
  switch (operador) {
    case '=': return String(valorRespuesta) === String(valorCondicion);
    case '!=': return String(valorRespuesta) !== String(valorCondicion);
    case '<': return Number(valorRespuesta) < Number(valorCondicion);
    case '<=': return Number(valorRespuesta) <= Number(valorCondicion);
    case '>': return Number(valorRespuesta) > Number(valorCondicion);
    case '>=': return Number(valorRespuesta) >= Number(valorCondicion);
    case 'entre': return Number(valorRespuesta) >= Number(valorCondicion[0]) && Number(valorRespuesta) <= Number(valorCondicion[1]);
    case 'contiene': return String(valorRespuesta).toLowerCase().includes(String(valorCondicion).toLowerCase());
    default: return false;
  }
}

export default function Ejecucion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [respuestas, setRespuestas] = useState({}); // item_id -> {valor_json, comentario, no_aplica, pendiente}
  const [evidencias, setEvidencias] = useState({}); // item_id -> [{id, tipo, url}]
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(null); // item_id en subida
  const [finalizando, setFinalizando] = useState(false);
  const [problemas, setProblemas] = useState(null);
  const [firma, setFirma] = useState('');
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  useEffect(() => {
    api.get(`/api/runs/${id}`).then((data) => {
      if (data.estado === 'COMPLETADA') { navigate(`/historial/${id}`, { replace: true }); return; }
      setRun(data);

      const respuestasIniciales = {};
      for (const r of data.respuestas) respuestasIniciales[r.item_id] = { valor_json: r.valor_json, comentario: r.comentario, no_aplica: r.no_aplica };
      const borrador = JSON.parse(localStorage.getItem(claveBorrador(id)) || '{}');
      setRespuestas({ ...respuestasIniciales, ...borrador });

      const respuestaPorId = new Map(data.respuestas.map((r) => [r.id, r.item_id]));
      const evidenciasIniciales = {};
      for (const e of data.evidencias) {
        const itemId = respuestaPorId.get(e.respuesta_id);
        if (!evidenciasIniciales[itemId]) evidenciasIniciales[itemId] = [];
        evidenciasIniciales[itemId].push(e);
      }
      setEvidencias(evidenciasIniciales);
    }).catch((e) => setError(e.message));
  }, [id, navigate]);

  useEffect(() => {
    function reintentarPendientes() {
      for (const [itemId, r] of Object.entries(respuestas)) {
        if (r.pendiente) guardarRespuesta(Number(itemId), r);
      }
    }
    window.addEventListener('online', reintentarPendientes);
    return () => window.removeEventListener('online', reintentarPendientes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuestas]);

  // Si el usuario cierra la pestaña o recarga a mitad de la auditoría, el
  // navegador pregunta antes de perder la pantalla (el borrador ya está
  // guardado en localStorage/servidor, pero igual conviene avisar).
  useEffect(() => {
    function avisar(e) { e.preventDefault(); e.returnValue = ''; }
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, []);

  if (error) return <p className="text-fat-bordo-600 p-4">{error}</p>;
  if (!run) return <Cargando />;

  const estructura = run.estructura_snapshot;
  const sectores = estructura.sectores;
  const sectorActual = sectores[paso];
  const esResumen = paso === sectores.length;
  const itemsDelSector = sectorActual ? estructura.items.filter((i) => i.sector_id === sectorActual.id) : [];
  const totalItems = estructura.items.length;
  const respondidos = estructura.items.filter((i) => {
    const r = respuestas[i.id];
    return r && (r.valor_json != null || r.no_aplica);
  }).length;

  function guardarLocal(itemId, cambios) {
    setRespuestas((prev) => {
      const nuevo = { ...prev, [itemId]: { ...prev[itemId], ...cambios } };
      localStorage.setItem(claveBorrador(id), JSON.stringify(nuevo));
      return nuevo;
    });
  }

  async function guardarRespuesta(itemId, r) {
    try {
      await api.put(`/api/runs/${id}/respuestas/${itemId}`, { valor_json: r.valor_json ?? null, comentario: r.comentario ?? null, no_aplica: !!r.no_aplica });
      setRespuestas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], pendiente: false } }));
    } catch {
      setRespuestas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], pendiente: true } }));
    }
  }

  function responder(itemId, valor) {
    const cambios = { valor_json: valor, no_aplica: false };
    guardarLocal(itemId, cambios);
    guardarRespuesta(itemId, { ...respuestas[itemId], ...cambios });
  }

  function comentar(itemId, comentario) {
    guardarLocal(itemId, { comentario });
  }
  function comentarBlur(itemId) {
    guardarRespuesta(itemId, respuestas[itemId] || {});
  }

  function marcarNoAplica(itemId, noAplica) {
    const cambios = { no_aplica: noAplica, valor_json: noAplica ? null : respuestas[itemId]?.valor_json };
    guardarLocal(itemId, cambios);
    guardarRespuesta(itemId, { ...respuestas[itemId], ...cambios });
  }

  async function subirEvidencia(item, file) {
    setSubiendo(item.id);
    try {
      const tipo = file.type.startsWith('video') ? 'VIDEO' : 'FOTO';
      const { uploadUrl, publicUrl } = await api.post(`/api/runs/${id}/evidencia/url-subida`, { content_type: file.type });
      await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });

      // Miniatura opcional: si falla (formato raro, canvas bloqueado, etc.)
      // no aborta la subida - la evidencia queda sin thumbnail_url y la UI
      // cae al archivo original.
      let thumbnailUrl = null;
      try {
        const miniatura = tipo === 'FOTO' ? await generarMiniaturaImagen(file) : await generarMiniaturaVideo(file);
        if (miniatura) {
          const { uploadUrl: urlMini, publicUrl: publicMini } = await api.post(`/api/runs/${id}/evidencia/url-subida`, { content_type: 'image/jpeg' });
          await fetch(urlMini, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: miniatura });
          thumbnailUrl = publicMini;
        }
      } catch {
        // sin miniatura, no es bloqueante
      }

      const evidencia = await api.post(`/api/runs/${id}/evidencia`, { item_id: item.id, tipo, url: publicUrl, thumbnail_url: thumbnailUrl });
      setEvidencias((prev) => ({ ...prev, [item.id]: [...(prev[item.id] || []), evidencia] }));
      return evidencia;
    } catch (err) {
      setError('No se pudo subir la evidencia: ' + err.message);
      return null;
    } finally {
      setSubiendo(null);
    }
  }

  async function quitarEvidencia(itemId, evidenciaId) {
    await api.del(`/api/evidencias/${evidenciaId}`);
    setEvidencias((prev) => ({ ...prev, [itemId]: prev[itemId].filter((e) => e.id !== evidenciaId) }));
  }

  // Reemplazar: sube el archivo nuevo primero y recién después borra el
  // viejo, para que el ítem nunca quede sin evidencia en el medio (relevante
  // si esa evidencia era la única que cumplía un requisito obligatorio).
  async function reemplazarEvidencia(item, evidenciaVieja, file) {
    const nueva = await subirEvidencia(item, file);
    if (nueva) await quitarEvidencia(item.id, evidenciaVieja.id);
  }

  async function finalizar() {
    setFinalizando(true);
    setProblemas(null);
    try {
      const run2 = await api.post(`/api/runs/${id}/finalizar`, { firma_nombre: firma });
      localStorage.removeItem(claveBorrador(id));
      navigate(`/historial/${run2.id}`, { replace: true });
    } catch (err) {
      setProblemas(err.data?.detalle || [err.message]);
    } finally {
      setFinalizando(false);
    }
  }

  function pedirSalir() {
    setConfirmandoSalida(true);
  }
  function confirmarSalida() {
    localStorage.setItem(claveBorrador(id), JSON.stringify(respuestas)); // guardar y salir - el borrador ya se guarda en cada cambio, esto es un refuerzo explícito
    navigate(-1);
  }

  return (
    <div className="min-h-screen bg-fat-marfil-suave">
      {/* Modo concentración: sin sidebar ni menú (esta ruta vive fuera del
          Layout, ver App.jsx) - solo lo necesario para auditar. */}
      <div className="sticky top-0 z-30 bg-fat-marfil-suave/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <button onClick={pedirSalir} aria-label="Salir" className="text-gray-500 hover:text-gray-700 text-xl leading-none px-1 shrink-0">&times;</button>
            <span className="text-sm font-medium text-gray-700 truncate text-center flex-1">{esResumen ? 'Resumen' : sectorActual.nombre}</span>
            <span className="text-xs text-gray-400 shrink-0">{respondidos}/{totalItems}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-fat-bordo-500 transition-all" style={{ width: `${(respondidos / totalItems) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-3 py-4 pb-24">
        {!esResumen && (
          <div className="space-y-3">
            {itemsDelSector.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                areaNombre={estructura.areas.find((a) => a.id === item.area_id)?.nombre}
                respuesta={respuestas[item.id] || {}}
                evidencias={evidencias[item.id] || []}
                subiendo={subiendo === item.id}
                onResponder={(v) => responder(item.id, v)}
                onComentar={(c) => comentar(item.id, c)}
                onComentarBlur={() => comentarBlur(item.id)}
                onNoAplica={(v) => marcarNoAplica(item.id, v)}
                onArchivo={(f) => subirEvidencia(item, f)}
                onQuitarEvidencia={(eid) => quitarEvidencia(item.id, eid)}
                onReemplazarEvidencia={(evidenciaVieja, f) => reemplazarEvidencia(item, evidenciaVieja, f)}
              />
            ))}
          </div>
        )}

        {esResumen && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <p className="font-medium text-gray-900">Confirmar y finalizar</p>
            <p className="text-sm text-gray-500">{respondidos} de {totalItems} ítems respondidos.</p>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Tu nombre (firma del auditor)"
              value={firma}
              onChange={(e) => setFirma(e.target.value)}
            />
            {problemas && (
              <div className="text-sm text-fat-bordo-600 bg-fat-bordo-50/50 rounded-lg p-3">
                <p className="font-medium mb-1">Faltan datos para poder finalizar:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {problemas.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            <Boton cargando={finalizando} disabled={!firma} onClick={finalizar}>Finalizar auditoría</Boton>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-center gap-3">
        <div className="w-full max-w-2xl flex justify-between gap-3">
          <Boton ancho="w-auto" variante="secundario" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>Anterior</Boton>
          {!esResumen && <Boton ancho="w-auto" onClick={() => setPaso((p) => p + 1)}>Guardar y seguir</Boton>}
        </div>
      </div>

      {confirmandoSalida && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setConfirmandoSalida(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-gray-900 mb-2">¿Salir de la auditoría?</p>
            <p className="text-sm text-gray-500 mb-4">Tu avance se guardó como borrador — al volver, vas a retomar desde donde lo dejaste.</p>
            <div className="flex gap-2">
              <Boton ancho="w-auto" variante="secundario" onClick={() => setConfirmandoSalida(false)}>Seguir auditando</Boton>
              <Boton ancho="w-auto" onClick={confirmarSalida}>Guardar y salir</Boton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, areaNombre, respuesta, evidencias, subiendo, onResponder, onComentar, onComentarBlur, onNoAplica, onArchivo, onQuitarEvidencia, onReemplazarEvidencia }) {
  const reglaDisparada = (item.reglas || []).find((r) => evaluarCondicion(r.condicion_json.operador, respuesta.valor_json, r.condicion_json.valor));
  const acciones = reglaDisparada?.acciones_json;
  const requiereFoto = item.evidencia_requerida === 'FOTO' || !!acciones?.foto_obligatoria;
  const requiereVideo = item.evidencia_requerida === 'VIDEO' || !!acciones?.video_obligatoria;
  const requiereFotoOVideo = item.evidencia_requerida === 'FOTO_O_VIDEO';
  const fotos = evidencias.filter((e) => e.tipo === 'FOTO');
  const videos = evidencias.filter((e) => e.tipo === 'VIDEO');
  const faltaFoto = requiereFoto && fotos.length === 0;
  const faltaVideo = requiereVideo && videos.length === 0;
  const faltaFotoOVideo = requiereFotoOVideo && fotos.length === 0 && videos.length === 0;
  const faltaComentario = acciones?.comentario_obligatorio && !respuesta.comentario;

  // Se puede sacar una evidencia solo si no es la única que cumple un
  // requisito obligatorio - si no, hay que "reemplazarla" en vez de borrarla
  // sin más (spec: "siempre que la foto no sea obligatoria o exista otra
  // evidencia válida").
  function puedeQuitar(e) {
    if (e.tipo === 'FOTO') {
      if (requiereFoto && fotos.length <= 1) return false;
      if (requiereFotoOVideo && fotos.length <= 1 && videos.length === 0) return false;
    }
    if (e.tipo === 'VIDEO') {
      if (requiereVideo && videos.length <= 1) return false;
      if (requiereFotoOVideo && videos.length <= 1 && fotos.length === 0) return false;
    }
    return true;
  }

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 ${respuesta.no_aplica ? 'opacity-50' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800">
            {item.texto} {item.critico && <span className="text-xs text-fat-bordo-600 font-medium">· crítico</span>}
          </p>
          <div className="mt-1"><EtiquetaArea nombre={areaNombre} /></div>
        </div>
        {item.permite_no_aplica && (
          <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
            <input type="checkbox" checked={!!respuesta.no_aplica} onChange={(e) => onNoAplica(e.target.checked)} /> No aplica
          </label>
        )}
      </div>
      {item.ayuda_texto && <p className="text-xs text-gray-400">{item.ayuda_texto}</p>}

      {!respuesta.no_aplica && <RespuestaControl item={item} valor={respuesta.valor_json} onResponder={onResponder} />}

      {!respuesta.no_aplica && (
        <>
          <div className="flex items-start gap-2">
            <textarea
              className={`flex-1 text-sm rounded-lg border px-3 py-1.5 ${faltaComentario ? 'border-fat-bordo-400' : 'border-gray-200'}`}
              rows={faltaComentario || respuesta.comentario ? 2 : 1}
              placeholder={faltaComentario ? 'Comentario obligatorio' : 'Comentario (opcional)'}
              value={respuesta.comentario || ''}
              onChange={(e) => onComentar(e.target.value)}
              onBlur={onComentarBlur}
            />
            {/* La cámara para foto opcional está siempre disponible al lado
                del comentario, exija o no evidencia el ítem - si una regla
                la vuelve obligatoria, este mismo botón pasa a resaltarse en
                vez de agregar uno nuevo (una foto ya cargada alcanza). */}
            <BotonEvidencia label="" accept="image/*" capture="environment" onArchivo={onArchivo} resaltado={faltaFoto || faltaFotoOVideo} disabled={subiendo} icono />
          </div>

          {(requiereVideo || (requiereFotoOVideo && fotos.length === 0)) && (
            <div className="flex flex-wrap items-center gap-2">
              <BotonEvidencia label={subiendo ? 'Subiendo…' : 'Video'} accept="video/*" capture="environment" onArchivo={onArchivo} resaltado={faltaVideo || faltaFotoOVideo} disabled={subiendo} />
            </div>
          )}

          {evidencias.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {evidencias.map((e) => (
                <MiniaturaEvidencia
                  key={e.id}
                  evidencia={e}
                  puedeQuitar={puedeQuitar(e)}
                  onQuitar={() => onQuitarEvidencia(e.id)}
                  onReemplazar={(f) => onReemplazarEvidencia(e, f)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniaturaEvidencia({ evidencia, puedeQuitar, onQuitar, onReemplazar }) {
  const ref = useRef(null);
  return (
    <div className="relative">
      <button type="button" onClick={() => ref.current?.click()} title="Reemplazar" className="block">
        {evidencia.tipo === 'FOTO' ? (
          <img src={evidencia.thumbnail_url || evidencia.url} alt="evidencia" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
        ) : (
          <video src={evidencia.url} className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept={evidencia.tipo === 'FOTO' ? 'image/*' : 'video/*'}
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onReemplazar(f); e.target.value = ''; }}
      />
      {puedeQuitar && (
        <button onClick={onQuitar} title="Eliminar" className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full w-4 h-4 text-[10px] leading-none text-gray-500">×</button>
      )}
    </div>
  );
}

function BotonEvidencia({ label, accept, capture, onArchivo, resaltado, disabled, icono }) {
  const ref = useRef(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        title="Adjuntar foto"
        className={`shrink-0 text-xs px-2.5 rounded-lg border ${icono ? 'py-1.5' : 'py-1.5'} ${resaltado ? 'border-fat-bordo-400 text-fat-bordo-600 bg-fat-bordo-50/50' : 'border-gray-300 text-gray-500'} disabled:opacity-50`}
      >
        📷{label ? ` ${label}` : ''}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }}
      />
    </>
  );
}

function RespuestaControl({ item, valor, onResponder }) {
  if (item.tipo_respuesta === 'ESCALA_5' || item.tipo_respuesta === 'ESCALA_10') {
    const max = item.tipo_respuesta === 'ESCALA_5' ? 5 : 10;
    return (
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onResponder(n)}
            className={`w-9 h-9 rounded-lg text-sm font-medium border ${valor === n ? 'bg-fat-bordo-500 border-fat-bordo-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }
  if (item.tipo_respuesta === 'SI_NO') {
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => onResponder('SI')} className={`px-4 py-1.5 rounded-lg text-sm font-medium border ${valor === 'SI' ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-600'}`}>Sí</button>
        <button type="button" onClick={() => onResponder('NO')} className={`px-4 py-1.5 rounded-lg text-sm font-medium border ${valor === 'NO' ? 'bg-fat-bordo-500 border-fat-bordo-500 text-white' : 'border-gray-300 text-gray-600'}`}>No</button>
      </div>
    );
  }
  if (item.tipo_respuesta === 'CHECKBOX') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={valor === true} onChange={(e) => onResponder(e.target.checked)} /> Verificado
      </label>
    );
  }
  if (item.tipo_respuesta === 'OPCION_MULTIPLE') {
    return (
      <div className="flex gap-2 flex-wrap">
        {(item.opciones_json || []).map((op) => (
          <button
            key={op.etiqueta}
            type="button"
            onClick={() => onResponder(op.etiqueta)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${valor === op.etiqueta ? 'bg-fat-bordo-500 border-fat-bordo-500 text-white' : 'border-gray-300 text-gray-600'}`}
          >
            {op.etiqueta}
          </button>
        ))}
      </div>
    );
  }
  if (item.tipo_respuesta === 'NUMERO') {
    return <input type="number" className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={valor ?? ''} onChange={(e) => onResponder(e.target.value === '' ? null : Number(e.target.value))} />;
  }
  if (item.tipo_respuesta === 'FECHA') {
    return <input type="date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={valor ?? ''} onChange={(e) => onResponder(e.target.value)} />;
  }
  return <input type="text" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={valor ?? ''} onChange={(e) => onResponder(e.target.value)} />;
}
