import { useEffect, useMemo, useRef, useState } from 'react';
import { api, subirArchivo } from '../api/client';
import { Tarjeta, Boton, Campo, Modal, Toast, Cargando, Leyenda } from '../components/ui';
import { FotoProducto } from '../components/MercUI';
import { reducirImagen } from '../utils/imagen';
import { pesos } from '../utils/mercaderia';

// Precio editable directo en el listado: se toca, se cambia y se guarda con
// Enter o con el botón, sin abrir el producto (los precios cambian seguido).
function PrecioRapido({ producto, onGuardar }) {
  const [valor, setValor] = useState(String(producto.precio));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setValor(String(producto.precio)); }, [producto.precio]);
  const cambio = valor !== '' && Number(valor) !== producto.precio;

  async function guardar() {
    if (!cambio || !(Number(valor) >= 0)) return;
    setGuardando(true);
    try { await onGuardar(producto, Number(valor)); } finally { setGuardando(false); }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
        <input
          type="number" inputMode="decimal" min="0" step="0.01" value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
          aria-label={`Precio de ${producto.nombre}`}
          className="w-28 rounded-lg border border-gray-300 pl-5 pr-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
        />
      </div>
      {cambio && <Boton ancho="w-auto" className="!py-1.5 !px-3 text-sm" cargando={guardando} onClick={guardar}>Guardar</Boton>}
    </div>
  );
}

// Mercadería FAT > Catálogo (solo Personal de Marca). Los productos nunca se
// borran: "eliminar" los pasa a Artículos deshabilitados (no se ofrecen en
// pedidos nuevos, siguen viéndose en los pedidos históricos).
export default function MercCatalogo() {
  const [productos, setProductos] = useState(null);
  const [editando, setEditando] = useState(null); // producto, o {} para uno nuevo
  const [deshabilitando, setDeshabilitando] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  function recargar() {
    api.get('/api/merc/productos?todos=1').then(setProductos).catch((e) => { setError(e.message); setProductos([]); });
  }
  useEffect(recargar, []);

  const activos = useMemo(() => (productos || []).filter((p) => p.activo), [productos]);
  const deshabilitados = useMemo(() => (productos || []).filter((p) => !p.activo), [productos]);

  async function guardarPrecio(producto, precio) {
    setError('');
    try {
      await api.patch(`/api/merc/productos/${producto.id}`, { precio });
      setToast(`Precio de ${producto.nombre} actualizado`);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarActivo(producto, activo) {
    setError('');
    try {
      await api.patch(`/api/merc/productos/${producto.id}`, { activo });
      setToast(activo ? 'Producto habilitado' : 'Producto deshabilitado');
      setDeshabilitando(null);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!productos) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Catálogo</h1>
        <Boton ancho="w-auto" onClick={() => setEditando({})}>+ Agregar producto</Boton>
      </div>
      <Leyenda>Los gerentes ven este catálogo al armar un pedido. Un cambio de precio solo afecta a los pedidos nuevos: los ya hechos conservan el precio de ese momento.</Leyenda>
      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      <Tarjeta className="divide-y divide-gray-100">
        {activos.length === 0 && <p className="p-4 text-sm text-gray-400">Todavía no hay productos activos.</p>}
        {activos.map((p) => (
          <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <FotoProducto url={p.imagen_url} tamano="w-14 h-14" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                {p.descripcion && <p className="text-xs text-gray-400 line-clamp-2">{p.descripcion}</p>}
                <span className="inline-block mt-0.5 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Activo</span>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <PrecioRapido producto={p} onGuardar={guardarPrecio} />
              <div className="flex gap-3 text-xs">
                <button onClick={() => setEditando(p)} className="text-gray-500 hover:text-fat-bordo-600">Editar</button>
                <button onClick={() => setDeshabilitando(p)} className="text-gray-500 hover:text-fat-bordo-600">Deshabilitar</button>
              </div>
            </div>
          </div>
        ))}
      </Tarjeta>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Artículos deshabilitados ({deshabilitados.length})</h2>
        <Tarjeta className="divide-y divide-gray-100">
          {deshabilitados.length === 0 && <p className="p-4 text-sm text-gray-400">No hay artículos deshabilitados.</p>}
          {deshabilitados.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3 opacity-80">
              <FotoProducto url={p.imagen_url} tamano="w-12 h-12" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">{p.nombre}</p>
                <p className="text-xs text-gray-400">{pesos(p.precio)} · Deshabilitado</p>
              </div>
              <button onClick={() => cambiarActivo(p, true)} className="text-xs font-medium text-fat-bordo-600 hover:underline shrink-0">Habilitar</button>
            </div>
          ))}
        </Tarjeta>
      </div>

      {editando && (
        <ModalProducto
          producto={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); setToast('Producto guardado'); recargar(); }}
        />
      )}
      {deshabilitando && (
        <Modal titulo="Deshabilitar producto" onClose={() => setDeshabilitando(null)} ancho="max-w-sm">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              ¿Deshabilitar <strong>{deshabilitando.nombre}</strong>? Deja de aparecer al crear pedidos, pero se conserva en la base y en los pedidos ya hechos. Se puede volver a habilitar.
            </p>
            <div className="flex gap-2">
              <Boton ancho="w-auto" variante="peligro" onClick={() => cambiarActivo(deshabilitando, false)}>Sí, deshabilitar</Boton>
              <Boton ancho="w-auto" variante="secundario" onClick={() => setDeshabilitando(null)}>Cancelar</Boton>
            </div>
          </div>
        </Modal>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function ModalProducto({ producto, onClose, onGuardado }) {
  const nuevo = !producto.id;
  const [nombre, setNombre] = useState(producto.nombre || '');
  const [descripcion, setDescripcion] = useState(producto.descripcion || '');
  const [precio, setPrecio] = useState(producto.precio != null ? String(producto.precio) : '');
  const [imagenUrl, setImagenUrl] = useState(producto.imagen_url || null);
  const [archivo, setArchivo] = useState(null); // foto nueva elegida, todavía sin subir
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const vistaPrevia = useMemo(() => (archivo ? URL.createObjectURL(archivo) : imagenUrl), [archivo, imagenUrl]);

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) { setError('Falta el nombre'); return; }
    if (precio === '' || !(Number(precio) >= 0)) { setError('Ingresá un precio válido'); return; }
    setGuardando(true);
    setError('');
    try {
      let url = imagenUrl;
      if (archivo) {
        const reducida = await reducirImagen(archivo);
        url = await subirArchivo({ rutaUrlSubida: '/api/merc/imagen/url-subida', carpeta: 'mercaderia', referencia: 'catalogo', archivo: reducida });
      }
      const cuerpo = { nombre, descripcion, precio: Number(precio), imagen_url: url };
      if (nuevo) await api.post('/api/merc/productos', cuerpo);
      else await api.patch(`/api/merc/productos/${producto.id}`, cuerpo);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={nuevo ? 'Agregar producto' : 'Editar producto'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción breve</label>
          <textarea
            rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
          />
        </div>
        <Campo label="Precio ($)" type="number" inputMode="decimal" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Imagen</label>
          <div className="flex items-center gap-3">
            <FotoProducto url={vistaPrevia} tamano="w-16 h-16" />
            <div className="flex flex-col gap-1 text-xs">
              <button type="button" onClick={() => inputRef.current?.click()} className="text-fat-bordo-600 hover:underline text-left">{vistaPrevia ? 'Reemplazar imagen' : 'Elegir imagen'}</button>
              {vistaPrevia && <button type="button" onClick={() => { setArchivo(null); setImagenUrl(null); if (inputRef.current) inputRef.current.value = ''; }} className="text-gray-400 hover:text-fat-bordo-600 text-left">Quitar</button>}
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
          </div>
        </div>
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Guardar</Boton>
      </form>
    </Modal>
  );
}
