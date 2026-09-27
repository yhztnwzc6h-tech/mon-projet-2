import { useEffect, useRef } from 'react';
import uPlot, { type AlignedData, type Options } from 'uplot';
import { parseTrimestre } from '../../shared/periods.ts';
import { fmtEntero } from '../lib/format.ts';

export interface Serie {
  etiqueta: string;
  /** Variable CSS de la couleur (ex. `--color-serie-municipio`). */
  color: string;
  puntos: Map<string, number | null>;
  discontinua?: boolean;
  barras?: boolean;
}

interface Props {
  series: Serie[];
  formato: (n: number) => string;
  alto?: number;
  titulo: string;
}

/** Milieu du trimestre, en secondes (axe temporel d'uPlot). */
function fechaDeTrimestre(p: string): number {
  const t = parseTrimestre(p);
  return Date.UTC(t.year, (t.q - 1) * 3 + 1, 15) / 1000;
}

function colorCss(variable: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || '#888';
}

export function GraficoSeries({ series, formato, alto = 260, titulo }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;

    const periodos = [...new Set(series.flatMap((s) => [...s.puntos.keys()]))].sort(
      (a, b) => fechaDeTrimestre(a) - fechaDeTrimestre(b),
    );
    const datos: AlignedData = [
      periodos.map(fechaDeTrimestre),
      ...series.map((s) => periodos.map((p) => s.puntos.get(p) ?? null)),
    ];
    const oscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const ejes = oscuro ? '#94a3b8' : '#475569';
    const rejilla = oscuro ? 'rgba(148,163,184,0.15)' : 'rgba(71,85,105,0.12)';

    const opciones: Options = {
      width: el.clientWidth,
      height: alto,
      title: undefined,
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: true } },
      axes: [
        { stroke: ejes, grid: { stroke: rejilla }, ticks: { stroke: rejilla } },
        {
          stroke: ejes,
          grid: { stroke: rejilla },
          ticks: { stroke: rejilla },
          size: 56,
          values: (_u, vals) => vals.map((v) => fmtEntero(v)),
        },
      ],
      series: [
        {
          label: 'Periodo',
          value: (_u, v) => {
            if (v == null) return '';
            const d = new Date(v * 1000);
            return `${Math.floor(d.getUTCMonth() / 3) + 1}T ${d.getUTCFullYear()}`;
          },
        },
        ...series.map((s) => {
          const c = colorCss(s.color);
          return {
            label: s.etiqueta,
            stroke: c,
            width: s.barras ? 0 : 2,
            fill: s.barras ? c : undefined,
            dash: s.discontinua ? [6, 4] : undefined,
            spanGaps: false,
            points: { show: false },
            paths: s.barras ? uPlot.paths.bars!({ size: [0.6, 12] }) : undefined,
            // idx null = curseur hors du graphique : rien à afficher dans la légende.
            value: (_u: uPlot, v: number | null, _s: number, idx: number | null) =>
              idx == null ? '' : v == null ? 'sin datos' : formato(v),
          };
        }),
      ],
    };

    const plot = new uPlot(opciones, datos, el);
    const ro = new ResizeObserver(() => plot.setSize({ width: el.clientWidth, height: alto }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.destroy();
    };
  }, [series, formato, alto]);

  return <div ref={contenedor} role="img" aria-label={titulo} className="w-full" />;
}
