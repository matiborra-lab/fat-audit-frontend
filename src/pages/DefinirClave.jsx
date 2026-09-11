import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthCard, Campo, Boton } from '../components/ui';

export default function DefinirClave() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { aplicarToken } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!token) { setError('El link no es válido.'); return; }
    setCargando(true);
    try {
      const data = await api.post('/api/auth/definir-password', { token, password }, { auth: false });
      aplicarToken(data.token, data.usuario);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthCard titulo="Elegí tu contraseña" subtitulo="Mínimo 8 caracteres">
      <form onSubmit={onSubmit} className="space-y-4">
        <Campo label="Contraseña nueva" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
        <Boton type="submit" cargando={cargando}>Confirmar</Boton>
      </form>
    </AuthCard>
  );
}
