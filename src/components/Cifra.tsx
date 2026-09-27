import type { ReactNode } from 'react';
import { fmtPct } from '../lib/format.ts';

interface Props {
  titulo: string;
  valor: number | null;
  formato: (n: number) => string;
  variacion?: number | null;
  /** Ex. « jul 2024 – jun 2025 ». */
  comparadoCon?: string;
  fuente: ReactNode;
  detalle?: ReactNode;
}

/** Chiffre clé avec sa variation sur un an, sa source et sa période. */
export function Cifra({ titulo, valor, formato, variacion, comparadoCon, fuente, detalle }: Props) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h3>
      {valor == null ? (
        <p className="text-lg font-medium text-slate-400 dark:text-slate-500">Sin datos suficientes</p>
      ) : (
        <p className="text-2xl font-semibold">{formato(valor)}</p>
      )}
      {variacion !== undefined && valor != null && (
        <p className="text-sm">
          {variacion == null ? (
            <span className="text-slate-500 dark:text-slate-400">Variación anual no disponible</span>
          ) : (
            <>
              <span
                className={
                  variacion > 0
                    ? 'font-medium text-sky-700 dark:text-sky-400'
                    : variacion < 0
                      ? 'font-medium text-amber-700 dark:text-amber-400'
                      : 'font-medium'
                }
              >
                {variacion > 0 ? '▲' : variacion < 0 ? '▼' : '■'} {fmtPct(variacion)}
              </span>{' '}
              <span className="text-slate-500 dark:text-slate-400">vs. {comparadoCon}</span>
            </>
          )}
        </p>
      )}
      {detalle && <div className="text-sm text-slate-600 dark:text-slate-300">{detalle}</div>}
      <p className="mt-auto pt-2 text-xs text-slate-500 dark:text-slate-400">{fuente}</p>
    </div>
  );
}
