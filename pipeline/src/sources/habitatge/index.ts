import * as XLSX from 'xlsx';
import type { Registro } from '../../../../shared/schema.ts';
import { compareTrimestres, type Ventana } from '../../../../shared/periods.ts';
import { download } from '../../http.ts';
import { discoverHabitatgeFiles, type HabitatgeFile } from './discover.ts';
import {
  parseHojaMunicipal,
  parseHojaTerritorial,
  type Filas,
  type FilaMunicipal,
  type FilaTerritorial,
} from './parse.ts';

export function leerLibro(buf: Buffer): { nombre: string; filas: Filas }[] {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
  return wb.SheetNames.map((nombre) => ({
    nombre,
    filas: XLSX.utils.sheet_to_json<Filas[number]>(wb.Sheets[nombre]!, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    }),
  }));
}

/** Séries par entité : `T` et `4T`, indexées par période. */
export interface Series {
  T: Map<string, Registro>;
  '4T': Map<string, Registro>;
}

function nuevaSerie(): Series {
  return { T: new Map(), '4T': new Map() };
}

export interface ResultadoHabitatge {
  municipios: Map<string, { nombre: string; series: Series }>;
  /** Clé : `${seccion}|${nombre}` (ex. `comarca|Gironès`, `catalunya|Catalunya`). */
  territorios: Map<string, { seccion: string | null; nombre: string; series: Series }>;
  archivos: HabitatgeFile[];
  ultimoPeriodo: string | null;
  /** Nombre de valeurs remplacées par une publication plus récente (révisions). */
  revisiones: number;
  avisos: string[];
}

/** Seuils minimaux : en dessous, le format a probablement changé. */
const MIN_MUNICIPIOS_POR_HOJA = 100;
const MIN_COMARCAS_POR_HOJA = 30;

// Fichiers les plus récents en dernier : ils remplacent les publications antérieures.
function prioridad(f: HabitatgeFile): number {
  return f.year * 10 + (/Trimestrals_/i.test(f.url) ? 1 : 0);
}

function mismoValor(a: Registro, b: Registro): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function cargarHabitatge(anioActual: number): Promise<ResultadoHabitatge> {
  const archivos = (await discoverHabitatgeFiles(anioActual)).filter((f) => f.scope !== 'barcelona');
  archivos.sort((a, b) => prioridad(a) - prioridad(b));

  const municipios: ResultadoHabitatge['municipios'] = new Map();
  const territorios: ResultadoHabitatge['territorios'] = new Map();
  const avisos: string[] = [];
  let revisiones = 0;
  let ultimoPeriodo: string | null = null;

  const guardar = (series: Series, ventana: Ventana, reg: Registro) => {
    const previo = series[ventana].get(reg.periodo);
    if (previo && !mismoValor(previo, reg)) revisiones++;
    series[ventana].set(reg.periodo, reg);
  };

  for (const archivo of archivos) {
    const nombreArchivo = archivo.url.split('/').pop();
    const hojas = leerLibro(await download(archivo.url, { maxAgeHours: 24 * 7 }));
    for (const hoja of hojas) {
      const ctx = `${nombreArchivo} › ${hoja.nombre}`;
      try {
        if (archivo.scope === 'municipis') {
          const r = parseHojaMunicipal(hoja.nombre, hoja.filas);
          if (r.tipo !== 'dato') continue;
          if (r.filas.length < MIN_MUNICIPIOS_POR_HOJA) {
            throw new Error(`seulement ${r.filas.length} communes (minimum attendu : ${MIN_MUNICIPIOS_POR_HOJA}).`);
          }
          for (const f of r.filas as FilaMunicipal[]) {
            let m = municipios.get(f.ine);
            if (!m) municipios.set(f.ine, (m = { nombre: f.nombre, series: nuevaSerie() }));
            guardar(m.series, r.ventana, { periodo: r.periodo, ...f.valores });
          }
          if (!ultimoPeriodo || compareTrimestres(r.periodo, ultimoPeriodo) > 0) ultimoPeriodo = r.periodo;
        } else {
          const r = parseHojaTerritorial(hoja.nombre, hoja.filas);
          if (r.tipo !== 'dato') continue;
          const comarcas = r.filas.filter((f) => f.seccion === 'comarca').length;
          if (comarcas < MIN_COMARCAS_POR_HOJA) {
            throw new Error(`seulement ${comarcas} comarques (minimum attendu : ${MIN_COMARCAS_POR_HOJA}).`);
          }
          if (!r.filas.some((f) => f.seccion === 'catalunya')) throw new Error('ligne « Catalunya » absente.');
          for (const f of r.filas as FilaTerritorial[]) {
            const clave = `${f.seccion}|${f.nombre}`;
            let t = territorios.get(clave);
            if (!t) territorios.set(clave, (t = { seccion: f.seccion, nombre: f.nombre, series: nuevaSerie() }));
            guardar(t.series, r.ventana, { periodo: r.periodo, ...f.valores });
          }
        }
      } catch (err) {
        throw new Error(`Habitatge, ${ctx} : ${err instanceof Error ? err.message : String(err)}`, {
          cause: err,
        });
      }
    }
  }

  return { municipios, territorios, archivos, ultimoPeriodo, revisiones, avisos };
}
