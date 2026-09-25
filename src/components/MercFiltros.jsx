import { Select } from './ui';
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO } from '../utils/mercaderia';

export const FILTROS_VACIOS = { sucursal_id: '', estado: '', cobro: '', usuario_id: '', desde: '', hasta: '' };

// Arma el query string de GET /api/merc/pedidos con solo los filtros usados.
export function queryDeFiltros(filtros, extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v) p.set(k, v);
  const q = p.toString();
  return q ? '?' + q : '';
}

const OPCIONES_COBRO = { PENDIENTE_COBRO: 'Pendiente de cobro', ABONADO: 'Abonado' };

// Campo de fecha con la etiqueta adentro, para que mida y alinee igual que
// los desplegables de al lado (con la etiqueta arriba quedaba desalineado).
function CampoFecha({ etiqueta, valor, onChange }) {
  return (
    <label className="col-span-2 md:col-span-1 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-fat-bordo-400">
      <span className="text-gray-400 shrink-0">{etiqueta}</span>
      <input type="date" value={valor} onChange={onChange} className="min-w-0 flex-1 bg-transparent text-gray-900 focus:outline-none" />
    </label>
  );
}

// Filtros del historial y de Gestión de pagos. Personal de Marca ve además
// sucursal y responsable; un Gerente solo su sucursal, así que no se los
// ofrece (el backend igual lo fuerza).
export default function MercFiltros({ filtros, onChange, marca, sucursales = [], responsables = [] }) {
  const set = (campo) => (e) => onChange({ ...filtros, [campo]: e.target.value });
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 items-center [&_select]:text-sm [&_select]:px-2 md:[&_select]:text-base md:[&_select]:px-3">
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
        {Object.entries(OPCIONES_COBRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      {marca && (
        <Select value={filtros.usuario_id} onChange={set('usuario_id')} aria-label="Responsable">
          <option value="">Responsables</option>
          {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </Select>
      )}
      <CampoFecha etiqueta="Desde" valor={filtros.desde} onChange={set('desde')} />
      <CampoFecha etiqueta="Hasta" valor={filtros.hasta} onChange={set('hasta')} />
    </div>
  );
}
