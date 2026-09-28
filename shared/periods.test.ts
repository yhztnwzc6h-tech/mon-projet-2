import { describe, expect, it } from 'vitest';
import {
  addTrimestres,
  compareTrimestres,
  etiquetaPeriodo,
  isTrimestre,
  parseTrimestre,
  trimestreIndex,
} from './periods.ts';

describe('periods', () => {
  it('parse et valide le format AAAA-Tn', () => {
    expect(parseTrimestre('2026-T2')).toEqual({ year: 2026, q: 2 });
    expect(isTrimestre('2026-T5')).toBe(false);
    expect(isTrimestre('2026T2')).toBe(false);
    expect(() => parseTrimestre('2T26')).toThrow();
  });

  it('additionne des trimestres en changeant d’année', () => {
    expect(addTrimestres('2025-T4', 1)).toBe('2026-T1');
    expect(addTrimestres('2026-T2', -4)).toBe('2025-T2');
    expect(addTrimestres('2026-T1', -5)).toBe('2024-T4');
  });

  it('compare et trie', () => {
    expect(compareTrimestres('2025-T4', '2026-T1')).toBeLessThan(0);
    expect(trimestreIndex('2026-T2') - trimestreIndex('2025-T2')).toBe(4);
    expect(['2026-T1', '2013-T4', '2025-T3'].sort(compareTrimestres)).toEqual(['2013-T4', '2025-T3', '2026-T1']);
  });

  it('produit des libellés en espagnol', () => {
    expect(etiquetaPeriodo('2026-T2', 'T')).toBe('2T 2026');
    expect(etiquetaPeriodo('2026-T2', '4T')).toBe('jul 2025 – jun 2026');
    expect(etiquetaPeriodo('2025-T4', '4T')).toBe('ene 2025 – dic 2025');
    expect(etiquetaPeriodo('2026-T1', '4T')).toBe('abr 2025 – mar 2026');
  });
});
