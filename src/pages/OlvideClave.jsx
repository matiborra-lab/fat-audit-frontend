import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AuthCard, Campo, Boton } from '../components/ui';

export default function OlvideClave() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await api.post('/api/auth/olvide-password', { email }, { auth: false });
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthCard titulo="Olvidé mi contraseña" subtitulo="Te mandamos un link para elegir una nueva">
      {enviado ? (
        <p className="text-sm text-gray-600 text-center">Si el mail existe, te va a llegar un link para restablecer la contraseña.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Campo label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
          <Boton type="submit" cargando={cargando}>Enviar link</Boton>
        </form>
      )}
      <p className="text-sm text-gray-500 text-center mt-4">
        <Link to="/login" className="hover:underline">Volver al login</Link>
      </p>
    </AuthCard>
  );
}
