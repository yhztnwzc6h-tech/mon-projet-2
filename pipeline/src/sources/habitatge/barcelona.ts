/**
 * Barcelone : statistique du registre par ville, districte (10) et barri (73),
 * publiée par la Secretaria d'Habitatge depuis le 4T 2013.
 */
import type { Registro } from '../../../../shared/schema.ts';
import { compareTrimestres, type Ventana } from '../../../../shared/periods.ts';
import { download } from '../../http.ts';
import { discoverHabitatgeFiles, type HabitatgeFile } from './discover.ts';
import { leerLibro } from './index.ts';
import { parseHojaBarcelona, type NivelBarcelona } from './parse.ts';

export interface EntidadBarcelona {
  /** `bcn`, `d01`…`d10`, `b01`…`b73`. */
  id: string;
  nivel: NivelBarcelona;
  codigo: number | null;
  nombre: string;
  series: Record<Ventana, Map<string, Registro>>;
}

export interface ResultadoBarcelona {
  entidades: Map<string, EntidadBarcelona>;
  archivos: HabitatgeFile[];
  ultimoPeriodo: string;
  revisiones: number;
}

export function idEntidad(nivel: NivelBarcelona, codigo: number | null): string {
  if (nivel === 'ciudad') return 'bcn';
  return `${nivel === 'distrito' ? 'd' : 'b'}${String(codigo).padStart(2, '0')}`;
}

/**
 * Ordre de lecture (le dernier lu l'emporte) : cumuls depuis janvier d'abord (prix
 * arrondis à la centaine d'euros), puis fichiers trimestriels et « 12 mois », plus précis.
 */
function prioridad(f: HabitatgeFile): number {
  return f.year * 10 + (/Trimestrals_/i.test(f.url) ? 2 : /_acumulat_/i.test(f.url) ? 0 : 1);
}

export async function cargarBarcelona(anioActual: number): Promise<ResultadoBarcelona> {
  const archivos = (await discoverHabitatgeFiles(anioActual, 'barcelona'))
    .filter((f) => f.scope === 'barcelona')
    .sort((a, b) => prioridad(a) - prioridad(b));

  const entidades = new Map<string, EntidadBarcelona>();
  let revisiones = 0;
  let ultimoPeriodo = '';

  for (const archivo of archivos) {
    const nombreArchivo = archivo.url.split('/').pop();
    for (const hoja of leerLibro(await download(archivo.url, { maxAgeHours: 24 * 7 }))) {
      let r;
      try {
        r = parseHojaBarcelona(hoja.nombre, hoja.filas);
      } catch (err) {
        throw new Error(`Habitatge Barcelona, ${nombreArchivo} › ${hoja.nombre} : ${(err as Error).message}`, {
          cause: err,
        });
      }
      if (r.tipo !== 'dato') continue;
      for (const f of r.filas) {
        const id = idEntidad(f.nivel, f.codigo);
        let e = entidades.get(id);
        if (!e) {
          e = { id, nivel: f.nivel, codigo: f.codigo, nombre: f.nombre, series: { T: new Map(), '4T': new Map() } };
          entidades.set(id, e);
        }
        e.nombre = f.nombre; // le nom le plus récent l'emporte
        const reg: Registro = { periodo: r.periodo, ...f.valores };
        const previo = e.series[r.ventana].get(r.periodo);
        if (previo && JSON.stringify(previo) !== JSON.stringify(reg)) revisiones++;
        e.series[r.ventana].set(r.periodo, reg);
      }
      if (!ultimoPeriodo || compareTrimestres(r.periodo, ultimoPeriodo) > 0) ultimoPeriodo = r.periodo;
    }
  }
  if (entidades.size !== 84) throw new Error(`Barcelona : ${entidades.size} entités lues, attendu 84 (1 + 10 + 73).`);
  return { entidades, archivos, ultimoPeriodo, revisiones };
}
