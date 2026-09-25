import { ETIQUETA_ESTADO, ETIQUETA_COBRO } from '../utils/mercaderia';

const COLOR_ESTADO = {
  PENDIENTE_CONFIRMAR: 'bg-yellow-100 text-yellow-700',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  LISTO_RETIRAR: 'bg-purple-100 text-purple-700',
  RETIRADO: 'bg-green-100 text-green-700',
};
const COLOR_COBRO = { PENDIENTE_COBRO: 'bg-fat-bordo-100 text-fat-bordo-700', ABONADO: 'bg-green-100 text-green-700' };

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
