import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Boton, Toast, Puntaje, Resultado, Cargando, EtiquetaArea } from '../components/ui';
import BuscadorResponsable from '../components/BuscadorResponsable';
import { esHallazgo } from '../utils/hallazgos';

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
  const { usuario } = useAuth();
  const puedeGenerarSeguimiento = usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR';
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [seleccionSeguimiento, setSeleccionSeguimiento] = useState(null); // null = no esta eligiendo
  const [programandoSeguimiento, setProgramandoSeguimiento] = useState(false); // 2do paso: sucursal/responsable/fecha
  const [formProgramar, setFormProgramar] = useState({ responsable: null, fecha: '', hora: '', notificar: true });
  const [guardandoSeguimiento, setGuardandoSeguimiento] = useState(false);
  const [errorSeguimiento, setErrorSeguimiento] = useState('');
  const [toast, setToast] = useState('');
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

  function iniciarSeleccionSeguimiento() {
    // El sistema propone los items críticos o con resultado deficiente -
    // el admin/auditor los revisa y ajusta antes de programar.
    const propuestos = new Set(
      estructura.items.filter((item) => esHallazgo(item, respuestaPorItem.get(item.id))).map((i) => i.id)
    );
    setSeleccionSeguimiento(propuestos);
  }

  function cancelarSeguimiento() {
    setSeleccionSeguimiento(null);
    setProgramandoSeguimiento(false);
    setFormProgramar({ responsable: null, fecha: '', hora: '', notificar: true });
    setErrorSeguimiento('');
  }

  async function programarSeguimiento(e) {
    e.preventDefault();
    if (!formProgramar.responsable) { setErrorSeguimiento('Elegí un responsable'); return; }
    if (!formProgramar.fecha || !formProgramar.hora) { setErrorSeguimiento('Elegí fecha y hora'); return; }
    setErrorSeguimiento('');
    setGuardandoSeguimiento(true);
    try {
      const fecha_hora = new Date(`${formProgramar.fecha}T${formProgramar.hora}:00`).toISOString();
      await api.post(`/api/runs/${id}/seguimiento`, {
        item_ids: [...seleccionSeguimiento], responsable_user_id: formProgramar.responsable.id,
        fecha_hora, notificar: formProgramar.notificar,
      });
      cancelarSeguimiento();
      setToast('Seguimiento programado y notificado al responsable');
    } catch (err) {
      setErrorSeguimiento(err.message);
    } finally {
      setGuardandoSeguimiento(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{run.sucursal_nombre || 'Auditoría'}</h1>
        <p className="text-sm text-gray-500">{run.tipo} · {new Date(run.creado_en).toLocaleString('es-AR', { hour12: false })}</p>
      </div>

      <Tarjeta className="p-4 flex flex-wrap items-center gap-4">
        <Puntaje valor={run.puntaje_total} semaforo={run.semaforo} tamano="lg" />
        <Resultado valor={run.resultado} />
        {run.estado === 'EN_PROGRESO' && <span className="text-sm text-gray-400">Auditoría en progreso</span>}
        {run.firma_nombre && <span className="text-sm text-gray-400 ml-auto">Firmado por {run.firma_nombre}</span>}
      </Tarjeta>

      {(detalle?.umbralesFallidos?.length > 0 || detalle?.noAlcanzaMinimoGeneral) && (
        <Tarjeta className="p-4 bg-fat-bordo-50/40 border-fat-bordo-200">
          <p className="text-sm font-medium text-fat-bordo-800 mb-1">Motivo de la desaprobación</p>
          <ul className="text-sm text-fat-bordo-700 list-disc list-inside">
            {detalle.noAlcanzaMinimoGeneral && (
              <li>Puntaje total {Math.round(run.puntaje_total * 100)}% — no alcanza el mínimo general de {Math.round(detalle.puntajeMinimoAprobacion * 100)}%</li>
            )}
            {detalle.umbralesFallidos.map((u, i) => (
              <li key={i}>{u.tipo === 'SECTOR' ? 'Sector' : 'Área'}: {Math.round(u.score * 100)}% (mínimo {Math.round(u.porcentaje_minimo * 100)}%)</li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {run.estado === 'COMPLETADA' && (
        <div className="flex flex-wrap justify-end gap-3">
          {seleccionSeguimiento && !programandoSeguimiento ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{seleccionSeguimiento.size} hallazgo(s) elegido(s)</span>
              <Boton ancho="w-auto" variante="secundario" onClick={cancelarSeguimiento}>Cancelar</Boton>
              <Boton ancho="w-auto" disabled={seleccionSeguimiento.size === 0} onClick={() => setProgramandoSeguimiento(true)}>Continuar</Boton>
            </div>
          ) : !seleccionSeguimiento ? (
            <>
              <Boton ancho="w-auto" variante="secundario" cargando={generandoPdf} onClick={descargarPdf}>Descargar PDF</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => { setMostrarEnviar((v) => !v); setEnviadoOk(false); }}>Enviar por email</Boton>
              {puedeGenerarSeguimiento && run.tipo === 'MARCA' && (
                <Boton ancho="w-auto" variante="secundario" onClick={iniciarSeleccionSeguimiento}>Generar auditoría de seguimiento</Boton>
              )}
            </>
          ) : null}
        </div>
      )}

      {programandoSeguimiento && (
        <Tarjeta className="p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Programar seguimiento — {seleccionSeguimiento.size} hallazgo(s)</p>
          <p className="text-xs text-gray-400">Se crea un evento en el calendario de <strong>{run.sucursal_nombre}</strong>; la auditoría de seguimiento arranca recién cuando se inicia desde ahí en la fecha elegida.</p>
          <form onSubmit={programarSeguimiento} className="space-y-3">
            <BuscadorResponsable
              sucursalId={run.sucursal_id} label="Responsable" nombreValue={formProgramar.responsable?.nombre}
              onChange={(_id, u) => setFormProgramar({ ...formProgramar, responsable: u })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha" type="date" required value={formProgramar.fecha} onChange={(e) => setFormProgramar({ ...formProgramar, fecha: e.target.value })} />
              <Campo label="Hora" type="time" required value={formProgramar.hora} onChange={(e) => setFormProgramar({ ...formProgramar, hora: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={formProgramar.notificar} onChange={(e) => setFormProgramar({ ...formProgramar, notificar: e.target.checked })} />
              Notificar al responsable ahora
            </label>
            {errorSeguimiento && <p className="text-sm text-fat-bordo-600">{errorSeguimiento}</p>}
            <div className="flex gap-2">
              <Boton ancho="w-auto" variante="secundario" onClick={() => setProgramandoSeguimiento(false)}>Volver</Boton>
              <Boton type="submit" cargando={guardandoSeguimiento}>Programar seguimiento</Boton>
            </div>
          </form>
        </Tarjeta>
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
                    {seleccionSeguimiento && !programandoSeguimiento && (
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
                      <div className="mt-1"><EtiquetaArea nombre={estructura.areas.find((a) => a.id === item.area_id)?.nombre} /></div>
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

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
