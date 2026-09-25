// Helpers compartidos del módulo Mercadería FAT.

export const ESTADOS_PEDIDO = ['PENDIENTE_CONFIRMAR', 'CONFIRMADO', 'LISTO_RETIRAR', 'RETIRADO', 'CANCELADO'];
export const ETIQUETA_ESTADO = {
  PENDIENTE_CONFIRMAR: 'Pendiente de confirmar',
  CONFIRMADO: 'Confirmado',
  LISTO_RETIRAR: 'Listo para retirar',
  RETIRADO: 'Retirado',
  CANCELADO: 'Cancelado',
};
export const ETIQUETA_COBRO = { PENDIENTE_COBRO: 'Pendiente de cobro', ABONADO: 'Abonado', NO_APLICA: 'Sin cobro' };

export const esMarca = (usuario) => usuario?.personal_marca === true;
export const puedeUsarMercaderia = (usuario) => usuario?.rol === 'GERENTE' || esMarca(usuario);

export function pesos(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const numeroPedido = (id) => '#' + String(id).padStart(5, '0');

export function fechaCorta(valor) {
  return new Date(valor).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fechaHora(valor) {
  const d = new Date(valor);
  return `${fechaCorta(d)} – ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export function textoDemora(dias) {
  if (dias == null) return '—';
  return `${dias} día${dias === 1 ? '' : 's'}`;
}
