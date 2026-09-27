import { downloadText } from '../../http.ts';

export const HABITATGE_ORIGIN = 'https://habitatge.gencat.cat';
export const HABITATGE_INDEX =
  HABITATGE_ORIGIN +
  '/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/estadistica-de-les-compravendes/compravendes-habitatges-Catalunya/';

/** Première année publiée sous forme de tableaux par commune. */
export const FIRST_YEAR = 2013;

/**
 * Nature d'un fichier publié :
 * - `trimestral` : une feuille par trimestre (et, depuis 2025, aussi les cumuls) ;
 * - `acum1any`  : 4 trimestres glissants (2019–2024, fichier séparé) ;
 * - `anual`     : année civile (2013–2018).
 */
export type HabitatgeFileKind = 'trimestral' | 'acum1any' | 'anual';
export type HabitatgeScope = 'municipis' | 'territori' | 'barcelona';

export interface HabitatgeFile {
  url: string;
  year: number;
  scope: HabitatgeScope;
  kind: HabitatgeFileKind;
}

// Les noms de fichiers ont changé plusieurs fois ; chaque motif est testé.
const PATTERNS: { re: RegExp; scope: HabitatgeScope; kind: HabitatgeFileKind }[] = [
  { re: /\/MUN_trimestral_(\d{4})\.xlsx?$/i, scope: 'municipis', kind: 'trimestral' },
  { re: /\/MUN_acum1any_(\d{4})\.xlsx?$/i, scope: 'municipis', kind: 'acum1any' },
  { re: /\/MUN_anual_(\d{4})\.xlsx?$/i, scope: 'municipis', kind: 'anual' },
  { re: /\/Trimestrals_per_municipis_(\d{4})\.xlsx?$/i, scope: 'municipis', kind: 'trimestral' },
  { re: /\/TERR_trimestral_(\d{4})\.xlsx?$/i, scope: 'territori', kind: 'trimestral' },
  { re: /\/TERR_acum1any_(\d{4})\.xlsx?$/i, scope: 'territori', kind: 'acum1any' },
  { re: /\/TERR_anual_(\d{4})\.xlsx?$/i, scope: 'territori', kind: 'anual' },
  { re: /\/Trimestrals_per_ambits_(\d{4})\.xlsx?$/i, scope: 'territori', kind: 'trimestral' },
  { re: /\/BCN_trimestral_(\d{4})\.xlsx?$/i, scope: 'barcelona', kind: 'trimestral' },
  { re: /\/BCN_anual_(\d{4})\.xlsx?$/i, scope: 'barcelona', kind: 'anual' },
  { re: /\/Trimestrals_Barcelona_(\d{4})\.xlsx?$/i, scope: 'barcelona', kind: 'trimestral' },
];

export function classifyHabitatgeUrl(url: string): HabitatgeFile | null {
  for (const p of PATTERNS) {
    const m = p.re.exec(url);
    if (m) return { url, year: Number(m[1]), scope: p.scope, kind: p.kind };
  }
  return null;
}

export function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"]+\.xlsx?)"/gi)) {
    out.add(new URL(m[1]!.trim(), base).toString());
  }
  return [...out];
}

/**
 * Parcourt la page d'index et les pages annuelles, et renvoie la liste des
 * fichiers reconnus. Échoue si une année attendue n'a aucun fichier communal.
 */
export async function discoverHabitatgeFiles(currentYear: number): Promise<HabitatgeFile[]> {
  const pages = [HABITATGE_INDEX];
  for (let y = FIRST_YEAR; y <= currentYear; y++) pages.push(`${HABITATGE_INDEX}${y}/`);

  const files = new Map<string, HabitatgeFile>();
  for (const page of pages) {
    let html: string;
    try {
      html = await downloadText(page);
    } catch (err) {
      // Les pages des années futures ou en cours peuvent ne pas exister.
      if (err instanceof Error && err.message.includes('HTTP 404')) continue;
      throw err;
    }
    for (const link of extractLinks(html, HABITATGE_ORIGIN)) {
      const f = classifyHabitatgeUrl(link);
      if (f) files.set(f.url, f);
    }
  }

  const list = [...files.values()].sort((a, b) => a.year - b.year || a.url.localeCompare(b.url));
  const lastYear = Math.max(...list.map((f) => f.year));
  for (let y = FIRST_YEAR; y <= lastYear; y++) {
    if (!list.some((f) => f.year === y && f.scope === 'municipis' && f.kind === 'trimestral')) {
      throw new Error(
        `Habitatge : aucun fichier trimestriel communal trouvé pour ${y}. ` +
          `La structure du site a peut-être changé.`,
      );
    }
  }
  return list;
}
