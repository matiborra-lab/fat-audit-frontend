import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Campo, Boton, Modal, Toast, Cargando } from '../components/ui';

export default function Sucursales() {
  const [lista, setLista] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ nombre: '', codigo: '', direccion: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function recargar() {
    api.get('/api/sucursales').then(setLista);
  }
  useEffect(recargar, []);

  async function crear(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await api.post('/api/sucursales', form);
      setModalAbierto(false);
      setForm({ nombre: '', codigo: '', direccion: '' });
      setToast('Sucursal creada');
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!lista) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Sucursales</h1>
        <Boton ancho="w-auto" onClick={() => setModalAbierto(true)}>+ Nueva sucursal</Boton>
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay sucursales cargadas.</p>}
          {lista.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{s.nombre}</p>
              <p className="text-xs text-gray-400">{[s.codigo, s.direccion].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</p>
            </div>
          ))}
        </div>
      </Tarjeta>

      {modalAbierto && (
        <Modal titulo="Nueva sucursal" onClose={() => setModalAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            <Campo label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
            <Campo label="Código (opcional)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo label="Dirección (opcional)" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Crear</Boton>
          </form>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
