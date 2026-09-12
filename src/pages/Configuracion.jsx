import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sucursales from './Sucursales';
import Usuarios from './Usuarios';
import TareasCatalogo from './TareasCatalogo';

// Pantalla que agrupa Sucursales, Usuarios y (solo Admin) el catálogo de
// tareas en pestañas - ver plan Calendario v2/v3. Reusa esos componentes tal
// cual, no están acoplados a su ruta anterior. La pestaña activa vive en la
// URL (/configuracion/:tab) para que el desplegable "Configuración" del
// menú pueda linkear directo a cada una.
export default function Configuracion() {
  const { usuario } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();
  const tabs = [
    { key: 'sucursales', label: 'Sucursales', el: <Sucursales /> },
    { key: 'usuarios', label: usuario.rol === 'GERENTE' ? 'Colaboradores' : 'Usuarios', el: <Usuarios /> },
  ];
  if (usuario.rol === 'ADMIN') tabs.push({ key: 'tareas', label: 'Tareas', el: <TareasCatalogo /> });
  const tabActiva = tabs.find((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/configuracion/${t.key}`)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tabActiva === t.key ? 'border-fat-bordo-500 text-fat-bordo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === tabActiva)?.el}
    </div>
  );
}
