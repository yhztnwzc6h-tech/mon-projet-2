/**
 * Référentiel officiel des communes et comarques (Idescat, « Codis territorials »).
 * Le code Idescat a 6 chiffres : les 5 premiers sont le code INE, le dernier un
 * chiffre de contrôle.
 */
import { z } from 'zod';
import type { Municipio } from '../../../../shared/schema.ts';
import { downloadText } from '../../http.ts';

export const IDESCAT_MUNICIPIS_URL = 'https://www.idescat.cat/codis/?id=50&n=9&f=ssv';

export const PROVINCIAS: Record<string, string> = {
  '08': 'Barcelona',
  '17': 'Girona',
  '25': 'Lleida',
  '43': 'Tarragona',
};

const filaSchema = z.object({
  codi: z.string().regex(/^\d{6}$/),
  nom: z.string().min(1),
  codiComarca: z.string().regex(/^\d{2}$/),
  nomComarca: z.string().min(1),
});

/** Interprète le CSV (séparateur « ; ») et renvoie les communes triées par code INE. */
export function parseMunicipis(csv: string): Municipio[] {
  const lineas = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const cab = lineas.findIndex((l) => /^Codi;Nom;Codi comarca;Nom comarca/i.test(l));
  if (cab < 0) throw new Error('Idescat : en-tête « Codi;Nom;Codi comarca;Nom comarca » introuvable.');
  const out: Municipio[] = [];
  for (const l of lineas.slice(cab + 1)) {
    if (!l.trim()) continue;
    const [codi, nom, codiComarca, nomComarca] = l.split(';').map((x) => x.trim());
    const f = filaSchema.parse({ codi, nom, codiComarca, nomComarca });
    const ine = f.codi.slice(0, 5);
    const prov = ine.slice(0, 2);
    const provincia = PROVINCIAS[prov];
    if (!provincia) throw new Error(`Idescat : province inconnue pour ${f.codi} (${f.nom}).`);
    out.push({
      ine,
      nombre: f.nom,
      comarca: { id: f.codiComarca, nombre: f.nomComarca },
      provincia: { id: prov, nombre: provincia },
    });
  }
  // Garde-fous : la Catalogne compte 947 communes (2026). Une variation forte signale un problème.
  if (out.length < 900 || out.length > 1000) {
    throw new Error(`Idescat : ${out.length} communes lues, attendu environ 947.`);
  }
  if (new Set(out.map((m) => m.ine)).size !== out.length) throw new Error('Idescat : codes INE en double.');
  return out.sort((a, b) => a.ine.localeCompare(b.ine));
}

export async function cargarMunicipios(): Promise<Municipio[]> {
  return parseMunicipis(await downloadText(IDESCAT_MUNICIPIS_URL));
}
