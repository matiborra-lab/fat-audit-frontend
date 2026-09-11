import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, guardarToken, borrarToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarUsuario = useCallback(async () => {
    if (!localStorage.getItem('fataudit_token')) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const data = await api.get('/api/auth/yo');
      setUsuario(data);
    } catch {
      // El token dejo de ser valido sin pasar por logout() (vencio solo, o
      // un admin desactivo la cuenta / le cambio el rol).
      borrarToken();
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuario();
  }, [cargarUsuario]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password }, { auth: false });
    guardarToken(data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const aplicarToken = useCallback((token, usuarioData) => {
    guardarToken(token);
    setUsuario(usuarioData);
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    borrarToken();
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, aplicarToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
