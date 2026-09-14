import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Campo, Select, Boton, Modal, Leyenda, Cargando } from '../components/ui';

const ESTADO_ESTILOS = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  PUBLICADA: 'bg-green-100 text-green-700',
  ARCHIVADA: 'bg-gray-100 text-gray-400',
};
const TIPO_LABEL = { INTERNA: 'Interna', MARCA: 'De marca', SEGUIMIENTO: 'Seguimiento' };

export default function Auditorias() {
  const navigate = useNavigate();
  const [lista, setLista] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'INTERNA', weighting_mode: 'CON_PESO', aprobadoDesde: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

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
              <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{t.nombre} <span className="text-gray-400 font-normal">v{t.version}</span></p>
              <span className="text-xs shrink-0 text-gray-500 w-24">{TIPO_LABEL[t.tipo] || t.tipo}</span>
              <span className={`text-xs shrink-0 px-2.5 py-0.5 rounded-full font-medium ${ESTADO_ESTILOS[t.estado]}`}>{t.estado}</span>
              <Link
                to={`/auditorias/${t.id}`}
                className="text-xs shrink-0 text-fat-bordo-600 hover:underline"
              >
                ✏️ Editar
              </Link>
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
            <Boton type="submit" cargando={guardando}>Crear</Boton>
          </form>
        </Modal>
      )}
    </div>
  );
}
