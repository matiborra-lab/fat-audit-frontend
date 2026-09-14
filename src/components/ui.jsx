import { useEffect, useRef, useState } from 'react';

export function Campo({ label, ...props }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
      />
    </div>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        {...props}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400 bg-white"
      >
        {children}
      </select>
    </div>
  );
}

export function Boton({ cargando, variante = 'primario', ancho = 'w-full', className = '', children, ...props }) {
  const estilos = {
    primario: 'bg-fat-bordo-500 hover:bg-fat-bordo-600 text-white',
    secundario: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    peligro: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      {...props}
      disabled={cargando || props.disabled}
      className={`${ancho} ${estilos[variante]} disabled:opacity-50 font-medium rounded-lg py-2 px-4 transition ${className}`}
    >
      {cargando ? 'Guardando…' : children}
    </button>
  );
}

export function Tarjeta({ children, className = '' }) {
  return <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>{children}</div>;
}

export function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-50" onClick={onClose}>
      <div
        className={'bg-white rounded-xl shadow-xl w-full ' + ancho + ' mt-4 md:mt-12'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Leyenda({ children }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50/70 border border-gray-100 rounded-lg px-2.5 py-1.5">
      <span className="shrink-0 leading-none">ⓘ</span>
      <span>{children}</span>
    </p>
  );
}

export function Toast({ mensaje, onCerrar }) {
  useEffect(() => {
    const id = setTimeout(onCerrar, 4000);
    return () => clearTimeout(id);
  }, [mensaje, onCerrar]);

  return (
    <div
      onClick={onCerrar}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 text-gray-800 text-sm font-medium px-4 py-3 rounded-lg shadow-lg cursor-pointer max-w-sm"
    >
      {mensaje}
    </div>
  );
}

export function AuthCard({ titulo, subtitulo, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-fat-bordo-500 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <img src="/brand/fatburger_logo.png" alt="FAT Burger" className="h-20 mx-auto mb-4" />
        {titulo && <h1 className="text-2xl font-semibold text-gray-900 mb-1 text-center">{titulo}</h1>}
        {subtitulo && <p className="text-sm text-gray-500 mb-6 text-center">{subtitulo}</p>}
        {children}
      </div>
    </div>
  );
}

// El semáforo se expresa coloreando el número del puntaje, no escribiendo
// el nombre del color - mismos 5 tramos que semaforo_config del backend.
const SEMAFORO_COLOR_TEXTO = {
  ROJO: 'text-red-600',
  NARANJA: 'text-orange-500',
  AMARILLO: 'text-yellow-600',
  VERDE: 'text-green-600',
  DORADO: 'text-fat-amarillo-600',
};

// Mismos colores que semaforo_config (ver seed) pero en hex, para usar como
// fill de barras en los gráficos del dashboard.
export const SEMAFORO_HEX = {
  ROJO: '#DC2626',
  NARANJA: '#EA580C',
  AMARILLO: '#CA8A04',
  VERDE: '#16A34A',
  DORADO: '#D4AF37',
};

// Fallback client-side para promedios que no vienen de una auditoría puntual
// (no traen su propio semaforo) - mismos tramos que semaforo_config.
export function semaforoDePuntaje(pct) {
  if (pct >= 95) return 'DORADO';
  if (pct >= 80) return 'VERDE';
  if (pct >= 60) return 'AMARILLO';
  if (pct >= 50) return 'NARANJA';
  return 'ROJO';
}

// Color consistente por área (categoría transversal del ítem: Bromatología,
// Limpieza, Operación, etc.) - misma paleta en toda la app (ejecución de
// auditoría, historial) para que una categoría se reconozca siempre por el
// mismo color, tal como pide la spec. Un hash simple del nombre elige el
// color, así una plantilla nueva con áreas nuevas no necesita tocar código.
const PALETA_AREA = [
  { bg: 'bg-blue-100', texto: 'text-blue-700' },
  { bg: 'bg-emerald-100', texto: 'text-emerald-700' },
  { bg: 'bg-purple-100', texto: 'text-purple-700' },
  { bg: 'bg-amber-100', texto: 'text-amber-800' },
  { bg: 'bg-pink-100', texto: 'text-pink-700' },
  { bg: 'bg-cyan-100', texto: 'text-cyan-700' },
  { bg: 'bg-lime-100', texto: 'text-lime-800' },
  { bg: 'bg-indigo-100', texto: 'text-indigo-700' },
];

function hashTexto(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

export function colorPorArea(nombre) {
  if (!nombre) return PALETA_AREA[0];
  return PALETA_AREA[hashTexto(nombre) % PALETA_AREA.length];
}

export function EtiquetaArea({ nombre }) {
  if (!nombre) return null;
  const color = colorPorArea(nombre);
  return <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${color.bg} ${color.texto}`}>{nombre}</span>;
}

// tamaño: 'sm' (listados) | 'lg' (detalle) - controla el tamaño de fuente,
// el color sale siempre de `semaforo`.
export function Puntaje({ valor, semaforo, tamano = 'sm', className = '' }) {
  const tamanos = { sm: 'text-sm', lg: 'text-2xl' };
  if (valor == null) return <span className={`text-gray-400 ${tamanos[tamano]} ${className}`}>—</span>;
  const pct = Math.round(valor * 100);
  const color = SEMAFORO_COLOR_TEXTO[semaforo] || 'text-gray-700';
  return (
    <span className={`font-bold ${color} ${tamanos[tamano]} ${className}`}>
      {semaforo === 'DORADO' && '★ '}{pct}%
    </span>
  );
}

export function Resultado({ valor }) {
  if (!valor) return null;
  const ok = valor === 'APROBADA';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-fat-bordo-100 text-fat-bordo-700'}`}>
      {valor}
    </span>
  );
}

export function Cargando() {
  return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>;
}

// Botón "📷 Sacar foto" que abre la cámara del dispositivo directamente (sin
// opción de elegir de la galería) - capture="environment" fuerza la cámara
// trasera en los navegadores que lo soportan (mismo patrón que la evidencia
// de auditorías en Ejecucion.jsx). onArchivo(file) se llama al elegir/sacar
// una foto.
export function BotonCamara({ onArchivo, disabled, label = 'Sacar foto', archivo }) {
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer ${
      archivo ? 'border-green-400 text-green-700 bg-green-50' : 'border-gray-300 text-gray-600'
    } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      📷 {archivo ? 'Foto lista' : label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }}
      />
    </label>
  );
}

// Banco fijo de emojis para tipos de tarea y Evento especial (elegido por el
// usuario) - un solo ícono seleccionable por vez.
export const BANCO_EMOJIS = ['📈', '🗓️', '🛠️', '🖥️', '💵', '🎁', '🎉', '📝', '❤️', '❌', '‼️', '🔔', '🇦🇷', '⚽', '🏈', '🏆', '🍻', '🍔', '🍟', '🥩', '🍞', '🥐', '🥓', '🍫', '🥬', '🍅', '🧀', '☀️', '🌨️', '🐷', '🐔', '🤟', '🧹', '🛵'];

export function SelectorEmoji({ opciones = BANCO_EMOJIS, valor, onChange, label }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`w-8 h-8 rounded-lg border text-base flex items-center justify-center ${
              valor === emoji ? 'border-fat-bordo-500 bg-fat-bordo-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Dropdown de checkboxes - filtro/selector multi-sucursal, con "Todas las
// sucursales" como opción de otro nivel (separada del resto) que tilda/
// destilda todas las individuales de una. `seleccionadas` es tri-estado:
// null = todas las sucursales; un array (incluso vacío) = selección manual
// explícita, así "todas" y "ninguna elegida todavía" son estados distintos
// y se puede destildar "Todas" sin que sea un no-op. Compartido entre
// Calendario (filtro) y Tareas (filtro admin de historial).
export function SelectorSucursalesMultiple({ sucursales, seleccionadas, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function alClickAfuera(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, []);
  const todasTildadas = seleccionadas === null;
  function alternarTodas() {
    onChange(todasTildadas ? [] : null);
  }
  function alternar(id) {
    const base = todasTildadas ? sucursales.map((s) => s.id) : seleccionadas;
    onChange(base.includes(id) ? base.filter((v) => v !== id) : [...base, id]);
  }
  const etiqueta = todasTildadas
    ? 'Todas las sucursales'
    : seleccionadas.length === 0
      ? 'Ninguna sucursal'
      : sucursales.filter((s) => seleccionadas.includes(s.id)).map((s) => s.nombre).join(', ');
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-700 max-w-[220px] truncate">
        {etiqueta}
      </button>
      {abierto && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px]">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800 px-1 py-1.5 hover:bg-gray-50 rounded cursor-pointer border-b border-gray-100 mb-1">
            <input type="checkbox" checked={todasTildadas} onChange={alternarTodas} />
            Todas las sucursales
          </label>
          <div className="space-y-1">
            {sucursales.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 px-1 py-0.5 hover:bg-gray-50 rounded cursor-pointer">
                <input type="checkbox" checked={todasTildadas || seleccionadas.includes(s.id)} onChange={() => alternar(s.id)} />
                {s.nombre}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Íconos simplificados a partir del weather_code de Open-Meteo (WMO) -
// compartido entre Calendario y Gestionar turnos.
export function emojiClima(code) {
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 95) return '⛈️';
  return '';
}

// Selector de días (semana o mes) como círculos togglables - compartido
// entre la recurrencia de tareas (Calendario) y "Programar asignaciones"
// (GestionarTurnos). `opciones` acepta strings sueltos o {label, valor}.
export function SelectorDias({ opciones, seleccionados, onChange, chico }) {
  function alternar(valor) {
    onChange(seleccionados.includes(valor) ? seleccionados.filter((v) => v !== valor) : [...seleccionados, valor]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const valor = typeof o === 'object' ? o.valor : o;
        const label = typeof o === 'object' ? o.label : o;
        const activo = seleccionados.includes(valor);
        return (
          <button
            key={valor}
            type="button"
            onClick={() => alternar(valor)}
            className={`${chico ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'} rounded-full font-medium border ${
              activo ? 'bg-fat-bordo-500 text-white border-fat-bordo-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
