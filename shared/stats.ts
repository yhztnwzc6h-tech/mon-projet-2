/**
 * Calculs statistiques simples, partagés entre le pipeline et l'app.
 * Aucune fonction n'interpole : une entrée manquante donne une sortie `null`.
 */

/** Variation relative (0.05 = +5 %). `null` si l'une des valeurs manque ou si la base est nulle. */
export function variacion(actual: number | null | undefined, anterior: number | null | undefined): number | null {
  if (actual == null || anterior == null) return null;
  if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return actual / anterior - 1;
}

/**
 * Quantile par interpolation linéaire entre les rangs (méthode R-7, celle d'Excel
 * et de NumPy par défaut). `p` dans [0, 1]. Les valeurs non finies sont ignorées.
 */
export function quantile(values: readonly number[], p: number): number | null {
  if (p < 0 || p > 1) throw new RangeError('p doit être dans [0, 1]');
  const xs = values
    .filter(Number.isFinite)
    .slice()
    .sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const h = (xs.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return xs[lo]! + (xs[hi]! - xs[lo]!) * (h - lo);
}

/**
 * Bornes de classes par quantiles : renvoie `k - 1` seuils croissants et
 * dédoublonnés (moins de classes si beaucoup de valeurs identiques).
 */
export function cortesCuantiles(values: readonly number[], k: number): number[] {
  if (k < 2) throw new RangeError('k doit être ≥ 2');
  const out: number[] = [];
  for (let i = 1; i < k; i++) {
    const q = quantile(values, i / k);
    if (q != null && (out.length === 0 || q > out[out.length - 1]!)) out.push(q);
  }
  return out;
}

/** Indice de classe (0 … cortes.length) d'une valeur selon des seuils croissants. */
export function claseDe(value: number, cortes: readonly number[]): number {
  let i = 0;
  while (i < cortes.length && value >= cortes[i]!) i++;
  return i;
}
