import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../components/Onboarding';
import { Tarjeta, Boton } from '../components/ui';
import { categoriasParaRol } from '../data/ayudaContenido';

function Articulo({ articulo }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-800">{articulo.titulo}</span>
        <span className="text-gray-400 text-xs shrink-0">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <ol className="px-4 pb-4 space-y-1.5 list-decimal list-inside text-sm text-gray-600">
          {articulo.pasos.map((paso, i) => <li key={i}>{paso}</li>)}
        </ol>
      )}
    </div>
  );
}

function Categoria({ categoria }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <Tarjeta className="overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 font-medium text-gray-900">
          <span className="text-lg">{categoria.icono}</span> {categoria.titulo}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{abierta ? '▲ ocultar' : `▼ ${categoria.articulos.length} instructivo(s)`}</span>
      </button>
      {abierta && (
        <div className="border-t border-gray-100">
          {categoria.articulos.map((a) => <Articulo key={a.titulo} articulo={a} />)}
        </div>
      )}
    </Tarjeta>
  );
}

export default function CentroAyuda() {
  const { usuario } = useAuth();
  const { iniciarTour } = useOnboarding();
  const categorias = categoriasParaRol(usuario.rol);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Centro de ayuda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Instructivos paso a paso, filtrados según tu rol.</p>
        </div>
        <Boton ancho="w-auto" variante="secundario" onClick={iniciarTour}>Volver a ver el tutorial guiado</Boton>
      </div>

      <div className="space-y-3">
        {categorias.map((cat) => <Categoria key={cat.id} categoria={cat} />)}
      </div>
    </div>
  );
}
