import { useMemo } from 'react';
import { etiquetaPeriodo, type Ventana } from '../../shared/periods.ts';
import { variacion } from '../../shared/stats.ts';
import { GraficoSeries, type Serie } from '../components/GraficoSeries.tsx';
import { fmtEntero, fmtEuros, fmtEurosM2, fmtM2, fmtPct } from '../lib/format.ts';
import { FORMATO } from './formatos.ts';
import { CAMPO, CAMPO_SUP, INDICADORES, TIPOS, type Indicador, type Modelo, type Tipo } from './modelo.ts';
import { NumeroAnimado } from './NumeroAnimado.tsx';

interface Props {
  modelo: Modelo;
  id: string;
  indicador: Indicador;
  tipo: Tipo;
  ventana: Ventana;
  indice: number;
  onCerrar: () => void;
  onSeleccion: (id: string) => void;
}

function Variacion({ v, contra }: { v: number | null; contra: string }) {
  if (v == null) return <span className="text-xs text-[var(--tinta-suave)]">Sin variación anual</span>;
  const sube = v > 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${
          sube ? 'bg-[var(--sube-fondo)] text-[var(--sube)]' : 'bg-[var(--baja-fondo)] text-[var(--baja)]'
        }`}
      >
        {sube ? '▲' : v < 0 ? '▼' : '■'} {fmtPct(v)}
      </span>
      <span className="text-[var(--tinta-suave)]">vs. {contra}</span>
    </span>
  );
}

export function Ficha({ modelo, id, indicador, tipo, ventana, indice, onCerrar, onSeleccion }: Props) {
  const e = modelo.entidad(id)!;
  const distrito = e.distrito ? modelo.entidad(e.distrito) : undefined;
  const periodo = modelo.periodos(ventana)[indice]!;
  const iAnterior = modelo.indiceAnioAnterior(ventana, indice);
  const etiqueta = etiquetaPeriodo(periodo, ventana);
  const etiquetaAnterior = iAnterior != null ? etiquetaPeriodo(modelo.periodos(ventana)[iAnterior]!, ventana) : '';

  const v = (campo: Parameters<Modelo['valor']>[3]) => modelo.valor(id, ventana, indice, campo);
  const vPrev = (campo: Parameters<Modelo['valor']>[3]) =>
    iAnterior == null ? null : modelo.valor(id, ventana, iAnterior, campo);

  const m2 = v(CAMPO.m2[tipo]);
  const precio = v(CAMPO.precio[tipo]);
  const sup = v(CAMPO_SUP[tipo]);
  const ventas = v('ventasTotal');
  const ventasTipo = v(CAMPO.ventas[tipo]);
  const nl = v('ventasNuevoLibre');
  const np = v('ventasNuevoProtegido');
  const us = v('ventasUsado');
  const rango = modelo.rango(id, 'm2', tipo, ventana, indice);

  const series = useMemo<Serie[]>(() => {
    const campo = CAMPO.m2[tipo];
    const s: Serie[] = [{ etiqueta: e.nombre, color: '--serie-1', puntos: modelo.serie(id, ventana, campo) }];
    if (distrito)
      s.push({ etiqueta: distrito.nombre, color: '--serie-2', puntos: modelo.serie(distrito.id, ventana, campo) });
    if (id !== 'bcn')
      s.push({
        etiqueta: 'Barcelona',
        color: '--serie-3',
        puntos: modelo.serie('bcn', ventana, campo),
        discontinua: true,
      });
    return s;
  }, [modelo, id, e.nombre, distrito, ventana, tipo]);

  const seriesVentas = useMemo<Serie[]>(
    () => [
      { etiqueta: 'Compraventas', color: '--serie-1', puntos: modelo.serie(id, ventana, 'ventasTotal'), barras: true },
    ],
    [modelo, id, ventana],
  );

  // Comparaison de l'indicateur courant : zone, districte, ville.
  const comparacion = [
    { id, nombre: e.nombre },
    ...(distrito ? [{ id: distrito.id, nombre: distrito.nombre }] : []),
    ...(id !== 'bcn' ? [{ id: 'bcn', nombre: 'Barcelona' }] : []),
  ].map((x) => ({ ...x, valor: modelo.indicador(x.id, indicador, tipo, ventana, indice) }));
  const maxComp = Math.max(...comparacion.map((x) => Math.abs(x.valor ?? 0)), 1e-9);
  const indDef = INDICADORES.find((x) => x.id === indicador)!;
  const tipoTxt = TIPOS.find((t) => t.id === tipo)!.texto.toLowerCase();

  const motivoSinPrecio =
    ventasTipo != null && ventasTipo < 3
      ? `Menos de 3 compraventas (${fmtEntero(ventasTipo)}) : la fuente no publica el precio.`
      : 'La fuente no publica el precio para este periodo.';

  return (
    <article className="flex flex-col gap-5" aria-label={`Ficha de ${e.nombre}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--acento)]">
            {e.nivel === 'barrio'
              ? `Barrio · ${distrito?.nombre ?? ''}`
              : e.nivel === 'distrito'
                ? 'Distrito'
                : 'Ciudad'}
          </p>
          <h2 className="text-2xl font-bold leading-tight tracking-tight [text-wrap:balance]">{e.nombre}</h2>
          <p className="mt-0.5 text-xs text-[var(--tinta-suave)]">
            {etiqueta} · {ventana === '4T' ? 'últimos 4 trimestres' : 'un trimestre'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-full p-2 text-[var(--tinta-suave)] hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-[var(--acento)]"
          aria-label="Cerrar la ficha"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <section className="rounded-2xl bg-[var(--destacado)] p-4 ring-1 ring-[var(--borde)]">
        <p className="text-xs font-medium text-[var(--tinta-suave)]">
          Precio medio por m² construido · vivienda {tipoTxt}
        </p>
        {m2 == null ? (
          <p className="mt-1 text-lg font-semibold text-[var(--tinta-suave)]">
            Sin datos suficientes
            <span className="mt-1 block text-xs font-normal">{motivoSinPrecio}</span>
          </p>
        ) : (
          <>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              <NumeroAnimado valor={m2} formato={fmtEurosM2} />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Variacion v={variacion(m2, vPrev(CAMPO.m2[tipo]))} contra={etiquetaAnterior} />
              {rango && e.nivel !== 'ciudad' && (
                <span className="rounded-full bg-[var(--hover)] px-2 py-0.5 text-xs font-medium tabular-nums">
                  {rango.rango}.º de {rango.total} {e.nivel === 'barrio' ? 'barrios' : 'distritos'}
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-3">
        {[
          { t: 'Precio medio', v: precio, f: fmtEuros, prev: vPrev(CAMPO.precio[tipo]) },
          { t: 'Superficie media', v: sup, f: fmtM2, prev: vPrev(CAMPO_SUP[tipo]) },
        ].map((x) => (
          <div key={x.t} className="rounded-xl p-3 ring-1 ring-[var(--borde)]">
            <dt className="text-xs text-[var(--tinta-suave)]">{x.t}</dt>
            <dd className="mt-0.5 text-lg font-bold">
              {x.v == null ? (
                <span className="text-sm font-medium text-[var(--tinta-suave)]">Sin datos</span>
              ) : (
                <NumeroAnimado valor={x.v} formato={x.f} />
              )}
            </dd>
            {x.v != null && x.prev != null && (
              <dd className="text-xs tabular-nums text-[var(--tinta-suave)]">
                {fmtPct(variacion(x.v, x.prev)!)} en un año
              </dd>
            )}
          </div>
        ))}
        <div className="col-span-2 rounded-xl p-3 ring-1 ring-[var(--borde)]">
          <dt className="flex items-baseline justify-between text-xs text-[var(--tinta-suave)]">
            <span>Compraventas inscritas</span>
            {ventas != null && vPrev('ventasTotal') != null && (
              <span className="tabular-nums">{fmtPct(variacion(ventas, vPrev('ventasTotal'))!)} en un año</span>
            )}
          </dt>
          <dd className="mt-0.5 text-lg font-bold">
            {ventas == null ? '—' : <NumeroAnimado valor={ventas} formato={fmtEntero} />}
          </dd>
          {ventas != null && ventas > 0 && (
            <dd className="mt-2">
              <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {[
                  { n: us ?? 0, c: 'var(--serie-1)' },
                  { n: nl ?? 0, c: 'var(--serie-2)' },
                  { n: np ?? 0, c: 'var(--serie-3)' },
                ]
                  .filter((x) => x.n > 0)
                  .map((x, i) => (
                    <span
                      key={i}
                      className="h-full transition-[width] duration-700"
                      style={{ width: `${(x.n / ventas) * 100}%`, background: x.c }}
                    />
                  ))}
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-[var(--tinta-suave)]">
                <li>
                  <span className="mr-1 inline-block size-2 rounded-full bg-[var(--serie-1)]" />
                  Usada {us == null ? '—' : fmtEntero(us)}
                </li>
                <li>
                  <span className="mr-1 inline-block size-2 rounded-full bg-[var(--serie-2)]" />
                  Nueva libre {nl == null ? '—' : fmtEntero(nl)}
                </li>
                <li>
                  <span className="mr-1 inline-block size-2 rounded-full bg-[var(--serie-3)]" />
                  Protegida {np == null ? '—' : fmtEntero(np)}
                </li>
              </ul>
            </dd>
          )}
        </div>
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          {indDef.largo} · {etiqueta}
        </h3>
        <ul className="flex flex-col gap-2">
          {comparacion.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                disabled={x.id === id}
                onClick={() => onSeleccion(x.id)}
                className="group w-full text-left disabled:cursor-default"
              >
                <div className="flex justify-between text-xs">
                  <span className={x.id === id ? 'font-semibold' : 'text-[var(--tinta-suave)] group-hover:underline'}>
                    {x.nombre}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {x.valor == null ? 'sin datos' : FORMATO[indicador](x.valor)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--hover)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${x.valor == null ? 0 : (Math.abs(x.valor) / maxComp) * 100}%`,
                      background: x.id === id ? 'var(--serie-1)' : x.id === 'bcn' ? 'var(--serie-3)' : 'var(--serie-2)',
                    }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Evolución del €/m² · vivienda {tipoTxt}</h3>
        <p className="mb-1 text-xs text-[var(--tinta-suave)]">
          {ventana === '4T' ? 'Media de 4 trimestres' : 'Por trimestre'}. Pasa el dedo o el ratón para ver cada periodo.
        </p>
        <GraficoSeries
          series={series}
          formato={fmtEurosM2}
          alto={200}
          titulo={`Evolución del precio por m² en ${e.nombre}`}
        />
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Compraventas inscritas</h3>
        <GraficoSeries series={seriesVentas} formato={fmtEntero} alto={120} titulo={`Compraventas en ${e.nombre}`} />
      </section>

      <p className="text-xs leading-relaxed text-[var(--tinta-suave)]">
        Fuente: Secretaria d’Habitatge (Generalitat de Catalunya), a partir de las compraventas inscritas en el Registro
        de la Propiedad. Precio medio por m² construido tal como se publica; «nueva» = vivienda nueva libre.
      </p>
    </article>
  );
}
