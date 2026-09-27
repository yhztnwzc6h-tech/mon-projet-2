/**
 * Schémas des fichiers produits dans `public/data/`.
 * Le pipeline valide chaque fichier avec ces schémas avant de l'écrire ;
 * l'application n'en importe que les types.
 */
import { z } from 'zod';

const periodo = z.string().regex(/^\d{4}-T[1-4]$/);
const ine = z.string().regex(/^\d{5}$/);
const entero = z.number().int().nonnegative().nullable();
const positivo = (max: number) => z.number().positive().max(max).nullable();

/**
 * Statistique du registre (Registradores, publiée par la Secretaria d'Habitatge).
 * `null` = non publié (secret statistique : moins de 3 ventes) ou non applicable.
 */
export const registroSchema = z.object({
  periodo,
  ventasTotal: entero,
  ventasNuevoLibre: entero,
  ventasNuevoProtegido: entero,
  ventasUsado: entero,
  /** Surface moyenne, m² construits. */
  supTotal: positivo(2000),
  supNuevoLibre: positivo(2000),
  supNuevoProtegido: positivo(2000),
  supUsado: positivo(2000),
  /** Prix total moyen, en euros. « Nuevo » = neuf libre uniquement. */
  precioTotal: positivo(50_000_000),
  precioNuevo: positivo(50_000_000),
  precioUsado: positivo(50_000_000),
  /** Prix moyen au m² construit, en euros (moyenne des prix au m² de chaque vente). */
  m2Total: positivo(100_000),
  m2Nuevo: positivo(100_000),
  m2Usado: positivo(100_000),
});
export type Registro = z.infer<typeof registroSchema>;

/** Transactions notariales (MIVAU). Nombre uniquement, pas de prix. */
export const notarialSchema = z.object({
  periodo,
  total: entero,
  nueva: entero,
  segundaMano: entero,
  /** Donnée marquée « provisional » par le ministère. */
  provisional: z.boolean(),
});
export type Notarial = z.infer<typeof notarialSchema>;

const serieRegistro = z.object({
  T: z.array(registroSchema),
  '4T': z.array(registroSchema),
});

export const territorioRefSchema = z.object({ id: z.string(), nombre: z.string() });
export type TerritorioRef = z.infer<typeof territorioRefSchema>;

export const nivelSchema = z.enum(['municipio', 'comarca', 'provincia', 'catalunya']);
export type Nivel = z.infer<typeof nivelSchema>;

export const historicoSchema = z.object({
  nivel: nivelSchema,
  id: z.string(),
  nombre: z.string(),
  comarca: territorioRefSchema.optional(),
  provincia: territorioRefSchema.optional(),
  registradores: serieRegistro,
  /** Uniquement au niveau communal ; les sommes sur 4 trimestres sont calculées (voir `4T`). */
  notarios: z
    .object({
      T: z.array(notarialSchema),
      /** Somme des 4 trimestres publiés ; absente si l'un d'eux manque. */
      '4T': z.array(notarialSchema),
    })
    .optional(),
});
export type Historico = z.infer<typeof historicoSchema>;

export const municipioSchema = z.object({
  ine,
  nombre: z.string().min(1),
  comarca: territorioRefSchema,
  provincia: territorioRefSchema,
});
export type Municipio = z.infer<typeof municipioSchema>;
export const municipiosSchema = z.array(municipioSchema);

export const fuenteSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  organismo: z.string(),
  url: z.url(),
  licencia: z.string(),
  descargado: z.iso.datetime(),
  ultimoPeriodo: periodo.nullable(),
  archivos: z.number().int().nonnegative(),
});
export type Fuente = z.infer<typeof fuenteSchema>;
export const fuentesSchema = z.object({
  generado: z.iso.datetime(),
  fuentes: z.array(fuenteSchema),
});
export type Fuentes = z.infer<typeof fuentesSchema>;
