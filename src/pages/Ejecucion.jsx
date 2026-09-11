import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Boton, Cargando } from '../components/ui';

function claveBorrador(runId) {
  return `fataudit_borrador_${runId}`;
}

// Misma logica que auth/../scoring/index.js del backend (evaluarCondicion en
// runs.js) - reimplementada acá SOLO para dar feedback inmediato en pantalla
// mientras se completa la auditoría. La validación real y definitiva la hace
// el backend al finalizar.
function evaluarCondicion(operador, valorRespuesta, valorCondicion) {
  if (valorRespuesta == null) return false;
  switch (operador) {
    case '=': return valorRespuesta === valorCondicion;
    case '!=': return valorRespuesta !== valorCondicion;
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
  const fileInputs = useRef({});

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

  if (error) return <p className="text-fat-bordo-600">{error}</p>;
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
      const evidencia = await api.post(`/api/runs/${id}/evidencia`, { item_id: item.id, tipo, url: publicUrl });
      setEvidencias((prev) => ({ ...prev, [item.id]: [...(prev[item.id] || []), evidencia] }));
    } catch (err) {
      setError('No se pudo subir la evidencia: ' + err.message);
    } finally {
      setSubiendo(null);
    }
  }

  async function quitarEvidencia(itemId, evidenciaId) {
    await api.del(`/api/evidencias/${evidenciaId}`);
    setEvidencias((prev) => ({ ...prev, [itemId]: prev[itemId].filter((e) => e.id !== evidenciaId) }));
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

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <div>
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>{esResumen ? 'Resumen' : sectorActual.nombre}</span>
          <span>{respondidos}/{totalItems} respondidos</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-fat-bordo-500 transition-all" style={{ width: `${(respondidos / totalItems) * 100}%` }} />
        </div>
      </div>

      {!esResumen && (
        <div className="space-y-3">
          {itemsDelSector.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              respuesta={respuestas[item.id] || {}}
              evidencias={evidencias[item.id] || []}
              subiendo={subiendo === item.id}
              onResponder={(v) => responder(item.id, v)}
              onComentar={(c) => comentar(item.id, c)}
              onComentarBlur={() => comentarBlur(item.id)}
              onNoAplica={(v) => marcarNoAplica(item.id, v)}
              onArchivo={(f) => subirEvidencia(item, f)}
              onQuitarEvidencia={(eid) => quitarEvidencia(item.id, eid)}
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

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-center gap-3">
        <div className="w-full max-w-2xl flex justify-between gap-3">
          <Boton ancho="w-auto" variante="secundario" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>Anterior</Boton>
          {!esResumen && <Boton ancho="w-auto" onClick={() => setPaso((p) => p + 1)}>Guardar y seguir</Boton>}
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, respuesta, evidencias, subiendo, onResponder, onComentar, onComentarBlur, onNoAplica, onArchivo, onQuitarEvidencia }) {
  const reglaDisparada = (item.reglas || []).find((r) => evaluarCondicion(r.condicion_json.operador, respuesta.valor_json, r.condicion_json.valor));
  const acciones = reglaDisparada?.acciones_json;
  const faltaFoto = acciones?.foto_obligatoria && !evidencias.some((e) => e.tipo === 'FOTO');
  const faltaVideo = acciones?.video_obligatoria && !evidencias.some((e) => e.tipo === 'VIDEO');
  const faltaComentario = acciones?.comentario_obligatorio && !respuesta.comentario;

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 ${respuesta.no_aplica ? 'opacity-50' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800 flex-1">
          {item.texto} {item.critico && <span className="text-xs text-fat-bordo-600 font-medium">· crítico</span>}
        </p>
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
          <textarea
            className={`w-full text-sm rounded-lg border px-3 py-1.5 ${faltaComentario ? 'border-fat-bordo-400' : 'border-gray-200'}`}
            rows={faltaComentario || respuesta.comentario ? 2 : 1}
            placeholder={faltaComentario ? 'Comentario obligatorio' : 'Comentario (opcional)'}
            value={respuesta.comentario || ''}
            onChange={(e) => onComentar(e.target.value)}
            onBlur={onComentarBlur}
          />

          {item.evidencia_requerida !== 'NINGUNA' || acciones?.foto_obligatoria || acciones?.video_obligatoria ? (
            <div className="flex flex-wrap items-center gap-2">
              {(item.evidencia_requerida === 'FOTO' || item.evidencia_requerida === 'FOTO_O_VIDEO' || acciones?.foto_obligatoria) && (
                <BotonEvidencia label={subiendo ? 'Subiendo…' : 'Foto'} accept="image/*" capture="environment" onArchivo={onArchivo} resaltado={faltaFoto} disabled={subiendo} />
              )}
              {(item.evidencia_requerida === 'VIDEO' || item.evidencia_requerida === 'FOTO_O_VIDEO' || acciones?.video_obligatoria) && (
                <BotonEvidencia label={subiendo ? 'Subiendo…' : 'Video'} accept="video/*" capture="environment" onArchivo={onArchivo} resaltado={faltaVideo} disabled={subiendo} />
              )}
              {evidencias.map((e) => (
                <div key={e.id} className="relative">
                  {e.tipo === 'FOTO' ? (
                    <img src={e.url} alt="evidencia" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                  ) : (
                    <video src={e.url} className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                  )}
                  <button onClick={() => onQuitarEvidencia(e.id)} className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full w-4 h-4 text-[10px] leading-none text-gray-500">×</button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function BotonEvidencia({ label, accept, capture, onArchivo, resaltado, disabled }) {
  const ref = useRef(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className={`text-xs px-2.5 py-1.5 rounded-lg border ${resaltado ? 'border-fat-bordo-400 text-fat-bordo-600' : 'border-gray-300 text-gray-600'} disabled:opacity-50`}
      >
        📷 {label}
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
