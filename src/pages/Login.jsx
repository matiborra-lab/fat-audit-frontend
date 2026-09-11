import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthCard, Campo, Boton } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(identificador, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthCard titulo="FAT Audit" subtitulo="Auditorías de sucursales FAT Burger">
      <form onSubmit={onSubmit} className="space-y-4">
        <Campo label="Usuario o email" type="text" required value={identificador} onChange={(e) => setIdentificador(e.target.value)} autoFocus />
        <Campo label="Contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={cargando}>Ingresar</Boton>
      </form>
      <p className="text-sm text-gray-500 text-center mt-4">
        <Link to="/olvide-clave" className="hover:underline">Olvidé mi contraseña</Link>
      </p>
    </AuthCard>
  );
}
