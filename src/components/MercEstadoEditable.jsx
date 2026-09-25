import { useState } from 'react';
import { api } from '../api/client';
import { Modal, Boton } from './ui';
import { EstadoPedido } from './MercUI';
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO, numeroPedido } from '../utils/mercaderia';

// Chip de estado del pedido. Para Personal de Marca (`editable`) es un botón:
// al tocarlo se abre la lista de estados y elegir uno lo aplica al instante,
// sin entrar al detalle. Cancelar pide una confirmación extra (avisa al
// gerente y saca el pedido de la deuda). El backend valida los permisos y las
// reglas (ej. un pedido con pagos no se cancela) - los errores se muestran acá.
export default function EstadoPedidoEditable({ pedido, editable, onCambiado }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState('');

  if (!editable) return <EstadoPedido estado={pedido.estado} />;

  function cerrar() {
    setAbierto(false);
    setConfirmandoCancelar(false);
    setError('');
  }

  async function aplicar(estado) {
    setGuardando(estado);
    setError('');
    try {
      await api.post(`/api/merc/pedidos/${pedido.id}/estado`, { estado });
      cerrar();
      onCambiado(`Pedido ${numeroPedido(pedido.id)}: ${ETIQUETA_ESTADO[estado]}`);
    } catch (err) {
      setError(err.message);
      setConfirmandoCancelar(false);
    } finally {
      setGuardando(null);
    }
  }

  function elegir(estado) {
    if (estado === pedido.estado) return;
    if (estado === 'CANCELADO') { setConfirmandoCancelar(true); return; }
    aplicar(estado);
  }

  return (
    <>
      <button
        type="button" onClick={() => setAbierto(true)} title="Tocá para cambiar el estado" aria-label={`Cambiar estado del pedido ${numeroPedido(pedido.id)}`}
        className="inline-flex items-center gap-1 rounded-full ring-1 ring-transparent hover:ring-gray-300 active:ring-gray-400"
      >
        <EstadoPedido estado={pedido.estado} />
        <span className="text-[10px] text-gray-400 -ml-0.5 mr-1" aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <Modal titulo={`Pedido ${numeroPedido(pedido.id)} · cambiar estado`} onClose={cerrar} ancho="max-w-sm">
          {confirmandoCancelar ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                ¿Cancelar el pedido {numeroPedido(pedido.id)} de <strong>{pedido.sucursal_nombre}</strong>? Deja de contar como deuda y el gerente recibe un aviso.
              </p>
              <div className="flex gap-2">
                <Boton ancho="w-auto" variante="peligro" cargando={guardando === 'CANCELADO'} onClick={() => aplicar('CANCELADO')}>Sí, cancelar pedido</Boton>
                <Boton ancho="w-auto" variante="secundario" onClick={() => setConfirmandoCancelar(false)}>Volver</Boton>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {ESTADOS_PEDIDO.map((e) => {
                const actual = e === pedido.estado;
                return (
                  <button
                    key={e} type="button" disabled={actual || guardando !== null} onClick={() => elegir(e)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm disabled:opacity-60 ${
                      actual ? 'border-fat-bordo-300 bg-fat-bordo-50' : 'border-gray-200 hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    <EstadoPedido estado={e} />
                    <span className="text-xs text-gray-400">{actual ? 'Estado actual' : guardando === e ? 'Guardando…' : ''}</span>
                  </button>
                );
              })}
              {error && <p className="text-sm text-fat-bordo-600 pt-1">{error}</p>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
