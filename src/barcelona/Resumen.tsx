import { useMemo, useState } from 'react';
import { etiquetaPeriodo, type Ventana } from '../../shared/periods.ts';
import { variacion } from '../../shared/stats.ts';
import { fmtEntero, fmtEurosM2, fmtPct } from '../lib/format.ts';
import { colorDe, type Escala } from './escala.ts';
import { FORMATO } from './formatos.ts';
import { CAMPO, INDICADORES, type Indicador, type Modelo, type Tipo } from './modelo.ts';
import type { Nivel } from './Mapa.tsx';
import { NumeroAnimado } from './NumeroAnimado.tsx';

interface Props {
  modelo: Modelo;
  indicador: Indicador;
  tipo: Tipo;
  ventana: Ventana;
  indice: number;
  nivel: Nivel;
  escala: Escala;
  onSeleccion: (id: string) => void;
}

const MINIMOS = [0, 10, 30, 100];

/** Vue d'ensemble de la ville et classement des zones pour l'indicateur choisi. */
export function Resumen({ modelo, indicador, tipo, ventana, indice, nivel, escala, onSeleccion }: Props) {
  const [minVentas, setMinVentas] = useState(10);
  const [orden, setOrden] = useState<'desc' | 'asc'>('desc');
  const periodo = modelo.periodos(ventana)[indice]!;
  const iAnt = modelo.indiceAnioAnterior(ventana, indice);
  const m2 = modelo.valor('bcn', ventana, indice, CAMPO.m2[tipo]);
  const m2Ant = iAnt == null ? null : modelo.valor('bcn', ventana, iAnt, CAMPO.m2[tipo]);
  const ventas = modelo.valor('bcn', ventana, indice, 'ventasTotal');
  const indDef = INDICADORES.find((x) => x.id === indicador)!;

  const filas = useMemo(() => {
    const lista = nivel === 'barrio' ? modelo.barrios : modelo.distritos;
    return lista
      .map((e) => ({
        e,
        valor: modelo.indicador(e.id, indicador, tipo, ventana, indice),
        ventas: modelo.valor(e.id, ventana, indice, CAMPO.ventas[tipo]),
      }))
      .filter((x) => x.valor != null && (x.ventas ?? 0) >= minVentas)
      .sort((a, b) => (orden === 'desc' ? b.valor! - a.valor! : a.valor! - b.valor!));
  }, [modelo, nivel, indicador, tipo, ventana, indice, minVentas, orden]);
  const sinDatos = (nivel === 'barrio' ? 73 : 10) - filas.length;
  const maxAbs = Math.max(...filas.map((f) => Math.abs(f.valor!)), 1e-9);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--acento)]">Barcelona · ciudad</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {m2 == null ? '—' : <NumeroAnimado valor={m2} formato={fmtEurosM2} />}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--tinta-suave)]">
          {variacion(m2, m2Ant) != null && (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                variacion(m2, m2Ant)! > 0
                  ? 'bg-[var(--sube-fondo)] text-[var(--sube)]'
                  : 'bg-[var(--baja-fondo)] text-[var(--baja)]'
              }`}
            >
              {fmtPct(variacion(m2, m2Ant)!)} en un año
            </span>
          )}
          <span>
            {ventas == null ? '' : `${fmtEntero(ventas)} compraventas · `}
            {etiquetaPeriodo(periodo, ventana)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => onSeleccion('bcn')}
          className="mt-2 text-xs font-semibold text-[var(--acento)] hover:underline"
        >
          Ver la evolución de la ciudad →
        </button>
      </header>

      <section aria-label="Clasificación">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {nivel === 'barrio' ? 'Barrios' : 'Distritos'} por {indDef.corto.toLowerCase()}
          </h2>
          <button
            type="button"
            onClick={() => setOrden((o) => (o === 'desc' ? 'asc' : 'desc'))}
            className="rounded-full px-2 py-1 text-xs font-medium ring-1 ring-[var(--borde)] hover:bg-[var(--hover)]"
          >
            {orden === 'desc' ? 'Mayor primero ↓' : 'Menor primero ↑'}
          </button>
        </div>
        <label className="mb-3 flex items-center gap-2 text-xs text-[var(--tinta-suave)]">
          Mínimo de compraventas
          <select
            id="min-ventas"
            value={minVentas}
            onChange={(e) => setMinVentas(Number(e.target.value))}
            className="rounded-md bg-[var(--hover)] px-1.5 py-0.5 text-[var(--tinta)]"
          >
            {MINIMOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <ol className="flex flex-col">
          {filas.map((f, i) => (
            <li key={f.e.id}>
              <button
                type="button"
                onClick={() => onSeleccion(f.e.id)}
                className="group grid w-full grid-cols-[1.6rem_1fr_auto] items-center gap-x-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-[var(--acento)]"
              >
                <span className="text-xs tabular-nums text-[var(--tinta-suave)]">{i + 1}</span>
                <span className="truncate text-sm">{f.e.nombre}</span>
                <span className="text-sm font-semibold tabular-nums">{FORMATO[indicador](f.valor!)}</span>
                <span />
                <span className="col-span-2 mt-1 h-1 rounded-full bg-[var(--hover)]">
                  <span
                    className="block h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${(Math.abs(f.valor!) / maxAbs) * 100}%`, background: colorDe(escala, f.valor!) }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
        {sinDatos > 0 && (
          <p className="mt-2 text-xs text-[var(--tinta-suave)]">
            {sinDatos} {nivel === 'barrio' ? 'barrios' : 'distritos'} sin datos suficientes o por debajo del mínimo de
            compraventas.
          </p>
        )}
      </section>
    </div>
  );
}
