import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Semaforo, Resultado, Cargando } from '../components/ui';

function Tendencia({ valor }) {
  if (valor == null) return null;
  const pct = Math.round(valor * 100);
  if (pct === 0) return <span className="text-gray-400 text-xs">sin cambio</span>;
  const sube = pct > 0;
  return (
    <span className={`text-xs font-medium ${sube ? 'text-green-600' : 'text-fat-bordo-600'}`}>
      {sube ? '▲' : '▼'} {Math.abs(pct)} pts
    </span>
  );
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/dashboard').then(setDatos).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-fat-bordo-600">{error}</p>;
  if (!datos) return <Cargando />;

  const unaSucursal = usuario.rol === 'GERENTE' && datos.ranking.length === 1;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {datos.ranking.some((r) => r.umbrales_fallidos > 0) && (
        <Tarjeta className="p-4 border-fat-bordo-200 bg-fat-bordo-50/40">
          <p className="text-sm font-medium text-fat-bordo-800 mb-2">Sucursales con umbrales críticos sin alcanzar</p>
          <ul className="text-sm text-fat-bordo-700 space-y-1">
            {datos.ranking.filter((r) => r.umbrales_fallidos > 0).map((r) => (
              <li key={r.sucursal_id}>{r.sucursal_nombre} — {r.umbrales_fallidos} umbral(es) por debajo del mínimo</li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-medium text-gray-900">{unaSucursal ? 'Último resultado' : 'Ranking de sucursales'}</p>
        </div>
        <div className="divide-y divide-gray-100">
          {datos.ranking.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay auditorías completadas.</p>}
          {datos.ranking.map((r) => (
            <Link key={r.sucursal_id} to={`/historial?sucursal_id=${r.sucursal_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.sucursal_nombre}</p>
                {r.completada_en && <p className="text-xs text-gray-400">{new Date(r.completada_en).toLocaleDateString('es-AR')}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Tendencia valor={r.tendencia} />
                {r.puntaje_total != null && <span className="text-sm font-semibold text-gray-700">{Math.round(r.puntaje_total * 100)}%</span>}
                <Semaforo valor={r.semaforo} />
                <Resultado valor={r.resultado} />
              </div>
            </Link>
          ))}
        </div>
      </Tarjeta>

      {datos.promedioPorArea?.length > 0 && (
        <Tarjeta className="p-4">
          <p className="font-medium text-gray-900 mb-3">Promedio por área (últimas auditorías)</p>
          <div className="space-y-2">
            {datos.promedioPorArea.sort((a, b) => a.promedio - b.promedio).map((a) => (
              <div key={a.nombre} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-48 shrink-0 truncate">{a.nombre}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-fat-bordo-400" style={{ width: `${Math.round(a.promedio * 100)}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-10 text-right">{Math.round(a.promedio * 100)}%</span>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
