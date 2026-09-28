import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CAMPOS_REGISTRO,
  datosBarcelonaSchema,
  type DatosBarcelona,
  type EntidadBarcelona,
  type Fuente,
} from '../../shared/schema.ts';
import { compareTrimestres, type Ventana } from '../../shared/periods.ts';
import { normalizarNombre } from './names.ts';
import { cargarBarcelona, type ResultadoBarcelona } from './sources/habitatge/barcelona.ts';
import { HABITATGE_INDEX_BCN } from './sources/habitatge/discover.ts';
import { BARRIS_FUENTE_OFICIAL, prepararGeometria } from './sources/bcn/geometria.ts';

/** Convertit les séries en tableaux compacts alignés sur une liste de périodes commune. */
export function compactar(res: Pick<ResultadoBarcelona, 'entidades'>, distritoDe: Map<string, string>): DatosBarcelona {
  const ventanas: Ventana[] = ['T', '4T'];
  const periodos = {} as DatosBarcelona['periodos'];
  const valores = { T: {}, '4T': {} } as DatosBarcelona['valores'];

  for (const v of ventanas) {
    const todos = new Set<string>();
    for (const e of res.entidades.values()) for (const p of e.series[v].keys()) todos.add(p);
    periodos[v] = [...todos].sort(compareTrimestres);
    for (const e of res.entidades.values()) {
      valores[v][e.id] = periodos[v].map((p) => {
        const r = e.series[v].get(p);
        return r ? CAMPOS_REGISTRO.map((c) => r[c]) : null;
      });
    }
  }

  const orden = (e: { nivel: string; codigo: number | null }) =>
    (e.nivel === 'ciudad' ? 0 : e.nivel === 'distrito' ? 100 : 200) + (e.codigo ?? 0);
  const entidades: EntidadBarcelona[] = [...res.entidades.values()]
    .sort((a, b) => orden(a) - orden(b))
    .map((e) => ({
      id: e.id,
      nivel: e.nivel,
      codigo: e.codigo,
      nombre: e.nombre,
      ...(e.nivel === 'barrio' ? { distrito: distritoDe.get(e.id)! } : {}),
    }));

  return { campos: [...CAMPOS_REGISTRO], periodos, entidades, valores };
}

export async function buildBarcelona(salida: string, anioActual: number): Promise<Fuente[]> {
  const ahora = new Date().toISOString();
  const log = (m: string) => console.log(`[pipeline] ${m}`);

  log('Barcelona : tableaux par districte et barri…');
  const res = await cargarBarcelona(anioActual);
  log(
    `  ${res.archivos.length} fichiers, 84 entités, dernière période ${res.ultimoPeriodo}, ${res.revisiones} révisions.`,
  );

  log('Barcelona : limites des barris…');
  const geo = await prepararGeometria();

  // Contrôle croisé : les noms des barris doivent concorder entre statistique et géométrie.
  for (const [id, nombreGeo] of geo.nombres) {
    const e = res.entidades.get(id);
    if (!e) throw new Error(`Barri ${id} (${nombreGeo}) absent de la statistique.`);
    const [a, b] = [normalizarNombre(e.nombre), normalizarNombre(nombreGeo)];
    if (a !== b && !a.includes(b) && !b.includes(a)) {
      log(`  ⚠ noms différents pour ${id} : « ${e.nombre} » (statistique) / « ${nombreGeo} » (limites)`);
    }
  }

  const datos = compactar(res, geo.distritoDe);
  const r = datosBarcelonaSchema.safeParse(datos);
  if (!r.success) throw new Error(`Validation de barcelona/datos.json échouée :\n${r.error.message}`);

  const dir = path.join(salida, 'barcelona');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'datos.json'), JSON.stringify(r.data));
  await writeFile(path.join(dir, 'barrios.geojson'), geo.barrios);
  await writeFile(path.join(dir, 'distritos.geojson'), geo.distritos);
  log(`  écrit dans ${dir}.`);

  return [
    {
      id: 'registradores-bcn',
      nombre: "Compravendes d'habitatges registrades i preu de venda a Barcelona",
      organismo: "Secretaria d'Habitatge, Generalitat de Catalunya, a partir de datos del Colegio de Registradores",
      url: HABITATGE_INDEX_BCN,
      licencia: 'Datos abiertos de la Generalitat de Catalunya (reutilización con cita de la fuente)',
      descargado: ahora,
      ultimoPeriodo: res.ultimoPeriodo,
      archivos: res.archivos.length,
    },
    {
      id: 'barris',
      nombre: 'Límites de barrios y distritos (Unitats administratives)',
      organismo: 'Ajuntament de Barcelona',
      url: BARRIS_FUENTE_OFICIAL,
      licencia: 'CC BY 4.0',
      descargado: ahora,
      ultimoPeriodo: null,
      archivos: 1,
    },
  ];
}
