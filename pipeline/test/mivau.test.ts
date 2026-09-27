import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Municipio, Notarial } from '../../shared/schema.ts';
import { parseMunicipis } from '../src/sources/idescat/municipios.ts';
import { emparejar, parseTablaMivau, sumar4T, type TablaMivau } from '../src/sources/mivau/transacciones.ts';

const FIX = path.resolve(import.meta.dirname, 'fixtures');
// L'extrait ne contient que quelques communes : pas de contrôle « ≈ 947 communes ».
const parseSinMinimo = (serie: string): TablaMivau =>
  parseTablaMivau(JSON.parse(readFileSync(path.join(FIX, `mivau-${serie}.extracto.json`), 'utf8')), {
    minMunicipios: 0,
  });

const municipios: Municipio[] = parseMunicipis(readFileSync(path.join(FIX, 'idescat-municipis.csv'), 'utf8'));

describe('MIVAU : structure du tableau', () => {
  const t = parseSinMinimo('total');

  it('associe chaque colonne à un trimestre, depuis 2004-T1', () => {
    expect(t.columnas[0]).toMatchObject({ periodo: '2004-T1', provisional: false });
    expect(t.columnas.at(-1)).toMatchObject({ periodo: '2026-T1', provisional: true });
    expect(t.columnas).toHaveLength(89);
  });

  it('ne garde que la Catalogne et rattache la bonne province', () => {
    const girona = t.filas.find((f) => f.nombre === 'Girona')!;
    expect(girona.provincia).toBe('17');
    expect(girona.valores.get('2004-T1')).toBe(388);
    expect(girona.valores.get('2026-T1')).toBe(387);
    expect(t.filas.some((f) => f.nombre === 'Abla')).toBe(false); // Andalousie
  });

  it("conserve les trimestres manquants d'une commune récente (la Canonja, 2010)", () => {
    const canonja = t.filas.find((f) => f.nombre === 'Canonja, La')!;
    expect(canonja.provincia).toBe('43');
    expect(canonja.valores.get('2004-T1')).toBeNull();
    expect(canonja.valores.get('2011-T1')).not.toBeNull();
  });

  it("ignore la valeur parasite de l'en-tête de province (tableau 2.3)", () => {
    const nueva = parseSinMinimo('nueva');
    const gironas = nueva.filas.filter((f) => f.nombre === 'Girona');
    expect(gironas).toHaveLength(1);
    expect(gironas[0]!.valores.get('2026-T1')).toBe(100);
  });
});

describe('MIVAU : appariement avec les codes Idescat', () => {
  it('apparie par nom normalisé et via les alias des communes renommées', () => {
    const t = parseSinMinimo('total');
    const { porIne, sinPareja } = emparejar(t.filas, municipios);
    expect(sinPareja).toEqual([]);
    expect(porIne.get('17079')!.nombre).toBe('Girona');
    expect(porIne.get('17034')!.nombre).toBe('Calonge'); // « Calonge i Sant Antoni » à l'Idescat
    expect(porIne.get('43907')!.nombre).toBe('Canonja, La');
    expect(porIne.get('08019')!.nombre).toBe('Barcelona');
  });
});

describe('sumar4T', () => {
  const s = (periodo: string, total: number | null, provisional = false): Notarial => ({
    periodo,
    total,
    nueva: total == null ? null : 1,
    segundaMano: total == null ? null : total - 1,
    provisional,
  });

  it('additionne exactement 4 trimestres', () => {
    const r = sumar4T([s('2025-T2', 398), s('2025-T3', 260), s('2025-T4', 434), s('2026-T1', 387, true)]);
    expect(r).toEqual([{ periodo: '2026-T1', total: 1479, nueva: 4, segundaMano: 1475, provisional: true }]);
  });

  it("n'estime rien quand un trimestre manque", () => {
    const r = sumar4T([s('2010-T4', null), s('2011-T1', 5), s('2011-T2', 6), s('2011-T3', 7), s('2011-T4', 8)]);
    expect(r.map((x) => x.total)).toEqual([null, 26]);
  });
});
