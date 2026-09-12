import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Campo, Boton, Modal, Toast, Cargando, Leyenda } from '../components/ui';

// Administración del catálogo de tareas rutinarias (tipo -> tareas) - ver
// plan Calendario v2. Solo Admin la ve (Configuracion.jsx la gatea).
export default function TareasCatalogo() {
  const [tipos, setTipos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [tareaEnEdicion, setTareaEnEdicion] = useState(null); // { tipoTareaId, tarea | null }
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  function recargar() {
    api.get('/api/tipos-tarea').then(setTipos);
  }
  useEffect(() => {
    recargar();
    api.get('/api/sucursales').then(setSucursales);
  }, []);

  async function crearTipo(e) {
    e.preventDefault();
    if (!nuevoTipo.trim()) return;
    try {
      await api.post('/api/tipos-tarea', { nombre: nuevoTipo.trim() });
      setNuevoTipo('');
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function alternarTipoActivo(tipo) {
    await api.patch(`/api/tipos-tarea/${tipo.id}`, { activo: !tipo.activo });
    recargar();
  }

  async function alternarTareaActiva(tarea) {
    await api.patch(`/api/tareas-catalogo/${tarea.id}`, { activo: !tarea.activo });
    recargar();
  }

  if (!tipos) return <Cargando />;

  return (
    <div className="space-y-4">
      <Leyenda>Los tipos y tareas activos son los que ven Admin/Auditor/Gerente al programar una tarea desde el calendario, filtrados por sucursal.</Leyenda>

      <Tarjeta className="p-4">
        <form onSubmit={crearTipo} className="flex gap-2 items-end">
          <div className="flex-1"><Campo label="Nuevo tipo de tarea" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Ej: Limpieza" /></div>
          <Boton ancho="w-auto" type="submit">Agregar</Boton>
        </form>
      </Tarjeta>

      {tipos.map((tipo) => (
        <Tarjeta key={tipo.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">{tipo.nombre} {!tipo.activo && <span className="text-xs text-gray-400">(inactivo)</span>}</h3>
            <div className="flex items-center gap-3 text-xs">
              <button onClick={() => setTareaEnEdicion({ tipoTareaId: tipo.id, tarea: null })} className="text-fat-bordo-600 hover:underline">+ Tarea</button>
              <button onClick={() => alternarTipoActivo(tipo)} className="text-gray-500 hover:underline">{tipo.activo ? 'Desactivar' : 'Activar'}</button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {tipo.tareas.length === 0 && <p className="text-sm text-gray-400 py-2">Sin tareas todavía.</p>}
            {tipo.tareas.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{t.nombre} {!t.activo && <span className="text-xs text-gray-400">(inactiva)</span>}</p>
                  <p className="text-xs text-gray-400">
                    {t.aplica_todas_sucursales ? 'Todas las sucursales' : `${t.sucursal_ids.length} sucursal(es)`}
                    {t.foto_requerida && ' · Requiere foto'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <button onClick={() => setTareaEnEdicion({ tipoTareaId: tipo.id, tarea: t })} className="text-fat-bordo-600 hover:underline">Editar</button>
                  <button onClick={() => alternarTareaActiva(t)} className="text-gray-500 hover:underline">{t.activo ? 'Desactivar' : 'Activar'}</button>
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      ))}

      {tareaEnEdicion && (
        <ModalTarea
          tipoTareaId={tareaEnEdicion.tipoTareaId}
          tarea={tareaEnEdicion.tarea}
          sucursales={sucursales}
          onClose={() => setTareaEnEdicion(null)}
          onGuardado={() => { setTareaEnEdicion(null); setToast('Guardado'); recargar(); }}
        />
      )}

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function ModalTarea({ tipoTareaId, tarea, sucursales, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(tarea?.nombre || '');
  const [fotoRequerida, setFotoRequerida] = useState(tarea?.foto_requerida || false);
  const [aplicaTodas, setAplicaTodas] = useState(tarea ? tarea.aplica_todas_sucursales : true);
  const [sucursalIds, setSucursalIds] = useState(new Set(tarea?.sucursal_ids || []));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError('');
    setGuardando(true);
    const body = {
      nombre: nombre.trim(), foto_requerida: fotoRequerida,
      aplica_todas_sucursales: aplicaTodas, sucursal_ids: [...sucursalIds],
    };
    try {
      if (tarea) await api.patch(`/api/tareas-catalogo/${tarea.id}`, body);
      else await api.post('/api/tareas-catalogo', { ...body, tipo_tarea_id: tipoTareaId });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={tarea ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={fotoRequerida} onChange={(e) => setFotoRequerida(e.target.checked)} />
          Requiere foto de evidencia (solo cámara) para completarla
        </label>
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <input type="checkbox" checked={aplicaTodas} onChange={(e) => setAplicaTodas(e.target.checked)} />
            Todas las sucursales
          </label>
          {!aplicaTodas && (
            <div className="grid grid-cols-2 gap-2">
              {sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={sucursalIds.has(s.id)}
                    onChange={(e) => {
                      const nuevo = new Set(sucursalIds);
                      if (e.target.checked) nuevo.add(s.id); else nuevo.delete(s.id);
                      setSucursalIds(nuevo);
                    }}
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Guardar</Boton>
      </form>
    </Modal>
  );
}
