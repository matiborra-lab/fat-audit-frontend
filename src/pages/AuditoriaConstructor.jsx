import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Tarjeta, Campo, Select, Boton, Toast, Leyenda, Cargando } from '../components/ui';

const TIPOS_RESPUESTA = ['ESCALA_5', 'ESCALA_10', 'SI_NO', 'CHECKBOX', 'OPCION_MULTIPLE', 'NUMERO', 'TEXTO', 'FECHA'];
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
    sectores: data.sectores.map((s) => ({ nombre: s.nombre, peso: s.peso })),
    areas: data.areas.map((a) => ({ nombre: a.nombre, peso: a.peso })),
    items: data.items.map((it) => ({
      sector: nombrePorSectorId.get(it.sector_id), area: nombrePorAreaId.get(it.area_id),
      texto: it.texto, ayuda_texto: it.ayuda_texto, tipo_respuesta: it.tipo_respuesta,
      peso: it.peso, critico: it.critico, informe_in_situ: it.informe_in_situ,
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

function nuevoItem(sector, area) {
  return {
    sector, area, texto: '', ayuda_texto: '', tipo_respuesta: 'ESCALA_5', peso: null,
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
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function recargar() {
    api.get(`/api/plantillas/${id}`).then((data) => {
      setPlantilla(data);
      setEstructura(aEstructuraEditable(data));
      setAplicaTodas(data.aplica_todas_sucursales);
      setSucursalesHabilitadas(new Set(data.sucursal_ids));
    });
    api.get('/api/sucursales').then(setSucursales);
  }
  useEffect(recargar, [id]);

  if (!plantilla || !estructura) return <Cargando />;
  const editable = plantilla.estado === 'BORRADOR';

  function actualizar(campo, valor) {
    setEstructura((e) => ({ ...e, [campo]: valor }));
  }

  async function guardarEstructura() {
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
    await api.patch(`/api/plantillas/${id}/sucursales`, {
      aplica_todas_sucursales: aplicaTodas,
      sucursal_ids: [...sucursalesHabilitadas],
    });
    setToast('Sucursales actualizadas');
  }

  async function publicar() {
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
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{plantilla.nombre} <span className="text-gray-400 font-normal">v{plantilla.version}</span></h1>
          <p className="text-sm text-gray-500">{plantilla.tipo} · {plantilla.estado}</p>
        </div>
        {!editable && <Boton ancho="w-auto" variante="secundario" onClick={crearNuevaVersion}>Crear nueva versión para editar</Boton>}
      </div>

      {!editable && <Leyenda>Esta plantilla está {plantilla.estado.toLowerCase()} y no se puede editar. Creá una nueva versión para modificarla sin afectar las auditorías ya hechas.</Leyenda>}

      {editable && (
        <>
          <SeccionSectores estructura={estructura} actualizar={actualizar} />
          <SeccionAreas estructura={estructura} actualizar={actualizar} />
          <SeccionItems estructura={estructura} actualizar={actualizar} />
          <SeccionUmbrales estructura={estructura} actualizar={actualizar} />

          <Tarjeta className="p-4">
            <p className="font-medium text-gray-900 mb-3">Sucursales habilitadas</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
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

          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-center gap-3 z-40">
            <div className="w-full max-w-[1400px] flex justify-end gap-3">
              <Boton ancho="w-auto" variante="secundario" cargando={guardando} onClick={guardarEstructura}>Guardar borrador</Boton>
              <Boton ancho="w-auto" onClick={publicar}>Publicar</Boton>
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
      <Leyenda>El agrupador de recorrido físico (Cocina, Depósito, etc.). El peso es el % que representa dentro del puntaje total — dejalo vacío para reparto igualitario.</Leyenda>
      <div className="space-y-2 mt-3">
        {estructura.sectores.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={s.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} placeholder="Nombre del sector" />
            <input className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" type="number" step="1" min="0" max="100" value={s.peso != null ? Math.round(s.peso * 100) : ''} onChange={(e) => set(i, 'peso', e.target.value === '' ? null : Number(e.target.value) / 100)} placeholder="peso %" />
            <button className="text-gray-400 hover:text-fat-bordo-600 text-sm" onClick={() => actualizar('sectores', estructura.sectores.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
      </div>
      <button className="text-sm text-fat-bordo-600 hover:underline mt-2" onClick={() => actualizar('sectores', [...estructura.sectores, { nombre: '', peso: null }])}>+ Agregar sector</button>
    </Tarjeta>
  );
}

function SeccionAreas({ estructura, actualizar }) {
  function set(i, campo, valor) {
    const copia = [...estructura.areas];
    copia[i] = { ...copia[i], [campo]: valor };
    actualizar('areas', copia);
  }
  return (
    <Tarjeta className="p-4">
      <p className="font-medium text-gray-900 mb-1">Áreas</p>
      <Leyenda>La dimensión transversal (Bromatología, Marca, etc.) que se audita dentro de varios sectores. El peso también es opcional.</Leyenda>
      <div className="space-y-2 mt-3">
        {estructura.areas.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={a.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} placeholder="Nombre del área" />
            <input className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" type="number" step="1" min="0" max="100" value={a.peso != null ? Math.round(a.peso * 100) : ''} onChange={(e) => set(i, 'peso', e.target.value === '' ? null : Number(e.target.value) / 100)} placeholder="peso %" />
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
      <Leyenda>Cada ítem pertenece a un sector y a un área a la vez. El peso (1, 2, 3…) define su intensidad dentro del área — vacío = reparto igualitario.</Leyenda>
      <div className="space-y-3 mt-3">
        {estructura.items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
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
              <input className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" type="number" min="0" step="0.5" value={it.peso ?? ''} onChange={(e) => set(i, 'peso', e.target.value === '' ? null : Number(e.target.value))} placeholder="peso (ej: 1, 2, 3)" />
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
          </div>
        ))}
      </div>
      <button className="text-sm text-fat-bordo-600 hover:underline mt-3" onClick={() => actualizar('items', [...estructura.items, nuevoItem(sectorPorDefecto, areaPorDefecto)])}>+ Agregar ítem</button>
    </Tarjeta>
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
