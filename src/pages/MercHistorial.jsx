import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Cargando, Toast } from '../components/ui';
import { EstadoCobro, Editado } from '../components/MercUI';
import EstadoPedidoEditable from '../components/MercEstadoEditable';
import MercFiltros, { FILTROS_VACIOS, queryDeFiltros } from '../components/MercFiltros';
import { esMarca, pesos, textoSaldo, numeroPedido, fechaCorta } from '../utils/mercaderia';

function IconoOjo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Mercadería FAT > Historial. Un Gerente ve solo los pedidos de su
// sucursal (lo fuerza el backend); Personal de Marca ve todas.
export default function MercHistorial() {
  const { usuario } = useAuth();
  const marca = esMarca(usuario);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pedidos, setPedidos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0); // se sube al cambiar un estado, para recargar el listado
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!marca) return;
    api.get('/api/sucursales').then(setSucursales).catch(() => {});
    api.get('/api/merc/responsables').then(setResponsables).catch(() => {});
  }, [marca]);

  useEffect(() => {
    setError('');
    api.get('/api/merc/pedidos' + queryDeFiltros(filtros)).then(setPedidos).catch((e) => { setError(e.message); setPedidos([]); });
  }, [filtros, version]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Historial de pedidos</h1>
      <MercFiltros filtros={filtros} onChange={setFiltros} marca={marca} sucursales={sucursales} responsables={responsables} />
      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {!pedidos ? <Cargando /> : pedidos.length === 0 ? (
        <p className="text-sm text-gray-400">No hay pedidos con estos filtros.</p>
      ) : (
        <>
          {/* Celular: tarjetas */}
          <div className="space-y-2 md:hidden">
            {pedidos.map((p) => (
              <Tarjeta key={p.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{numeroPedido(p.id)} · {p.sucursal_nombre} {p.editado && <Editado />}</p>
                    <p className="text-xs text-gray-400">{p.responsable_nombre} · {fechaCorta(p.creado_en)}</p>
                  </div>
                  <EstadoPedidoEditable pedido={p} editable={marca} onCambiado={(m) => { setToast(m); setVersion((v) => v + 1); }} />
                </div>
                <div className="flex items-end justify-between gap-2 mt-2">
                  <div className="text-sm">
                    <p className="text-gray-700">Total <strong>{pesos(p.total)}</strong></p>
                    <p className={p.saldo > 0 ? 'text-fat-bordo-600' : 'text-gray-400'}>Saldo {textoSaldo(p)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EstadoCobro estado={p.estado_cobro} />
                    <Link to={`/mercaderia/pedidos/${p.id}`} aria-label="Ver detalle" title="Ver detalle" className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"><IconoOjo /></Link>
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>

          {/* Escritorio: tabla */}
          <Tarjeta className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs xl:text-sm">
              <thead className="text-xs text-gray-400 border-b border-gray-100">
                <tr className="text-left">
                  <th className="px-2 xl:px-3 py-2 font-medium">Pedido</th><th className="px-2 xl:px-3 py-2 font-medium">Sucursal</th>
                  <th className="px-2 xl:px-3 py-2 font-medium">Responsable</th><th className="px-2 xl:px-3 py-2 font-medium">Fecha</th>
                  <th className="px-2 xl:px-3 py-2 font-medium text-right">Total</th><th className="px-2 xl:px-3 py-2 font-medium text-right">Saldo</th>
                  <th className="px-2 xl:px-3 py-2 font-medium">Estado</th><th className="px-2 xl:px-3 py-2 font-medium">Cobro</th><th className="px-2 xl:px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-2 xl:px-3 py-2 font-medium text-gray-900">{numeroPedido(p.id)} {p.editado && <Editado />}</td>
                    <td className="px-2 xl:px-3 py-2 text-gray-700">{p.sucursal_nombre}</td>
                    <td className="px-2 xl:px-3 py-2 text-gray-700">{p.responsable_nombre}</td>
                    <td className="px-2 xl:px-3 py-2 text-gray-500">{fechaCorta(p.creado_en)}</td>
                    <td className="px-2 xl:px-3 py-2 text-right text-gray-900">{pesos(p.total)}</td>
                    <td className={`px-3 py-2 text-right ${p.saldo > 0 ? 'text-fat-bordo-600 font-medium' : 'text-gray-400'}`}>{textoSaldo(p)}</td>
                    <td className="px-2 xl:px-3 py-2"><EstadoPedidoEditable pedido={p} editable={marca} onCambiado={(m) => { setToast(m); setVersion((v) => v + 1); }} /></td>
                    <td className="px-2 xl:px-3 py-2"><EstadoCobro estado={p.estado_cobro} /></td>
                    <td className="px-2 xl:px-3 py-2 text-right">
                      <Link to={`/mercaderia/pedidos/${p.id}`} aria-label="Ver detalle" title="Ver detalle" className="inline-block p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"><IconoOjo /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}
