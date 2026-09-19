import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sucursales from './Sucursales';
import Usuarios from './Usuarios';
import TareasCatalogo from './TareasCatalogo';
import NotificacionPreferencias from './NotificacionPreferencias';
import Almacenamiento from './Almacenamiento';

// Agrupa Sucursales, Usuarios, el catálogo de tareas (solo Admin) y
// Notificaciones (cualquier rol - preferencias personales) - ver plan
// Calendario v2/v3. Reusa esos componentes tal cual, no están acoplados a
// su ruta anterior. La pestaña activa vive en la URL (/configuracion/:tab):
// el desplegable "Configuración" del menú lateral ya es la única
// navegación entre ellas, así que acá no se repite como pestañas.
export default function Configuracion() {
  const { usuario } = useAuth();
  const { tab } = useParams();
  const tabs = [];
  if (usuario.rol === 'ADMIN' || usuario.rol === 'GERENTE') {
    tabs.push({ key: 'sucursales', el: <Sucursales /> });
    tabs.push({ key: 'usuarios', el: <Usuarios /> });
    if (usuario.rol === 'ADMIN') tabs.push({ key: 'tareas', el: <TareasCatalogo /> });
    if (usuario.rol === 'ADMIN') tabs.push({ key: 'almacenamiento', el: <Almacenamiento /> });
  }
  tabs.push({ key: 'notificaciones', el: <NotificacionPreferencias /> });
  const activa = tabs.find((t) => t.key === tab) || tabs[0];

  return <div className="space-y-4">{activa.el}</div>;
}
