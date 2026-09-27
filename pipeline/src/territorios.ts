/**
 * Rattache les lignes des tableaux territoriaux d'Habitatge (identifiées par leur
 * nom) aux codes officiels : comarque Idescat, province INE, Catalogne.
 */
import type { Municipio, Nivel } from '../../shared/schema.ts';
import { normalizarNombre } from './names.ts';
import { PROVINCIAS } from './sources/idescat/municipios.ts';

/** Noms de comarque utilisés par Habitatge et différents de ceux de l'Idescat. */
const ALIAS_COMARCAS: Record<string, string> = {
  'val d aran': 'aran',
};

export interface TerritorioId {
  nivel: Exclude<Nivel, 'municipio'>;
  id: string;
  nombre: string;
}

export function crearResolutor(municipios: Municipio[]) {
  const comarcas = new Map<string, { id: string; nombre: string }>();
  for (const m of municipios) comarcas.set(normalizarNombre(m.comarca.nombre), m.comarca);
  const provincias = new Map(Object.entries(PROVINCIAS).map(([id, n]) => [normalizarNombre(n), { id, nombre: n }]));

  /** `null` pour les niveaux non utilisés (àmbits, AMB). Lève une erreur pour une comarque/province inconnue. */
  return function resolver(seccion: string | null, nombre: string): TerritorioId | null {
    if (seccion === 'catalunya') return { nivel: 'catalunya', id: 'CAT', nombre: 'Catalunya' };
    const n = normalizarNombre(nombre);
    if (seccion === 'comarca') {
      const c = comarcas.get(ALIAS_COMARCAS[n] ?? n);
      if (!c) throw new Error(`Comarque inconnue dans les tableaux Habitatge : « ${nombre} ».`);
      return { nivel: 'comarca', id: c.id, nombre: c.nombre };
    }
    if (seccion === 'provincia') {
      const p = provincias.get(n);
      if (!p) throw new Error(`Province inconnue dans les tableaux Habitatge : « ${nombre} ».`);
      return { nivel: 'provincia', id: p.id, nombre: p.nombre };
    }
    return null;
  };
}
