import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Boton, Semaforo, Resultado, Cargando } from '../components/ui';

const API_URL = import.meta.env.VITE_API_URL;

function valorLegible(item, valor) {
  if (valor == null) return '—';
  if (item.tipo_respuesta === 'ESCALA_5') return `${valor} / 5`;
  if (item.tipo_respuesta === 'ESCALA_10') return `${valor} / 10`;
  if (item.tipo_respuesta === 'SI_NO') return valor === 'SI' || valor === true ? 'Sí' : 'No';
  if (item.tipo_respuesta === 'CHECKBOX') return valor ? 'Verificado' : 'Pendiente';
  return String(valor);
}

export default function HistorialDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [seleccionSeguimiento, setSeleccionSeguimiento] = useState(null); // null = no esta eligiendo
  const [creandoSeguimiento, setCreandoSeguimiento] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [mostrarEnviar, setMostrarEnviar] = useState(false);
  const [emails, setEmails] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviadoOk, setEnviadoOk] = useState(false);

  function recargar() {
    api.get(`/api/runs/${id}`).then(setRun).catch((e) => setError(e.message));
  }
  useEffect(recargar, [id]);

  if (error) return <p className="text-fat-bordo-600">{error}</p>;
  if (!run) return <Cargando />;

  const { estructura_snapshot: estructura, respuestas, evidencias, detalle_calculo: detalle } = run;
  const respuestaPorItem = new Map(respuestas.map((r) => [r.item_id, r]));
  const evidenciasPorRespuesta = new Map();
  for (const e of evidencias) {
    if (!evidenciasPorRespuesta.has(e.respuesta_id)) evidenciasPorRespuesta.set(e.respuesta_id, []);
    evidenciasPorRespuesta.get(e.respuesta_id).push(e);
  }

  async function descargarPdf() {
    setGenerandoPdf(true);
    setError('');
    try {
      const token = localStorage.getItem('fataudit_token');
      const resp = await fetch(`${API_URL}/api/runs/${id}/pdf`, { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) throw new Error('No se pudo generar el PDF');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerandoPdf(false);
    }
  }

  async function enviarInforme() {
    const destinatarios = emails.split(',').map((e) => e.trim()).filter(Boolean);
    if (destinatarios.length === 0) return;
    setEnviando(true);
    setError('');
    try {
      await api.post(`/api/runs/${id}/enviar-informe`, { destinatarios });
      setEnviadoOk(true);
      setEmails('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarSeguimiento() {
    setCreandoSeguimiento(true);
    try {
      const nuevo = await api.post(`/api/runs/${id}/seguimiento`, { item_ids: [...seleccionSeguimiento] });
      navigate(`/ejecucion/${nuevo.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreandoSeguimiento(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{run.sucursal_nombre || 'Auditoría'}</h1>
        <p className="text-sm text-gray-500">{run.tipo} · {new Date(run.creado_en).toLocaleString('es-AR')}</p>
      </div>

      <Tarjeta className="p-4 flex flex-wrap items-center gap-4">
        {run.puntaje_total != null && <span className="text-2xl font-bold text-gray-900">{Math.round(run.puntaje_total * 100)}%</span>}
        <Semaforo valor={run.semaforo} />
        <Resultado valor={run.resultado} />
        {run.estado === 'EN_PROGRESO' && <span className="text-sm text-gray-400">Auditoría en progreso</span>}
        {run.firma_nombre && <span className="text-sm text-gray-400 ml-auto">Firmado por {run.firma_nombre}</span>}
      </Tarjeta>

      {detalle?.umbralesFallidos?.length > 0 && (
        <Tarjeta className="p-4 bg-fat-bordo-50/40 border-fat-bordo-200">
          <p className="text-sm font-medium text-fat-bordo-800 mb-1">Umbrales críticos no alcanzados</p>
          <ul className="text-sm text-fat-bordo-700 list-disc list-inside">
            {detalle.umbralesFallidos.map((u, i) => (
              <li key={i}>{u.tipo === 'SECTOR' ? 'Sector' : 'Área'}: {Math.round(u.score * 100)}% (mínimo {Math.round(u.porcentaje_minimo * 100)}%)</li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {run.estado === 'COMPLETADA' && (
        <div className="flex flex-wrap justify-end gap-3">
          {seleccionSeguimiento ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{seleccionSeguimiento.size} hallazgo(s) elegido(s)</span>
              <Boton ancho="w-auto" variante="secundario" onClick={() => setSeleccionSeguimiento(null)}>Cancelar</Boton>
              <Boton ancho="w-auto" cargando={creandoSeguimiento} disabled={seleccionSeguimiento.size === 0} onClick={confirmarSeguimiento}>Crear seguimiento</Boton>
            </div>
          ) : (
            <>
              <Boton ancho="w-auto" variante="secundario" cargando={generandoPdf} onClick={descargarPdf}>Descargar PDF</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => { setMostrarEnviar((v) => !v); setEnviadoOk(false); }}>Enviar por email</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => setSeleccionSeguimiento(new Set())}>Crear auditoría de seguimiento</Boton>
            </>
          )}
        </div>
      )}

      {mostrarEnviar && (
        <Tarjeta className="p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">Enviar informe por email</p>
          {enviadoOk ? (
            <p className="text-sm text-green-700">Informe enviado.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                placeholder="mail1@ejemplo.com, mail2@ejemplo.com"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
              />
              <Boton ancho="w-auto" cargando={enviando} disabled={!emails.trim()} onClick={enviarInforme}>Enviar</Boton>
            </div>
          )}
        </Tarjeta>
      )}

      {estructura.sectores.map((sector) => {
        const itemsDelSector = estructura.items.filter((i) => i.sector_id === sector.id);
        if (itemsDelSector.length === 0) return null;
        return (
          <Tarjeta key={sector.id} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-900">{sector.nombre}</div>
            <div className="divide-y divide-gray-100">
              {itemsDelSector.map((item) => {
                const resp = respuestaPorItem.get(item.id);
                const evidenciasItem = resp ? evidenciasPorRespuesta.get(resp.id) || [] : [];
                const marcado = seleccionSeguimiento?.has(item.id);
                return (
                  <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${marcado ? 'bg-fat-bordo-50/40' : ''}`}>
                    {seleccionSeguimiento && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!!marcado}
                        onChange={(e) => {
                          const nuevo = new Set(seleccionSeguimiento);
                          if (e.target.checked) nuevo.add(item.id); else nuevo.delete(item.id);
                          setSeleccionSeguimiento(nuevo);
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">
                        {item.texto} {item.critico && <span className="text-xs text-fat-bordo-600 font-medium">· crítico</span>}
                      </p>
                      <p className="text-xs text-gray-400">{item.area_id != null && estructura.areas.find((a) => a.id === item.area_id)?.nombre}</p>
                      {resp?.comentario && <p className="text-sm text-gray-600 mt-1">"{resp.comentario}"</p>}
                      {evidenciasItem.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {evidenciasItem.map((e) => (
                            <a key={e.id} href={e.url} target="_blank" rel="noreferrer">
                              <img src={e.thumbnail_url || e.url} alt="evidencia" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 shrink-0">
                      {resp?.no_aplica ? 'No aplica' : valorLegible(item, resp?.valor_json)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Tarjeta>
        );
      })}
    </div>
  );
}
