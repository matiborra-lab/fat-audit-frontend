import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Select, Boton, Cargando } from '../components/ui';

const ROL_LABEL = { ADMIN: 'Admin', AUDITOR: 'Auditor', GERENTE: 'Gerente', COLABORADOR: 'Colaborador' };

// Buscador de responsables PRESENTES en la auditoría (puede ser mas de
// uno) - se arma la lista de nombres a partir de la gente de la sucursal,
// en vez de un campo de texto libre. Se sigue guardando como
// responsable_nombre (texto), uniendo los nombres elegidos con ", ".
function BuscadorResponsablesPresentes({ sucursalId, seleccionados, onChange }) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!sucursalId) { setOpciones([]); return; }
    const id = setTimeout(() => {
      const params = new URLSearchParams({ sucursal_id: sucursalId });
      if (texto) params.set('q', texto);
      api.get(`/api/usuarios/buscar?${params}`).then(setOpciones).catch(() => setOpciones([]));
    }, 250);
    return () => clearTimeout(id);
  }, [texto, sucursalId]);

  function agregar(u) {
    if (!seleccionados.some((s) => s.id === u.id)) onChange([...seleccionados, u]);
    setTexto('');
    setAbierto(false);
  }
  function quitar(id) {
    onChange(seleccionados.filter((s) => s.id !== id));
  }

  const opcionesFiltradas = opciones.filter((o) => !seleccionados.some((s) => s.id === o.id));

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">Responsables presentes (opcional)</label>
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {seleccionados.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 bg-fat-bordo-50 text-fat-bordo-700 text-xs font-medium pl-2 pr-1 py-1 rounded-full">
              {s.nombre || s.email}
              <button type="button" onClick={() => quitar(s.id)} className="hover:bg-fat-bordo-100 rounded-full w-4 h-4 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-fat-bordo-400"
        placeholder={sucursalId ? 'Buscar por nombre o email…' : 'Elegí primero una sucursal'}
        disabled={!sucursalId}
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {abierto && opcionesFiltradas.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {opcionesFiltradas.map((u) => (
            <button key={u.id} type="button" onMouseDown={() => agregar(u)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
              <span className="font-medium text-gray-900">{u.nombre || u.email}</span>
              <span className="text-xs text-gray-400 ml-1.5">{ROL_LABEL[u.rol]}{u.puesto ? ` · ${u.puesto}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Ejecutar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState(usuario.rol === 'GERENTE' ? usuario.sucursal_id : '');
  const [plantillas, setPlantillas] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [tipo, setTipo] = useState('INTERNA');
  const [responsables, setResponsables] = useState([]);
  const [error, setError] = useState('');
  const [iniciando, setIniciando] = useState(false);

  useEffect(() => {
    if (usuario.rol !== 'GERENTE') api.get('/api/sucursales').then(setSucursales);
  }, [usuario.rol]);

  useEffect(() => {
    setPlantillas(null);
    setTemplateId('');
    if (!sucursalId) return;
    api.get(`/api/runs/disponibles?sucursal_id=${sucursalId}`).then(setPlantillas);
  }, [sucursalId]);

  async function iniciar(e) {
    e.preventDefault();
    setError('');
    setIniciando(true);
    try {
      const responsable_nombre = responsables.map((r) => r.nombre || r.email).join(', ');
      const run = await api.post('/api/runs', { template_id: Number(templateId), sucursal_id: Number(sucursalId), tipo, responsable_nombre });
      navigate(`/ejecucion/${run.id}`);
    } catch (err) {
      setError(err.message);
      setIniciando(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Nueva auditoría</h1>
      <Tarjeta className="p-5">
        <form onSubmit={iniciar} className="space-y-4">
          {usuario.rol !== 'GERENTE' && (
            <Select label="Sucursal" required value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Elegí una sucursal</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          )}

          {sucursalId && !plantillas && <Cargando />}
          {plantillas && plantillas.length === 0 && <p className="text-sm text-gray-400">No hay plantillas publicadas habilitadas para esta sucursal.</p>}
          {plantillas && plantillas.length > 0 && (
            <Select label="Plantilla" required value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Elegí una plantilla</option>
              {plantillas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Select>
          )}

          <Select label="Tipo de auditoría" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="INTERNA">Interna</option>
            <option value="MARCA">De marca</option>
          </Select>

          <BuscadorResponsablesPresentes sucursalId={sucursalId} seleccionados={responsables} onChange={setResponsables} />

          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <Boton type="submit" disabled={!templateId} cargando={iniciando}>Comenzar auditoría</Boton>
        </form>
      </Tarjeta>
    </div>
  );
}
