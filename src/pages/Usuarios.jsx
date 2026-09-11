import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';

const ROLES = ['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR'];
const PUESTOS = ['COCINA', 'CAJA', 'REFUERZO_COCINA'];
const PUESTO_LABEL = { COCINA: 'Cocina', CAJA: 'Caja', REFUERZO_COCINA: 'Refuerzo cocina' };

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const esGerente = yo.rol === 'GERENTE';
  const [lista, setLista] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ email: '', usuario: '', nombre: '', rol: esGerente ? 'COLABORADOR' : 'AUDITOR', sucursal_id: '', puesto: '' });
  const [formEdit, setFormEdit] = useState({ nombre: '', usuario: '', puesto: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function recargar() {
    api.get('/api/admin/usuarios').then(setLista);
  }
  useEffect(() => {
    recargar();
    if (!esGerente) api.get('/api/sucursales').then(setSucursales);
  }, []);

  async function crear(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const body = { ...form };
      if (esGerente) { body.rol = 'COLABORADOR'; delete body.sucursal_id; }
      else { body.sucursal_id = (form.rol === 'GERENTE' || form.rol === 'COLABORADOR') ? Number(form.sucursal_id) : null; }
      if (body.rol !== 'COLABORADOR') delete body.puesto;
      await api.post('/api/admin/usuarios', body);
      setModalAbierto(false);
      setForm({ email: '', usuario: '', nombre: '', rol: esGerente ? 'COLABORADOR' : 'AUDITOR', sucursal_id: '', puesto: '' });
      setToast('Usuario invitado por mail');
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const body = { nombre: formEdit.nombre, usuario: formEdit.usuario || null };
      if (editando.rol === 'COLABORADOR') body.puesto = formEdit.puesto;
      await api.patch(`/api/admin/usuarios/${editando.id}`, body);
      setEditando(null);
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

  function abrirEdicion(u) {
    setError('');
    setFormEdit({ nombre: u.nombre || '', usuario: u.usuario || '', puesto: u.puesto || '' });
    setEditando(u);
  }

  if (!lista) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{esGerente ? 'Colaboradores' : 'Usuarios'}</h1>
        <Boton ancho="w-auto" onClick={() => setModalAbierto(true)}>{esGerente ? '+ Invitar colaborador' : '+ Invitar usuario'}</Boton>
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <button className="min-w-0 text-left" onClick={() => abrirEdicion(u)}>
                <p className="text-sm font-medium text-gray-900 truncate">{u.nombre || u.email}</p>
                <p className="text-xs text-gray-400 truncate">
                  {u.usuario ? `@${u.usuario} · ` : ''}{u.email} · {u.rol}{u.puesto ? ` · ${PUESTO_LABEL[u.puesto]}` : ''}{u.sucursal_nombre ? ` · ${u.sucursal_nombre}` : ''}
                  {!u.clave_definida && ' · invitación pendiente'}
                </p>
              </button>
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
        <Modal titulo={esGerente ? 'Invitar colaborador' : 'Invitar usuario'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            <Campo label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
            <Campo label="Nombre de usuario (opcional, para loguearse sin el mail)" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
            <Campo label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            {!esGerente && (
              <Select label="Rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            )}
            {!esGerente && (form.rol === 'GERENTE' || form.rol === 'COLABORADOR') && (
              <Select label="Sucursal" required value={form.sucursal_id} onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}>
                <option value="">Elegí una sucursal</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            )}
            {(esGerente || form.rol === 'COLABORADOR') && (
              <Select label="Puesto" required value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })}>
                <option value="">Elegí un puesto</option>
                {PUESTOS.map((p) => <option key={p} value={p}>{PUESTO_LABEL[p]}</option>)}
              </Select>
            )}
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Invitar</Boton>
          </form>
        </Modal>
      )}

      {editando && (
        <Modal titulo="Editar usuario" onClose={() => setEditando(null)}>
          <form onSubmit={guardarEdicion} className="space-y-4">
            <Campo label="Nombre" value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} autoFocus />
            <Campo label="Nombre de usuario" value={formEdit.usuario} onChange={(e) => setFormEdit({ ...formEdit, usuario: e.target.value })} />
            {editando.rol === 'COLABORADOR' && (
              <Select label="Puesto" required value={formEdit.puesto} onChange={(e) => setFormEdit({ ...formEdit, puesto: e.target.value })}>
                <option value="">Elegí un puesto</option>
                {PUESTOS.map((p) => <option key={p} value={p}>{PUESTO_LABEL[p]}</option>)}
              </Select>
            )}
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Guardar</Boton>
          </form>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
