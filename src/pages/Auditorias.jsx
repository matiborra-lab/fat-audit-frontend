import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Campo, Select, Boton, Modal, Cargando } from '../components/ui';

const ESTADO_ESTILOS = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  PUBLICADA: 'bg-green-100 text-green-700',
  ARCHIVADA: 'bg-gray-100 text-gray-400',
};

export default function Auditorias() {
  const navigate = useNavigate();
  const [lista, setLista] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'INTERNA', weighting_mode: 'CON_PESO' });
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
      const nueva = await api.post('/api/plantillas', form);
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

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay plantillas cargadas.</p>}
          {lista.map((t) => (
            <Link key={t.id} to={`/auditorias/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.nombre} <span className="text-gray-400 font-normal">v{t.version}</span></p>
                <p className="text-xs text-gray-400">{t.tipo} · {t.cantidad_items} ítems</p>
              </div>
              <span className={`text-xs shrink-0 px-2.5 py-0.5 rounded-full font-medium ${ESTADO_ESTILOS[t.estado]}`}>{t.estado}</span>
            </Link>
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
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Crear y editar estructura</Boton>
          </form>
        </Modal>
      )}
    </div>
  );
}
