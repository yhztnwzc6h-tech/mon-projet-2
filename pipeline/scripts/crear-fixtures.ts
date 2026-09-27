/**
 * Régénère les fixtures de test à partir des fichiers officiels.
 *
 *   npx tsx pipeline/scripts/crear-fixtures.ts
 *
 * - Les petits fichiers sont copiés tels quels.
 * - Pour les gros fichiers (11 Mo pour Habitatge 2026, 6 Mo pour chaque tableau
 *   MIVAU), on extrait des lignes réelles, cellule par cellule, au format JSON :
 *   les positions de colonnes sont conservées et aucune valeur n'est modifiée.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { download } from '../src/http.ts';
import { IDESCAT_MUNICIPIS_URL } from '../src/sources/idescat/municipios.ts';
import { MIVAU_BASE, MIVAU_TABLAS } from '../src/sources/mivau/transacciones.ts';

const DIR = path.resolve(import.meta.dirname, '../test/fixtures');
const HAB =
  'https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/01_Estadistiques_de_construccio_i_mercat_immobiliari/02_Compravenda_i_preu_de_venda/02_Compravendes_d_habitatges_registrades_i_el_preu_de_venda/';

const COPIAS: Record<string, string> = {
  'MUN_trimestral_2013.xls': `${HAB}2013/MUN_trimestral_2013.xls`,
  'MUN_trimestral_2024.xlsx': `${HAB}2024/MUN_trimestral_2024.xlsx`,
  'TERR_acum1any_2024.xlsx': `${HAB}2024/TERR_acum1any_2024.xlsx`,
  'Trimestrals_per_ambits_2026.xlsx': `${HAB}2026/Trimestrals_per_ambits_2026.xlsx`,
  'idescat-municipis.csv': IDESCAT_MUNICIPIS_URL,
  'BCN_trimestral_2014.xls': `${HAB}2014/BCN_trimestral_2014.xls`,
  'BCN_acum1any_2024.xlsx': `${HAB}2024/BCN_acum1any_2024.xlsx`,
  'Trimestrals_Barcelona_2026.xlsx': `${HAB}2026/Trimestrals_Barcelona_2026.xlsx`,
  // Réponses du Catastro (Pg. de Gràcia 43, un point en mer, un immeuble de Girona).
  'catastro-rccoor-pg-gracia-43.xml':
    'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=2.164960&Coordenada_Y=41.391700',
  'catastro-rccoor-mar.xml':
    'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=2.2&Coordenada_Y=41.2',
  'catastro-dnprc-bico.json':
    'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=0227802DF3802E',
  'catastro-dnprc-lista.json':
    'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=5381917DG8458A',
};

type Filas = unknown[][];

function filas(buf: Buffer, hoja?: string): { nombre: string; filas: Filas }[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  return wb.SheetNames.filter((n) => !hoja || n === hoja).map((nombre) => ({
    nombre,
    filas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre]!, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    }),
  }));
}

/** Garde les `n` premières lignes et celles qui satisfont `garder`, en remplaçant les autres par des lignes vides. */
function extraer(f: Filas, n: number, garder: (fila: unknown[]) => boolean): Filas {
  return f.map((fila, i) => (i < n || garder(fila) ? fila : []));
}

await mkdir(DIR, { recursive: true });

for (const [nombre, url] of Object.entries(COPIAS)) {
  await writeFile(path.join(DIR, nombre), await download(url));
}

// Habitatge 2026, communes : Girona, Agramunt, Aitona, Albatàrrec.
{
  const codigos = new Set(['17079', '25003', '25038', '25007']);
  const hojas = filas(await download(`${HAB}2026/Trimestrals_per_municipis_2026.xlsx`)).map((h) => {
    const recortada = extraer(h.filas, 10, (r) => codigos.has(String(r[0])));
    // Supprime les lignes vides finales (le fichier officiel en contient ~64 000).
    while (recortada.length && recortada[recortada.length - 1]!.length === 0) recortada.pop();
    return { nombre: h.nombre, filas: recortada };
  });
  await writeFile(path.join(DIR, 'Trimestrals_per_municipis_2026.extracto.json'), JSON.stringify(hojas));
}

// MIVAU : en-têtes, un autre territoire, la province de Girona (en-tête avec valeur parasite
// dans le tableau 2.3), Girona, la Canonja (créée en 2010, historique partiel), une commune renommée (Calonge).
for (const serie of Object.keys(MIVAU_TABLAS) as (keyof typeof MIVAU_TABLAS)[]) {
  const [h] = filas(await download(MIVAU_BASE + MIVAU_TABLAS[serie]));
  const f = h!.filas;
  const iCat = f.findIndex((r) => r[1] === 'CATALUÑA');
  const nombres = new Set(['Girona', 'Canonja, La', 'Calonge', 'Barcelona', 'Abrera', 'Lleida', 'Tarragona']);
  const recortada = extraer(f, 13, (r) => {
    const n = typeof r[1] === 'string' ? r[1].trim() : '';
    return (
      n === 'ANDALUCÍA' ||
      n === 'Almería' ||
      n === 'Abla' ||
      n === 'CATALUÑA' ||
      nombres.has(n) ||
      n === 'COMUNITAT VALENCIANA' ||
      n === 'COMUNIDAD VALENCIANA'
    );
  });
  // Coupe après la Catalogne et la communauté suivante.
  const iSig = f.findIndex((r, i) => i > iCat && typeof r[1] === 'string' && /^[A-ZÁÉÍÓÚÑ ]{5,}$/.test(r[1].trim()));
  await writeFile(
    path.join(DIR, `mivau-${serie}.extracto.json`),
    JSON.stringify(recortada.slice(0, iSig + 1).filter((r, i) => i < 13 || r.length > 0)),
  );
}
console.log('Fixtures écrites dans', DIR);
