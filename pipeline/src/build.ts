import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import {
  fuentesSchema,
  historicoSchema,
  municipiosSchema,
  type Fuente,
  type Historico,
  type Registro,
} from '../../shared/schema.ts';
import { compareTrimestres } from '../../shared/periods.ts';
import { cargarHabitatge, type Series } from './sources/habitatge/index.ts';
import { HABITATGE_INDEX } from './sources/habitatge/discover.ts';
import { cargarMunicipios, IDESCAT_MUNICIPIS_URL } from './sources/idescat/municipios.ts';
import { cargarMivau, MIVAU_PAGINA, sumar4T } from './sources/mivau/transacciones.ts';
import { crearResolutor } from './territorios.ts';

export interface OpcionesBuild {
  salida: string;
  /** Communes pour lesquelles écrire l'historique ; `null` = toutes. */
  municipios: string[] | null;
  anioActual: number;
}

async function escribir<T>(archivo: string, schema: z.ZodType<T>, datos: T): Promise<void> {
  const r = schema.safeParse(datos);
  if (!r.success) {
    throw new Error(`Validation échouée pour ${archivo} :\n${r.error.message}`);
  }
  await mkdir(path.dirname(archivo), { recursive: true });
  await writeFile(archivo, JSON.stringify(r.data));
}

function ordenar(series: Series | undefined): Historico['registradores'] {
  const orden = (m: Map<string, Registro> | undefined) =>
    [...(m?.values() ?? [])].sort((a, b) => compareTrimestres(a.periodo, b.periodo));
  return { T: orden(series?.T), '4T': orden(series?.['4T']) };
}

export async function build(op: OpcionesBuild): Promise<void> {
  const ahora = new Date().toISOString();
  const log = (msg: string) => console.log(`[pipeline] ${msg}`);

  log('Idescat : communes et comarques…');
  const municipios = await cargarMunicipios();
  log(`  ${municipios.length} communes.`);

  log('Habitatge (Registradores) : découverte et lecture des tableaux…');
  const hab = await cargarHabitatge(op.anioActual);
  log(
    `  ${hab.archivos.length} fichiers, ${hab.municipios.size} communes avec données, ` +
      `dernière période ${hab.ultimoPeriodo}, ${hab.revisiones} valeurs révisées.`,
  );
  const ineConocidos = new Set(municipios.map((m) => m.ine));
  const desconocidos = [...hab.municipios.keys()].filter((ine) => !ineConocidos.has(ine));
  if (desconocidos.length) {
    throw new Error(`Habitatge : codes communaux inconnus de l'Idescat : ${desconocidos.join(', ')}.`);
  }

  log('MIVAU (Notaires) : transactions par commune…');
  const mivau = await cargarMivau(municipios);
  log(`  ${mivau.porIne.size} communes appariées, dernière période ${mivau.ultimoPeriodo}.`);

  // Territoires (comarque, province, Catalogne) à partir des tableaux TERR.
  const resolver = crearResolutor(municipios);
  const territorios = new Map<string, { nivel: string; id: string; nombre: string; series: Series }>();
  for (const t of hab.territorios.values()) {
    const r = resolver(t.seccion, t.nombre);
    if (!r) continue;
    const clave = `${r.nivel}/${r.id}`;
    const previo = territorios.get(clave);
    if (!previo) {
      territorios.set(clave, { ...r, series: t.series });
    } else {
      // Même territoire sous deux graphies : fusion, la plus récente l'emporte.
      for (const v of ['T', '4T'] as const) for (const [p, reg] of t.series[v]) previo.series[v].set(p, reg);
    }
  }
  log(`  ${territorios.size} territoires (comarques, provinces, Catalogne).`);

  const out = op.salida;
  await escribir(path.join(out, 'municipios.json'), municipiosSchema, municipios);

  const seleccion = op.municipios ? municipios.filter((m) => op.municipios!.includes(m.ine)) : municipios;
  if (op.municipios && seleccion.length !== op.municipios.length) {
    throw new Error(`Communes demandées introuvables : ${op.municipios.join(', ')}.`);
  }

  const territoriosNecesarios = new Set<string>(['catalunya/CAT']);
  for (const m of seleccion) {
    const notarial = mivau.porIne.get(m.ine)!;
    const h: Historico = {
      nivel: 'municipio',
      id: m.ine,
      nombre: m.nombre,
      comarca: m.comarca,
      provincia: m.provincia,
      registradores: ordenar(hab.municipios.get(m.ine)?.series),
      notarios: { T: notarial, '4T': sumar4T(notarial) },
    };
    await escribir(path.join(out, 'historico', 'municipio', `${m.ine}.json`), historicoSchema, h);
    territoriosNecesarios.add(`comarca/${m.comarca.id}`);
    territoriosNecesarios.add(`provincia/${m.provincia.id}`);
  }

  for (const clave of territoriosNecesarios) {
    const t = territorios.get(clave);
    if (!t) throw new Error(`Territoire ${clave} absent des tableaux Habitatge.`);
    const h: Historico = {
      nivel: t.nivel as Historico['nivel'],
      id: t.id,
      nombre: t.nombre,
      registradores: ordenar(t.series),
    };
    const archivo =
      t.nivel === 'catalunya'
        ? path.join(out, 'historico', 'catalunya.json')
        : path.join(out, 'historico', t.nivel, `${t.id}.json`);
    await escribir(archivo, historicoSchema, h);
  }

  const fuentes: Fuente[] = [
    {
      id: 'registradores',
      nombre: "Compravendes d'habitatges registrades i preu de venda",
      organismo: "Secretaria d'Habitatge, Generalitat de Catalunya, a partir de datos del Colegio de Registradores",
      url: HABITATGE_INDEX,
      licencia: 'Datos abiertos de la Generalitat de Catalunya (reutilización con cita de la fuente)',
      descargado: ahora,
      ultimoPeriodo: hab.ultimoPeriodo,
      archivos: hab.archivos.length,
    },
    {
      id: 'notarios',
      nombre: 'Transacciones inmobiliarias de viviendas por municipios',
      organismo: 'Ministerio de Vivienda y Agenda Urbana, a partir de datos del Consejo General del Notariado',
      url: MIVAU_PAGINA,
      licencia: 'Reutilización permitida citando la fuente (aviso legal del Ministerio)',
      descargado: ahora,
      ultimoPeriodo: mivau.ultimoPeriodo,
      archivos: 3,
    },
    {
      id: 'idescat',
      nombre: 'Codis territorials: municipis',
      organismo: "Institut d'Estadística de Catalunya (Idescat)",
      url: IDESCAT_MUNICIPIS_URL,
      licencia: 'Condiciones de uso de Idescat (reutilización con cita de la fuente)',
      descargado: ahora,
      ultimoPeriodo: null,
      archivos: 1,
    },
  ];
  await escribir(path.join(out, 'sources.json'), fuentesSchema, { generado: ahora, fuentes });
  log(`Terminé : ${seleccion.length} commune(s), ${territoriosNecesarios.size} territoire(s) écrits dans ${out}.`);
}
