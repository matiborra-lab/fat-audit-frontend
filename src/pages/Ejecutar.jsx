import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tarjeta, Campo, Select, Boton, Cargando } from '../components/ui';

export default function Ejecutar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState(usuario.rol === 'GERENTE' ? usuario.sucursal_id : '');
  const [plantillas, setPlantillas] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [tipo, setTipo] = useState('INTERNA');
  const [responsable, setResponsable] = useState('');
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
      const run = await api.post('/api/runs', { template_id: Number(templateId), sucursal_id: Number(sucursalId), tipo, responsable_nombre: responsable });
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

          <Campo label="Responsable / turno auditado (opcional)" value={responsable} onChange={(e) => setResponsable(e.target.value)} />

          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <Boton type="submit" disabled={!templateId} cargando={iniciando}>Comenzar auditoría</Boton>
        </form>
      </Tarjeta>
    </div>
  );
}
