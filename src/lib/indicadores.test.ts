import { describe, expect, it } from 'vitest';
import type { Historico, Registro } from '../../shared/schema.ts';
import { notarialHasta, periodosDisponibles, valorConVariacion } from './indicadores.ts';

const vacio: Omit<Registro, 'periodo'> = {
  ventasTotal: null,
  ventasNuevoLibre: null,
  ventasNuevoProtegido: null,
  ventasUsado: null,
  supTotal: null,
  supNuevoLibre: null,
  supNuevoProtegido: null,
  supUsado: null,
  precioTotal: null,
  precioNuevo: null,
  precioUsado: null,
  m2Total: null,
  m2Nuevo: null,
  m2Usado: null,
};

const h: Historico = {
  nivel: 'municipio',
  id: '17079',
  nombre: 'Girona',
  registradores: {
    T: [],
    '4T': [
      { ...vacio, periodo: '2025-T2', m2Total: 2500, m2Nuevo: null },
      { ...vacio, periodo: '2026-T1', m2Total: 2800 },
      { ...vacio, periodo: '2026-T2', m2Total: 2866.1, m2Nuevo: 3365.49 },
    ],
  },
  notarios: {
    T: [
      { periodo: '2025-T4', total: 434, nueva: 139, segundaMano: 295, provisional: false },
      { periodo: '2026-T1', total: 387, nueva: 100, segundaMano: 287, provisional: true },
    ],
    '4T': [],
  },
};

describe('valorConVariacion', () => {
  it('compare à la même fenêtre un an plus tôt', () => {
    const v = valorConVariacion(h, '4T', '2026-T2', 'm2Total');
    expect(v.periodoAnterior).toBe('2025-T2');
    expect(v.valor).toBe(2866.1);
    expect(v.variacion).toBeCloseTo(0.14644, 5);
  });

  it('ne calcule pas de variation si la valeur antérieure est secrète ou absente', () => {
    expect(valorConVariacion(h, '4T', '2026-T2', 'm2Nuevo').variacion).toBeNull();
    expect(valorConVariacion(h, '4T', '2026-T1', 'm2Total').variacion).toBeNull();
  });
});

describe('periodosDisponibles / notarialHasta', () => {
  it('trie du plus récent au plus ancien', () => {
    expect(periodosDisponibles(h, '4T')).toEqual(['2026-T2', '2026-T1', '2025-T2']);
  });

  it('prend la dernière donnée notariale publiée jusqu’à la période choisie', () => {
    expect(notarialHasta(h, 'T', '2026-T2')?.periodo).toBe('2026-T1');
    expect(notarialHasta(h, 'T', '2025-T4')?.periodo).toBe('2025-T4');
    expect(notarialHasta(h, 'T', '2020-T1')).toBeUndefined();
  });
});
