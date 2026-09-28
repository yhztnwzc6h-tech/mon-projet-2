// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDnprc, parseRccoor, urlSede } from './catastro.ts';

const FIX = path.resolve(import.meta.dirname, '../../pipeline/test/fixtures');
const leer = (n: string) => readFileSync(path.join(FIX, n), 'utf8');

describe('Catastro : réponses réelles enregistrées', () => {
  it('coordonnées → référence cadastrale (Pg. de Gràcia 43)', () => {
    expect(parseRccoor(leer('catastro-rccoor-pg-gracia-43.xml'))).toEqual({
      pc1: '0227802',
      pc2: 'DF3802E',
      direccion: 'PS GRACIA 43 BARCELONA (BARCELONA)',
    });
  });

  it('coordonnées sans parcelle : message du Catastro', () => {
    expect(() => parseRccoor(leer('catastro-rccoor-mar.xml'))).toThrow(/NO HAY REFERENCIA/);
  });

  it('un seul bien (bico)', () => {
    const r = parseDnprc(JSON.parse(leer('catastro-dnprc-bico.json')));
    expect(r.total).toBe(1);
    expect(r.unidades[0]).toMatchObject({ referencia: '0227802DF3802E0001WX', superficie: 4165, anio: 2017 });
  });

  it('plusieurs biens (lrcdnp) : usage, surface, année, étage', () => {
    const r = parseDnprc(JSON.parse(leer('catastro-dnprc-lista.json')));
    expect(r.unidades.length).toBeGreaterThan(1);
    expect(r.total).toBe(r.unidades.length);
    expect(r.unidades[0]).toMatchObject({
      referencia: '5381917DG8458A0001YW',
      uso: 'Almacen-Estacionamiento',
      superficie: 20,
      anio: 1988,
    });
    expect(r.unidades[0]!.ubicacion).toContain('Planta -2');
  });

  it('lien vers la fiche officielle', () => {
    expect(urlSede('0227802', 'DF3802E')).toBe(
      'https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=0227802&rc2=DF3802E',
    );
  });
});
