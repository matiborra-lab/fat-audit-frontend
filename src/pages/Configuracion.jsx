import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Sucursales from './Sucursales';
import Usuarios from './Usuarios';

// Pantalla que agrupa Sucursales y Usuarios (y, más adelante, el catálogo de
// tareas) en pestañas - ver plan Calendario v2. Reusa esos componentes tal
// cual, no están acoplados a su ruta anterior.
export default function Configuracion() {
  const { usuario } = useAuth();
  const tabs = [
    { key: 'sucursales', label: 'Sucursales', el: <Sucursales /> },
    { key: 'usuarios', label: usuario.rol === 'GERENTE' ? 'Colaboradores' : 'Usuarios', el: <Usuarios /> },
  ];
  const [tab, setTab] = useState(tabs[0].key);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-fat-bordo-500 text-fat-bordo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === tab)?.el}
    </div>
  );
}
