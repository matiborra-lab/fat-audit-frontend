import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Select, Puntaje, Resultado, Cargando, SEMAFORO_HEX, semaforoDePuntaje } from '../components/ui';

const TIPO_LABEL = { MARCA: 'De marca', INTERNA: 'Interna', SEGUIMIENTO: 'Seguimiento' };

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

function TooltipAuditoria({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-900">{d.sucursal_nombre}</p>
      <p className="text-gray-500">{TIPO_LABEL[d.tipo] || d.tipo} · {new Date(d.completada_en).toLocaleDateString('es-AR')}</p>
      <p className="text-gray-700 font-semibold mt-0.5">{d.pct}% · {d.resultado}</p>
    </div>
  );
}

function TooltipArea({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-900">{d.nombre}</p>
      <p className="text-gray-700 font-semibold">{d.pct}% promedio</p>
    </div>
  );
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const puedeComparar = usuario.rol === 'ADMIN' || usuario.rol === 'AUDITOR';
  const [sucursales, setSucursales] = useState([]);
  const [sucursalFiltro, setSucursalFiltro] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (puedeComparar) api.get('/api/sucursales').then(setSucursales);
  }, [puedeComparar]);

  useEffect(() => {
    setDatos(null);
    const query = sucursalFiltro ? `?sucursal_id=${sucursalFiltro}` : '';
    api.get(`/api/dashboard${query}`).then(setDatos).catch((e) => setError(e.message));
  }, [sucursalFiltro]);

  if (error) return <p className="text-fat-bordo-600">{error}</p>;
  if (!datos) return <Cargando />;

  const unaSucursal = (usuario.rol === 'GERENTE' || sucursalFiltro) && datos.ranking.length === 1;

  const datosAuditorias = [...datos.ultimasAuditorias].reverse().map((a) => ({
    ...a, pct: Math.round(a.puntaje_total * 100),
    fechaCorta: new Date(a.completada_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
  }));
  const datosAreas = [...datos.promedioPorArea]
    .map((a) => ({ ...a, pct: Math.round(a.promedio * 100) }))
    .sort((a, b) => a.pct - b.pct);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        {puedeComparar && sucursales.length > 0 && (
          <div className="w-56">
            <Select value={sucursalFiltro} onChange={(e) => setSucursalFiltro(e.target.value)}>
              <option value="">Comparar todas las sucursales</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          </div>
        )}
      </div>

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
          {datos.ranking.map((r, i) => (
            <Link key={r.sucursal_id} to={`/historial?sucursal_id=${r.sucursal_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {!unaSucursal && (
                  <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.sucursal_nombre}</p>
                  {r.completada_en ? (
                    <p className="text-xs text-gray-400">{TIPO_LABEL[r.tipo] || r.tipo} · {new Date(r.completada_en).toLocaleDateString('es-AR')}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Sin auditorías completadas</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Tendencia valor={r.tendencia} />
                <Puntaje valor={r.puntaje_total} semaforo={r.semaforo} />
                <Resultado valor={r.resultado} />
              </div>
            </Link>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="p-4">
        <p className="font-medium text-gray-900 mb-1">Resultado de las últimas auditorías</p>
        <p className="text-xs text-gray-400 mb-3">Últimas {datosAuditorias.length || ''} auditorías completadas en este alcance, de más antigua a más reciente.</p>
        {datosAuditorias.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Todavía no hay auditorías completadas para graficar.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosAuditorias} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="fechaCorta" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip content={<TooltipAuditoria />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {datosAuditorias.map((d, i) => <Cell key={i} fill={SEMAFORO_HEX[d.semaforo] || '#9CA3AF'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="p-4">
        <p className="font-medium text-gray-900 mb-1">Desempeño por área</p>
        <p className="text-xs text-gray-400 mb-3">Promedio de las últimas auditorías completadas en este alcance.</p>
        {datosAreas.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Todavía no hay datos suficientes para graficar.</p>
        ) : (
          <div style={{ height: Math.max(120, datosAreas.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosAreas} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="nombre" width={140} tick={{ fontSize: 12, fill: '#374151' }} />
                <Tooltip content={<TooltipArea />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {datosAreas.map((d, i) => <Cell key={i} fill={SEMAFORO_HEX[semaforoDePuntaje(d.pct)]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
