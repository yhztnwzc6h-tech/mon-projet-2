import type { Historico, Notarial, Registro } from '../../shared/schema.ts';
import { addTrimestres, compareTrimestres, type Ventana } from '../../shared/periods.ts';
import { variacion } from '../../shared/stats.ts';

export type TipoVivienda = 'total' | 'nuevo' | 'usado';

export const ETIQUETA_TIPO: Record<TipoVivienda, string> = {
  total: 'Toda la vivienda',
  nuevo: 'Nueva (libre)',
  usado: 'Usada',
};

type CampoNum = Exclude<keyof Registro, 'periodo'>;

export const CAMPO_M2: Record<TipoVivienda, CampoNum> = { total: 'm2Total', nuevo: 'm2Nuevo', usado: 'm2Usado' };
export const CAMPO_PRECIO: Record<TipoVivienda, CampoNum> = {
  total: 'precioTotal',
  nuevo: 'precioNuevo',
  usado: 'precioUsado',
};
/** Base de ventes de chaque prix : le prix « nuevo » ne porte que sur le neuf libre. */
export const CAMPO_VENTAS: Record<TipoVivienda, CampoNum> = {
  total: 'ventasTotal',
  nuevo: 'ventasNuevoLibre',
  usado: 'ventasUsado',
};
export const CAMPO_SUP: Record<TipoVivienda, CampoNum> = {
  total: 'supTotal',
  nuevo: 'supNuevoLibre',
  usado: 'supUsado',
};

export function registro(h: Historico | undefined, ventana: Ventana, periodo: string): Registro | undefined {
  return h?.registradores[ventana].find((r) => r.periodo === periodo);
}

export interface ValorComparado {
  valor: number | null;
  anterior: number | null;
  /** Variation sur un an (même fenêtre, 4 trimestres plus tôt). */
  variacion: number | null;
  periodoAnterior: string;
}

export function valorConVariacion(
  h: Historico | undefined,
  ventana: Ventana,
  periodo: string,
  campo: CampoNum,
): ValorComparado {
  const periodoAnterior = addTrimestres(periodo, -4);
  const valor = registro(h, ventana, periodo)?.[campo] ?? null;
  const anterior = registro(h, ventana, periodoAnterior)?.[campo] ?? null;
  return { valor, anterior, variacion: variacion(valor, anterior), periodoAnterior };
}

/** Périodes disponibles (les plus récentes d'abord). */
export function periodosDisponibles(h: Historico | undefined, ventana: Ventana): string[] {
  return (h?.registradores[ventana] ?? []).map((r) => r.periodo).sort((a, b) => compareTrimestres(b, a));
}

/** Dernière donnée notariale publiée jusqu'à `periodo` inclus (les deux sources n'ont pas le même calendrier). */
export function notarialHasta(h: Historico | undefined, ventana: Ventana, periodo: string): Notarial | undefined {
  const serie = h?.notarios?.[ventana] ?? [];
  let mejor: Notarial | undefined;
  for (const n of serie) {
    if (compareTrimestres(n.periodo, periodo) <= 0 && (!mejor || compareTrimestres(n.periodo, mejor.periodo) > 0)) {
      mejor = n;
    }
  }
  return mejor;
}
