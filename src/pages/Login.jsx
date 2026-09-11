import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Campo, Boton } from '../components/ui';

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ backgroundColor: '#54818B' }}>
      {/* Único recurso visual del login - sin texto ni rectángulo blanco detrás, tal como pide la spec. */}
      <img src="/brand/login-audit-fat.png" alt="FAT Audit" className="w-48 sm:w-56 h-auto mb-6 drop-shadow-lg" />
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Usuario o email" type="text" required value={identificador} onChange={(e) => setIdentificador(e.target.value)} autoFocus />
          <Campo label="Contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <Boton type="submit" cargando={cargando}>Ingresar</Boton>
        </form>
        <p className="text-sm text-gray-500 text-center mt-4">
          <Link to="/olvide-clave" className="hover:underline">Olvidé mi contraseña</Link>
        </p>
      </div>
    </div>
  );
}
