import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizarNombre } from '../src/names.ts';
import { parseMunicipis } from '../src/sources/idescat/municipios.ts';
import { crearResolutor } from '../src/territorios.ts';

const municipios = parseMunicipis(
  readFileSync(path.resolve(import.meta.dirname, 'fixtures/idescat-municipis.csv'), 'utf8'),
);

describe('normalizarNombre', () => {
  it.each([
    ["l'Ametlla de Mar", "Ametlla de Mar (L')"],
    ['la Llacuna', 'Llacuna (La)'],
    ["Esquirol, l'", 'Esquirol'],
    ['la Bisbal de Montsant', 'Bisbal de Montsant, la'],
    ['els Hostalets de Pierola', 'Hostalets de Pierola (Els)'],
    ['Sant Adrià de Besòs', 'SANT ADRIA DE BESOS'],
    ['Castell-Platja d’Aro', "Castell-Platja d'Aro"],
    ['Sant Martí Sesgueioles', 'Sant Martí Sesgueioles'],
  ])('« %s » = « %s »', (a, b) => {
    expect(normalizarNombre(a)).toBe(normalizarNombre(b));
  });

  it('ne supprime pas un « la » qui fait partie du nom', () => {
    expect(normalizarNombre('la Seu d’Urgell')).toBe('seu d urgell');
    expect(normalizarNombre('Lladó')).toBe('llado');
  });
});

describe('Idescat : communes', () => {
  it('lit les 947 communes avec comarque et province', () => {
    expect(municipios).toHaveLength(947);
    expect(municipios.find((m) => m.ine === '17079')).toEqual({
      ine: '17079',
      nombre: 'Girona',
      comarca: { id: '20', nombre: 'Gironès' },
      provincia: { id: '17', nombre: 'Girona' },
    });
  });

  it('échoue si le format change', () => {
    expect(() => parseMunicipis('Code,Name\n1,x')).toThrow(/en-tête/);
  });
});

describe('rattachement des territoires Habitatge', () => {
  const resolver = crearResolutor(municipios);

  it('résout comarques, provinces et Catalogne', () => {
    expect(resolver('comarca', 'Gironès')).toEqual({ nivel: 'comarca', id: '20', nombre: 'Gironès' });
    expect(resolver('comarca', "Val d'Aran")?.nivel).toBe('comarca');
    expect(resolver('provincia', 'Girona')).toEqual({ nivel: 'provincia', id: '17', nombre: 'Girona' });
    expect(resolver('catalunya', 'Catalunya')?.id).toBe('CAT');
    expect(resolver('ambito', 'Ponent')).toBeNull();
  });

  it('échoue sur une comarque inconnue', () => {
    expect(() => resolver('comarca', 'Comarca Inventada')).toThrow(/inconnue/);
  });
});
