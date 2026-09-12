import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Boton, Toast, Cargando, BotonCamara } from '../components/ui';

function aClaveDia(d) {
  return d.toISOString().slice(0, 10);
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

const VENTANA_DIAS = 90;

export default function Tareas() {
  const [eventos, setEventos] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  function recargar() {
    const hoy = new Date();
    const desde = aClaveDia(new Date(hoy.getTime() - VENTANA_DIAS * 86400000));
    const hasta = aClaveDia(new Date(hoy.getTime() + VENTANA_DIAS * 86400000));
    api.get(`/api/calendario?tipo=TAREA&desde=${desde}&hasta=${hasta}`).then(setEventos).catch((e) => setError(e.message));
  }
  useEffect(recargar, []);

  const { pendientes, historial } = useMemo(() => {
    const p = [];
    const h = [];
    for (const e of eventos || []) {
      if (e.estado_efectivo === 'COMPLETADA') h.push(e);
      else if (e.estado_efectivo === 'PENDIENTE' || e.estado_efectivo === 'DEMORADA') p.push(e);
    }
    p.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
    h.sort((a, b) => new Date(b.completado_en) - new Date(a.completado_en));
    return { pendientes: p, historial: h };
  }, [eventos]);

  if (!eventos) return <Cargando />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pendientes ({pendientes.length})</h2>
        <Tarjeta className="overflow-hidden">
          {pendientes.length === 0 && <p className="p-4 text-sm text-gray-400">No tenés tareas pendientes.</p>}
          <div className="divide-y divide-gray-100">
            {pendientes.map((e) => (
              <TareaPendiente key={e.id} evento={e} onCambio={() => { recargar(); setToast('Tarea completada'); }} />
            ))}
          </div>
        </Tarjeta>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Historial ({historial.length})</h2>
        <Tarjeta className="overflow-hidden">
          {historial.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no se completó ninguna tarea.</p>}
          <div className="divide-y divide-gray-100">
            {historial.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{e.titulo}{e.sucursal_nombre ? ` · ${e.sucursal_nombre}` : ''}</p>
                <p className="text-xs text-gray-400">
                  Programada: {formatearFechaHora(e)} · Completada: {new Date(e.completado_en).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-gray-500 italic mt-0.5">{calcularObservacion(e)}</p>
                {e.completado_comentario && <p className="text-xs text-gray-600 mt-0.5">"{e.completado_comentario}"</p>}
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function TareaPendiente({ evento, onCambio }) {
  const [completando, setCompletando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const puedeCompletar = new Date(evento.fecha_hora) <= new Date();

  async function confirmar() {
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
      await api.post(`/api/calendario/${evento.id}/completar`, {
        comentario: comentario || null,
        evidencia_url: evidenciaUrl,
        evidencia_tipo: evidenciaUrl ? 'FOTO' : null,
      });
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{evento.titulo}{evento.sucursal_nombre ? ` · ${evento.sucursal_nombre}` : ''}</p>
          <p className="text-xs text-gray-400">
            Asignó: {evento.creado_por_nombre || '—'} · Programada: {formatearFechaHora(evento)}
            {evento.responsable_nombre && ` · ${evento.responsable_nombre}`}
          </p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${evento.estado_efectivo === 'DEMORADA' ? 'bg-fat-bordo-100 text-fat-bordo-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {evento.estado_efectivo === 'DEMORADA' ? 'Demorada' : 'Pendiente'}
        </span>
      </div>

      <div className="mt-2">
        {!completando ? (
          <div title={!puedeCompletar ? 'Todavía no llegó la fecha/hora programada' : undefined}>
            <Boton ancho="w-auto" variante="secundario" disabled={!puedeCompletar} onClick={() => setCompletando(true)}>Marcar cumplida</Boton>
          </div>
        ) : (
          <div className="space-y-2">
            <input className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
            {evento.evidencia_obligatoria && (
              <div className="flex items-center gap-2">
                <BotonCamara archivo={archivo} onArchivo={setArchivo} />
                <span className="text-xs text-gray-400">Esta tarea requiere foto de evidencia (solo cámara).</span>
              </div>
            )}
            {error && <p className="text-xs text-fat-bordo-600">{error}</p>}
            <div className="flex gap-2">
              <Boton ancho="w-auto" cargando={guardando} onClick={confirmar}>Confirmar cumplimiento</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => setCompletando(false)}>Cancelar</Boton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
