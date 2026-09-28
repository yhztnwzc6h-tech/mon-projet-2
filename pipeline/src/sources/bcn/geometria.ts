/**
 * Limites des 73 barris de Barcelone (Ajuntament de Barcelona, « Unitats
 * administratives », CC BY 4.0).
 *
 * Le portail Open Data BCN protège ses téléchargements par un captcha : on
 * utilise une copie publique du même fichier officiel (0301040100_Barris_UNITATS_ADM),
 * vérifiée à chaque exécution (73 barris, codes 1–73, 10 districtes).
 */
import mapshaper from 'mapshaper';
import { z } from 'zod';
import { downloadText } from '../../http.ts';

export const BARRIS_URL = 'https://raw.githubusercontent.com/martgnz/bcn-geodata/master/barris/barris.geojson';
export const BARRIS_FUENTE_OFICIAL =
  'https://opendata-ajuntament.barcelona.cat/data/ca/dataset/20170706-districtes-barris';

const featureSchema = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    BARRI: z.string().regex(/^\d{2}$/),
    DISTRICTE: z.string().regex(/^\d{2}$/),
    NOM: z.string().min(1),
    TIPUS_UA: z.literal('BARRI'),
  }),
  geometry: z.object({ type: z.enum(['Polygon', 'MultiPolygon']), coordinates: z.array(z.unknown()) }),
});
const coleccionSchema = z.object({ type: z.literal('FeatureCollection'), features: z.array(featureSchema) });

export interface GeometriaBarcelona {
  barrios: string;
  distritos: string;
  /** Distrito de chaque barri (`b01` → `d01`). */
  distritoDe: Map<string, string>;
  nombres: Map<string, string>;
}

export function validarBarris(texto: string) {
  const col = coleccionSchema.parse(JSON.parse(texto));
  const codigos = col.features.map((f) => Number(f.properties.BARRI)).sort((a, b) => a - b);
  if (codigos.length !== 73 || codigos.some((c, i) => c !== i + 1)) {
    throw new Error(`Limites des barris : codes inattendus (${codigos.length} barris).`);
  }
  const distritos = new Set(col.features.map((f) => f.properties.DISTRICTE));
  if (distritos.size !== 10) throw new Error(`Limites des barris : ${distritos.size} districtes, attendu 10.`);
  // Coordonnées en degrés (WGS84) autour de Barcelone.
  const primer = JSON.stringify(col.features[0]!.geometry.coordinates)
    .match(/-?\d+\.\d+/g)!
    .map(Number);
  if (!(primer[0]! > 2 && primer[0]! < 2.3 && primer[1]! > 41.3 && primer[1]! < 41.5)) {
    throw new Error('Limites des barris : coordonnées hors de Barcelone (système de coordonnées changé ?).');
  }
  return col;
}

export async function prepararGeometria(): Promise<GeometriaBarcelona> {
  const bruto = await downloadText(BARRIS_URL, { maxAgeHours: 24 * 30 });
  const col = validarBarris(bruto);

  const distritoDe = new Map<string, string>();
  const nombres = new Map<string, string>();
  const limpio = {
    type: 'FeatureCollection',
    features: col.features.map((f) => {
      const id = `b${f.properties.BARRI}`;
      const distrito = `d${f.properties.DISTRICTE}`;
      distritoDe.set(id, distrito);
      nombres.set(id, f.properties.NOM);
      return {
        type: 'Feature',
        properties: { id, codigo: Number(f.properties.BARRI), distrito, nombre: f.properties.NOM },
        geometry: f.geometry,
      };
    }),
  };

  // Simplification (garde la topologie partagée entre barris voisins) puis fusion par districte.
  const salida = await mapshaper.applyCommands(
    [
      '-i barris.json',
      '-simplify 25% keep-shapes',
      '-o barrios.json format=geojson precision=0.00001',
      '-dissolve distrito copy-fields=distrito',
      '-each "id=distrito"',
      '-o distritos.json format=geojson precision=0.00001',
    ].join(' '),
    { 'barris.json': JSON.stringify(limpio) },
  );
  return {
    barrios: String(salida['barrios.json']),
    distritos: String(salida['distritos.json']),
    distritoDe,
    nombres,
  };
}
