import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAMPOS_REGISTRO, datosBarcelonaSchema } from '../../shared/schema.ts';
import { compactar } from '../src/build-barcelona.ts';
import { validarBarris } from '../src/sources/bcn/geometria.ts';
import { idEntidad, type EntidadBarcelona } from '../src/sources/habitatge/barcelona.ts';
import { leerLibro } from '../src/sources/habitatge/index.ts';
import { parseHojaBarcelona, type FilaBarcelona, type HojaParseada } from '../src/sources/habitatge/parse.ts';

const FIX = path.resolve(import.meta.dirname, 'fixtures');
const hoja = (archivo: string, nombre: string) => {
  const h = leerLibro(readFileSync(path.join(FIX, archivo))).find((x) => x.nombre === nombre);
  if (!h) throw new Error(`feuille ${nombre} absente`);
  return h;
};
function datos(r: HojaParseada<FilaBarcelona>) {
  if (r.tipo !== 'dato') throw new Error('feuille ignorée');
  return r;
}
const buscar = (r: { filas: FilaBarcelona[] }, nombre: string) => r.filas.find((f) => f.nombre === nombre)!;

describe('tableaux de Barcelone (fichiers officiels)', () => {
  it('2014 (XLS) : ville, 10 districtes, 73 barris', () => {
    const h = hoja('BCN_trimestral_2014.xls', '4t14');
    const r = datos(parseHojaBarcelona(h.nombre, h.filas));
    expect(r.periodo).toBe('2014-T4');
    expect(r.ventana).toBe('T');
    expect(buscar(r, 'Barcelona')).toMatchObject({ nivel: 'ciudad', codigo: null });
    expect(buscar(r, 'Barcelona').valores).toMatchObject({ ventasTotal: 2513, m2Total: 2801.89, m2Nuevo: 3171.29 });
    expect(buscar(r, 'Eixample')).toMatchObject({ nivel: 'distrito', codigo: 2 });
    const raval = buscar(r, 'el Raval');
    expect(raval).toMatchObject({ nivel: 'barrio', codigo: 1 });
    // 7 ventes neuves mais prix publié à 0 : non publié, jamais 0.
    expect(raval.valores.ventasNuevoLibre).toBe(7);
    expect(raval.valores.m2Nuevo).toBeNull();
    expect(raval.valores.m2Usado).toBe(2706.77);
  });

  it('2024, 4 trimestres glissants : secret statistique appliqué', () => {
    const h = hoja('BCN_acum1any_2024.xlsx', '4t24acum_1any');
    const r = datos(parseHojaBarcelona(h.nombre, h.filas));
    expect(r).toMatchObject({ periodo: '2024-T4', ventana: '4T' });
    expect(buscar(r, 'Eixample').valores).toMatchObject({ ventasTotal: 2679, m2Total: 5410.44, precioTotal: 507511 });
    const pedralbes = buscar(r, 'Pedralbes').valores;
    expect(pedralbes.m2Usado).toBe(6786.15);
    // 1 seule vente neuve : la surface publiée est masquée par la règle des 3 ventes.
    expect(pedralbes.ventasNuevoLibre).toBe(1);
    expect(pedralbes.supNuevoLibre).toBeNull();
    expect(buscar(r, 'la Clota').valores.m2Usado).toBeNull();
  });

  it('2026 (nouvelle mise en page)', () => {
    const h = hoja('Trimestrals_Barcelona_2026.xlsx', '2t26acum_1any');
    const r = datos(parseHojaBarcelona(h.nombre, h.filas));
    expect(r).toMatchObject({ periodo: '2026-T2', ventana: '4T' });
    expect(buscar(r, 'Pedralbes').valores).toMatchObject({ ventasTotal: 115, m2Total: 7787.6, m2Usado: 7795.9 });
    // Baró de Viver : 33 ventes, prix non publié par la source.
    expect(buscar(r, 'Baró de Viver').valores).toMatchObject({ ventasTotal: 33, m2Total: null, precioTotal: null });
  });

  it('refuse une feuille incomplète', () => {
    const h = hoja('BCN_acum1any_2024.xlsx', '4t24acum_1any');
    const recortada = h.filas.filter((f) => f[1] !== 'Pedralbes');
    expect(() => parseHojaBarcelona(h.nombre, recortada)).toThrow(/72/);
  });
});

describe('compactar', () => {
  it('aligne toutes les entités sur une liste de périodes commune', () => {
    const vacio = Object.fromEntries(CAMPOS_REGISTRO.map((c) => [c, null])) as Record<
      (typeof CAMPOS_REGISTRO)[number],
      null
    >;
    const entidades = new Map<string, EntidadBarcelona>();
    const add = (nivel: EntidadBarcelona['nivel'], codigo: number | null, periodos: string[]) => {
      const id = idEntidad(nivel, codigo);
      const series = { T: new Map(), '4T': new Map() } as EntidadBarcelona['series'];
      for (const p of periodos) series['4T'].set(p, { periodo: p, ...vacio, m2Total: 1000 });
      entidades.set(id, { id, nivel, codigo, nombre: id, series });
    };
    add('ciudad', null, ['2025-T4', '2026-T1']);
    for (let d = 1; d <= 10; d++) add('distrito', d, ['2026-T1']);
    for (let b = 1; b <= 73; b++) add('barrio', b, b === 1 ? ['2025-T4'] : ['2026-T1']);
    const distritoDe = new Map([...Array(73)].map((_, i) => [idEntidad('barrio', i + 1), 'd01']));
    const d = compactar({ entidades }, distritoDe);
    expect(datosBarcelonaSchema.safeParse(d).success).toBe(true);
    expect(d.periodos['4T']).toEqual(['2025-T4', '2026-T1']);
    expect(d.entidades[0]!.id).toBe('bcn');
    expect(d.entidades[11]).toMatchObject({ id: 'b01', distrito: 'd01' });
    expect(d.valores['4T'].b01![1]).toBeNull(); // pas de ligne publiée pour 2026-T1
    expect(d.valores['4T'].b01![0]![CAMPOS_REGISTRO.indexOf('m2Total')]).toBe(1000);
  });
});

describe('validarBarris', () => {
  const carre = (x: number, y: number) => [
    [
      [x, y],
      [x + 0.001, y],
      [x + 0.001, y + 0.001],
      [x, y],
    ],
  ];
  const coleccion = (n: number, distritos = 10) => ({
    type: 'FeatureCollection',
    features: Array.from({ length: n }, (_, i) => ({
      type: 'Feature',
      properties: {
        BARRI: String(i + 1).padStart(2, '0'),
        DISTRICTE: String((i % distritos) + 1).padStart(2, '0'),
        NOM: `Barri ${i + 1}`,
        TIPUS_UA: 'BARRI',
      },
      geometry: { type: 'Polygon', coordinates: carre(2.1 + i * 0.001, 41.4) },
    })),
  });

  it('accepte 73 barris en 10 districtes', () => {
    expect(validarBarris(JSON.stringify(coleccion(73))).features).toHaveLength(73);
  });

  it('refuse un fichier incomplet ou dans un autre système de coordonnées', () => {
    expect(() => validarBarris(JSON.stringify(coleccion(72)))).toThrow(/codes/);
    expect(() => validarBarris(JSON.stringify(coleccion(73, 9)))).toThrow(/districtes/);
    const utm = coleccion(73);
    utm.features[0]!.geometry.coordinates = carre(430000, 4580000);
    expect(() => validarBarris(JSON.stringify(utm))).toThrow(/coordonnées/);
  });
});
