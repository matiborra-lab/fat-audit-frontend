import { useState } from 'react';
import { api } from '../api/client';
import { Tarjeta, Boton, Leyenda } from '../components/ui';

// Prueba el almacenamiento de fotos/videos paso por paso (ver
// diagnosticar en src/storage del backend) - para saber qué falla cuando
// una foto no se sube o no se ve, sin tener que mirar los logs del server.
export default function Almacenamiento() {
  const [resultado, setResultado] = useState(null);
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState('');

  async function probar() {
    setProbando(true);
    setError('');
    try {
      setResultado(await api.get('/api/storage/diagnostico'));
    } catch (err) {
      setError(err.message);
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Almacenamiento de fotos</h1>
      <Leyenda>
        Comprueba que el servidor pueda guardar fotos y videos, que se puedan ver, y que la app pueda subirlos directo desde el celular.
        Deja y borra un archivo de prueba de 1 píxel.
      </Leyenda>
      <Boton ancho="w-auto" onClick={probar} cargando={probando}>Probar almacenamiento</Boton>
      {error && <p className="text-sm text-fat-bordo-600">{error}</p>}
      {resultado && (
        <Tarjeta className="divide-y divide-gray-100">
          {resultado.pasos.map((p, i) => (
            <div key={i} className="px-4 py-3">
              <p className={`text-sm font-medium ${p.ok ? 'text-green-700' : 'text-fat-bordo-600'}`}>{p.ok ? '✓' : '✗'} {p.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5 break-words">{p.detalle}</p>
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
