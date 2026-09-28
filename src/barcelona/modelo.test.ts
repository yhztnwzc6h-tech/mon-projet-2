import { describe, expect, it } from 'vitest';
import { CAMPOS_REGISTRO, type DatosBarcelona } from '../../shared/schema.ts';
import { alturaNormalizada, colorDe, crearEscala } from './escala.ts';
import { zonaEnPunto } from './geo.ts';
import { Modelo } from './modelo.ts';

const fila = (m2Total: number | null, ventasTotal: number | null) =>
  CAMPOS_REGISTRO.map((c) => (c === 'm2Total' ? m2Total : c === 'ventasTotal' ? ventasTotal : null));

function datos(): DatosBarcelona {
  const entidades: DatosBarcelona['entidades'] = [
    { id: 'bcn', nivel: 'ciudad', codigo: null, nombre: 'Barcelona' },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `d${String(i + 1).padStart(2, '0')}`,
      nivel: 'distrito' as const,
      codigo: i + 1,
      nombre: `Distrito ${i + 1}`,
    })),
    ...Array.from({ length: 73 }, (_, i) => ({
      id: `b${String(i + 1).padStart(2, '0')}`,
      nivel: 'barrio' as const,
      codigo: i + 1,
      nombre: `Barrio ${i + 1}`,
      distrito: 'd01',
    })),
  ];
  const periodos = ['2025-T1', '2025-T2', '2026-T1', '2026-T2'];
  const valores: DatosBarcelona['valores'] = { T: {}, '4T': {} };
  for (const e of entidades) valores['4T'][e.id] = periodos.map(() => fila(null, null));
  valores['4T'].b01 = [fila(4000, 50), fila(5000, 60), fila(4400, 55), fila(5500, 70)];
  valores['4T'].b02 = [fila(3000, 20), fila(3000, 2), fila(3300, 25), fila(null, 2)];
  valores['4T'].b03 = [null, null, null, fila(6000, 90)];
  return { campos: [...CAMPOS_REGISTRO], periodos: { T: [], '4T': periodos }, entidades, valores };
}

describe('Modelo', () => {
  const m = new Modelo(datos());

  it('lit une valeur publiée et renvoie null sinon', () => {
    expect(m.valor('b01', '4T', 3, 'm2Total')).toBe(5500);
    expect(m.valor('b02', '4T', 3, 'm2Total')).toBeNull();
    expect(m.valor('b03', '4T', 0, 'm2Total')).toBeNull(); // pas de ligne
  });

  it('trouve la même période un an plus tôt, même avec des trous', () => {
    expect(m.indiceAnioAnterior('4T', 3)).toBe(1); // 2026-T2 → 2025-T2
    expect(m.indiceAnioAnterior('4T', 1)).toBeNull(); // 2024-T2 absent
  });

  it('calcule la variation annuelle sans interpoler', () => {
    expect(m.indicador('b01', 'variacion', 'total', '4T', 3)).toBeCloseTo(0.1, 10);
    expect(m.indicador('b02', 'variacion', 'total', '4T', 3)).toBeNull();
    expect(m.indicador('b03', 'variacion', 'total', '4T', 3)).toBeNull();
  });

  it('classe les barris avec une valeur publiée', () => {
    expect(m.rango('b03', 'm2', 'total', '4T', 3)).toEqual({ rango: 1, total: 2 });
    expect(m.rango('b01', 'm2', 'total', '4T', 3)).toEqual({ rango: 2, total: 2 });
    expect(m.rango('b02', 'm2', 'total', '4T', 3)).toBeNull();
  });

  it('rassemble toutes les valeurs pour une échelle stable', () => {
    expect(m.todosLosValores('m2', 'total', '4T', 'barrio').sort()).toEqual([
      3000, 3000, 3300, 4000, 4400, 5000, 5500, 6000,
    ]);
  });
});

describe('escala', () => {
  it('magnitude : 6 classes, hauteur linéaire bornée', () => {
    const vals = Array.from({ length: 60 }, (_, i) => 2000 + i * 100);
    const e = crearEscala('m2', vals, vals, false);
    expect(e.cortes).toHaveLength(5);
    expect(e.colores).toHaveLength(6);
    expect(colorDe(e, 1000)).toBe(e.colores[0]);
    expect(colorDe(e, 99999)).toBe(e.colores[5]);
    expect(alturaNormalizada(e, 2000)).toBe(0);
    expect(alturaNormalizada(e, 7900)).toBe(1);
    expect(alturaNormalizada(e, 99999)).toBe(1);
  });

  it('variation : divergente, gris autour de zéro', () => {
    const e = crearEscala('variacion', [], [], false);
    expect(e.divergente).toBe(true);
    expect(colorDe(e, 0)).toBe(e.colores[3]);
    expect(colorDe(e, -0.2)).toBe(e.colores[0]);
    expect(colorDe(e, 0.2)).toBe(e.colores[6]);
    expect(alturaNormalizada(e, -0.25)).toBe(1);
  });
});

describe('zonaEnPunto', () => {
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'b01' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
              [0, 0],
            ],
            [
              [1, 1],
              [2, 1],
              [2, 2],
              [1, 2],
              [1, 1],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { id: 'b02' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [10, 10],
                [12, 10],
                [12, 12],
                [10, 12],
                [10, 10],
              ],
            ],
          ],
        },
      },
    ],
  };
  it('trouve le barri contenant un point, en tenant compte des trous', () => {
    expect(zonaEnPunto(fc, 3, 3)).toBe('b01');
    expect(zonaEnPunto(fc, 1.5, 1.5)).toBeNull();
    expect(zonaEnPunto(fc, 11, 11)).toBe('b02');
    expect(zonaEnPunto(fc, 50, 50)).toBeNull();
  });
});
