import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, descargarPdf } from '../api/client';
import { Tarjeta, Boton, Modal, Select, Toast, Cargando } from '../components/ui';
import { EstadoPedido } from '../components/MercUI';
import MercFiltros, { FILTROS_VACIOS, queryDeFiltros } from '../components/MercFiltros';
import { pesos, numeroPedido, fechaCorta, textoDemora } from '../utils/mercaderia';

function Indicador({ etiqueta, valor, destacado }) {
  return (
    <Tarjeta className="p-4">
      <p className="text-xs text-gray-400">{etiqueta}</p>
      <p className={`text-xl font-semibold ${destacado ? 'text-fat-bordo-600' : 'text-gray-900'}`}>{valor}</p>
    </Tarjeta>
  );
}

// Mercadería FAT > Gestión de pagos (solo Personal de Marca). Es el único
// lugar donde se registran cobros: no hay un "marcar como pagado" en el
// pedido, para que queden bien asentados los pagos parciales, los que cubren
// varios pedidos y la observación de cada cobro.
export default function MercPagos() {
  const [resumen, setResumen] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pedidos, setPedidos] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [cancelando, setCancelando] = useState(false);
  const [reportes, setReportes] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  function recargar() {
    api.get('/api/merc/pagos/resumen').then(setResumen).catch((e) => setError(e.message));
    // Más antiguos primero (orden predeterminado de esta pantalla).
    api.get('/api/merc/pedidos' + queryDeFiltros(filtros, { orden: 'antiguos' })).then(setPedidos).catch((e) => { setError(e.message); setPedidos([]); });
  }
  useEffect(() => {
    api.get('/api/sucursales').then(setSucursales).catch(() => {});
    api.get('/api/merc/responsables').then(setResponsables).catch(() => {});
  }, []);
  useEffect(recargar, [filtros]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Gestión de pagos</h1>
        <div className="flex gap-2">
          <Boton ancho="w-auto" variante="secundario" onClick={() => setReportes(true)}>Reportes</Boton>
          <Boton ancho="w-auto" onClick={() => setCancelando(true)}>Cancelar saldo</Boton>
        </div>
      </div>

      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Indicador etiqueta="Total pendiente de cobro" valor={pesos(resumen.total_pendiente)} destacado={resumen.total_pendiente > 0} />
          <Indicador etiqueta="Pedidos con saldo pendiente" valor={resumen.pedidos_con_saldo} />
          <Indicador etiqueta="Sucursales con deuda" valor={resumen.sucursales_con_deuda} />
        </div>
      )}

      <MercFiltros filtros={filtros} onChange={setFiltros} marca sucursales={sucursales} responsables={responsables} />
      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}

      {!pedidos ? <Cargando /> : pedidos.length === 0 ? (
        <p className="text-sm text-gray-400">No hay pedidos con estos filtros.</p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {pedidos.map((p) => (
              <Link key={p.id} to={`/mercaderia/pedidos/${p.id}`} className="block">
                <Tarjeta className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{numeroPedido(p.id)} · {p.sucursal_nombre}</p>
                      <p className="text-xs text-gray-400">{p.responsable_nombre} · {fechaCorta(p.creado_en)}</p>
                    </div>
                    <EstadoPedido estado={p.estado} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div><p className="text-gray-400">Total</p><p className="text-gray-900 font-medium">{pesos(p.total)}</p></div>
                    <div><p className="text-gray-400">Abonado</p><p className="text-gray-900 font-medium">{pesos(p.abonado)}</p></div>
                    <div><p className="text-gray-400">Saldo</p><p className={`font-semibold ${p.saldo > 0 ? 'text-fat-bordo-600' : 'text-gray-400'}`}>{pesos(p.saldo)}</p></div>
                  </div>
                  {p.saldo > 0 && <p className="text-xs text-gray-400 mt-1">Demora: {textoDemora(p.dias_demora)}</p>}
                </Tarjeta>
              </Link>
            ))}
          </div>

          <Tarjeta className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs xl:text-sm">
              <thead className="text-xs text-gray-400 border-b border-gray-100">
                <tr className="text-left">
                  <th className="px-2 xl:px-3 py-2 font-medium">Pedido</th><th className="px-2 xl:px-3 py-2 font-medium">Sucursal</th>
                  <th className="px-2 xl:px-3 py-2 font-medium">Fecha</th><th className="px-2 xl:px-3 py-2 font-medium">Gerente responsable</th>
                  <th className="px-2 xl:px-3 py-2 font-medium text-right">Total pedido</th><th className="px-2 xl:px-3 py-2 font-medium text-right">Abonado</th>
                  <th className="px-2 xl:px-3 py-2 font-medium text-right">Saldo pendiente</th><th className="px-2 xl:px-3 py-2 font-medium text-right">Días de demora</th>
                  <th className="px-2 xl:px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-2 xl:px-3 py-2 font-medium"><Link to={`/mercaderia/pedidos/${p.id}`} className="text-fat-bordo-600 hover:underline">{numeroPedido(p.id)}</Link></td>
                    <td className="px-2 xl:px-3 py-2 text-gray-700">{p.sucursal_nombre}</td>
                    <td className="px-2 xl:px-3 py-2 text-gray-500">{fechaCorta(p.creado_en)}</td>
                    <td className="px-2 xl:px-3 py-2 text-gray-700">{p.responsable_nombre}</td>
                    <td className="px-2 xl:px-3 py-2 text-right text-gray-900">{pesos(p.total)}</td>
                    <td className="px-2 xl:px-3 py-2 text-right text-gray-700">{pesos(p.abonado)}</td>
                    <td className={`px-3 py-2 text-right ${p.saldo > 0 ? 'text-fat-bordo-600 font-semibold' : 'text-gray-400'}`}>{pesos(p.saldo)}</td>
                    <td className="px-2 xl:px-3 py-2 text-right text-gray-500">{textoDemora(p.dias_demora)}</td>
                    <td className="px-2 xl:px-3 py-2"><EstadoPedido estado={p.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}

      {cancelando && (
        <ModalCancelarSaldo
          sucursales={sucursales}
          sucursalesConDeuda={resumen?.por_sucursal || []}
          onClose={() => setCancelando(false)}
          onRegistrado={() => { recargar(); setToast('Pago registrado'); }}
        />
      )}
      {reportes && <ModalReportes sucursales={sucursales} onClose={() => setReportes(false)} />}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

// "Cancelar saldo": elegir sucursal -> tildar los pedidos con saldo -> monto
// (por defecto todo lo seleccionado, editable) -> el pago se aplica del más
// antiguo al más nuevo. La vista previa muestra exactamente cómo se repartiría.
function ModalCancelarSaldo({ sucursales, sucursalesConDeuda, onClose, onRegistrado }) {
  const [sucursalId, setSucursalId] = useState('');
  const [pedidos, setPedidos] = useState(null);
  const [seleccion, setSeleccion] = useState(new Set());
  const [monto, setMonto] = useState('');
  const [montoManual, setMontoManual] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    setSeleccion(new Set()); setMontoManual(false); setError('');
    if (!sucursalId) { setPedidos(null); return; }
    setPedidos(null);
    api.get(`/api/merc/pedidos?sucursal_id=${sucursalId}&con_saldo=1&orden=antiguos`).then(setPedidos).catch((e) => { setError(e.message); setPedidos([]); });
  }, [sucursalId]);

  const elegidos = useMemo(() => (pedidos || []).filter((p) => seleccion.has(p.id)), [pedidos, seleccion]);
  const saldoElegido = Math.round(elegidos.reduce((s, p) => s + Math.round(p.saldo * 100), 0)) / 100;

  // El monto acompaña al saldo seleccionado hasta que el usuario lo edita a mano.
  useEffect(() => { if (!montoManual) setMonto(saldoElegido > 0 ? String(saldoElegido) : ''); }, [saldoElegido, montoManual]);

  const montoNumero = Number(monto);
  const montoValido = montoNumero > 0 && Math.round(montoNumero * 100) <= Math.round(saldoElegido * 100);

  // Vista previa de la imputación (más antiguo primero).
  const reparto = useMemo(() => {
    let restante = Math.round((montoValido ? montoNumero : 0) * 100);
    return elegidos.map((p) => {
      const saldoC = Math.round(p.saldo * 100);
      const aplicado = Math.min(saldoC, restante);
      restante -= aplicado;
      return { ...p, aplicado: aplicado / 100, queda: (saldoC - aplicado) / 100 };
    }).filter((r) => r.aplicado > 0);
  }, [elegidos, montoNumero, montoValido]);

  function alternar(id) {
    setSeleccion((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const todosElegidos = pedidos?.length > 0 && pedidos.every((p) => seleccion.has(p.id));

  async function confirmar() {
    setGuardando(true);
    setError('');
    try {
      const pago = await api.post('/api/merc/pagos', {
        sucursal_id: Number(sucursalId), pedido_ids: elegidos.map((p) => p.id), monto: montoNumero, observaciones,
      });
      setResultado(pago);
      onRegistrado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (resultado) {
    return (
      <Modal titulo="Pago registrado" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Se registró un cobro de <strong>{pesos(resultado.monto)}</strong>. Así se aplicó:</p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg text-sm">
            {resultado.aplicaciones.map((a) => (
              <div key={a.pedido_id} className="p-3">
                <p className="font-medium text-gray-900">Pedido {a.numero}</p>
                <p className="text-xs text-gray-500">Saldo anterior {pesos(a.saldo_anterior)} · Abonado {pesos(a.importe)} · Saldo {pesos(a.saldo)}</p>
              </div>
            ))}
          </div>
          <Boton onClick={onClose}>Listo</Boton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Cancelar saldo" onClose={onClose} ancho="max-w-2xl">
      <div className="space-y-4">
        <Select label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Elegí una sucursal</option>
          {sucursales.map((s) => {
            const deuda = sucursalesConDeuda.find((d) => d.sucursal_id === s.id);
            return <option key={s.id} value={s.id}>{s.nombre}{deuda ? ` — debe ${pesos(deuda.saldo)}` : ''}</option>;
          })}
        </Select>

        {sucursalId && !pedidos && <Cargando />}
        {pedidos && pedidos.length === 0 && <p className="text-sm text-gray-400">Esta sucursal no tiene pedidos con saldo pendiente.</p>}

        {pedidos && pedidos.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={todosElegidos} onChange={() => setSeleccion(todosElegidos ? new Set() : new Set(pedidos.map((p) => p.id)))} />
              Seleccionar todos ({pedidos.length})
            </label>
            <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
              {pedidos.map((p) => (
                <label key={p.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" className="mt-1" checked={seleccion.has(p.id)} onChange={() => alternar(p.id)} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-900">Pedido {numeroPedido(p.id)}</span>
                      <span className="font-semibold text-fat-bordo-600">{pesos(p.saldo)}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {fechaCorta(p.creado_en)} · Total {pesos(p.total)} · Abonado {pesos(p.abonado)} · Demora {textoDemora(p.dias_demora)}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-400">Total de documentos seleccionados</p><p className="font-semibold text-gray-900">{elegidos.length}</p></div>
              <div><p className="text-xs text-gray-400">Saldo pendiente seleccionado</p><p className="font-semibold text-fat-bordo-600">{pesos(saldoElegido)}</p></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto a cancelar</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01" value={monto}
                onChange={(e) => { setMonto(e.target.value); setMontoManual(true); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
              />
              {monto !== '' && Math.round(montoNumero * 100) > Math.round(saldoElegido * 100) && (
                <p className="text-xs text-fat-bordo-600 mt-1">El monto no puede superar el saldo pendiente seleccionado ({pesos(saldoElegido)}).</p>
              )}
              {montoManual && saldoElegido > 0 && (
                <button type="button" onClick={() => setMontoManual(false)} className="text-xs text-fat-bordo-600 hover:underline mt-1">Usar el total seleccionado</button>
              )}
            </div>

            {reparto.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">Cómo se aplicaría (del más antiguo al más nuevo):</p>
                {reparto.map((r) => (
                  <p key={r.id}>Pedido {numeroPedido(r.id)}: abona {pesos(r.aplicado)} → queda {pesos(r.queda)}</p>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones del cobro</label>
              <textarea
                rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: Transferencia bancaria."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <div className="flex gap-2">
          <Boton variante="secundario" ancho="w-auto" onClick={onClose}>Cancelar</Boton>
          <Boton cargando={guardando} disabled={!elegidos.length || !montoValido} onClick={confirmar}>Confirmar pago</Boton>
        </div>
      </div>
    </Modal>
  );
}

// Reportes PDF: saldos pendientes (situación de hoy) o todos los documentos
// emitidos en un período.
function ModalReportes({ sucursales, onClose }) {
  const [tipo, setTipo] = useState('saldos');
  const [sucursalId, setSucursalId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  async function generar() {
    setError('');
    if (tipo === 'documentos' && (!desde || !hasta)) { setError('Elegí la fecha desde y hasta'); return; }
    setGenerando(true);
    try {
      const p = new URLSearchParams();
      if (sucursalId) p.set('sucursal_id', sucursalId);
      if (tipo === 'documentos') { p.set('desde', desde); p.set('hasta', hasta); }
      await descargarPdf(`/api/merc/reportes/${tipo}?${p}`, tipo === 'saldos' ? 'mercaderia-saldos-pendientes.pdf' : 'mercaderia-documentos-emitidos.pdf');
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Modal titulo="Reportes" onClose={onClose} ancho="max-w-md">
      <div className="space-y-4">
        <Select label="Tipo de reporte" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="saldos">Saldos pendientes</option>
          <option value="documentos">Todos los documentos emitidos</option>
        </Select>
        <Select label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Select>
        {tipo === 'documentos' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">Fecha desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
            </label>
            <label className="text-sm font-medium text-gray-700">Fecha hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
            </label>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Muestra siempre la situación actual, por eso no lleva fechas. Con todas las sucursales, se agrupa por sucursal.</p>
        )}
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton disabled={generando} onClick={generar}>{generando ? 'Generando…' : 'Generar PDF'}</Boton>
      </div>
    </Modal>
  );
}
