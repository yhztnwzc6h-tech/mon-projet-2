import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { leerLibro } from '../src/sources/habitatge/index.ts';
import { classifyHabitatgeUrl, extractLinks } from '../src/sources/habitatge/discover.ts';
import {
  aNumero,
  parseHojaMunicipal,
  parseHojaTerritorial,
  parsePeriodoTitulo,
  periodoDeHoja,
  type Filas,
  type FilaMunicipal,
  type FilaTerritorial,
  type HojaParseada,
} from '../src/sources/habitatge/parse.ts';

const FIX = path.resolve(import.meta.dirname, 'fixtures');
const libro = (n: string) => leerLibro(readFileSync(path.join(FIX, n)));
const hoja = (n: string, h: string) => {
  const x = libro(n).find((s) => s.nombre === h);
  if (!x) throw new Error(`feuille ${h} absente de ${n}`);
  return x;
};
function datos<F>(r: HojaParseada<F>) {
  if (r.tipo !== 'dato') throw new Error('feuille ignorée');
  return r;
}
const fila = (r: { filas: FilaMunicipal[] }, ine: string) => r.filas.find((f) => f.ine === ine)!;

describe('parsePeriodoTitulo', () => {
  it.each([
    ['Període: 4t. trimestre 2013', { tipo: 'dato', periodo: '2013-T4', ventana: 'T' }],
    ['Període: 1r. trimestre 2014', { tipo: 'dato', periodo: '2014-T1', ventana: 'T' }],
    ['Període: 2n. trimestre 2014', { tipo: 'dato', periodo: '2014-T2', ventana: 'T' }],
    ['Període: 4r. trimestre 2025', { tipo: 'dato', periodo: '2025-T4', ventana: 'T' }],
    ['Període: Any 2017', { tipo: 'dato', periodo: '2017-T4', ventana: '4T' }],
    ['Període: gener - desembre 2020', { tipo: 'dato', periodo: '2020-T4', ventana: '4T' }],
    ['Període: gener 2025 - desembre 2025', { tipo: 'dato', periodo: '2025-T4', ventana: '4T' }],
    ['Període: octubre 2014 - setembre 2015', { tipo: 'dato', periodo: '2015-T3', ventana: '4T' }],
    ['Període: abril 2016 - març 2017', { tipo: 'dato', periodo: '2017-T1', ventana: '4T' }],
    ['Juliol 2025- juny 2026', { tipo: 'dato', periodo: '2026-T2', ventana: '4T' }],
    ['Abril- juny 2026', { tipo: 'dato', periodo: '2026-T2', ventana: 'T' }],
    ['Gener- març 2026', { tipo: 'dato', periodo: '2026-T1', ventana: 'T' }],
    ['Període: Gener-setembre 2025', { tipo: 'acumulado-parcial' }],
    ['Gener- juny 2026', { tipo: 'acumulado-parcial' }],
  ])('%s', (texto, esperado) => {
    expect(parsePeriodoTitulo(texto)).toEqual(esperado);
  });

  it('ignore les textes qui ne sont pas des périodes', () => {
    expect(
      parsePeriodoTitulo("Compravendes d'habitatge registrades als municipis de més de 2.000 habitants"),
    ).toBeNull();
    expect(parsePeriodoTitulo('febrer - abril 2020')).toBeNull(); // pas aligné sur un trimestre
  });

  it('refuse une feuille dont le titre contredit le nom', () => {
    const filas: Filas = [['Període: 3r. trimestre 2024']];
    expect(() => periodoDeHoja('4t24', filas)).toThrow(/contredit/);
    expect(() => periodoDeHoja('4t24', [['sans titre']])).toThrow(/introuvable/);
  });
});

describe('aNumero', () => {
  it('lit nombres, « n.d. » et format catalan', () => {
    expect(aNumero(12.5)).toBe(12.5);
    expect(aNumero('n.d.')).toBeNull();
    expect(aNumero(null)).toBeNull();
    expect(aNumero('2004.11')).toBe(2004.11);
    expect(aNumero('1.234,5')).toBe(1234.5);
    expect(() => aNumero('abc')).toThrow(/inattendue/);
  });
});

describe('fichiers communaux réels', () => {
  it('2013 (XLS, communes > 5 000 hab.) : Girona 4T13', () => {
    const h = hoja('MUN_trimestral_2013.xls', '4t13');
    const r = datos(parseHojaMunicipal(h.nombre, h.filas));
    expect(r.periodo).toBe('2013-T4');
    expect(r.ventana).toBe('T');
    expect(r.filas.length).toBeGreaterThan(150);
    const g = fila(r, '17079');
    expect(g.nombre).toBe('Girona');
    expect(g.valores).toMatchObject({
      ventasTotal: 74,
      ventasNuevoLibre: 59,
      ventasNuevoProtegido: 3,
      ventasUsado: 12,
      supTotal: 90.84,
      precioNuevo: 134111, // 134,11144 milliers d'euros
      precioUsado: 102033,
      precioTotal: 129020,
    });
  });

  it('2013 : un prix à 0 avec moins de 3 ventes devient « non publié »', () => {
    const h = hoja('MUN_trimestral_2013.xls', '4t13');
    const agramunt = fila(datos(parseHojaMunicipal(h.nombre, h.filas)), '25003');
    expect(agramunt.valores.ventasTotal).toBe(1);
    expect(agramunt.valores.precioTotal).toBeNull();
    expect(agramunt.valores.m2Total).toBeNull();
    expect(agramunt.valores.supTotal).toBeNull();
  });

  it('2024 (XLSX) : Girona 2T24', () => {
    const h = hoja('MUN_trimestral_2024.xlsx', '2t24');
    const g = fila(datos(parseHojaMunicipal(h.nombre, h.filas)), '17079');
    expect(g.valores).toMatchObject({
      ventasTotal: 384,
      ventasNuevoLibre: 173,
      ventasNuevoProtegido: 9,
      ventasUsado: 202,
      supNuevoProtegido: 62.5,
      precioTotal: 233996,
    });
  });

  it('2026 (colonnes vides et min/max) : Girona, 4 trimestres glissants 3T25–2T26', () => {
    const hojas = JSON.parse(readFileSync(path.join(FIX, 'Trimestrals_per_municipis_2026.extracto.json'), 'utf8')) as {
      nombre: string;
      filas: Filas;
    }[];
    const h = hojas.find((x) => x.nombre === '2t26acum_1any')!;
    const r = datos(parseHojaMunicipal(h.nombre, h.filas));
    expect(r.periodo).toBe('2026-T2');
    expect(r.ventana).toBe('4T');
    expect(fila(r, '17079').valores).toEqual({
      ventasTotal: 1402,
      ventasNuevoLibre: 452,
      ventasNuevoProtegido: 56,
      ventasUsado: 894,
      supTotal: 84.47,
      supNuevoLibre: 83.62,
      supNuevoProtegido: 80.64,
      supUsado: 85.16,
      precioTotal: 238637,
      precioNuevo: 276365,
      precioUsado: 216515,
      m2Total: 2866.1,
      m2Nuevo: 3365.49,
      m2Usado: 2573.28,
    });
    // « n.d. » (neuf libre : 1 vente) → null
    expect(fila(r, '25007').valores.m2Nuevo).not.toBeNull(); // Albatàrrec : 12 ventes neuves
    const hT = hojas.find((x) => x.nombre === '2t26')!;
    const aitona = fila(datos(parseHojaMunicipal(hT.nombre, hT.filas)), '25038');
    expect(aitona.valores.ventasTotal).toBe(1);
    expect(aitona.valores.m2Usado).toBeNull();
    expect(aitona.valores.m2Total).toBeNull();
  });

  it('ignore les cumuls depuis janvier', () => {
    const hojas = JSON.parse(readFileSync(path.join(FIX, 'Trimestrals_per_municipis_2026.extracto.json'), 'utf8')) as {
      nombre: string;
      filas: Filas;
    }[];
    const h = hojas.find((x) => x.nombre === '2t26_acum')!;
    expect(parseHojaMunicipal(h.nombre, h.filas)).toEqual({ tipo: 'acumulado-parcial' });
  });
});

describe('fichiers territoriaux réels', () => {
  const buscar = (filas: FilaTerritorial[], seccion: string, nombre: string) =>
    filas.find((f) => f.seccion === seccion && f.nombre === nombre)!;

  it('2024, 4 trimestres glissants : comarque, province, Catalogne', () => {
    const h = hoja('TERR_acum1any_2024.xlsx', '4t24acum_1any');
    const r = datos(parseHojaTerritorial(h.nombre, h.filas));
    expect(r.periodo).toBe('2024-T4');
    expect(r.ventana).toBe('4T');
    expect(r.filas.filter((f) => f.seccion === 'comarca').length).toBeGreaterThanOrEqual(42);
    expect(buscar(r.filas, 'comarca', 'Gironès').valores.ventasTotal).toBe(2384);
    expect(buscar(r.filas, 'comarca', "Val d'Aran").valores.ventasUsado).toBe(387);
    expect(buscar(r.filas, 'provincia', 'Girona').valores.ventasTotal).toBe(13470);
    // « Comarques gironines » est un àmbit, pas un en-tête de section.
    expect(buscar(r.filas, 'ambito', 'Comarques gironines')).toBeDefined();
    expect(buscar(r.filas, 'catalunya', 'Catalunya').valores).toMatchObject({
      ventasTotal: 98108,
      precioTotal: 227617,
    });
  });

  it('2026 (nouvelle mise en page) : Gironès, province de Girona, Catalogne', () => {
    const h = hoja('Trimestrals_per_ambits_2026.xlsx', '2t26acum_1any');
    const r = datos(parseHojaTerritorial(h.nombre, h.filas));
    expect(r.periodo).toBe('2026-T2');
    expect(buscar(r.filas, 'comarca', 'Gironès').valores).toMatchObject({
      ventasTotal: 2475,
      m2Nuevo: 2863.99,
      m2Usado: 2166.95,
      m2Total: 2435.33,
    });
    expect(buscar(r.filas, 'provincia', 'Girona').valores.m2Total).toBe(2612.46);
    expect(buscar(r.filas, 'catalunya', 'Catalunya').valores).toMatchObject({
      ventasTotal: 111035,
      m2Total: 2848.63,
    });
    // L'AMB précède la section « Comarques » : elle n'est rattachée à aucun niveau utilisé.
    expect(r.filas[0]!.seccion).toBeNull();
  });
});

describe('découverte des fichiers', () => {
  it('classe les noms de fichiers de toutes les époques', () => {
    const base = 'https://habitatge.gencat.cat/web/x/';
    expect(classifyHabitatgeUrl(`${base}2013/MUN_trimestral_2013.xls`)).toMatchObject({
      year: 2013,
      scope: 'municipis',
      kind: 'trimestral',
    });
    expect(classifyHabitatgeUrl(`${base}2024/MUN_acum1any_2024.xlsx`)).toMatchObject({ kind: 'acum1any' });
    expect(classifyHabitatgeUrl(`${base}2026/Trimestrals_per_ambits_2026.xlsx`)).toMatchObject({
      scope: 'territori',
      year: 2026,
    });
    expect(classifyHabitatgeUrl(`${base}2024/MUN_COM_nou_1t24.xlsx`)).toBeNull();
  });

  it('extrait des liens relatifs', () => {
    const html = '<a href="/web/.content/a/MUN_anual_2014.xls">x</a><a href="/doc.pdf">y</a>';
    expect(extractLinks(html, 'https://habitatge.gencat.cat')).toEqual([
      'https://habitatge.gencat.cat/web/.content/a/MUN_anual_2014.xls',
    ]);
  });
});
