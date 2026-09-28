/**
 * Accès aux séries de Barcelone (fichier compact `barcelona/datos.json`) et
 * définition des indicateurs affichés sur la carte.
 */
import type { CampoRegistro, DatosBarcelona, EntidadBarcelona } from '../../shared/schema.ts';
import type { Ventana } from '../../shared/periods.ts';
import { variacion } from '../../shared/stats.ts';

export type Indicador = 'm2' | 'precio' | 'ventas' | 'variacion';
export type Tipo = 'total' | 'nuevo' | 'usado';

export const INDICADORES: { id: Indicador; corto: string; largo: string }[] = [
  { id: 'm2', corto: '€/m²', largo: 'Precio medio por m² construido' },
  { id: 'precio', corto: 'Precio', largo: 'Precio medio por vivienda' },
  { id: 'ventas', corto: 'Ventas', largo: 'Compraventas inscritas' },
  { id: 'variacion', corto: 'Var. anual', largo: 'Variación anual del €/m²' },
];

export const TIPOS: { id: Tipo; texto: string }[] = [
  { id: 'total', texto: 'Todas' },
  { id: 'usado', texto: 'Usada' },
  { id: 'nuevo', texto: 'Nueva' },
];

export const CAMPO: Record<Exclude<Indicador, 'variacion'>, Record<Tipo, CampoRegistro>> = {
  m2: { total: 'm2Total', nuevo: 'm2Nuevo', usado: 'm2Usado' },
  precio: { total: 'precioTotal', nuevo: 'precioNuevo', usado: 'precioUsado' },
  // Le prix « neuf » ne porte que sur le neuf libre : même base pour le nombre de ventes.
  ventas: { total: 'ventasTotal', nuevo: 'ventasNuevoLibre', usado: 'ventasUsado' },
};
export const CAMPO_SUP: Record<Tipo, CampoRegistro> = { total: 'supTotal', nuevo: 'supNuevoLibre', usado: 'supUsado' };

export class Modelo {
  readonly entidades: EntidadBarcelona[];
  readonly barrios: EntidadBarcelona[];
  readonly distritos: EntidadBarcelona[];
  private readonly porId: Map<string, EntidadBarcelona>;
  private readonly indiceCampo: Map<string, number>;

  constructor(readonly datos: DatosBarcelona) {
    this.entidades = datos.entidades;
    this.barrios = datos.entidades.filter((e) => e.nivel === 'barrio');
    this.distritos = datos.entidades.filter((e) => e.nivel === 'distrito');
    this.porId = new Map(datos.entidades.map((e) => [e.id, e]));
    this.indiceCampo = new Map(datos.campos.map((c, i) => [c, i]));
  }

  entidad(id: string): EntidadBarcelona | undefined {
    return this.porId.get(id);
  }

  periodos(v: Ventana): string[] {
    return this.datos.periodos[v];
  }

  /** Valeur brute publiée ; `null` si non publiée (secret statistique) ou absente. */
  valor(id: string, v: Ventana, i: number, campo: CampoRegistro): number | null {
    const fila = this.datos.valores[v][id]?.[i];
    if (!fila) return null;
    return fila[this.indiceCampo.get(campo)!] ?? null;
  }

  /** Même fenêtre, 4 trimestres plus tôt. */
  indiceAnioAnterior(v: Ventana, i: number): number | null {
    const p = this.datos.periodos[v];
    const actual = p[i];
    if (!actual) return null;
    const [y, q] = actual.split('-T').map(Number) as [number, number];
    const j = p.indexOf(`${y - 1}-T${q}`);
    return j >= 0 ? j : null;
  }

  /** Valeur d'un indicateur pour une entité. */
  indicador(id: string, ind: Indicador, tipo: Tipo, v: Ventana, i: number): number | null {
    if (ind === 'variacion') {
      const j = this.indiceAnioAnterior(v, i);
      if (j == null) return null;
      const campo = CAMPO.m2[tipo];
      return variacion(this.valor(id, v, i, campo), this.valor(id, v, j, campo));
    }
    return this.valor(id, v, i, CAMPO[ind][tipo]);
  }

  /** Série complète d'un champ, indexée par période. */
  serie(id: string, v: Ventana, campo: CampoRegistro): Map<string, number | null> {
    return new Map(this.datos.periodos[v].map((p, i) => [p, this.valor(id, v, i, campo)]));
  }

  /** Valeurs de l'indicateur pour tous les barris, sur toutes les périodes (pour une échelle stable). */
  todosLosValores(ind: Indicador, tipo: Tipo, v: Ventana, nivel: 'barrio' | 'distrito'): number[] {
    const out: number[] = [];
    const lista = nivel === 'barrio' ? this.barrios : this.distritos;
    for (let i = 0; i < this.datos.periodos[v].length; i++) {
      for (const e of lista) {
        const x = this.indicador(e.id, ind, tipo, v, i);
        if (x != null) out.push(x);
      }
    }
    return out;
  }

  /** Rang (1 = valeur la plus haute) d'un barri parmi ceux qui ont une valeur publiée. */
  rango(id: string, ind: Indicador, tipo: Tipo, v: Ventana, i: number): { rango: number; total: number } | null {
    const propio = this.indicador(id, ind, tipo, v, i);
    if (propio == null) return null;
    const lista = this.entidad(id)?.nivel === 'distrito' ? this.distritos : this.barrios;
    const valores = lista.map((e) => this.indicador(e.id, ind, tipo, v, i)).filter((x): x is number => x != null);
    return { rango: valores.filter((x) => x > propio).length + 1, total: valores.length };
  }
}
