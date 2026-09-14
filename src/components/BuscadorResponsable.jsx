import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const ROL_LABEL = { ADMIN: 'Admin', AUDITOR: 'Auditor', GERENTE: 'Gerente', COLABORADOR: 'Colaborador' };

// Buscador de responsables: lista gente de la sucursal (Gerente +
// Colaboradores) mas Admin/Auditor - usado en el constructor de eventos del
// calendario y al ejecutar una auditoría, en vez de un campo de texto libre.
// advertenciaPorUsuario: Map opcional usuario_id -> texto ("Con licencia
// otorgada") - si está presente para un candidato, su nombre se muestra en
// rojo con esa aclaración al lado (no lo bloquea, solo avisa - ver
// Gestionar turnos).
export default function BuscadorResponsable({ sucursalId, todasLasSucursales = false, value, nombreValue, onChange, label = 'Responsable', required = false, advertenciaPorUsuario }) {
  const [texto, setTexto] = useState(nombreValue || '');
  const [opciones, setOpciones] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const puedeBuscar = todasLasSucursales || !!sucursalId;

  useEffect(() => {
    setTexto(nombreValue || '');
  }, [nombreValue]);

  useEffect(() => {
    if (!puedeBuscar) { setOpciones([]); return; }
    const id = setTimeout(() => {
      const params = new URLSearchParams(todasLasSucursales ? { todas: 'true' } : { sucursal_id: sucursalId });
      if (texto) params.set('q', texto);
      api.get(`/api/usuarios/buscar?${params}`).then(setOpciones).catch(() => setOpciones([]));
    }, 250);
    return () => clearTimeout(id);
  }, [texto, sucursalId, todasLasSucursales]);

  useEffect(() => {
    function alClickAfuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', alClickAfuera);
    return () => document.removeEventListener('mousedown', alClickAfuera);
  }, []);

  function elegir(u) {
    setTexto(u.nombre || u.email);
    setAbierto(false);
    onChange(u.id, u);
  }

  return (
    <div ref={contenedorRef} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
        placeholder={puedeBuscar ? 'Buscar por nombre o email…' : 'Elegí primero una sucursal'}
        disabled={!puedeBuscar}
        required={required}
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); if (value) onChange('', null); }}
        onFocus={() => setAbierto(true)}
      />
      {abierto && opciones.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {opciones.map((u) => {
            const advertencia = advertenciaPorUsuario?.get(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => elegir(u)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
              >
                <span className={`font-medium ${advertencia ? 'text-fat-bordo-600' : 'text-gray-900'}`}>{u.nombre || u.email}</span>
                <span className="text-xs text-gray-400 ml-1.5">
                  {ROL_LABEL[u.rol]}{u.puesto ? ` · ${u.puesto}` : ''}{u.sucursal_nombre ? ` · ${u.sucursal_nombre}` : ''}
                </span>
                {advertencia && <span className="block text-xs text-fat-bordo-600 font-medium mt-0.5">⚠ {advertencia}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
