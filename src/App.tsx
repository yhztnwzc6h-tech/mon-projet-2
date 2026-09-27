import { FichaMunicipio } from './components/FichaMunicipio.tsx';

/** Étape 2 (prototype) : fiche de la commune test, Girona. */
const MUNICIPIO_PILOTO = '17079';

export function App() {
  return (
    <div className="min-h-dvh">
      <div
        role="note"
        className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 px-4 py-1.5 text-center text-xs text-slate-700 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300"
      >
        Datos agregados por zona — no son precios de venta individuales
      </div>
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Data Spain</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mercado de compraventa de vivienda · Catalunya</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <FichaMunicipio ine={MUNICIPIO_PILOTO} />
      </main>
    </div>
  );
}
