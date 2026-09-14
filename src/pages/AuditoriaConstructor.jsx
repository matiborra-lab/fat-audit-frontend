import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Campo, Select, Boton, Toast, Leyenda, Cargando } from '../components/ui';

const TIPOS_RESPUESTA = ['ESCALA_5', 'ESCALA_10', 'SI_NO', 'CHECKBOX', 'OPCION_MULTIPLE', 'NUMERO', 'TEXTO', 'FECHA'];
// Unicos tipos que aportan puntaje - TEXTO/FECHA/NUMERO son solo
// informativos y nunca tienen peso (ver src/scoring en el backend).
const TIPOS_PUNTUABLES = ['SI_NO', 'CHECKBOX', 'ESCALA_5', 'ESCALA_10', 'OPCION_MULTIPLE'];
const EVIDENCIA_OPCIONES = ['NINGUNA', 'FOTO', 'VIDEO', 'FOTO_O_VIDEO'];
const OPERADORES = ['=', '!=', '<', '<=', '>', '>=', 'entre', 'contiene'];

// Convierte la respuesta de GET /api/plantillas/:id (items con sector_id/
// area_id numericos) al formato "por nombre" que espera PUT .../estructura
// - asi el estado de edicion se puede mandar directo al guardar, sin volver
// a resolver ids.
function aEstructuraEditable(data) {
  const nombrePorSectorId = new Map(data.sectores.map((s) => [s.id, s.nombre]));
  const nombrePorAreaId = new Map(data.areas.map((a) => [a.id, a.nombre]));
  return {
    sectores: data.sectores.map((s) => ({ nombre: s.nombre })),
    areas: data.areas.map((a) => ({ nombre: a.nombre, peso: a.peso })),
    items: data.items.map((it) => ({
      sector: nombrePorSectorId.get(it.sector_id), area: nombrePorAreaId.get(it.area_id),
      texto: it.texto, ayuda_texto: it.ayuda_texto, tipo_respuesta: it.tipo_respuesta,
      opciones_json: it.opciones_json, peso: it.peso, critico: it.critico, informe_in_situ: it.informe_in_situ,
      evidencia_requerida: it.evidencia_requerida, permite_no_aplica: it.permite_no_aplica,
      reglas: (it.reglas || []).map((r) => ({ condicion: r.condicion_json, acciones: r.acciones_json })),
    })),
    umbrales: data.umbrales.map((u) => ({
      tipo: u.tipo, sector: u.tipo === 'SECTOR' ? nombrePorSectorId.get(u.sector_id) : undefined,
      area: u.tipo === 'AREA' ? nombrePorAreaId.get(u.area_id) : undefined,
      porcentaje_minimo: u.porcentaje_minimo,
    })),
  };
}

// Misma regla en los dos niveles donde se usa (areas de la plantilla, items
// puntuables dentro de cada area - ver validarPesos en server/
// plantillas.js, que la vuelve a chequear del lado del servidor): o NINGUNA
// entidad tiene peso (reparto igual) o TODAS lo tienen y suman 100%.
function estadoPesos(entidades) {
  if (entidades.length === 0) return { modo: 'vacio', suma: 0, ok: true };
  const conPeso = entidades.filter((e) => e.peso != null);
  if (conPeso.length === 0) return { modo: 'igualitario', suma: 0, ok: true };
  const suma = entidades.reduce((acc, e) => acc + Number(e.peso || 0), 0);
  const completo = conPeso.length === entidades.length;
  const ok = completo && Math.abs(suma - 1) < 0.0005;
  return { modo: 'manual', suma, ok, faltanAlgunos: !completo };
}

function Totalizador({ estado }) {
  if (estado.modo === 'igualitario' || estado.modo === 'vacio') {
    return <span className="text-xs text-gray-400">reparto igualitario</span>;
  }
  const pct = (estado.suma * 100).toFixed(1);
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estado.ok ? 'bg-green-100 text-green-700' : 'bg-fat-bordo-100 text-fat-bordo-700'}`}>
      {estado.faltanAlgunos ? 'faltan pesos' : `${pct}/100%`}
    </span>
  );
}

// Junta todos los errores de peso de la estructura completa (areas de la
// plantilla + items puntuables de cada area) - si la lista no esta vacia,
// no se puede guardar ni publicar.
function erroresDePeso(estructura) {
  const errores = [];
  const estadoAreas = estadoPesos(estructura.areas);
  if (!estadoAreas.ok) errores.push(`Las áreas: ${estadoAreas.faltanAlgunos ? 'faltan pesos en algunas' : `suman ${(estadoAreas.suma * 100).toFixed(1)}%, deben sumar 100%`}`);
  for (const area of estructura.areas) {
    const itemsDelArea = estructura.items.filter((it) => it.area === area.nombre && TIPOS_PUNTUABLES.includes(it.tipo_respuesta));
    const estado = estadoPesos(itemsDelArea);
    if (!estado.ok) errores.push(`Ítems de "${area.nombre}": ${estado.faltanAlgunos ? 'faltan pesos en algunos' : `suman ${(estado.suma * 100).toFixed(1)}%, deben sumar 100%`}`);
  }
  return errores;
}

// Reordena una lista moviendo el elemento i un lugar hacia arriba (dir=-1)
// o abajo (dir=1). El orden final que se guarda es el orden del array (el
// backend usa el índice como "orden" si no se manda uno explícito), así que
// reordenar acá alcanza sin tocar ningún campo aparte.
function mover(lista, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

function BotonesOrden({ i, total, onMover }) {
  return (
    <div className="flex flex-col shrink-0">
      <button type="button" disabled={i === 0} className="text-gray-400 hover:text-fat-bordo-600 disabled:opacity-25 leading-none text-xs px-1" onClick={() => onMover(-1)}>▲</button>
      <button type="button" disabled={i === total - 1} className="text-gray-400 hover:text-fat-bordo-600 disabled:opacity-25 leading-none text-xs px-1" onClick={() => onMover(1)}>▼</button>
    </div>
  );
}

function nuevoItem(sector, area) {
  return {
    sector, area, texto: '', ayuda_texto: '', tipo_respuesta: 'ESCALA_5', opciones_json: null, peso: null,
    critico: false, informe_in_situ: false, evidencia_requerida: 'NINGUNA', permite_no_aplica: true, reglas: [],
  };
}

export default function AuditoriaConstructor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plantilla, setPlantilla] = useState(null);
  const [estructura, setEstructura] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [aplicaTodas, setAplicaTodas] = useState(true);
  const [sucursalesHabilitadas, setSucursalesHabilitadas] = useState(new Set());
  const [aprobadoDesde, setAprobadoDesde] = useState('');
  const [nombreEditado, setNombreEditado] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function recargar() {
    api.get(`/api/plantillas/${id}`).then((data) => {
      setPlantilla(data);
      setEstructura(aEstructuraEditable(data));
      setAplicaTodas(data.aplica_todas_sucursales);
      setSucursalesHabilitadas(new Set(data.sucursal_ids));
      setAprobadoDesde(data.puntaje_minimo_aprobacion != null ? String(Math.round(data.puntaje_minimo_aprobacion * 1000) / 10) : '');
      setNombreEditado(data.nombre);
    });
    api.get('/api/sucursales').then(setSucursales);
  }
  useEffect(recargar, [id]);

  if (!plantilla || !estructura) return <Cargando />;
  const editable = plantilla.estado === 'BORRADOR';
  const erroresPeso = erroresDePeso(estructura);

  function actualizar(campo, valor) {
    setEstructura((e) => ({ ...e, [campo]: valor }));
  }

  async function guardarEstructura() {
    if (erroresPeso.length > 0) return;
    setError('');
    setGuardando(true);
    try {
      await api.put(`/api/plantillas/${id}/estructura`, estructura);
      setToast('Estructura guardada');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarSucursales() {
    setError('');
    try {
      await api.patch(`/api/plantillas/${id}/sucursales`, {
        aplica_todas_sucursales: aplicaTodas,
        sucursal_ids: [...sucursalesHabilitadas],
      });
      setToast('Sucursales actualizadas');
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarNombre() {
    if (!nombreEditado.trim()) { setError('El nombre no puede estar vacío'); return; }
    setError('');
    try {
      const actualizada = await api.patch(`/api/plantillas/${id}`, { nombre: nombreEditado.trim() });
      setPlantilla(actualizada);
      setToast('Nombre actualizado');
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminarPlantilla() {
    setError('');
    try {
      await api.del(`/api/plantillas/${id}`);
      navigate('/auditorias');
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarAprobacion() {
    setError('');
    try {
      const actualizada = await api.patch(`/api/plantillas/${id}`, {
        puntaje_minimo_aprobacion: aprobadoDesde === '' ? null : Number(aprobadoDesde) / 100,
      });
      setPlantilla(actualizada);
      setToast('Umbral general actualizado');
    } catch (err) {
      setError(err.message);
    }
  }

  async function publicar() {
    if (erroresPeso.length > 0) return;
    setError('');
    try {
      await guardarEstructura();
      const actualizada = await api.post(`/api/plantillas/${id}/publicar`);
      setPlantilla(actualizada);
      setToast('Plantilla publicada');
    } catch (err) {
      setError(err.message);
    }
  }

  async function crearNuevaVersion() {
    const nueva = await api.post(`/api/plantillas/${id}/nueva-version`);
    navigate(`/auditorias/${nueva.id}`);
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editable ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="text-xl font-semibold text-gray-900 rounded-lg border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
                value={nombreEditado}
                onChange={(e) => setNombreEditado(e.target.value)}
              />
              <span className="text-gray-400 font-normal">v{plantilla.version}</span>
              {nombreEditado.trim() && nombreEditado !== plantilla.nombre && (
                <Boton ancho="w-auto" variante="secundario" onClick={guardarNombre}>Guardar nombre</Boton>
              )}
            </div>
          ) : (
            <h1 className="text-xl font-semibold text-gray-900">{plantilla.nombre} <span className="text-gray-400 font-normal">v{plantilla.version}</span></h1>
          )}
          <p className="text-sm text-gray-500">{plantilla.tipo} · {plantilla.estado}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editable && <Boton ancho="w-auto" variante="secundario" onClick={crearNuevaVersion}>Crear nueva versión para editar</Boton>}
          <button onClick={eliminarPlantilla} className="text-xs text-gray-400 hover:text-fat-bordo-600">Eliminar plantilla</button>
        </div>
      </div>

      {!editable && plantilla.estado !== 'ARCHIVADA' && <Leyenda>Esta plantilla está {plantilla.estado.toLowerCase()} y su estructura no se puede editar. Creá una nueva versión para modificar ítems/sectores/áreas sin afectar las auditorías ya hechas — las sucursales habilitadas sí se pueden ajustar acá abajo.</Leyenda>}
      {!editable && plantilla.estado === 'ARCHIVADA' && <Leyenda>Esta plantilla está archivada y no se puede editar.</Leyenda>}

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {plantilla.estado !== 'ARCHIVADA' && (
        <Tarjeta className="p-4">
          <p className="font-medium text-gray-900 mb-3">Sucursales habilitadas</p>
          <Leyenda>Se puede ajustar en cualquier momento, incluso con la plantilla publicada — no hace falta una nueva versión para sumar o sacar un punto de venta.</Leyenda>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-3 mb-2">
            <input type="checkbox" checked={aplicaTodas} onChange={(e) => setAplicaTodas(e.target.checked)} />
            Todas las sucursales
          </label>
          {!aplicaTodas && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={sucursalesHabilitadas.has(s.id)}
                    onChange={(e) => {
                      const nuevo = new Set(sucursalesHabilitadas);
                      if (e.target.checked) nuevo.add(s.id); else nuevo.delete(s.id);
                      setSucursalesHabilitadas(nuevo);
                    }}
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          )}
          <Boton ancho="w-auto" variante="secundario" className="mt-3" onClick={guardarSucursales}>Guardar sucursales</Boton>
        </Tarjeta>
      )}

      {editable && (
        <>
          <SeccionSectores estructura={estructura} actualizar={actualizar} />
          <SeccionAreas estructura={estructura} actualizar={actualizar} />
          <SeccionItems estructura={estructura} actualizar={actualizar} />
          <SeccionUmbrales estructura={estructura} actualizar={actualizar} />

          <Tarjeta className="p-4">
            <p className="font-medium text-gray-900 mb-1">Umbral general de aprobación</p>
            <Leyenda>Si el puntaje total no llega a este %, la auditoría queda desaprobada — es un chequeo aparte de los umbrales por sector/área de arriba. Dejalo vacío para que solo decidan esos umbrales.</Leyenda>
            <div className="flex items-center gap-2 mt-3">
              <input
                className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                type="number" min="0" max="100" step="0.1"
                value={aprobadoDesde}
                onChange={(e) => setAprobadoDesde(e.target.value)}
                placeholder="sin mínimo"
              />
              <span className="text-sm text-gray-500">% aprobada desde</span>
              <Boton ancho="w-auto" variante="secundario" onClick={guardarAprobacion}>Guardar</Boton>
            </div>
          </Tarjeta>

          {erroresPeso.length > 0 && (
            <Tarjeta className="p-4 bg-fat-bordo-50/40 border-fat-bordo-200">
              <p className="text-sm font-medium text-fat-bordo-800 mb-1">No se puede guardar todavía — los pesos no cierran en 100%:</p>
              <ul className="text-sm text-fat-bordo-700 list-disc list-inside">
                {erroresPeso.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </Tarjeta>
          )}

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-center gap-3 z-40">
            <div className="w-full max-w-[1400px] flex justify-end gap-3">
              <Boton ancho="w-auto" variante="secundario" cargando={guardando} disabled={erroresPeso.length > 0} onClick={guardarEstructura}>Guardar borrador</Boton>
              <Boton ancho="w-auto" disabled={erroresPeso.length > 0} onClick={publicar}>Publicar</Boton>
            </div>
          </div>
        </>
      )}

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function SeccionSectores({ estructura, actualizar }) {
  function set(i, campo, valor) {
    const copia = [...estructura.sectores];
    copia[i] = { ...copia[i], [campo]: valor };
    actualizar('sectores', copia);
  }
  return (
    <Tarjeta className="p-4">
      <p className="font-medium text-gray-900 mb-1">Sectores</p>
      <Leyenda>Agrupador de recorrido físico (Cocina, Depósito, etc.) — define el orden en que el auditor completa la auditoría paso a paso en el celular. No pondera el puntaje (eso lo hace el área).</Leyenda>
      <div className="space-y-2 mt-3">
        {estructura.sectores.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <BotonesOrden i={i} total={estructura.sectores.length} onMover={(dir) => actualizar('sectores', mover(estructura.sectores, i, dir))} />
            <input className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={s.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} placeholder="Nombre del sector" />
            <button className="text-gray-400 hover:text-fat-bordo-600 text-sm" onClick={() => actualizar('sectores', estructura.sectores.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
      </div>
      <button className="text-sm text-fat-bordo-600 hover:underline mt-2" onClick={() => actualizar('sectores', [...estructura.sectores, { nombre: '' }])}>+ Agregar sector</button>
    </Tarjeta>
  );
}

function SeccionAreas({ estructura, actualizar }) {
  function set(i, campo, valor) {
    const copia = [...estructura.areas];
    copia[i] = { ...copia[i], [campo]: valor };
    actualizar('areas', copia);
  }
  const estado = estadoPesos(estructura.areas);
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium text-gray-900">Áreas</p>
        <Totalizador estado={estado} />
      </div>
      <Leyenda>Dimensión transversal (Bromatología, Marca, etc.) — única unidad de peso de la plantilla. Sin pesos: reparto igualitario. Con pesos: tienen que sumar 100% entre todas (hasta 1 decimal).</Leyenda>
      <div className="space-y-2 mt-3">
        {estructura.areas.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <BotonesOrden i={i} total={estructura.areas.length} onMover={(dir) => actualizar('areas', mover(estructura.areas, i, dir))} />
            <input className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={a.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} placeholder="Nombre del área" />
            <input className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" type="number" step="0.1" min="0" max="100" value={a.peso != null ? Math.round(a.peso * 1000) / 10 : ''} onChange={(e) => set(i, 'peso', e.target.value === '' ? null : Number(e.target.value) / 100)} placeholder="peso %" />
            <button className="text-gray-400 hover:text-fat-bordo-600 text-sm" onClick={() => actualizar('areas', estructura.areas.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
      </div>
      <button className="text-sm text-fat-bordo-600 hover:underline mt-2" onClick={() => actualizar('areas', [...estructura.areas, { nombre: '', peso: null }])}>+ Agregar área</button>
    </Tarjeta>
  );
}

function SeccionItems({ estructura, actualizar }) {
  function set(i, campo, valor) {
    const copia = [...estructura.items];
    copia[i] = { ...copia[i], [campo]: valor };
    actualizar('items', copia);
  }
  const sectorPorDefecto = estructura.sectores[0]?.nombre || '';
  const areaPorDefecto = estructura.areas[0]?.nombre || '';

  return (
    <Tarjeta className="p-4">
      <p className="font-medium text-gray-900 mb-1">Ítems ({estructura.items.length})</p>
      <Leyenda>Cada ítem pertenece a un sector y a un área. El peso (dentro del área) define cuánto vale ese ítem en el puntaje — solo aplica a tipos que puntúan (no TEXTO/FECHA/NÚMERO).</Leyenda>

      {estructura.areas.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 mb-1">
          {estructura.areas.map((area) => {
            const itemsDelArea = estructura.items.filter((it) => it.area === area.nombre && TIPOS_PUNTUABLES.includes(it.tipo_respuesta));
            const estado = estadoPesos(itemsDelArea);
            return (
              <div key={area.nombre} className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-100 rounded-full pl-2.5 pr-1 py-1">
                <span className="text-gray-500">{area.nombre}</span>
                <Totalizador estado={estado} />
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3 mt-3">
        {estructura.items.map((it, i) => {
          const puntuable = TIPOS_PUNTUABLES.includes(it.tipo_respuesta);
          return (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <BotonesOrden i={i} total={estructura.items.length} onMover={(dir) => actualizar('items', mover(estructura.items, i, dir))} />
                <input className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={it.texto} onChange={(e) => set(i, 'texto', e.target.value)} placeholder="Texto del ítem" />
                <button className="text-gray-400 hover:text-fat-bordo-600 text-sm shrink-0" onClick={() => actualizar('items', estructura.items.filter((_, j) => j !== i))}>Quitar</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={it.sector} onChange={(e) => set(i, 'sector', e.target.value)}>
                  {estructura.sectores.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
                </Select>
                <Select value={it.area} onChange={(e) => set(i, 'area', e.target.value)}>
                  {estructura.areas.map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
                </Select>
                <Select value={it.tipo_respuesta} onChange={(e) => set(i, 'tipo_respuesta', e.target.value)}>
                  {TIPOS_RESPUESTA.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                {puntuable ? (
                  <input className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" type="number" min="0" max="100" step="0.1" value={it.peso != null ? Math.round(it.peso * 1000) / 10 : ''} onChange={(e) => set(i, 'peso', e.target.value === '' ? null : Number(e.target.value) / 100)} placeholder="peso % en el área" />
                ) : (
                  <span className="text-xs text-gray-400 self-center">no puntúa — sin peso</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                <label className="flex items-center gap-1"><input type="checkbox" checked={it.critico} onChange={(e) => set(i, 'critico', e.target.checked)} /> Crítico</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={it.informe_in_situ} onChange={(e) => set(i, 'informe_in_situ', e.target.checked)} /> Informe in situ</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={it.permite_no_aplica} onChange={(e) => set(i, 'permite_no_aplica', e.target.checked)} /> Permite "no aplica"</label>
                <label className="flex items-center gap-1">
                  Evidencia:
                  <select className="rounded border border-gray-300 text-xs" value={it.evidencia_requerida} onChange={(e) => set(i, 'evidencia_requerida', e.target.value)}>
                    {EVIDENCIA_OPCIONES.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </label>
              </div>
              {it.tipo_respuesta === 'OPCION_MULTIPLE' && <OpcionesEditor item={it} index={i} set={set} />}
              <ReglasEditor item={it} index={i} set={set} />
            </div>
          );
        })}
      </div>
      <button className="text-sm text-fat-bordo-600 hover:underline mt-3" onClick={() => actualizar('items', [...estructura.items, nuevoItem(sectorPorDefecto, areaPorDefecto)])}>+ Agregar ítem</button>
    </Tarjeta>
  );
}

// Valores por opcion de un item OPCION_MULTIPLE (ej: Excelente=100%,
// Bueno=66%, Regular=33%, Malo=0%). A diferencia del peso de area/item, no
// tienen que sumar 100 entre si - cada uno es el puntaje independiente que
// se lleva esa respuesta puntual.
function OpcionesEditor({ item, index, set }) {
  const opciones = item.opciones_json || [];

  function setOpciones(nuevas) {
    set(index, 'opciones_json', nuevas);
  }
  function setOpcion(oi, campo, valor) {
    const copia = [...opciones];
    copia[oi] = { ...copia[oi], [campo]: valor };
    setOpciones(copia);
  }

  return (
    <div className="border-t border-gray-100 pt-2 space-y-2">
      <p className="text-xs font-medium text-gray-500">Opciones y su valor</p>
      {opciones.map((op, oi) => (
        <div key={oi} className="flex items-center gap-2">
          <input className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs" placeholder="Etiqueta (ej: Excelente)" value={op.etiqueta || ''} onChange={(e) => setOpcion(oi, 'etiqueta', e.target.value)} />
          <input className="w-20 rounded border border-gray-300 px-2 py-1 text-xs" type="number" min="0" max="100" step="0.1" value={op.valor != null ? Math.round(op.valor * 1000) / 10 : ''} onChange={(e) => setOpcion(oi, 'valor', e.target.value === '' ? null : Number(e.target.value) / 100)} placeholder="%" />
          <button className="text-gray-400 hover:text-fat-bordo-600 text-xs" onClick={() => setOpciones(opciones.filter((_, j) => j !== oi))}>Quitar</button>
        </div>
      ))}
      <button className="text-xs text-fat-bordo-600 hover:underline" onClick={() => setOpciones([...opciones, { etiqueta: '', valor: null }])}>+ Agregar opción</button>
    </div>
  );
}

// Reglas condicionales de un ítem: "si la respuesta [operador] [valor],
// exigir comentario/foto/video". Se evalúan en tiempo real durante la
// ejecución (ver Ejecucion.jsx) y de nuevo, de forma definitiva, al
// finalizar (ver runs.js en el backend).
function ReglasEditor({ item, index, set }) {
  const reglas = item.reglas || [];

  function setReglas(nuevas) {
    set(index, 'reglas', nuevas);
  }
  function setCondicion(ri, campo, valor) {
    const copia = [...reglas];
    copia[ri] = { ...copia[ri], condicion: { ...copia[ri].condicion, [campo]: valor } };
    setReglas(copia);
  }
  function setAccion(ri, campo, valor) {
    const copia = [...reglas];
    copia[ri] = { ...copia[ri], acciones: { ...copia[ri].acciones, [campo]: valor } };
    setReglas(copia);
  }

  return (
    <div className="border-t border-gray-100 pt-2 space-y-2">
      <p className="text-xs font-medium text-gray-500">Reglas condicionales</p>
      {reglas.map((r, ri) => (
        <div key={ri} className="bg-gray-50 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-gray-500">Si la respuesta</span>
            <select className="rounded border border-gray-300 text-xs py-0.5" value={r.condicion?.operador || '='} onChange={(e) => setCondicion(ri, 'operador', e.target.value)}>
              {OPERADORES.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            {r.condicion?.operador === 'entre' ? (
              <>
                <input className="w-14 rounded border border-gray-300 px-1 py-0.5 text-xs" placeholder="min" value={r.condicion?.valor?.[0] ?? ''} onChange={(e) => setCondicion(ri, 'valor', [e.target.value, r.condicion?.valor?.[1] ?? ''])} />
                <span className="text-gray-400">y</span>
                <input className="w-14 rounded border border-gray-300 px-1 py-0.5 text-xs" placeholder="max" value={r.condicion?.valor?.[1] ?? ''} onChange={(e) => setCondicion(ri, 'valor', [r.condicion?.valor?.[0] ?? '', e.target.value])} />
              </>
            ) : (
              <input className="w-20 rounded border border-gray-300 px-1 py-0.5 text-xs" placeholder="valor" value={r.condicion?.valor ?? ''} onChange={(e) => setCondicion(ri, 'valor', e.target.value)} />
            )}
            <button className="text-gray-400 hover:text-fat-bordo-600 ml-auto" onClick={() => setReglas(reglas.filter((_, j) => j !== ri))}>Quitar</button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.acciones?.comentario_obligatorio} onChange={(e) => setAccion(ri, 'comentario_obligatorio', e.target.checked)} /> Exigir comentario</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.acciones?.foto_obligatoria} onChange={(e) => setAccion(ri, 'foto_obligatoria', e.target.checked)} /> Exigir foto</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.acciones?.video_obligatoria} onChange={(e) => setAccion(ri, 'video_obligatoria', e.target.checked)} /> Exigir video</label>
          </div>
        </div>
      ))}
      <button className="text-xs text-fat-bordo-600 hover:underline" onClick={() => setReglas([...reglas, { condicion: { operador: '=', valor: '' }, acciones: {} }])}>+ Agregar regla</button>
    </div>
  );
}

function SeccionUmbrales({ estructura, actualizar }) {
  function set(i, campo, valor) {
    const copia = [...estructura.umbrales];
    copia[i] = { ...copia[i], [campo]: valor };
    actualizar('umbrales', copia);
  }
  return (
    <Tarjeta className="p-4">
      <p className="font-medium text-gray-900 mb-1">Umbrales críticos</p>
      <Leyenda>Si un sector o área no alcanza este % mínimo, la auditoría queda DESAPROBADA sin importar el puntaje total.</Leyenda>
      <div className="space-y-2 mt-3">
        {estructura.umbrales.map((u, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select value={u.tipo} onChange={(e) => set(i, 'tipo', e.target.value)}>
              <option value="SECTOR">Sector</option>
              <option value="AREA">Área</option>
            </Select>
            <Select value={u.tipo === 'SECTOR' ? u.sector || '' : u.area || ''} onChange={(e) => set(i, u.tipo === 'SECTOR' ? 'sector' : 'area', e.target.value)}>
              <option value="">Elegí {u.tipo === 'SECTOR' ? 'un sector' : 'un área'}</option>
              {(u.tipo === 'SECTOR' ? estructura.sectores : estructura.areas).map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}
            </Select>
            <input className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" type="number" min="0" max="100" value={Math.round((u.porcentaje_minimo || 0) * 100)} onChange={(e) => set(i, 'porcentaje_minimo', Number(e.target.value) / 100)} placeholder="min %" />
            <button className="text-gray-400 hover:text-fat-bordo-600 text-sm" onClick={() => actualizar('umbrales', estructura.umbrales.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
      </div>
      <button className="text-sm text-fat-bordo-600 hover:underline mt-2" onClick={() => actualizar('umbrales', [...estructura.umbrales, { tipo: 'SECTOR', porcentaje_minimo: 0.8 }])}>+ Agregar umbral</button>
    </Tarjeta>
  );
}
