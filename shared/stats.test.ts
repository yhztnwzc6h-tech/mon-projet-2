import { describe, expect, it } from 'vitest';
import { claseDe, cortesCuantiles, quantile, variacion } from './stats.ts';

describe('variacion', () => {
  it('calcule une variation relative', () => {
    expect(variacion(2866.1, 2500)).toBeCloseTo(0.14644, 5);
    expect(variacion(90, 100)).toBeCloseTo(-0.1, 10);
  });

  it('renvoie null sans interpoler quand une valeur manque', () => {
    expect(variacion(null, 100)).toBeNull();
    expect(variacion(100, undefined)).toBeNull();
    expect(variacion(100, 0)).toBeNull();
    expect(variacion(Number.NaN, 100)).toBeNull();
  });
});

describe('quantile (méthode R-7, comme numpy.quantile)', () => {
  const xs = [1, 3, 2, 4, 10];

  it('donne les mêmes résultats que numpy', () => {
    // numpy.quantile([1,3,2,4,10], [0, .25, .5, .75, 1]) = [1, 2, 3, 4, 10]
    expect(quantile(xs, 0)).toBe(1);
    expect(quantile(xs, 0.25)).toBe(2);
    expect(quantile(xs, 0.5)).toBe(3);
    expect(quantile(xs, 0.75)).toBe(4);
    expect(quantile(xs, 1)).toBe(10);
    // numpy.quantile([1,2,3,4], 0.4) = 2.2
    expect(quantile([4, 3, 2, 1], 0.4)).toBeCloseTo(2.2, 10);
  });

  it('ignore les valeurs non finies et gère le vide', () => {
    expect(quantile([Number.NaN, 5, Infinity], 0.5)).toBe(5);
    expect(quantile([], 0.5)).toBeNull();
    expect(() => quantile(xs, 1.5)).toThrow();
  });
});

describe('cortesCuantiles / claseDe', () => {
  it('produit k-1 seuils croissants', () => {
    const valores = Array.from({ length: 100 }, (_, i) => i + 1);
    const cortes = cortesCuantiles(valores, 5);
    expect(cortes).toHaveLength(4);
    expect(cortes).toEqual([...cortes].sort((a, b) => a - b));
    expect(cortes[1]).toBeCloseTo(40.6, 10);
  });

  it('dédoublonne quand beaucoup de valeurs sont égales', () => {
    expect(cortesCuantiles([1, 1, 1, 1, 1, 1, 2], 4)).toEqual([1]);
  });

  it('affecte chaque valeur à sa classe', () => {
    const cortes = [10, 20, 30];
    expect(claseDe(5, cortes)).toBe(0);
    expect(claseDe(10, cortes)).toBe(1);
    expect(claseDe(29.9, cortes)).toBe(2);
    expect(claseDe(99, cortes)).toBe(3);
  });
});
