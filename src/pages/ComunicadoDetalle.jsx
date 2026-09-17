import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Boton, Cargando } from '../components/ui';

// Vista de UNA notificación de tipo comunicado, ya personalizada para quien
// la recibió (título/cuerpo ya vienen con las variables reemplazadas, ver
// enviarComunicado en el backend) - a la que se llega tocando el push o la
// campana. Si la notificación no existe o no es propia, el backend
// devuelve 404 (mismo criterio que /api/notificaciones/:id/leida).
export default function ComunicadoDetalle() {
  const { notificacionId } = useParams();
  const navigate = useNavigate();
  const [notificacion, setNotificacion] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/notificaciones/${notificacionId}`)
      .then((n) => { setNotificacion(n); if (!n.leida_en) api.post(`/api/notificaciones/${notificacionId}/leida`).catch(() => {}); })
      .catch((err) => setError(err.message));
  }, [notificacionId]);

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-fat-bordo-600">{error}</p>
        <Boton ancho="w-auto" variante="secundario" onClick={() => navigate('/calendario')}>Volver</Boton>
      </div>
    );
  }
  if (!notificacion) return <Cargando />;

  const payload = notificacion.payload_json || {};

  return (
    <div className="space-y-4 max-w-xl">
      <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-fat-bordo-600">← Volver</button>
      <Tarjeta className="overflow-hidden">
        {payload.imagen_url && (
          <img src={payload.imagen_url} alt="" className="w-full max-h-80 object-cover" />
        )}
        <div className="p-4 space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">{notificacion.titulo}</h1>
          {notificacion.cuerpo && <p className="text-sm text-gray-700 whitespace-pre-wrap">{notificacion.cuerpo}</p>}
          {payload.enlace && (
            <a
              href={payload.enlace} target="_blank" rel="noreferrer"
              className="inline-block text-sm font-medium rounded-lg py-2 px-4 transition bg-fat-bordo-500 hover:bg-fat-bordo-600 text-white"
            >
              {payload.enlace_nombre || 'Ver más'}
            </a>
          )}
          <p className="text-xs text-gray-400">
            {new Date(notificacion.creado_en).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </Tarjeta>
    </div>
  );
}
