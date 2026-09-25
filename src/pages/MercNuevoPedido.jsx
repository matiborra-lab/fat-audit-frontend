import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Boton, Modal, Select, Cargando, Leyenda } from '../components/ui';
import { FotoProducto, Cantidad } from '../components/MercUI';
import { esMarca, pesos } from '../utils/mercaderia';

// Mercadería FAT > Nuevo pedido. Pensado para el celular: catálogo en
// tarjetas grandes, una barra fija abajo con el total y la revisión del
// pedido antes de confirmar.
export default function MercNuevoPedido() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const marca = esMarca(usuario);
  const [productos, setProductos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState(usuario.sucursal_id ? String(usuario.sucursal_id) : '');
  const [buscar, setBuscar] = useState('');
  const [borrador, setBorrador] = useState({}); // producto_id -> cantidad elegida en la tarjeta (antes de agregar)
  const [carrito, setCarrito] = useState({}); // producto_id -> cantidad en el pedido
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  function cargarProductos() {
    return api.get('/api/merc/productos').then(setProductos).catch((e) => { setError(e.message); setProductos([]); });
  }
  useEffect(() => {
    cargarProductos();
    api.get('/api/sucursales').then(setSucursales).catch(() => {});
  }, []);

  const sucursalNombre = sucursales.find((s) => String(s.id) === String(sucursalId))?.nombre;
  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (productos || []).filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q));
  }, [productos, buscar]);

  const lineas = (productos || []).filter((p) => carrito[p.id]).map((p) => ({ ...p, cantidad: carrito[p.id], subtotal: p.precio * carrito[p.id] }));
  const total = lineas.reduce((s, l) => s + l.subtotal, 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);

  function agregar(p) {
    const cantidad = borrador[p.id] || 1;
    setCarrito((c) => ({ ...c, [p.id]: (c[p.id] || 0) + cantidad }));
    setBorrador((b) => ({ ...b, [p.id]: 1 }));
  }
  function cambiarCantidad(id, cantidad) {
    setCarrito((c) => {
      const n = { ...c };
      if (cantidad <= 0) delete n[id]; else n[id] = cantidad;
      return n;
    });
  }

  async function confirmar() {
    setError('');
    if (marca && !sucursalId) { setError('Elegí la sucursal del pedido'); return; }
    setEnviando(true);
    try {
      const pedido = await api.post('/api/merc/pedidos', {
        ...(marca && sucursalId ? { sucursal_id: Number(sucursalId) } : {}),
        items: lineas.map((l) => ({ producto_id: l.id, cantidad: l.cantidad })),
      });
      navigate(`/mercaderia/pedidos/${pedido.id}`, { state: { creado: true }, replace: true });
    } catch (err) {
      setError(err.message);
      // Si un producto se deshabilitó mientras se armaba el pedido, se
      // actualiza el catálogo (el efecto de abajo saca del carrito lo que ya no existe).
      cargarProductos();
    } finally {
      setEnviando(false);
    }
  }

  // Limpia del carrito productos que ya no están disponibles tras recargar.
  useEffect(() => {
    if (!productos) return;
    setCarrito((c) => Object.fromEntries(Object.entries(c).filter(([id]) => productos.some((p) => p.id === Number(id)))));
  }, [productos]);

  if (!productos) return <Cargando />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Nuevo pedido</h1>

      <Tarjeta className="p-4">
        {marca ? (
          <Select label="Sucursal del pedido" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Elegí una sucursal</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
        ) : (
          <div>
            <p className="text-xs text-gray-400">Sucursal</p>
            <p className="text-base font-medium text-gray-900">{sucursalNombre || '…'}</p>
          </div>
        )}
      </Tarjeta>

      <input
        type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar producto…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
      />

      {error && !revisando && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {productos.length === 0 && <Leyenda>Todavía no hay productos disponibles en el catálogo.</Leyenda>}
      <div className="space-y-3">
        {filtrados.map((p, i) => (
          <div key={p.id} className="space-y-3">
          {/* Encabezado de categoría cuando cambia (el orden viene del catálogo). */}
          {(i === 0 || filtrados[i - 1].categoria_id !== p.categoria_id) && (p.categoria_nombre || filtrados.some((x) => x.categoria_id)) && (
            <h2 className="text-sm font-semibold text-gray-500 uppercase pt-1">{p.categoria_nombre || 'Otros productos'}</h2>
          )}
          <Tarjeta className="p-3">
            <div className="flex gap-3">
              <FotoProducto url={p.imagen_url} tamano="w-20 h-20" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{p.nombre}</p>
                {p.descripcion && <p className="text-xs text-gray-500 line-clamp-2">{p.descripcion}</p>}
                <p className="text-base font-semibold text-fat-bordo-600 mt-0.5">{pesos(p.precio)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-3">
              <Cantidad valor={borrador[p.id] || 1} onChange={(n) => setBorrador((b) => ({ ...b, [p.id]: n }))} />
              <div className="flex items-center gap-2">
                {carrito[p.id] > 0 && <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">En pedido: {carrito[p.id]}</span>}
                <Boton ancho="w-auto" onClick={() => agregar(p)}>Agregar</Boton>
              </div>
            </div>
          </Tarjeta>
          </div>
        ))}
        {productos.length > 0 && filtrados.length === 0 && <p className="text-sm text-gray-400">No hay productos que coincidan con la búsqueda.</p>}
      </div>

      {lineas.length > 0 && (
        <div className="sticky bottom-3 z-20">
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">{unidades} unidad{unidades === 1 ? '' : 'es'} · {lineas.length} producto{lineas.length === 1 ? '' : 's'}</p>
              <p className="text-lg font-semibold text-gray-900">{pesos(total)}</p>
            </div>
            <Boton ancho="w-auto" onClick={() => { setError(''); setRevisando(true); }}>Revisar pedido</Boton>
          </div>
        </div>
      )}

      {revisando && (
        <Modal titulo="Revisá tu pedido" onClose={() => setRevisando(false)}>
          <div className="space-y-3">
            {sucursalNombre && <p className="text-sm text-gray-600">Sucursal: <strong>{sucursalNombre}</strong></p>}
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {lineas.map((l) => (
                <div key={l.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{l.nombre}</p>
                    <button type="button" onClick={() => cambiarCantidad(l.id, 0)} className="text-xs text-gray-400 hover:text-fat-bordo-600 shrink-0">Quitar</button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Cantidad valor={l.cantidad} onChange={(n) => cambiarCantidad(l.id, n)} />
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{pesos(l.precio)} c/u</p>
                      <p className="text-sm font-semibold text-gray-900">{pesos(l.subtotal)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-gray-700">Total</span>
              <span className="font-semibold text-gray-900">{pesos(total)}</span>
            </div>
            {lineas.length === 0 && <p className="text-sm text-gray-400">El pedido quedó vacío.</p>}
            {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
            <div className="flex gap-2">
              <Boton variante="secundario" ancho="w-auto" onClick={() => setRevisando(false)}>Seguir agregando</Boton>
              <Boton cargando={enviando} disabled={lineas.length === 0} onClick={confirmar}>Confirmar pedido</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
