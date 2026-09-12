import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Modal, Toast, Cargando } from '../components/ui';

const ROLES = ['ADMIN', 'AUDITOR', 'GERENTE', 'COLABORADOR'];
const ROL_LABEL = { ADMIN: 'Admin', AUDITOR: 'Auditor', GERENTE: 'Gerente', COLABORADOR: 'Colaborador' };
const PUESTOS = ['COCINA', 'CAJA', 'REFUERZO_COCINA'];
const PUESTO_LABEL = { COCINA: 'Cocina', CAJA: 'Caja', REFUERZO_COCINA: 'Refuerzo cocina' };

function formatearFecha(valor) {
  if (!valor) return 'Sin actividad todavía';
  return new Date(valor).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const esGerente = yo.rol === 'GERENTE';
  const [lista, setLista] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ email: '', usuario: '', nombre: '', rol: esGerente ? 'COLABORADOR' : 'AUDITOR', sucursal_id: '', puesto: '', fecha_nacimiento: '' });
  const [formEdit, setFormEdit] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const [reseteando, setReseteando] = useState(false);

  function recargar() {
    const params = new URLSearchParams();
    if (filtroSucursal) params.set('sucursal_id', filtroSucursal);
    if (filtroRol) params.set('rol', filtroRol);
    const query = params.toString();
    api.get('/api/admin/usuarios' + (query ? '?' + query : '')).then(setLista);
  }
  useEffect(recargar, [filtroSucursal, filtroRol]);
  useEffect(() => {
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
      setForm({ email: '', usuario: '', nombre: '', rol: esGerente ? 'COLABORADOR' : 'AUDITOR', sucursal_id: '', puesto: '', fecha_nacimiento: '' });
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
      if (esGerente) {
        if (editando.rol === 'COLABORADOR') { body.puesto = formEdit.puesto; body.fecha_nacimiento = formEdit.fecha_nacimiento || null; }
      } else {
        body.rol = formEdit.rol;
        body.sucursal_id = (formEdit.rol === 'GERENTE' || formEdit.rol === 'COLABORADOR') ? Number(formEdit.sucursal_id) : null;
        if (formEdit.rol === 'COLABORADOR') body.puesto = formEdit.puesto;
        if (formEdit.rol === 'GERENTE' || formEdit.rol === 'COLABORADOR') body.fecha_nacimiento = formEdit.fecha_nacimiento || null;
      }
      await api.patch(`/api/admin/usuarios/${editando.id}`, body);
      setEditando(null);
      setToast('Usuario actualizado');
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

  async function restablecerPassword() {
    setReseteando(true);
    setError('');
    try {
      const r = await api.post(`/api/admin/usuarios/${editando.id}/resetear`);
      setConfirmandoReset(false);
      setToast(r.message || 'Mail de reseteo enviado');
    } catch (err) {
      setError(err.message);
    } finally {
      setReseteando(false);
    }
  }

  function abrirEdicion(u) {
    setError('');
    setConfirmandoReset(false);
    setFormEdit({ nombre: u.nombre || '', usuario: u.usuario || '', puesto: u.puesto || '', rol: u.rol, sucursal_id: u.sucursal_id || '', fecha_nacimiento: u.fecha_nacimiento || '' });
    setEditando(u);
  }

  if (!lista) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{esGerente ? 'Colaboradores' : 'Usuarios'}</h1>
        <Boton ancho="w-auto" onClick={() => setModalAbierto(true)}>{esGerente ? '+ Invitar colaborador' : '+ Invitar usuario'}</Boton>
      </div>

      {!esGerente && (
        <div className="grid grid-cols-2 gap-3">
          <Select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
          <Select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </Select>
        </div>
      )}

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-400">No hay usuarios con estos filtros.</p>}
          {lista.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <button className="min-w-0 text-left" onClick={() => abrirEdicion(u)}>
                <p className="text-sm font-medium text-gray-900 truncate">{u.nombre || u.email}</p>
                <p className="text-xs text-gray-400 truncate">
                  {u.usuario ? `@${u.usuario} · ` : ''}{u.email} · {ROL_LABEL[u.rol]}{u.puesto ? ` · ${PUESTO_LABEL[u.puesto]}` : ''}{u.sucursal_nombre ? ` · ${u.sucursal_nombre}` : ''}
                  {!u.clave_definida && ' · invitación pendiente'}
                </p>
                <p className="text-xs text-gray-300 truncate">Última actividad: {formatearFecha(u.ultima_actividad_en)}</p>
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
                {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
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
            {(esGerente || form.rol === 'GERENTE' || form.rol === 'COLABORADOR') && (
              <Campo label="Fecha de nacimiento (opcional)" type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
            )}
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Invitar</Boton>
          </form>
        </Modal>
      )}

      {editando && formEdit && (
        <Modal titulo="Editar usuario" onClose={() => setEditando(null)}>
          <form onSubmit={guardarEdicion} className="space-y-4">
            <Campo label="Nombre" value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} autoFocus />
            <Campo label="Nombre de usuario" value={formEdit.usuario} onChange={(e) => setFormEdit({ ...formEdit, usuario: e.target.value })} />
            {!esGerente && (
              <Select label="Rol" value={formEdit.rol} onChange={(e) => setFormEdit({ ...formEdit, rol: e.target.value, sucursal_id: '' })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </Select>
            )}
            {!esGerente && (formEdit.rol === 'GERENTE' || formEdit.rol === 'COLABORADOR') && (
              <Select label="Sucursal" required value={formEdit.sucursal_id} onChange={(e) => setFormEdit({ ...formEdit, sucursal_id: e.target.value })}>
                <option value="">Elegí una sucursal</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            )}
            {formEdit.rol === 'COLABORADOR' && (
              <Select label="Puesto" required value={formEdit.puesto} onChange={(e) => setFormEdit({ ...formEdit, puesto: e.target.value })}>
                <option value="">Elegí un puesto</option>
                {PUESTOS.map((p) => <option key={p} value={p}>{PUESTO_LABEL[p]}</option>)}
              </Select>
            )}
            {(formEdit.rol === 'GERENTE' || formEdit.rol === 'COLABORADOR') && (
              <Campo label="Fecha de nacimiento (opcional)" type="date" value={formEdit.fecha_nacimiento} onChange={(e) => setFormEdit({ ...formEdit, fecha_nacimiento: e.target.value })} />
            )}
            <p className="text-xs text-gray-400">Última actividad: {formatearFecha(editando.ultima_actividad_en)}</p>
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Guardar</Boton>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100">
            {!confirmandoReset ? (
              <button type="button" onClick={() => setConfirmandoReset(true)} className="text-sm text-fat-bordo-600 hover:underline">
                Restablecer contraseña
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">¿Mandar un link para elegir una contraseña nueva a <strong>{editando.email}</strong>?</p>
                <div className="flex gap-2">
                  <Boton ancho="w-auto" variante="peligro" onClick={restablecerPassword} cargando={reseteando}>Sí, enviar</Boton>
                  <Boton ancho="w-auto" variante="secundario" onClick={() => setConfirmandoReset(false)}>Cancelar</Boton>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
