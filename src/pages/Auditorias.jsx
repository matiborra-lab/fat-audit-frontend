import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Campo, Select, Boton, Modal, Leyenda, Cargando } from '../components/ui';

const ESTADO_ESTILOS = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  PUBLICADA: 'bg-green-100 text-green-700',
  ARCHIVADA: 'bg-gray-100 text-gray-400',
};

export default function Auditorias() {
  const navigate = useNavigate();
  const [lista, setLista] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'INTERNA', weighting_mode: 'CON_PESO', aprobadoDesde: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [duplicandoId, setDuplicandoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  function recargar() {
    api.get('/api/plantillas').then(setLista);
  }
  useEffect(recargar, []);

  async function crear(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const nueva = await api.post('/api/plantillas', {
        nombre: form.nombre, tipo: form.tipo, weighting_mode: form.weighting_mode,
        puntaje_minimo_aprobacion: form.aprobadoDesde === '' ? null : Number(form.aprobadoDesde) / 100,
      });
      navigate(`/auditorias/${nueva.id}`);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  async function duplicar(t) {
    setError('');
    setDuplicandoId(t.id);
    try {
      const nueva = await api.post(`/api/plantillas/${t.id}/duplicar`);
      navigate(`/auditorias/${nueva.id}`);
    } catch (err) {
      setError(err.message);
      setDuplicandoId(null);
    }
  }

  async function eliminar(t) {
    setError('');
    setEliminandoId(t.id);
    try {
      await api.del(`/api/plantillas/${t.id}`);
      setLista((l) => l.filter((x) => x.id !== t.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminandoId(null);
    }
  }

  if (!lista) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Auditorías</h1>
        <Boton ancho="w-auto" onClick={() => setModalAbierto(true)}>+ Nueva plantilla</Boton>
      </div>

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay plantillas cargadas.</p>}
          {lista.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 gap-3">
              <Link to={`/auditorias/${t.id}`} className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{t.nombre} <span className="text-gray-400 font-normal">v{t.version}</span></p>
                <p className="text-xs text-gray-400">{t.tipo} · {t.cantidad_items} ítems</p>
              </Link>
              <span className={`text-xs shrink-0 px-2.5 py-0.5 rounded-full font-medium ${ESTADO_ESTILOS[t.estado]}`}>{t.estado}</span>
              <button
                onClick={() => duplicar(t)}
                disabled={duplicandoId === t.id}
                className="text-xs shrink-0 text-fat-bordo-600 hover:underline disabled:opacity-50"
              >
                {duplicandoId === t.id ? 'Duplicando…' : 'Duplicar'}
              </button>
              <button
                onClick={() => eliminar(t)}
                disabled={eliminandoId === t.id}
                className="text-xs shrink-0 text-gray-400 hover:text-fat-bordo-600 disabled:opacity-50"
              >
                {eliminandoId === t.id ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      </Tarjeta>

      {modalAbierto && (
        <Modal titulo="Nueva plantilla" onClose={() => setModalAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            <Campo label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
            <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="INTERNA">Interna</option>
              <option value="MARCA">De marca</option>
              <option value="SEGUIMIENTO">Seguimiento</option>
            </Select>
            <Select label="Modo de ponderación" value={form.weighting_mode} onChange={(e) => setForm({ ...form, weighting_mode: e.target.value })}>
              <option value="CON_PESO">Con pesos personalizados</option>
              <option value="SIN_PESO">Sin pesos (reparto igualitario)</option>
            </Select>
            <Campo
              label="Aprobada desde (% del puntaje total, opcional)"
              type="number" min="0" max="100" step="0.1"
              value={form.aprobadoDesde}
              onChange={(e) => setForm({ ...form, aprobadoDesde: e.target.value })}
              placeholder="ej: 75"
            />
            <Leyenda>Si el puntaje total no llega a este %, la auditoría queda desaprobada — independiente de los umbrales críticos por sector/área, que se configuran aparte. Dejalo vacío si solo querés que decidan esos umbrales.</Leyenda>
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Crear y editar estructura</Boton>
          </form>
        </Modal>
      )}
    </div>
  );
}
