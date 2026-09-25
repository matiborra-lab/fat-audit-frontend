import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Boton, Select, Toast, Cargando } from '../components/ui';
import { EstadoPedido, EstadoCobro, FotoProducto } from '../components/MercUI';
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO, esMarca, pesos, numeroPedido, fechaHora, textoDemora } from '../utils/mercaderia';

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{etiqueta}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

// Mercadería FAT > detalle completo de un pedido. Un Gerente solo puede
// abrir los de su sucursal (el backend responde 404 con cualquier otro);
// cambiar el estado operativo es solo de Personal de Marca. El cobro NO se
// toca desde acá: se registra en Gestión de pagos.
export default function MercPedidoDetalle() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const marca = esMarca(usuario);
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(location.state?.creado ? 'Pedido enviado. Quedó pendiente de confirmar.' : '');

  function cargar() {
    return api.get(`/api/merc/pedidos/${id}`).then((p) => { setPedido(p); setNuevoEstado(p.estado); }).catch((e) => setError(e.message));
  }
  useEffect(() => { cargar(); }, [id]);

  async function cambiarEstado() {
    setGuardando(true);
    setError('');
    try {
      await api.post(`/api/merc/pedidos/${id}/estado`, { estado: nuevoEstado });
      await cargar();
      setToast('Estado actualizado');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (error && !pedido) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-fat-bordo-600">{error}</p>
        <Boton ancho="w-auto" variante="secundario" onClick={() => navigate('/mercaderia/historial')}>Volver al historial</Boton>
      </div>
    );
  }
  if (!pedido) return <Cargando />;

  const totalAbonado = pedido.abonado;

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-fat-bordo-600">← Volver</button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Pedido {numeroPedido(pedido.id)}</h1>
        <EstadoPedido estado={pedido.estado} />
        <EstadoCobro estado={pedido.estado_cobro} />
      </div>

      <Tarjeta className="p-4 grid grid-cols-2 gap-3">
        <Dato etiqueta="Nº de pedido">{numeroPedido(pedido.id)}</Dato>
        <Dato etiqueta="Sucursal">{pedido.sucursal_nombre}</Dato>
        <Dato etiqueta="Responsable">{pedido.responsable_nombre}</Dato>
        <Dato etiqueta="Fecha y hora">{fechaHora(pedido.creado_en)}</Dato>
        <Dato etiqueta="Estado operativo"><EstadoPedido estado={pedido.estado} /></Dato>
        <Dato etiqueta="Estado financiero"><EstadoCobro estado={pedido.estado_cobro} /></Dato>
        {pedido.retirado_en && (
          <Dato etiqueta="Retirado / demora">{fechaHora(pedido.retirado_en)}{pedido.saldo > 0 ? ` · ${textoDemora(pedido.dias_demora)} de demora` : ''}</Dato>
        )}
      </Tarjeta>

      {marca && (
        <Tarjeta className="p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Estado del pedido</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
              </Select>
            </div>
            <Boton ancho="w-auto" cargando={guardando} disabled={nuevoEstado === pedido.estado} onClick={cambiarEstado}>Actualizar estado</Boton>
          </div>
          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <p className="text-xs text-gray-400">
            Cada cambio queda registrado con fecha, hora y responsable. Los cobros se registran desde{' '}
            <Link to="/mercaderia/pagos" className="text-fat-bordo-600 hover:underline">Gestión de pagos</Link>.
          </p>
        </Tarjeta>
      )}

      <Tarjeta className="overflow-hidden">
        <p className="px-4 pt-3 text-sm font-medium text-gray-900">Productos</p>
        <div className="divide-y divide-gray-100">
          {pedido.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-3">
              <FotoProducto url={it.imagen_url} tamano="w-12 h-12" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{it.nombre}</p>
                <p className="text-xs text-gray-400">{it.cantidad} × {pesos(it.precio_unitario)}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900 shrink-0">{pesos(it.subtotal)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total del pedido</span><span className="font-semibold text-gray-900">{pesos(pedido.total)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total abonado</span><span className="text-gray-900">{pesos(totalAbonado)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Saldo pendiente</span><span className={`font-semibold ${pedido.saldo > 0 ? 'text-fat-bordo-600' : 'text-green-700'}`}>{pesos(pedido.saldo)}</span></div>
        </div>
      </Tarjeta>

      <Tarjeta className="p-4">
        <p className="text-sm font-medium text-gray-900 mb-3">Historial operativo</p>
        <ol className="space-y-3">
          {pedido.movimientos.map((m) => (
            <li key={m.id} className="border-l-2 border-fat-bordo-200 pl-3">
              <p className="text-sm font-medium text-gray-900">{m.estado_anterior ? ETIQUETA_ESTADO[m.estado_nuevo] : 'Pedido recibido'}</p>
              <p className="text-xs text-gray-500">{fechaHora(m.creado_en)}</p>
              <p className="text-xs text-gray-400">{m.estado_anterior ? 'Responsable' : 'Realizado por'}: {m.usuario_nombre}</p>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta className="p-4">
        <p className="text-sm font-medium text-gray-900 mb-1">Historial financiero</p>
        <p className="text-xs text-gray-500 mb-3">
          Total original {pesos(pedido.total)} · Abonado {pesos(totalAbonado)} · Saldo pendiente {pesos(pedido.saldo)}
        </p>
        {pedido.pagos.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no se registraron pagos.</p>
        ) : (
          <ol className="space-y-3">
            {pedido.pagos.map((pg) => (
              <li key={pg.id} className="border-l-2 border-green-300 pl-3">
                <p className="text-sm font-medium text-gray-900">Pago recibido</p>
                <p className="text-xs text-gray-500">{fechaHora(pg.creado_en)}</p>
                <p className="text-sm text-gray-900">Monto: {pesos(pg.importe)}{pg.monto_pago !== pg.importe && <span className="text-xs text-gray-400"> (de un pago total de {pesos(pg.monto_pago)})</span>}</p>
                <p className="text-xs text-gray-400">Registrado por: {pg.usuario_nombre}</p>
                {pg.observaciones && <p className="text-xs text-gray-500">Observación: {pg.observaciones}</p>}
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>

      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
