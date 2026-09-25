import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Boton, Select, Modal, Toast, Cargando } from '../components/ui';
import { EstadoPedido, EstadoCobro, FotoProducto, Editado, Cantidad } from '../components/MercUI';
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
  const [editando, setEditando] = useState(false);
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
  const puedeEditar = marca && pedido.estado !== 'RETIRADO' && pedido.estado !== 'CANCELADO';
  // Historial operativo: movimientos de estado y ediciones, en orden cronológico.
  const eventos = [
    ...pedido.movimientos.map((m) => ({ clave: 'm' + m.id, cuando: m.creado_en, tipo: 'estado', m })),
    ...pedido.ediciones.map((e) => ({ clave: 'e' + e.id, cuando: e.creado_en, tipo: 'edicion', e })),
  ].sort((a, b) => new Date(a.cuando) - new Date(b.cuando));

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-fat-bordo-600">← Volver</button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Pedido {numeroPedido(pedido.id)}</h1>
        <EstadoPedido estado={pedido.estado} />
        <EstadoCobro estado={pedido.estado_cobro} />
        {pedido.editado && <Editado />}
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
          {nuevoEstado === 'CANCELADO' && pedido.estado !== 'CANCELADO' && (
            <p className="text-xs text-gray-500">Al cancelarlo, el pedido deja de contar como deuda y el gerente recibe un aviso.</p>
          )}
          {puedeEditar && (
            <div className="pt-1">
              <Boton ancho="w-auto" variante="secundario" onClick={() => setEditando(true)}>Editar pedido</Boton>
              <span className="text-xs text-gray-400 ml-2">Se puede editar hasta que sea retirado.</span>
            </div>
          )}
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
          {eventos.map((ev) => (ev.tipo === 'estado' ? (
            <li key={ev.clave} className="border-l-2 border-fat-bordo-200 pl-3">
              <p className="text-sm font-medium text-gray-900">{ev.m.estado_anterior ? ETIQUETA_ESTADO[ev.m.estado_nuevo] : 'Pedido recibido'}</p>
              <p className="text-xs text-gray-500">{fechaHora(ev.m.creado_en)}</p>
              <p className="text-xs text-gray-400">{ev.m.estado_anterior ? 'Responsable' : 'Realizado por'}: {ev.m.usuario_nombre}</p>
            </li>
          ) : (
            <li key={ev.clave} className="border-l-2 border-amber-300 pl-3">
              <p className="text-sm font-medium text-gray-900">Pedido editado</p>
              <p className="text-xs text-gray-500">{fechaHora(ev.e.creado_en)}</p>
              <ul className="text-xs text-gray-600 list-disc list-inside mt-0.5">
                {ev.e.cambios.map((c, i) => <li key={i}>{c.texto}</li>)}
              </ul>
              <p className="text-xs text-gray-600">Total: {pesos(ev.e.total_anterior)} → <strong>{pesos(ev.e.total_nuevo)}</strong></p>
              <p className="text-xs text-gray-400">Responsable: {ev.e.usuario_nombre}</p>
            </li>
          )))}
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

      {editando && (
        <EditorPedido
          pedido={pedido}
          onClose={() => setEditando(false)}
          onGuardado={() => { setEditando(false); setToast('Pedido editado. Se le avisó al gerente.'); cargar(); }}
        />
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

// Editor del contenido de un pedido (solo Personal de Marca, hasta el retiro):
// cambiar cantidades o precios, quitar productos o agregar otros. El total se
// recalcula y no puede quedar por debajo de lo ya abonado.
function EditorPedido({ pedido, onClose, onGuardado }) {
  const [lineas, setLineas] = useState(() => pedido.items.map((it) => ({
    producto_id: it.producto_id, nombre: it.nombre, imagen_url: it.imagen_url, cantidad: it.cantidad, precio: String(it.precio_unitario),
  })));
  const [catalogo, setCatalogo] = useState([]);
  const [agregar, setAgregar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/merc/productos').then(setCatalogo).catch(() => {}); }, []);

  const subtotal = (l) => Math.round(Number(l.precio || 0) * 100) * l.cantidad / 100;
  const total = lineas.reduce((s, l) => s + Math.round(subtotal(l) * 100), 0) / 100;
  const disponibles = catalogo.filter((p) => !lineas.some((l) => l.producto_id === p.id));
  const cambiar = (id, campo, valor) => setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, [campo]: valor } : l)));

  function agregarProducto() {
    const p = catalogo.find((x) => String(x.id) === agregar);
    if (!p) return;
    setLineas((ls) => [...ls, { producto_id: p.id, nombre: p.nombre, imagen_url: p.imagen_url, cantidad: 1, precio: String(p.precio) }]);
    setAgregar('');
  }

  async function guardar() {
    setError('');
    if (lineas.some((l) => l.precio === '' || !(Number(l.precio) >= 0))) { setError('Revisá los precios'); return; }
    setGuardando(true);
    try {
      await api.put(`/api/merc/pedidos/${pedido.id}/items`, {
        items: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio_unitario: Number(l.precio) })),
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar pedido ${numeroPedido(pedido.id)}`} onClose={onClose} ancho="max-w-xl">
      <div className="space-y-4">
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {lineas.length === 0 && <p className="p-3 text-sm text-gray-400">El pedido quedó sin productos. Si no se puede tomar, cancelalo en lugar de editarlo.</p>}
          {lineas.map((l) => (
            <div key={l.producto_id} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FotoProducto url={l.imagen_url} tamano="w-9 h-9" />
                <p className="flex-1 min-w-0 text-sm font-medium text-gray-900">{l.nombre}</p>
                <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.producto_id !== l.producto_id))} className="text-xs text-gray-400 hover:text-fat-bordo-600 shrink-0">Quitar</button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Cantidad valor={l.cantidad} onChange={(n) => cambiar(l.producto_id, 'cantidad', n)} />
                <label className="flex items-center gap-1 text-xs text-gray-500">Precio $
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01" value={l.precio} onChange={(e) => cambiar(l.producto_id, 'precio', e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  />
                </label>
                <p className="text-sm font-semibold text-gray-900 w-24 text-right">{pesos(subtotal(l))}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={agregar} onChange={(e) => setAgregar(e.target.value)} aria-label="Agregar producto">
              <option value="">Agregar otro producto…</option>
              {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {pesos(p.precio)}</option>)}
            </Select>
          </div>
          <Boton ancho="w-auto" variante="secundario" disabled={!agregar} onClick={agregarProducto}>Agregar</Boton>
        </div>

        <div className="text-sm space-y-0.5">
          <div className="flex justify-between"><span className="text-gray-500">Total anterior</span><span className="text-gray-700">{pesos(pedido.total)}</span></div>
          <div className="flex justify-between"><span className="font-medium text-gray-700">Nuevo total</span><span className="font-semibold text-gray-900">{pesos(total)}</span></div>
          {pedido.abonado > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Ya abonado</span><span className={total < pedido.abonado ? 'text-fat-bordo-600 font-medium' : 'text-gray-700'}>{pesos(pedido.abonado)}</span></div>
          )}
        </div>
        <p className="text-xs text-gray-400">El pedido queda marcado como editado con el resumen de los cambios, y el gerente que lo hizo recibe un aviso.</p>
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <div className="flex gap-2">
          <Boton variante="secundario" ancho="w-auto" onClick={onClose}>Cancelar</Boton>
          <Boton cargando={guardando} disabled={lineas.length === 0} onClick={guardar}>Guardar cambios</Boton>
        </div>
      </div>
    </Modal>
  );
}
