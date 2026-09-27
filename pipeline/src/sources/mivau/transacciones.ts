/**
 * Transactions immobilières de logements par commune (Ministerio de Vivienda y
 * Agenda Urbana, à partir des données du Consejo General del Notariado).
 * Tableaux 2, 2.3 et 2.4 du « Boletín estadístico online ».
 *
 * Particularités :
 * - une seule feuille, une colonne par trimestre depuis 2004 ;
 * - communes identifiées par leur nom seulement, au format « Llacuna (La) » :
 *   l'appariement avec les codes INE se fait par nom normalisé, par province ;
 * - trimestres marqués « (*) » : données provisoires.
 */
import * as XLSX from 'xlsx';
import type { Municipio, Notarial } from '../../../../shared/schema.ts';
import { formatTrimestre } from '../../../../shared/periods.ts';
import { download } from '../../http.ts';
import { normalizarNombre } from '../../names.ts';
import { PROVINCIAS } from '../idescat/municipios.ts';

export const MIVAU_BASE = 'https://apps.fomento.gob.es/BoletinOnline2/sedal/';
export const MIVAU_PAGINA =
  'https://www.mivau.gob.es/el-ministerio/observatorios-y-estadisticas/estadisticas/transacciones-inmobiliarias-compraventa';

export const MIVAU_TABLAS = {
  total: '34010210.XLS',
  nueva: '34010240.XLS',
  segundaMano: '34010250.XLS',
} as const;
export type SerieMivau = keyof typeof MIVAU_TABLAS;

type Celda = string | number | null;

export interface ColumnaTrimestre {
  col: number;
  periodo: string;
  provisional: boolean;
}

export interface FilaMivau {
  provincia: string; // code à 2 chiffres
  nombre: string;
  valores: Map<string, number | null>;
}

export interface TablaMivau {
  columnas: ColumnaTrimestre[];
  filas: FilaMivau[];
}

/** Repère la ligne des trimestres (« 1º », « 2º (*) »…) et la ligne des années au-dessus. */
export function detectarColumnasMivau(filas: Celda[][]): ColumnaTrimestre[] {
  const iTrim = filas.findIndex((f) => f.filter((c) => typeof c === 'string' && /^\s*[1-4]º/.test(c)).length >= 8);
  if (iTrim < 0) throw new Error('MIVAU : ligne des trimestres introuvable.');
  let iAnio = -1;
  for (let i = iTrim - 1; i >= Math.max(0, iTrim - 4); i--) {
    if (filas[i]!.some((c) => typeof c === 'string' && /Año\s+\d{4}/.test(c))) {
      iAnio = i;
      break;
    }
  }
  if (iAnio < 0) throw new Error('MIVAU : ligne des années introuvable.');

  const out: ColumnaTrimestre[] = [];
  let anio: number | null = null;
  const fila = filas[iTrim]!;
  for (let c = 0; c < fila.length; c++) {
    const a = filas[iAnio]![c];
    if (typeof a === 'string') {
      const m = /Año\s+(\d{4})/.exec(a);
      if (m) anio = Number(m[1]);
    }
    const t = fila[c];
    if (typeof t !== 'string') continue;
    const m = /^\s*([1-4])º\s*(\(\*\))?/.exec(t);
    if (!m) continue;
    if (anio == null) throw new Error(`MIVAU : trimestre sans année en colonne ${c}.`);
    out.push({
      col: c,
      periodo: formatTrimestre({ year: anio, q: Number(m[1]) as 1 | 2 | 3 | 4 }),
      provisional: Boolean(m[2]),
    });
  }
  // Contrôle : trimestres consécutifs et sans doublon.
  for (let i = 1; i < out.length; i++) {
    const [a, b] = [out[i - 1]!.periodo, out[i]!.periodo];
    const [ya, qa] = a.split('-T').map(Number) as [number, number];
    const [yb, qb] = b.split('-T').map(Number) as [number, number];
    if (yb * 4 + qb !== ya * 4 + qa + 1) throw new Error(`MIVAU : trimestres non consécutifs (${a} puis ${b}).`);
  }
  return out;
}

const PROV_POR_NOMBRE = new Map(Object.entries(PROVINCIAS).map(([id, n]) => [n.toLowerCase(), id]));

/** Extrait les lignes des communes de Catalogne. */
export function parseTablaMivau(filas: Celda[][], { minMunicipios = 900 } = {}): TablaMivau {
  const columnas = detectarColumnasMivau(filas);
  const out: FilaMivau[] = [];
  let enCatalunya = false;
  let provincia: string | null = null;
  const colNombre = 1;

  for (const fila of filas) {
    const nombre = typeof fila[colNombre] === 'string' ? (fila[colNombre] as string).trim() : '';
    if (!nombre) continue;
    // Une ligne de données est remplie sur la plupart des trimestres. Les en-têtes
    // de province peuvent contenir une valeur parasite isolée (ex. « Girona », tableau 2.3).
    // Les communes créées récemment (ex. Medinyà, 2018) n'ont qu'une partie des trimestres.
    const numeros = columnas.filter((c) => typeof fila[c.col] === 'number').length;
    const esCabeceraProvincia = PROV_POR_NOMBRE.has(nombre.toLowerCase()) && numeros < columnas.length / 2;
    const esDato = numeros > 0 && !esCabeceraProvincia;
    if (!esDato) {
      if (nombre === nombre.toUpperCase() && /[A-ZÑ]{4,}/.test(nombre)) {
        enCatalunya = /^CATALU(Ñ|N)A$/.test(nombre);
        provincia = null;
      } else if (enCatalunya) {
        const p = PROV_POR_NOMBRE.get(nombre.toLowerCase());
        if (p) provincia = p;
      }
      continue;
    }
    if (!enCatalunya) continue;
    if (!provincia) throw new Error(`MIVAU : commune « ${nombre} » sans province.`);
    const valores = new Map<string, number | null>();
    for (const c of columnas) {
      const v = fila[c.col];
      if (v == null || v === '') valores.set(c.periodo, null);
      else if (typeof v === 'number' && Number.isInteger(v) && v >= 0) valores.set(c.periodo, v);
      else throw new Error(`MIVAU : valeur inattendue pour ${nombre} ${c.periodo} : « ${v} ».`);
    }
    out.push({ provincia, nombre, valores });
  }
  if (out.length < minMunicipios)
    throw new Error(`MIVAU : ${out.length} communes catalanes lues, attendu environ 947.`);
  return { columnas, filas: out };
}

/**
 * Noms MIVAU qui ne s'apparient pas automatiquement (graphie castillane ou
 * ancienne). Clé : `${province}|${nom normalisé MIVAU}` → code INE.
 */
export const ALIAS_MIVAU: Record<string, string> = {
  // Communes renommées ; le ministère conserve l'ancien nom (code INE inchangé).
  '08|bigues i riells': '08023', // Bigues i Riells del Fai
  '08|santa maria de corco': '08254', // l'Esquirol
  '17|brunyola': '17028', // Brunyola i Sant Martí Sapresa
  '17|calonge': '17034', // Calonge i Sant Antoni
  '17|castell platja d aro': '17048', // Castell d'Aro, Platja d'Aro i s'Agaró
  '17|cruilles monells i sant sadurni de l he': '17901', // nom tronqué par le ministère
  '17|masarac': '17100', // Masarac i Vilarnadal
  '43|bisbal de falset': '43027', // la Bisbal de Montsant
  '43|roda de bara': '43131', // Roda de Berà
  '43|sant carles de la rapita': '43136', // la Ràpita
};

export function emparejar(
  filas: FilaMivau[],
  municipios: Municipio[],
): { porIne: Map<string, FilaMivau>; sinPareja: FilaMivau[] } {
  const indice = new Map<string, string>();
  for (const m of municipios) indice.set(`${m.provincia.id}|${normalizarNombre(m.nombre)}`, m.ine);
  const porIne = new Map<string, FilaMivau>();
  const sinPareja: FilaMivau[] = [];
  for (const f of filas) {
    const clave = `${f.provincia}|${normalizarNombre(f.nombre)}`;
    const ine = ALIAS_MIVAU[clave] ?? indice.get(clave);
    if (!ine) {
      sinPareja.push(f);
      continue;
    }
    if (porIne.has(ine)) throw new Error(`MIVAU : deux lignes pour la commune ${ine} (« ${f.nombre} »).`);
    porIne.set(ine, f);
  }
  return { porIne, sinPareja };
}

export async function leerTablaMivau(serie: SerieMivau): Promise<TablaMivau> {
  const buf = await download(MIVAU_BASE + MIVAU_TABLAS[serie], { maxAgeHours: 24 * 7 });
  const wb = XLSX.read(buf, { type: 'buffer' });
  const filas = XLSX.utils.sheet_to_json<Celda[]>(wb.Sheets[wb.SheetNames[0]!]!, {
    header: 1,
    defval: null,
    raw: true,
  });
  return parseTablaMivau(filas);
}

export interface ResultadoMivau {
  porIne: Map<string, Notarial[]>;
  ultimoPeriodo: string;
}

/** Charge les trois tableaux et les combine par commune. Échoue si une commune n'est pas appariée. */
export async function cargarMivau(municipios: Municipio[]): Promise<ResultadoMivau> {
  const tablas = {
    total: await leerTablaMivau('total'),
    nueva: await leerTablaMivau('nueva'),
    segundaMano: await leerTablaMivau('segundaMano'),
  };
  const emparejadas = {} as Record<SerieMivau, Map<string, FilaMivau>>;
  for (const [serie, tabla] of Object.entries(tablas) as [SerieMivau, TablaMivau][]) {
    const { porIne, sinPareja } = emparejar(tabla.filas, municipios);
    if (sinPareja.length) {
      throw new Error(
        `MIVAU (${serie}) : ${sinPareja.length} commune(s) sans correspondance Idescat : ` +
          sinPareja.map((f) => `${f.provincia}|${normalizarNombre(f.nombre)} (« ${f.nombre} »)`).join(', ') +
          '. Ajouter une entrée dans ALIAS_MIVAU.',
      );
    }
    const faltan = municipios.filter((m) => !porIne.has(m.ine));
    if (faltan.length) {
      throw new Error(
        `MIVAU (${serie}) : ${faltan.length} commune(s) Idescat absente(s) : ` +
          faltan.map((m) => `${m.ine} ${m.nombre}`).join(', '),
      );
    }
    emparejadas[serie] = porIne;
  }

  const cols = tablas.total.columnas;
  const porIne = new Map<string, Notarial[]>();
  for (const [ine, filaTotal] of emparejadas.total) {
    const serie: Notarial[] = cols.map((c) => ({
      periodo: c.periodo,
      total: filaTotal.valores.get(c.periodo) ?? null,
      nueva: emparejadas.nueva.get(ine)?.valores.get(c.periodo) ?? null,
      segundaMano: emparejadas.segundaMano.get(ine)?.valores.get(c.periodo) ?? null,
      provisional: c.provisional,
    }));
    porIne.set(ine, serie);
  }
  return { porIne, ultimoPeriodo: cols[cols.length - 1]!.periodo };
}

/**
 * Somme exacte des 4 trimestres se terminant à chaque période. Aucune valeur
 * n'est estimée : si l'un des 4 trimestres manque, la somme est `null`.
 */
export function sumar4T(serie: Notarial[]): Notarial[] {
  const out: Notarial[] = [];
  for (let i = 3; i < serie.length; i++) {
    const v = serie.slice(i - 3, i + 1);
    const suma = (k: 'total' | 'nueva' | 'segundaMano') =>
      v.every((x) => x[k] != null) ? v.reduce((s, x) => s + x[k]!, 0) : null;
    out.push({
      periodo: serie[i]!.periodo,
      total: suma('total'),
      nueva: suma('nueva'),
      segundaMano: suma('segundaMano'),
      provisional: v.some((x) => x.provisional),
    });
  }
  return out;
}
