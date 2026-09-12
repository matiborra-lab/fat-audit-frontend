import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Boton, Modal, Select, Campo, Toast, Cargando } from '../components/ui';

// Mismas opciones de anticipación para cualquier tipo con RECORDATORIO_* -
// horas fijas en vez de un campo libre, más simple de elegir en el momento.
const ANTICIPACION_OPCIONES = [1, 3, 6, 12, 24, 48, 72];
function etiquetaAnticipacion(horas) {
  if (horas < 24) return `${horas} hora${horas > 1 ? 's' : ''} antes`;
  const dias = horas / 24;
  return `${dias} día${dias > 1 ? 's' : ''} antes`;
}

// Subconjunto de códigos WMO que devuelve Open-Meteo (ver src/clima del
// backend) - los más frecuentes, alcanza para el selector de reglas.
const OPCIONES_CLIMA = [
  { value: 0, label: 'Despejado' }, { value: 2, label: 'Parcialmente nublado' }, { value: 3, label: 'Nublado' },
  { value: 45, label: 'Niebla' }, { value: 51, label: 'Llovizna' }, { value: 61, label: 'Lluvia' },
  { value: 71, label: 'Nieve' }, { value: 80, label: 'Chubascos' }, { value: 95, label: 'Tormenta' },
];
const ETIQUETA_CLIMA_POR_CODIGO = Object.fromEntries(OPCIONES_CLIMA.map((o) => [o.value, o.label]));

const CATEGORIAS_EVENTO = [
  {
    titulo: 'Tarea', asignacion: 'ASIGNACION_TAREA', recordatorio: 'RECORDATORIO_TAREA', anticipacionDefault: 1,
    descripcionAsignacion: 'Avisar cuando se te asigna una tarea', descripcionRecordatorio: 'Recordar antes de la hora programada',
  },
  {
    titulo: 'Auditoría', asignacion: 'ASIGNACION_AUDITORIA', recordatorio: 'RECORDATORIO_AUDITORIA', anticipacionDefault: 24,
    descripcionAsignacion: 'Avisar cuando se te asigna una auditoría o seguimiento', descripcionRecordatorio: 'Recordar antes de la hora programada',
  },
  {
    titulo: 'Evento especial', asignacion: 'ASIGNACION_EVENTO_ESPECIAL', recordatorio: 'RECORDATORIO_EVENTO_ESPECIAL', anticipacionDefault: 24,
    descripcionAsignacion: 'Avisar cuando sos responsable de un evento especial', descripcionRecordatorio: 'Recordar antes de un evento especial de tu sucursal',
  },
];
const TIPOS_SIMPLES = [
  { titulo: 'Turno', tipo: 'TURNOS_ASIGNADOS', descripcion: 'Cuando se confirma un turno asignado' },
  { titulo: 'Cumpleaños', tipo: 'CUMPLEANOS', descripcion: 'A las 00:00 del día de cumpleaños de un colaborador de tu sucursal' },
];

export default function NotificacionPreferencias() {
  const [prefs, setPrefs] = useState(null); // { [tipo]: { habilitado, anticipacion_horas } }
  const [reglasClima, setReglasClima] = useState([]);
  const [modalRegla, setModalRegla] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  function recargar() {
    api.get('/api/notificacion-preferencias').then(({ preferencias, reglasClima }) => {
      setPrefs(Object.fromEntries(preferencias.map((p) => [p.tipo, p])));
      setReglasClima(reglasClima);
    });
  }
  useEffect(recargar, []);

  // Sin fila = habilitado por default (mismo criterio que el backend).
  function pref(tipo, anticipacionDefault) {
    return prefs?.[tipo] || { habilitado: true, anticipacion_horas: anticipacionDefault ?? null };
  }

  async function actualizar(tipo, cambios) {
    const actual = pref(tipo);
    const nuevo = { habilitado: actual.habilitado, anticipacion_horas: actual.anticipacion_horas, ...cambios };
    setError('');
    try {
      await api.put(`/api/notificacion-preferencias/${tipo}`, nuevo);
      setPrefs((p) => ({ ...p, [tipo]: nuevo }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminarRegla(id) {
    try {
      await api.del(`/api/notificacion-preferencias/reglas-clima/${id}`);
      setReglasClima((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!prefs) return <Cargando />;

  const climaPref = pref('CLIMA');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Notificaciones</h1>
      <p className="text-sm text-gray-500">
        Elegí qué notificaciones querés recibir (campana y push) y con cuánta anticipación.
      </p>

      {CATEGORIAS_EVENTO.map((cat) => {
        const asig = pref(cat.asignacion);
        const rec = pref(cat.recordatorio, cat.anticipacionDefault);
        return (
          <Tarjeta key={cat.titulo} className="p-4 space-y-3">
            <h3 className="font-medium text-gray-900">{cat.titulo}</h3>
            <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
              <span>{cat.descripcionAsignacion}</span>
              <input type="checkbox" checked={asig.habilitado} onChange={(e) => actualizar(cat.asignacion, { habilitado: e.target.checked })} />
            </label>
            <div className="flex items-center justify-between gap-3 text-sm text-gray-700">
              <span>{cat.descripcionRecordatorio}</span>
              <div className="flex items-center gap-2 shrink-0">
                {rec.habilitado && (
                  <select
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white"
                    value={rec.anticipacion_horas ?? cat.anticipacionDefault}
                    onChange={(e) => actualizar(cat.recordatorio, { habilitado: true, anticipacion_horas: Number(e.target.value) })}
                  >
                    {ANTICIPACION_OPCIONES.map((h) => <option key={h} value={h}>{etiquetaAnticipacion(h)}</option>)}
                  </select>
                )}
                <input type="checkbox" checked={rec.habilitado} onChange={(e) => actualizar(cat.recordatorio, { habilitado: e.target.checked })} />
              </div>
            </div>
          </Tarjeta>
        );
      })}

      {TIPOS_SIMPLES.map((t) => {
        const p = pref(t.tipo);
        return (
          <Tarjeta key={t.tipo} className="p-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{t.titulo}</p>
                <p className="text-xs text-gray-400">{t.descripcion}</p>
              </div>
              <input type="checkbox" checked={p.habilitado} onChange={(e) => actualizar(t.tipo, { habilitado: e.target.checked })} />
            </label>
          </Tarjeta>
        );
      })}

      <Tarjeta className="p-4 space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-gray-900">Clima</p>
            <p className="text-xs text-gray-400">Avisos condicionales según el pronóstico de tu sucursal</p>
          </div>
          <input type="checkbox" checked={climaPref.habilitado} onChange={(e) => actualizar('CLIMA', { habilitado: e.target.checked })} />
        </label>

        {climaPref.habilitado && (
          <div className="space-y-2">
            {reglasClima.length === 0 && <p className="text-xs text-gray-400">Sin reglas todavía.</p>}
            {reglasClima.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                <span className="text-gray-700">
                  {r.campo === 'weather_code' ? (ETIQUETA_CLIMA_POR_CODIGO[r.valor] || 'Clima') : `Temperatura ${r.operador === 'gte' ? '≥' : '≤'} ${r.valor}°C`}
                  {' · '}{r.anticipacion_dias === 0 ? 'el mismo día' : `${r.anticipacion_dias} día${r.anticipacion_dias > 1 ? 's' : ''} antes`}
                </span>
                <button onClick={() => eliminarRegla(r.id)} className="text-gray-400 hover:text-fat-bordo-600 shrink-0">&times;</button>
              </div>
            ))}
            <Boton ancho="w-auto" variante="secundario" onClick={() => setModalRegla(true)}>+ Agregar regla</Boton>
          </div>
        )}
      </Tarjeta>

      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
      {modalRegla && (
        <ModalReglaClima
          onClose={() => setModalRegla(false)}
          onCreada={(regla) => { setReglasClima((r) => [...r, regla]); setModalRegla(false); setToast('Regla agregada'); }}
        />
      )}
      {toast && <Toast mensaje={toast} onCerrar={() => setToast('')} />}
    </div>
  );
}

function ModalReglaClima({ onClose, onCreada }) {
  const [campo, setCampo] = useState('weather_code');
  const [valorClima, setValorClima] = useState(OPCIONES_CLIMA[0].value);
  const [operador, setOperador] = useState('gte');
  const [valorTemperatura, setValorTemperatura] = useState('');
  const [anticipacionDias, setAnticipacionDias] = useState(0);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (campo === 'temperatura' && valorTemperatura === '') { setError('Ingresá una temperatura'); return; }
    setError('');
    setGuardando(true);
    try {
      const regla = await api.post('/api/notificacion-preferencias/reglas-clima', {
        campo,
        operador: campo === 'weather_code' ? 'eq' : operador,
        valor: campo === 'weather_code' ? valorClima : Number(valorTemperatura),
        anticipacion_dias: Number(anticipacionDias),
      });
      onCreada(regla);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nueva regla de clima" onClose={onClose}>
      <form onSubmit={guardar} className="space-y-3">
        <Select label="Condición" value={campo} onChange={(e) => setCampo(e.target.value)}>
          <option value="weather_code">Tipo de clima</option>
          <option value="temperatura">Temperatura</option>
        </Select>

        {campo === 'weather_code' ? (
          <Select label="Clima" value={valorClima} onChange={(e) => setValorClima(Number(e.target.value))}>
            {OPCIONES_CLIMA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Cuándo" value={operador} onChange={(e) => setOperador(e.target.value)}>
              <option value="gte">Mayor o igual a</option>
              <option value="lte">Menor o igual a</option>
            </Select>
            <Campo label="Temperatura (°C)" type="number" value={valorTemperatura} onChange={(e) => setValorTemperatura(e.target.value)} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Avisar con anticipación</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            value={anticipacionDias}
            onChange={(e) => setAnticipacionDias(e.target.value)}
          >
            <option value={0}>El mismo día</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d} día{d > 1 ? 's' : ''} antes</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={guardando}>Agregar</Boton>
      </form>
    </Modal>
  );
}
