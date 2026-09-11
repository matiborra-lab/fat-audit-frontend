import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';

const ROLES = ['ADMIN', 'AUDITOR', 'GERENTE'];

export default function Usuarios() {
  const [lista, setLista] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ email: '', nombre: '', rol: 'AUDITOR', sucursal_id: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function recargar() {
    api.get('/api/admin/usuarios').then(setLista);
  }
  useEffect(() => {
    recargar();
    api.get('/api/sucursales').then(setSucursales);
  }, []);

  async function crear(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await api.post('/api/admin/usuarios', { ...form, sucursal_id: form.rol === 'GERENTE' ? Number(form.sucursal_id) : null });
      setModalAbierto(false);
      setForm({ email: '', nombre: '', rol: 'AUDITOR', sucursal_id: '' });
      setToast('Usuario invitado por mail');
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(usuario) {
    await api.patch(`/api/admin/usuarios/${usuario.id}`, { activo: !usuario.activo });
    recargar();
  }

  if (!lista) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
        <Boton ancho="w-auto" onClick={() => setModalAbierto(true)}>+ Invitar usuario</Boton>
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.nombre || u.email}</p>
                <p className="text-xs text-gray-400 truncate">
                  {u.email} · {u.rol}{u.sucursal_nombre ? ` · ${u.sucursal_nombre}` : ''}
                  {!u.clave_definida && ' · invitación pendiente'}
                </p>
              </div>
              <button
                onClick={() => cambiarActivo(u)}
                className={`text-xs shrink-0 px-2.5 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {u.activo ? 'Activo' : 'Deshabilitado'}
              </button>
            </div>
          ))}
        </div>
      </Tarjeta>

      {modalAbierto && (
        <Modal titulo="Invitar usuario" onClose={() => setModalAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            <Campo label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
            <Campo label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <Select label="Rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            {form.rol === 'GERENTE' && (
              <Select label="Sucursal" required value={form.sucursal_id} onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
                <option value="">Elegí una sucursal</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            )}
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Invitar</Boton>
          </form>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
