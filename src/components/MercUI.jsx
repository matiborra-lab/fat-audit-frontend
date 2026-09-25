import { ETIQUETA_ESTADO, ETIQUETA_COBRO } from '../utils/mercaderia';

const COLOR_ESTADO = {
  PENDIENTE_CONFIRMAR: 'bg-yellow-100 text-yellow-700',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  LISTO_RETIRAR: 'bg-purple-100 text-purple-700',
  RETIRADO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-gray-200 text-gray-600',
};
const COLOR_COBRO = { PENDIENTE_COBRO: 'bg-fat-bordo-100 text-fat-bordo-700', ABONADO: 'bg-green-100 text-green-700', NO_APLICA: 'bg-gray-100 text-gray-500' };

export function EstadoPedido({ estado }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${COLOR_ESTADO[estado] || 'bg-gray-100 text-gray-600'}`}>{ETIQUETA_ESTADO[estado] || estado}</span>;
}

export function EstadoCobro({ estado }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${COLOR_COBRO[estado] || 'bg-gray-100 text-gray-600'}`}>{ETIQUETA_COBRO[estado] || estado}</span>;
}

// Miniatura de producto (o un ícono si no tiene foto).
export function FotoProducto({ url, tamano = 'w-16 h-16', className = '' }) {
  return url
    ? <img src={url} alt="" loading="lazy" className={`${tamano} rounded-lg object-cover bg-gray-100 shrink-0 ${className}`} />
    : <div className={`${tamano} rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0 ${className}`}>📦</div>;
}

// Marca de un pedido al que la marca le cambió el contenido antes del retiro.
export function Editado() {
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-amber-100 text-amber-700">Editado</span>;
}

// Selector de cantidad: - [n] +
export function Cantidad({ valor, onChange, min = 1 }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white">
      <button type="button" onClick={() => onChange(Math.max(min, valor - 1))} className="w-9 h-9 text-lg text-gray-600 active:bg-gray-100" aria-label="Menos">−</button>
      <input
        type="number" inputMode="numeric" min={min} value={valor}
        onChange={(e) => onChange(Math.max(min, Math.min(9999, Math.floor(Number(e.target.value)) || min)))}
        className="w-12 h-9 text-center text-sm text-gray-900 border-x border-gray-200 focus:outline-none"
      />
      <button type="button" onClick={() => onChange(Math.min(9999, valor + 1))} className="w-9 h-9 text-lg text-gray-600 active:bg-gray-100" aria-label="Más">+</button>
    </div>
  );
}
