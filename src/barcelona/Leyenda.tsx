import { SIN_DATOS, type Escala } from './escala.ts';
import { FORMATO_CORTO } from './formatos.ts';
import { INDICADORES, type Indicador } from './modelo.ts';

interface Props {
  escala: Escala;
  indicador: Indicador;
  oscuro: boolean;
  historica: boolean;
  onHistorica: (v: boolean) => void;
}

export function Leyenda({ escala, indicador, oscuro, historica, onHistorica }: Props) {
  const f = FORMATO_CORTO[indicador];
  const def = INDICADORES.find((x) => x.id === indicador)!;
  const etiquetas = escala.colores.map((_, i) => {
    const lo = escala.cortes[i - 1];
    const hi = escala.cortes[i];
    if (lo == null) return `< ${f(hi!)}`;
    if (hi == null) return `≥ ${f(lo)}`;
    return `${f(lo)} – ${f(hi)}`;
  });
  return (
    <figure className="text-[11px]" aria-label={`Leyenda: ${def.largo}`}>
      <figcaption className="mb-1.5 font-semibold">{def.largo}</figcaption>
      {!escala.divergente && (
        <div
          className="mb-2 flex items-center gap-1 text-[var(--tinta-suave)]"
          role="radiogroup"
          aria-label="Escala de colores"
        >
          <span>Colores:</span>
          {[
            { v: false, t: 'periodo elegido' },
            { v: true, t: '2013–hoy' },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              role="radio"
              aria-checked={historica === o.v}
              onClick={() => onHistorica(o.v)}
              className={`rounded-full px-2 py-0.5 ${historica === o.v ? 'bg-[var(--hover)] font-semibold text-[var(--tinta)]' : 'hover:underline'}`}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-1">
        {[
          ...escala.colores.map((c, i) => ({ c, t: etiquetas[i]! })).reverse(),
          { c: oscuro ? SIN_DATOS.oscuro : SIN_DATOS.claro, t: 'Sin datos suficientes' },
        ].map((x) => (
          <li key={x.t} className="flex items-center gap-2 tabular-nums">
            <span className="h-3 w-5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: x.c }} />
            {x.t}
          </li>
        ))}
      </ul>
    </figure>
  );
}
