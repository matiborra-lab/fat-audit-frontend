import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Boton, Modal, Toast, Cargando, Leyenda } from '../components/ui';

const PUESTO_LABEL = { COCINA: 'Cocina', CAJA: 'Caja', REFUERZO_COCINA: 'Refuerzo cocina' };
const ROL_LABEL = { GERENTE: 'Gerente', COLABORADOR: 'Colaborador' };
// Lun..Dom en la UI -> Date#getDay() (0=domingo..6=sábado), que es lo que espera el backend.
const DIAS_SEMANA_UI = [
  { label: 'Lunes', valor: 1 }, { label: 'Martes', valor: 2 }, { label: 'Miércoles', valor: 3 },
  { label: 'Jueves', valor: 4 }, { label: 'Viernes', valor: 5 }, { label: 'Sábado', valor: 6 }, { label: 'Domingo', valor: 0 },
];
const TURNOS_UI = [{ valor: 'DIURNO', label: 'Diurno' }, { valor: 'NOCTURNO', label: 'Nocturno' }];

function clave(dia, turno) {
  return `${dia}|${turno}`;
}

function nombreCompleto(u) {
  return [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email;
}

function ModalPersonal({ sucursal, onClose }) {
  const [personal, setPersonal] = useState(null);

  useEffect(() => {
    api.get(`/api/admin/usuarios?sucursal_id=${sucursal.id}`).then(setPersonal).catch(() => setPersonal([]));
  }, [sucursal.id]);

  const porPuesto = useMemo(() => {
    const mapa = { COCINA: [], CAJA: [], REFUERZO_COCINA: [], SIN_PUESTO: [] };
    for (const u of personal || []) {
      if (u.rol === 'GERENTE') continue;
      (mapa[u.puesto] || mapa.SIN_PUESTO).push(u);
    }
    return mapa;
  }, [personal]);
  const gerentes = (personal || []).filter((u) => u.rol === 'GERENTE');

  return (
    <Modal titulo={`Personal · ${sucursal.nombre}`} onClose={onClose}>
      {!personal && <Cargando />}
      {personal && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Gerentes</h3>
            {gerentes.length === 0 && <p className="text-sm text-gray-400">Sin gerente asignado.</p>}
            <div className="space-y-1">
              {gerentes.map((u) => (
                <p key={u.id} className="text-sm text-gray-800">{nombreCompleto(u)} <span className="text-xs text-gray-400">({ROL_LABEL[u.rol]})</span></p>
              ))}
            </div>
          </div>
          {['COCINA', 'CAJA', 'REFUERZO_COCINA'].map((p) => (
            <div key={p}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{PUESTO_LABEL[p]} ({porPuesto[p].length})</h3>
              {porPuesto[p].length === 0 && <p className="text-sm text-gray-400">Nadie asignado todavía.</p>}
              <div className="space-y-1">
                {porPuesto[p].map((u) => (
                  <p key={u.id} className="text-sm text-gray-800">{nombreCompleto(u)}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ModalHorario({ sucursal, onClose, onGuardado }) {
  const [dias, setDias] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get(`/api/sucursales/${sucursal.id}/horario-turnos`).then((rows) => {
      const mapa = new Map(rows.map((r) => [clave(r.dia_semana, r.turno_tipo), r]));
      const completo = {};
      for (const d of DIAS_SEMANA_UI) {
        for (const t of TURNOS_UI) {
          const k = clave(d.valor, t.valor);
          const existente = mapa.get(k);
          completo[k] = existente
            ? { habilitado: existente.habilitado, hora_desde: existente.hora_desde.slice(0, 5), hora_hasta: existente.hora_hasta.slice(0, 5) }
            : { habilitado: false, hora_desde: t.valor === 'DIURNO' ? '08:00' : '16:00', hora_hasta: t.valor === 'DIURNO' ? '16:00' : '00:00' };
        }
      }
      setDias(completo);
    });
  }, [sucursal.id]);

  function actualizar(diaValor, turnoValor, campo, valor) {
    setDias((d) => ({ ...d, [clave(diaValor, turnoValor)]: { ...d[clave(diaValor, turnoValor)], [campo]: valor } }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const payload = DIAS_SEMANA_UI.flatMap((d) => TURNOS_UI.map((t) => ({
        dia_semana: d.valor, turno_tipo: t.valor, ...dias[clave(d.valor, t.valor)],
      })));
      await api.put(`/api/sucursales/${sucursal.id}/horario-turnos`, { dias: payload });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Horario de turnos · ${sucursal.nombre}`} onClose={onClose} ancho="max-w-2xl">
      {!dias && <Cargando />}
      {dias && (
        <form onSubmit={guardar} className="space-y-3">
          <p className="text-xs text-gray-400">Marcá qué turnos tiene esta sucursal cada día y a qué hora. Un día sin marcar no se puede asignar en Gestionar turnos.</p>
          <div className="space-y-2">
            {DIAS_SEMANA_UI.map((d) => (
              <div key={d.valor} className="border border-gray-100 rounded-lg p-2.5">
                <p className="text-sm font-medium text-gray-800 mb-1.5">{d.label}</p>
                <div className="grid grid-cols-2 gap-3">
                  {TURNOS_UI.map((t) => {
                    const v = dias[clave(d.valor, t.valor)];
                    return (
                      <div key={t.valor} className={`rounded-lg border p-2 ${v.habilitado ? 'border-fat-bordo-200 bg-fat-bordo-50/40' : 'border-gray-100'}`}>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                          <input type="checkbox" checked={v.habilitado} onChange={(e) => actualizar(d.valor, t.valor, 'habilitado', e.target.checked)} />
                          {t.label}
                        </label>
                        <div className="flex items-center gap-1">
                          <input type="time" disabled={!v.habilitado} value={v.hora_desde} onChange={(e) => actualizar(d.valor, t.valor, 'hora_desde', e.target.value)} className="w-full rounded border border-gray-300 px-1 py-1 text-xs disabled:opacity-40" />
                          <span className="text-gray-400 text-xs">a</span>
                          <input type="time" disabled={!v.habilitado} value={v.hora_hasta} onChange={(e) => actualizar(d.valor, t.valor, 'hora_hasta', e.target.value)} className="w-full rounded border border-gray-300 px-1 py-1 text-xs disabled:opacity-40" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <Boton type="submit" cargando={guardando}>Guardar horario</Boton>
        </form>
      )}
    </Modal>
  );
}

export default function Sucursales() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === 'ADMIN';
  const [lista, setLista] = useState(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [sucursalEditar, setSucursalEditar] = useState(null);
  const [sucursalHorario, setSucursalHorario] = useState(null);
  const [sucursalPersonal, setSucursalPersonal] = useState(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ nombre: '', codigo: '', direccion: '' });
  const [formEditar, setFormEditar] = useState(null);
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
      setModalCrear(false);
      setForm({ nombre: '', codigo: '', direccion: '' });
      setToast('Sucursal creada');
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function abrirEditar(s) {
    setSucursalEditar(s);
    setFormEditar({
      nombre: s.nombre, codigo: s.codigo || '', direccion: s.direccion || '', activo: s.activo,
      latitud: s.latitud ?? '', longitud: s.longitud ?? '',
    });
  }

  async function guardarEditar(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await api.patch(`/api/sucursales/${sucursalEditar.id}`, {
        ...formEditar,
        latitud: formEditar.latitud === '' ? null : Number(formEditar.latitud),
        longitud: formEditar.longitud === '' ? null : Number(formEditar.longitud),
      });
      setSucursalEditar(null);
      setToast('Sucursal actualizada');
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
        {esAdmin && <Boton ancho="w-auto" onClick={() => setModalCrear(true)}>+ Nueva sucursal</Boton>}
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {lista.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay sucursales cargadas.</p>}
          {lista.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.nombre} {!s.activo && <span className="text-xs text-gray-400">(inactiva)</span>}</p>
                <p className="text-xs text-gray-400">{[s.codigo, s.direccion].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <button onClick={() => setSucursalPersonal(s)} className="text-gray-500 hover:text-fat-bordo-600 hover:underline">Personal</button>
                <button onClick={() => setSucursalHorario(s)} className="text-gray-500 hover:text-fat-bordo-600 hover:underline">Horario de turnos</button>
                {esAdmin && <button onClick={() => abrirEditar(s)} className="text-fat-bordo-600 hover:underline">Editar</button>}
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>

      {modalCrear && (
        <Modal titulo="Nueva sucursal" onClose={() => setModalCrear(false)}>
          <form onSubmit={crear} className="space-y-4">
            <Campo label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
            <Campo label="Código (opcional)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo label="Dirección (opcional)" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Crear</Boton>
          </form>
        </Modal>
      )}

      {sucursalEditar && formEditar && (
        <Modal titulo={`Editar · ${sucursalEditar.nombre}`} onClose={() => setSucursalEditar(null)}>
          <form onSubmit={guardarEditar} className="space-y-4">
            <Campo label="Nombre" required value={formEditar.nombre} onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })} autoFocus />
            <Campo label="Código (opcional)" value={formEditar.codigo} onChange={(e) => setFormEditar({ ...formEditar, codigo: e.target.value })} />
            <Campo label="Dirección (opcional)" value={formEditar.direccion} onChange={(e) => setFormEditar({ ...formEditar, direccion: e.target.value })} />
            <div>
              <Leyenda>Para mostrar el clima en el calendario de esta sucursal. En Google Maps, clic derecho sobre la ubicación y copiar las coordenadas.</Leyenda>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Campo label="Latitud (opcional)" type="number" step="any" value={formEditar.latitud} onChange={(e) => setFormEditar({ ...formEditar, latitud: e.target.value })} />
                <Campo label="Longitud (opcional)" type="number" step="any" value={formEditar.longitud} onChange={(e) => setFormEditar({ ...formEditar, longitud: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={formEditar.activo} onChange={(e) => setFormEditar({ ...formEditar, activo: e.target.checked })} />
              Sucursal activa
            </label>
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <Boton type="submit" cargando={guardando}>Guardar cambios</Boton>
          </form>
        </Modal>
      )}

      {sucursalHorario && (
        <ModalHorario
          sucursal={sucursalHorario}
          onClose={() => setSucursalHorario(null)}
          onGuardado={() => { setSucursalHorario(null); setToast('Horario de turnos actualizado'); }}
        />
      )}

      {sucursalPersonal && <ModalPersonal sucursal={sucursalPersonal} onClose={() => setSucursalPersonal(null)} />}

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
