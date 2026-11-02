// Helpers compartidos del módulo Mercadería FAT.

export const ESTADOS_PEDIDO = ['PENDIENTE_CONFIRMAR', 'CONFIRMADO', 'LISTO_RETIRAR', 'RETIRADO', 'CANCELADO'];
export const ETIQUETA_ESTADO = {
  PENDIENTE_CONFIRMAR: 'Pendiente de confirmar',
  CONFIRMADO: 'Confirmado',
  LISTO_RETIRAR: 'Listo para retirar',
  RETIRADO: 'Retirado',
  CANCELADO: 'Cancelado',
};
export const ETIQUETA_COBRO = { PENDIENTE_COBRO: 'Pendiente de cobro', ABONADO: 'Abonado', NO_APLICA: 'Sin deuda' };

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

// El saldo pendiente solo existe desde el retiro: antes se muestra un guion.
export function textoSaldo(pedido) {
  return pedido.estado === 'RETIRADO' ? pesos(pedido.saldo) : '—';
}

export function textoDemora(dias) {
  if (dias == null) return '—';
  return `${dias} día${dias === 1 ? '' : 's'}`;
}

// ---- Enviar saldo por WhatsApp (Reportes > Saldos pendientes de una sucursal) ----

// Número para wa.me: solo dígitos, con 54 + 9 de Argentina. El teléfono
// administrativo se carga con código de área y sin 0 ni 15 (ej. 2236123456).
export function telefonoParaWhatsapp(telefono) {
  let d = String(telefono || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  if (d.startsWith('54')) return d.startsWith('549') ? d : '549' + d.slice(2);
  return '549' + d;
}

const plata = (n) => pesos(n).replace('$', '$ ');

// Mensaje de cuenta corriente: los pedidos con saldo (ya retirados), del más
// antiguo al más nuevo, y el total adeudado. Los *…* son negrita en WhatsApp.
export function armarMensajeSaldo({ sucursalNombre, pedidos }) {
  const total = pedidos.reduce((acc, p) => acc + Number(p.saldo || 0), 0);
  const bloques = pedidos.map((p) => {
    const lineas = [`*Pedido ${numeroPedido(p.id)}*`, `Fecha: ${fechaCorta(p.creado_en)}`];
    if (Number(p.abonado) > 0) {
      lineas.push(`Monto: ${plata(p.total)}`, `Pagado: ${plata(p.abonado)} · Saldo: ${plata(p.saldo)}`);
    } else {
      lineas.push(`Monto: ${plata(p.saldo)}`);
    }
    return lineas.join('\n');
  });
  return [
    `*Cuenta corriente - Fatburger ${sucursalNombre}*`,
    `Mercadería FAT · Saldo pendiente al ${fechaCorta(new Date())}`,
    '',
    bloques.join('\n\n'),
    '',
    '━━━━━━━━━━━━━━',
    `*TOTAL ADEUDADO: ${plata(total)}*`,
    '',
    'Cualquier duda, respondé a este mensaje.',
  ].join('\n');
}
