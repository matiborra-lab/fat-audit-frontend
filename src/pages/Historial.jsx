import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Select, Semaforo, Resultado, Cargando } from '../components/ui';

const TIPOS = ['MARCA', 'INTERNA', 'SEGUIMIENTO'];
const ESTADOS = ['EN_PROGRESO', 'COMPLETADA', 'CANCELADA'];

export default function Historial() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [sucursales, setSucursales] = useState([]);

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Historial</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <Select value={params.get('estado') || ''} onChange={(e) => actualizarFiltro('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>

      {!lista ? <Cargando /> : (
        <Tarjeta className="overflow-hidden">
          <div className="divide-y divide-gray-100">
            {lista.length === 0 && <p className="p-4 text-sm text-gray-400">No hay auditorías con estos filtros.</p>}
            {lista.map((r) => (
              <Link key={r.id} to={`/historial/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.sucursal_nombre} · {r.plantilla_nombre}</p>
                  <p className="text-xs text-gray-400">
                    {r.tipo} · {r.auditor_nombre} · {new Date(r.creado_en).toLocaleDateString('es-AR')}
                    {r.origen_run_id && ' · seguimiento'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.puntaje_total != null && <span className="text-sm font-semibold text-gray-700">{Math.round(r.puntaje_total * 100)}%</span>}
                  <Semaforo valor={r.semaforo} />
                  <Resultado valor={r.resultado} />
                  {r.estado === 'EN_PROGRESO' && <span className="text-xs text-gray-400">en progreso</span>}
                </div>
              </Link>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
