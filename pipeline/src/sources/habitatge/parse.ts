/**
 * Lecture des tableaux « Compravendes d'habitatges registrades i preu de venda »
 * (Secretaria d'Habitatge, Generalitat de Catalunya ; données des Registradores).
 *
 * La mise en page a varié entre 2013 et 2026 (XLS puis XLSX, noms de feuilles,
 * colonnes vides, colonnes min/max ajoutées en 2026). Le parseur s'appuie donc
 * sur les en-têtes et sur le titre « Període » de chaque feuille, et échoue
 * bruyamment dès qu'un élément attendu manque.
 */
import type { Registro } from '../../../../shared/schema.ts';
import { formatTrimestre, type Ventana } from '../../../../shared/periods.ts';

export type Celda = string | number | boolean | null | undefined;
export type Filas = Celda[][];

// ---------------------------------------------------------------------------
// Période
// ---------------------------------------------------------------------------

const MESOS: Record<string, number> = {
  gener: 1,
  febrer: 2,
  març: 3,
  marc: 3,
  abril: 4,
  maig: 5,
  juny: 6,
  juliol: 7,
  agost: 8,
  setembre: 9,
  octubre: 10,
  novembre: 11,
  desembre: 12,
};
const MES = `(${Object.keys(MESOS).join('|')})`;

export type PeriodoHoja =
  | { tipo: 'dato'; periodo: string; ventana: Ventana }
  /** Cumul depuis janvier inférieur à un an (ex. « Gener-setembre ») : ignoré. */
  | { tipo: 'acumulado-parcial' };

function trimestreDeMes(year: number, mes: number): string | null {
  if (mes % 3 !== 0) return null;
  return formatTrimestre({ year, q: (mes / 3) as 1 | 2 | 3 | 4 });
}

/**
 * Interprète un titre de période, par exemple :
 * « Període: 4t. trimestre 2013 », « 2n. trimestre 2014 », « Any 2017 »,
 * « gener - desembre 2020 », « octubre 2014 - setembre 2015 »,
 * « Juliol 2025- juny 2026 », « Gener-setembre 2025 ».
 */
export function parsePeriodoTitulo(texto: string): PeriodoHoja | null {
  const t = texto
    .replace(/^\s*Per[ií]ode\s*:\s*/i, '')
    .trim()
    .toLowerCase();

  let m = /^([1-4])\s*[a-z]*\.?\s*trimestre\s+(\d{4})$/.exec(t);
  if (m) {
    return {
      tipo: 'dato',
      periodo: formatTrimestre({ year: Number(m[2]), q: Number(m[1]) as 1 | 2 | 3 | 4 }),
      ventana: 'T',
    };
  }

  m = /^any\s+(\d{4})$/.exec(t);
  if (m) return { tipo: 'dato', periodo: `${m[1]}-T4`, ventana: '4T' };

  m = new RegExp(`^${MES}\\s*(\\d{4})?\\s*-\\s*${MES}\\s+(\\d{4})$`).exec(t);
  if (m) {
    const y2 = Number(m[4]);
    const y1 = m[2] ? Number(m[2]) : y2;
    const m1 = MESOS[m[1]!]!;
    const m2 = MESOS[m[3]!]!;
    const meses = y2 * 12 + m2 - (y1 * 12 + m1) + 1;
    const periodo = trimestreDeMes(y2, m2);
    if (!periodo || (m1 - 1) % 3 !== 0) return null;
    if (meses === 3) return { tipo: 'dato', periodo, ventana: 'T' };
    if (meses === 12) return { tipo: 'dato', periodo, ventana: '4T' };
    if (m1 === 1 && meses < 12) return { tipo: 'acumulado-parcial' };
    return null;
  }
  return null;
}

/** Période attendue d'après le nom de la feuille, quand il est sans ambiguïté. */
export function periodoDeNombreHoja(nombre: string): { periodo: string; ventana: Ventana } | null {
  const n = nombre.trim().toLowerCase();
  let m = /^([1-4])t(\d{2})$/.exec(n);
  if (m) return { periodo: `20${m[2]}-T${m[1]}`, ventana: 'T' };
  m = /^([1-4])t(\d{2})\s*acum_?1any$/.exec(n);
  if (m) return { periodo: `20${m[2]}-T${m[1]}`, ventana: '4T' };
  m = /^(\d{4})$/.exec(n);
  if (m) return { periodo: `${m[1]}-T4`, ventana: '4T' };
  return null;
}

export function periodoDeHoja(nombreHoja: string, filas: Filas): PeriodoHoja {
  let encontrado: PeriodoHoja | null = null;
  for (const fila of filas.slice(0, 12)) {
    for (const c of fila) {
      if (typeof c !== 'string') continue;
      const p = parsePeriodoTitulo(c);
      if (p) {
        encontrado = p;
        break;
      }
    }
    if (encontrado) break;
  }
  if (!encontrado) {
    throw new Error(`Feuille « ${nombreHoja} » : titre de période introuvable ou non reconnu.`);
  }
  const esperado = periodoDeNombreHoja(nombreHoja);
  if (
    esperado &&
    (encontrado.tipo !== 'dato' || encontrado.periodo !== esperado.periodo || encontrado.ventana !== esperado.ventana)
  ) {
    throw new Error(
      `Feuille « ${nombreHoja} » : le titre (${JSON.stringify(encontrado)}) ` +
        `contredit le nom de la feuille (${JSON.stringify(esperado)}).`,
    );
  }
  return encontrado;
}

// ---------------------------------------------------------------------------
// Colonnes
// ---------------------------------------------------------------------------

export type Campo = Exclude<keyof Registro, 'periodo'>;

export const CAMPOS: readonly Campo[] = [
  'ventasTotal',
  'ventasNuevoLibre',
  'ventasNuevoProtegido',
  'ventasUsado',
  'supTotal',
  'supNuevoLibre',
  'supNuevoProtegido',
  'supUsado',
  'precioTotal',
  'precioNuevo',
  'precioUsado',
  'm2Total',
  'm2Nuevo',
  'm2Usado',
];

const GRUPOS: { re: RegExp; clave: 'ventas' | 'sup' | 'precio' | 'm2' | null }[] = [
  { re: /^nre\.?\s*compravendes/i, clave: 'ventas' },
  { re: /^superf/i, clave: 'sup' },
  { re: /^preu\s+total/i, clave: 'precio' },
  { re: /^preu\s*\/\s*m2.*(m[àa]xim|m[íi]nim)/i, clave: null },
  { re: /^preu\s*\/\s*m2/i, clave: 'm2' },
];

const SUBTIPOS: { re: RegExp; sufijo: string }[] = [
  { re: /nous\s+lliures/i, sufijo: 'NuevoLibre' },
  { re: /nous\s+protegits/i, sufijo: 'NuevoProtegido' },
  { re: /usat/i, sufijo: 'Usado' },
  { re: /^total$/i, sufijo: 'Total' },
  { re: /^habitatge\s+nou$/i, sufijo: 'Nuevo' },
];

export interface Columnas {
  filaDatos: number;
  columnaCodigo: number | null;
  columnaNombre: number;
  campos: Map<Campo, number>;
}

function texto(c: Celda): string {
  return typeof c === 'string' ? c.replace(/\s+/g, ' ').trim() : '';
}

export function detectarColumnas(filas: Filas, nombreHoja: string): Columnas {
  const filaGrupos = filas.findIndex((f) => f.some((c) => /^nre\.?\s*compravendes/i.test(texto(c))));
  if (filaGrupos < 0) throw new Error(`Feuille « ${nombreHoja} » : ligne d'en-tête « Nre. Compravendes » introuvable.`);
  const grupos = filas[filaGrupos]!;
  const subs = filas[filaGrupos + 1] ?? [];

  const campos = new Map<Campo, number>();
  let grupoActual: (typeof GRUPOS)[number]['clave'] | undefined;
  let columnaCodigo: number | null = null;
  let columnaNombre: number | null = null;
  const ancho = Math.max(grupos.length, subs.length);

  for (let c = 0; c < ancho; c++) {
    const g = texto(grupos[c]);
    if (g) {
      const def = GRUPOS.find((x) => x.re.test(g));
      if (!def) throw new Error(`Feuille « ${nombreHoja} » : groupe de colonnes inconnu « ${g} ».`);
      grupoActual = def.clave;
    }
    const s = texto(subs[c]);
    if (!s) continue;
    if (/^codi$/i.test(s)) {
      columnaCodigo = c;
      continue;
    }
    if (/^municipi$/i.test(s)) {
      columnaNombre = c;
      continue;
    }
    if (grupoActual === undefined) continue; // colonnes de libellé avant le premier groupe
    if (grupoActual === null) continue; // min / max : ignorés
    const sub = SUBTIPOS.find((x) => x.re.test(s));
    if (!sub) throw new Error(`Feuille « ${nombreHoja} » : sous-en-tête inconnu « ${s} ».`);
    const campo = `${grupoActual}${sub.sufijo}` as Campo;
    if (!CAMPOS.includes(campo)) {
      throw new Error(`Feuille « ${nombreHoja} » : combinaison inattendue « ${grupoActual} / ${s} ».`);
    }
    if (campos.has(campo)) throw new Error(`Feuille « ${nombreHoja} » : colonne « ${campo} » en double.`);
    campos.set(campo, c);
  }

  const faltan = CAMPOS.filter((c) => !campos.has(c));
  if (faltan.length) {
    throw new Error(`Feuille « ${nombreHoja} » : colonnes manquantes : ${faltan.join(', ')}.`);
  }
  // Tableaux territoriaux : le libellé est dans la première colonne, sans en-tête.
  const primera = Math.min(...campos.values());
  return {
    filaDatos: filaGrupos + 2,
    columnaCodigo,
    columnaNombre: columnaNombre ?? (primera > 0 ? 0 : -1),
    campos,
  };
}

// ---------------------------------------------------------------------------
// Valeurs
// ---------------------------------------------------------------------------

const NO_DISPONIBLE = new Set(['', 'n.d.', 'n.d', 'nd', '-', '--', '..', '...', 's.d.']);

/** Convertit une cellule en nombre ; `null` si non publiée. Lève une erreur si inconnue. */
export function aNumero(c: Celda): number | null {
  if (c == null) return null;
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  if (typeof c === 'boolean') throw new Error(`Valeur booléenne inattendue : ${c}`);
  const s = c.trim().toLowerCase();
  if (NO_DISPONIBLE.has(s)) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // Format catalan : « 1.234,56 »
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
  throw new Error(`Valeur non numérique inattendue : « ${c} »`);
}

/** Seuil de publication de la source : pas de prix en dessous de 3 ventes. */
export const MIN_VENTAS_PUBLICABLES = 3;

// Pour chaque mesure de prix ou de surface, le nombre de ventes qui la fonde.
const BASE_SECRETO: Partial<Record<Campo, Campo>> = {
  supTotal: 'ventasTotal',
  supNuevoLibre: 'ventasNuevoLibre',
  supNuevoProtegido: 'ventasNuevoProtegido',
  supUsado: 'ventasUsado',
  precioTotal: 'ventasTotal',
  precioNuevo: 'ventasNuevoLibre',
  precioUsado: 'ventasUsado',
  m2Total: 'ventasTotal',
  m2Nuevo: 'ventasNuevoLibre',
  m2Usado: 'ventasUsado',
};

function redondear(n: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

/**
 * Normalise une ligne :
 * - nombres de ventes entiers ;
 * - prix total converti de milliers d'euros en euros ;
 * - 0 ou « n.d. » pour une mesure de prix/surface → `null` (non publiée) ;
 * - secret statistique appliqué : mesure `null` si sa base compte moins de 3 ventes.
 */
export function normalizarFila(fila: Celda[], columnas: Columnas, contexto: string): Omit<Registro, 'periodo'> {
  const out = {} as Record<Campo, number | null>;
  for (const campo of CAMPOS) {
    const v = aNumero(fila[columnas.campos.get(campo)!]);
    if (campo.startsWith('ventas')) {
      if (v != null && (!Number.isInteger(v) || v < 0)) {
        throw new Error(`${contexto} : nombre de ventes invalide pour ${campo} (${v}).`);
      }
      out[campo] = v;
    } else if (v == null || v === 0) {
      out[campo] = null;
    } else if (v < 0) {
      throw new Error(`${contexto} : valeur négative pour ${campo} (${v}).`);
    } else if (campo.startsWith('precio')) {
      out[campo] = Math.round(v * 1000);
    } else {
      out[campo] = redondear(v, 2);
    }
  }
  for (const [campo, base] of Object.entries(BASE_SECRETO) as [Campo, Campo][]) {
    const n = out[base];
    if (n == null || n < MIN_VENTAS_PUBLICABLES) out[campo] = null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Feuilles
// ---------------------------------------------------------------------------

export interface FilaMunicipal {
  ine: string;
  nombre: string;
  valores: Omit<Registro, 'periodo'>;
}

export interface FilaTerritorial {
  seccion: string | null;
  nombre: string;
  valores: Omit<Registro, 'periodo'>;
}

export type HojaParseada<F> =
  { tipo: 'dato'; periodo: string; ventana: Ventana; filas: F[] } | { tipo: 'acumulado-parcial' };

function codigoIne(c: Celda): string | null {
  if (typeof c === 'number' && Number.isInteger(c) && c > 0 && c < 100000) return String(c).padStart(5, '0');
  if (typeof c === 'string' && /^\d{4,5}$/.test(c.trim())) return c.trim().padStart(5, '0');
  return null;
}

export function parseHojaMunicipal(nombreHoja: string, filas: Filas): HojaParseada<FilaMunicipal> {
  const p = periodoDeHoja(nombreHoja, filas);
  if (p.tipo !== 'dato') return p;
  const col = detectarColumnas(filas, nombreHoja);
  if (col.columnaCodigo == null) throw new Error(`Feuille « ${nombreHoja} » : colonne « Codi » introuvable.`);
  const out: FilaMunicipal[] = [];
  const vistos = new Set<string>();
  for (let i = col.filaDatos; i < filas.length; i++) {
    const fila = filas[i]!;
    const ine = codigoIne(fila[col.columnaCodigo]);
    if (!ine) continue;
    if (vistos.has(ine)) throw new Error(`Feuille « ${nombreHoja} » : commune ${ine} en double.`);
    vistos.add(ine);
    out.push({
      ine,
      nombre: texto(fila[col.columnaNombre]),
      valores: normalizarFila(fila, col, `Feuille « ${nombreHoja} », commune ${ine}`),
    });
  }
  return { ...p, filas: out };
}

const SECCIONES: { re: RegExp; id: string }[] = [
  // Motifs stricts : « Comarques gironines » est un àmbit, pas un titre de section.
  { re: /^comarques(\s+i\s+aran)?$/i, id: 'comarca' },
  { re: /^[àa]mbits\s+territorials/i, id: 'ambito' },
  { re: /^demarcacions(\s+territorials)?$|^prov[íi]ncies$/i, id: 'provincia' },
];

export function parseHojaTerritorial(nombreHoja: string, filas: Filas): HojaParseada<FilaTerritorial> {
  const p = periodoDeHoja(nombreHoja, filas);
  if (p.tipo !== 'dato') return p;
  const col = detectarColumnas(filas, nombreHoja);
  if (col.columnaNombre < 0) throw new Error(`Feuille « ${nombreHoja} » : colonne des libellés introuvable.`);
  const out: FilaTerritorial[] = [];
  let seccion: string | null = null;
  for (let i = col.filaDatos; i < filas.length; i++) {
    const fila = filas[i]!;
    const nombre = texto(fila[col.columnaNombre]);
    if (!nombre) continue;
    const s = SECCIONES.find((x) => x.re.test(nombre));
    if (s) {
      seccion = s.id;
      continue;
    }
    const tieneDatos = [...col.campos.values()].some((c) => typeof fila[c] === 'number');
    if (!tieneDatos) continue; // notes de bas de tableau
    out.push({
      seccion: /^catalunya$/i.test(nombre) ? 'catalunya' : seccion,
      nombre: nombre.replace(/\*+$/, '').trim(),
      valores: normalizarFila(fila, col, `Feuille « ${nombreHoja} », ${nombre}`),
    });
  }
  return { ...p, filas: out };
}
