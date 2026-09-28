/**
 * Périodes statistiques.
 *
 * Un trimestre est identifié par `AAAA-Tn` (ex. `2026-T2`).
 * Une donnée porte aussi une « fenêtre » :
 * - `T`  : le trimestre seul ;
 * - `4T` : les 4 trimestres glissants se terminant par ce trimestre
 *          (ex. `2026-T2` + `4T` = juillet 2025 – juin 2026).
 */
export type Ventana = 'T' | '4T';

export interface Trimestre {
  year: number;
  q: 1 | 2 | 3 | 4;
}

const RE_TRIMESTRE = /^(\d{4})-T([1-4])$/;

export function formatTrimestre(t: Trimestre): string {
  return `${t.year}-T${t.q}`;
}

export function parseTrimestre(s: string): Trimestre {
  const m = RE_TRIMESTRE.exec(s);
  if (!m) throw new Error(`Période invalide : « ${s} » (attendu AAAA-Tn)`);
  return { year: Number(m[1]), q: Number(m[2]) as Trimestre['q'] };
}

export function isTrimestre(s: string): boolean {
  return RE_TRIMESTRE.test(s);
}

/** Index croissant (utile pour trier et calculer des écarts). */
export function trimestreIndex(s: string): number {
  const t = parseTrimestre(s);
  return t.year * 4 + (t.q - 1);
}

export function fromIndex(i: number): string {
  return formatTrimestre({ year: Math.floor(i / 4), q: ((i % 4) + 1) as Trimestre['q'] });
}

export function addTrimestres(s: string, n: number): string {
  return fromIndex(trimestreIndex(s) + n);
}

export function compareTrimestres(a: string, b: string): number {
  return trimestreIndex(a) - trimestreIndex(b);
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Libellé lisible en espagnol : « 2T 2026 » ou « jul 2025 – jun 2026 ». */
export function etiquetaPeriodo(periodo: string, ventana: Ventana): string {
  const t = parseTrimestre(periodo);
  if (ventana === 'T') return `${t.q}T ${t.year}`;
  const fin = t.q * 3; // mois de fin (1-12)
  const inicioIdx = trimestreIndex(periodo) - 3;
  const ini = fromIndex(inicioIdx);
  const ti = parseTrimestre(ini);
  const mesIni = (ti.q - 1) * 3; // 0-based
  return `${MESES_CORTOS[mesIni]} ${ti.year} – ${MESES_CORTOS[fin - 1]} ${t.year}`;
}
