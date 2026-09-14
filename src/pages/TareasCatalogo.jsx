import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Campo, Boton, Modal, Toast, Cargando, Leyenda, SelectorEmojiCatalogo } from '../components/ui';

const ICONO_TIPO_DEFAULT = '📝';

// Administración del catálogo de tareas rutinarias (tipo -> tareas) - ver
// plan Calendario v2/v3. Solo Admin la ve (Configuracion.jsx la gatea). El
// ícono del tipo es el que se usa para las tareas de ese tipo en el
// calendario (ver TIPO_ICONO en Calendario.jsx) - no se elige por tarea
// puntual ni al programar desde el calendario.
export default function TareasCatalogo() {
  const [tipos, setTipos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [nuevoIcono, setNuevoIcono] = useState(ICONO_TIPO_DEFAULT);
  const [tipoEnEdicion, setTipoEnEdicion] = useState(null);
  const [tareaEnEdicion, setTareaEnEdicion] = useState(null); // { tipoTareaId, tarea | null }
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [actualizandoFeriados, setActualizandoFeriados] = useState(false);

  function recargar() {
    api.get('/api/tipos-tarea').then(setTipos);
  }

  async function actualizarFeriados() {
    setActualizandoFeriados(true);
    setError('');
    try {
      const r = await api.post('/api/feriados/actualizar', { anio: new Date().getFullYear() });
      setToast(`Feriados ${r.anio} actualizados (${r.actualizados})`);
    } catch (err) {
      setError(err.message);
    } finally {
      setActualizandoFeriados(false);
    }
  }
  useEffect(() => {
    recargar();
    api.get('/api/sucursales').then(setSucursales);
  }, []);

  async function crearTipo(e) {
    e.preventDefault();
    if (!nuevoTipo.trim()) return;
    try {
      await api.post('/api/tipos-tarea', { nombre: nuevoTipo.trim(), icono: nuevoIcono });
      setNuevoTipo('');
      setNuevoIcono(ICONO_TIPO_DEFAULT);
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
      <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
      <Leyenda>Los tipos y tareas activos son los que ven Admin/Auditor/Gerente al programar una tarea desde el calendario, filtrados por sucursal.</Leyenda>

      <Tarjeta className="p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Feriados nacionales</p>
          <p className="text-xs text-gray-400">Se actualizan solos al empezar cada año - esto fuerza un refresco manual desde ArgentinaDatos.</p>
        </div>
        <Boton ancho="w-auto" variante="secundario" cargando={actualizandoFeriados} onClick={actualizarFeriados}>Actualizar feriados</Boton>
      </Tarjeta>

      <Tarjeta className="p-4 space-y-3">
        <form onSubmit={crearTipo} className="flex gap-2 items-end">
          <div className="flex-1"><Campo label="Nuevo tipo de tarea" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Ej: Limpieza" /></div>
          <SelectorEmojiCatalogo valor={nuevoIcono} onChange={setNuevoIcono} />
          <Boton ancho="w-auto" type="submit">Agregar</Boton>
        </form>
      </Tarjeta>

      {tipos.map((tipo) => (
        <Tarjeta key={tipo.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">{tipo.icono || ICONO_TIPO_DEFAULT} {tipo.nombre} {!tipo.activo && <span className="text-xs text-gray-400">(inactivo)</span>}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setTareaEnEdicion({ tipoTareaId: tipo.id, tarea: null })} className="text-xs text-fat-bordo-600 hover:underline shrink-0">+ Tarea</button>
              <button onClick={() => setTipoEnEdicion(tipo)} title="Editar tipo de tarea" className="text-gray-400 hover:text-fat-bordo-600 shrink-0">✏️</button>
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

      {tipoEnEdicion && (
        <ModalTipoTarea
          tipo={tipoEnEdicion}
          onClose={() => setTipoEnEdicion(null)}
          onGuardado={() => { setTipoEnEdicion(null); setToast('Guardado'); recargar(); }}
          onEliminar={async () => { await alternarTipoActivo(tipoEnEdicion); setTipoEnEdicion(null); }}
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
  const [descripcion, setDescripcion] = useState(tarea?.descripcion || '');
  const [enlace, setEnlace] = useState(tarea?.enlace || '');
  const [enlaceNombre, setEnlaceNombre] = useState(tarea?.enlace_nombre || '');
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
      descripcion: descripcion.trim() || null, enlace: enlace.trim() || null, enlace_nombre: enlaceNombre.trim() || null,
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
        <Campo label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Instrucciones que se muestran al completar esta tarea" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Enlace (opcional)" type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://..." />
          <Campo label="Nombre del enlace (opcional)" value={enlaceNombre} onChange={(e) => setEnlaceNombre(e.target.value)} placeholder="Ir a página web" />
        </div>
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

function ModalTipoTarea({ tipo, onClose, onGuardado, onEliminar }) {
  const [nombre, setNombre] = useState(tipo.nombre);
  const [icono, setIcono] = useState(tipo.icono || ICONO_TIPO_DEFAULT);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError('');
    setGuardando(true);
    try {
      await api.patch(`/api/tipos-tarea/${tipo.id}`, { nombre: nombre.trim(), icono });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo() {
    setEliminando(true);
    setError('');
    try {
      await onEliminar();
    } catch (err) {
      setError(err.message);
      setEliminando(false);
    }
  }

  return (
    <Modal titulo="Editar tipo de tarea" onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Campo label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></div>
          <SelectorEmojiCatalogo valor={icono} onChange={setIcono} />
        </div>
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Guardar</Boton>
      </form>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button type="button" onClick={alternarActivo} disabled={eliminando} className="text-sm text-fat-bordo-600 hover:underline disabled:opacity-50">
          {tipo.activo ? 'Eliminar tipo de tarea' : 'Reactivar tipo de tarea'}
        </button>
      </div>
    </Modal>
  );
}
