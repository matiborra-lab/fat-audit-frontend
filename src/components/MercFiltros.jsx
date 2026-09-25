import { Select } from './ui';
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO, ETIQUETA_COBRO } from '../utils/mercaderia';

export const FILTROS_VACIOS = { sucursal_id: '', estado: '', cobro: '', usuario_id: '', desde: '', hasta: '' };

// Arma el query string de GET /api/merc/pedidos con solo los filtros usados.
export function queryDeFiltros(filtros, extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v) p.set(k, v);
  const q = p.toString();
  return q ? '?' + q : '';
}

// Filtros del historial y de Gestión de pagos. Personal de Marca ve además
// sucursal y responsable; un Gerente solo su sucursal, así que no se los
// ofrece (el backend igual lo fuerza).
export default function MercFiltros({ filtros, onChange, marca, sucursales = [], responsables = [] }) {
  const set = (campo) => (e) => onChange({ ...filtros, [campo]: e.target.value });
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
      {marca && (
        <Select value={filtros.sucursal_id} onChange={set('sucursal_id')} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Select>
      )}
      <Select value={filtros.estado} onChange={set('estado')} aria-label="Estado del pedido">
        <option value="">Todos los estados</option>
        {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
      </Select>
      <Select value={filtros.cobro} onChange={set('cobro')} aria-label="Estado de cobro">
        <option value="">Todo el cobro</option>
        {Object.entries(ETIQUETA_COBRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      {marca && (
        <Select value={filtros.usuario_id} onChange={set('usuario_id')} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </Select>
      )}
      <label className="text-[11px] text-gray-400">Desde
        <input type="date" value={filtros.desde} onChange={set('desde')} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 bg-white" />
      </label>
      <label className="text-[11px] text-gray-400">Hasta
        <input type="date" value={filtros.hasta} onChange={set('hasta')} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 bg-white" />
      </label>
    </div>
  );
}
