import { useEffect } from 'react';
import { etiquetaPeriodo, type Ventana } from '../../shared/periods.ts';

interface Props {
  periodos: string[];
  indice: number;
  ventana: Ventana;
  reproduciendo: boolean;
  onIndice: (i: number) => void;
  onReproducir: (v: boolean) => void;
  onVentana: (v: Ventana) => void;
}

const PASO_MS = 850;

/** Frise temporelle : curseur des trimestres, lecture animée, choix de la fenêtre. */
export function LineaTiempo({ periodos, indice, ventana, reproduciendo, onIndice, onReproducir, onVentana }: Props) {
  useEffect(() => {
    if (!reproduciendo) return;
    const t = setTimeout(() => {
      if (indice >= periodos.length - 1) onReproducir(false);
      else onIndice(indice + 1);
    }, PASO_MS);
    return () => clearTimeout(t);
  }, [reproduciendo, indice, periodos.length, onIndice, onReproducir]);

  const periodo = periodos[indice]!;
  const anios = [...new Set(periodos.map((p) => p.slice(0, 4)))];

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          if (!reproduciendo && indice >= periodos.length - 1) onIndice(0);
          onReproducir(!reproduciendo);
        }}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--acento)] text-[var(--sobre-acento)] shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]"
        aria-label={reproduciendo ? 'Pausar la animación' : 'Reproducir la evolución desde 2013'}
      >
        {reproduciendo ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold tabular-nums" aria-live="polite">
            {etiquetaPeriodo(periodo, ventana)}
          </p>
          <div
            className="flex shrink-0 rounded-full bg-[var(--hover)] p-0.5 text-xs"
            role="radiogroup"
            aria-label="Periodo"
          >
            {(['4T', 'T'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={ventana === v}
                onClick={() => onVentana(v)}
                className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                  ventana === v ? 'bg-[var(--panel-fuerte)] shadow' : 'text-[var(--tinta-suave)]'
                }`}
              >
                {v === '4T' ? '12 meses' : 'Trimestre'}
              </button>
            ))}
          </div>
        </div>
        <input
          id="periodo"
          type="range"
          min={0}
          max={periodos.length - 1}
          value={indice}
          onChange={(e) => {
            onReproducir(false);
            onIndice(Number(e.target.value));
          }}
          aria-label="Periodo"
          aria-valuetext={etiquetaPeriodo(periodo, ventana)}
          className="mt-1 w-full accent-[var(--acento)]"
        />
        <div className="relative h-3 text-[10px] text-[var(--tinta-suave)]" aria-hidden="true">
          {anios
            .filter((_, i) => i % 2 === 0)
            .map((a) => {
              const j = periodos.findIndex((p) => p.startsWith(a));
              return (
                <span
                  key={a}
                  className="absolute -translate-x-1/2 tabular-nums"
                  style={{ left: `${(j / Math.max(1, periodos.length - 1)) * 100}%` }}
                >
                  {a}
                </span>
              );
            })}
        </div>
      </div>
    </div>
  );
}
