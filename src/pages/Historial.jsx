import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Select, Puntaje, Resultado, Cargando } from '../components/ui';

const TIPOS = ['MARCA', 'INTERNA', 'SEGUIMIENTO'];

// Solo se puede eliminar una auditoría abandonada (nunca una ya completada,
// para no perder historial real) - mismo criterio que DELETE /api/runs/:id.
function puedeEliminar(usuario, r) {
  if (r.estado === 'COMPLETADA') return false;
  if (usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR') return true;
  if (usuario.rol === 'GERENTE') return r.tipo === 'INTERNA';
  return false;
}

export default function Historial() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (usuario.rol !== 'GERENTE') api.get('/api/sucursales').then(setSucursales);
  }, [usuario.rol]);

  useEffect(() => {
    const query = new URLSearchParams(params).toString();
    api.get('/api/historial' + (query ? '?' + query : '')).then(setLista);
  }, [params]);

  function actualizarFiltro(clave, valor) {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor); else nuevos.delete(clave);
    setParams(nuevos);
  }

  async function eliminar(id) {
    setError('');
    setEliminandoId(id);
    try {
      await api.del(`/api/runs/${id}`);
      setLista((l) => l.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Historial</h1>

      <div className="grid grid-cols-2 gap-3">
        {usuario.rol !== 'GERENTE' && (
          <Select value={params.get('sucursal_id') || ''} onChange={(e) => actualizarFiltro('sucursal_id', e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        )}
        <Select value={params.get('tipo') || ''} onChange={(e) => actualizarFiltro('tipo', e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {!lista ? <Cargando /> : (
        <Tarjeta className="overflow-hidden">
          <div className="divide-y divide-gray-100">
            {lista.length === 0 && <p className="p-4 text-sm text-gray-400">No hay auditorías con estos filtros.</p>}
            {lista.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 gap-3">
                <Link to={`/historial/${r.id}`} className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.sucursal_nombre} · {r.plantilla_nombre}</p>
                  <p className="text-xs text-gray-400">
                    {r.tipo} · {r.auditor_nombre} · {new Date(r.creado_en).toLocaleDateString('es-AR')}
                    {r.origen_run_id && ' · seguimiento'}
                  </p>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <Puntaje valor={r.puntaje_total} semaforo={r.semaforo} />
                  <Resultado valor={r.resultado} />
                  {r.estado === 'EN_PROGRESO' && <span className="text-xs text-gray-400">en progreso</span>}
                  {puedeEliminar(usuario, r) && (
                    <button
                      onClick={() => eliminar(r.id)}
                      disabled={eliminandoId === r.id}
                      className="text-xs text-gray-400 hover:text-fat-bordo-600 disabled:opacity-50"
                    >
                      {eliminandoId === r.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
