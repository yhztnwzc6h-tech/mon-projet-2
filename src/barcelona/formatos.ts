import { fmtEntero, fmtEuros, fmtEurosM2, fmtKEuros, fmtPct } from '../lib/format.ts';
import type { Indicador } from './modelo.ts';

export const FORMATO: Record<Indicador, (n: number) => string> = {
  m2: fmtEurosM2,
  precio: fmtEuros,
  ventas: fmtEntero,
  variacion: fmtPct,
};

/** Version courte pour la légende. */
export const FORMATO_CORTO: Record<Indicador, (n: number) => string> = {
  m2: (n) => fmtEntero(n),
  precio: fmtKEuros,
  ventas: fmtEntero,
  variacion: (n) => fmtPct(n).replace(',0', ''),
};
