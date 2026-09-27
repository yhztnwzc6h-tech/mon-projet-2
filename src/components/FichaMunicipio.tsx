import { useEffect, useMemo, useState } from 'react';
import type { Fuentes, Historico } from '../../shared/schema.ts';
import { etiquetaPeriodo, type Ventana } from '../../shared/periods.ts';
import {
  cargarFuentes,
  cargarHistoricoCatalunya,
  cargarHistoricoComarca,
  cargarHistoricoMunicipio,
  cargarHistoricoProvincia,
} from '../lib/data.ts';
import { fmtEntero, fmtEuros, fmtEurosM2, fmtFecha, fmtM2, fmtPct } from '../lib/format.ts';
import {
  CAMPO_M2,
  CAMPO_PRECIO,
  CAMPO_SUP,
  ETIQUETA_TIPO,
  notarialHasta,
  periodosDisponibles,
  registro,
  valorConVariacion,
  type TipoVivienda,
} from '../lib/indicadores.ts';
import { addTrimestres } from '../../shared/periods.ts';
import { variacion } from '../../shared/stats.ts';
import { Cifra } from './Cifra.tsx';
import { GraficoSeries, type Serie } from './GraficoSeries.tsx';
import { Segmentado } from './Segmentado.tsx';

interface Datos {
  municipio: Historico;
  comarca: Historico;
  provincia: Historico;
  catalunya: Historico;
  fuentes: Fuentes;
}

const FUENTE_REG = 'Registradores (Secretaria d’Habitatge)';
const FUENTE_NOT = 'Notarios (Ministerio de Vivienda)';

/** Un nombre absent reste affiché comme absent, jamais comme 0. */
const n0 = (n: number | null) => (n == null ? '—' : fmtEntero(n));

const ETIQUETA_VENTANA: Record<Ventana, string> = { '4T': '4 trimestres', T: 'Trimestre' };

export function FichaMunicipio({ ine }: { ine: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>('4T');
  const [periodoElegido, setPeriodoElegido] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoVivienda>('total');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const municipio = await cargarHistoricoMunicipio(ine);
      const [comarca, provincia, catalunya, fuentes] = await Promise.all([
        cargarHistoricoComarca(municipio.comarca!.id),
        cargarHistoricoProvincia(municipio.provincia!.id),
        cargarHistoricoCatalunya(),
        cargarFuentes(),
      ]);
      if (vivo) setDatos({ municipio, comarca, provincia, catalunya, fuentes });
    })().catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [ine]);

  const periodos = useMemo(() => periodosDisponibles(datos?.municipio, ventana), [datos, ventana]);
  const periodo = periodoElegido && periodos.includes(periodoElegido) ? periodoElegido : periodos[0];

  const seriesPrecio = useMemo<Serie[]>(() => {
    if (!datos) return [];
    const campo = CAMPO_M2[tipo];
    const serie = (h: Historico) => new Map(h.registradores[ventana].map((r) => [r.periodo, r[campo]]));
    return [
      { etiqueta: datos.municipio.nombre, color: '--color-serie-municipio', puntos: serie(datos.municipio) },
      { etiqueta: `Comarca: ${datos.comarca.nombre}`, color: '--color-serie-comarca', puntos: serie(datos.comarca) },
      {
        etiqueta: `Provincia: ${datos.provincia.nombre}`,
        color: '--color-serie-provincia',
        puntos: serie(datos.provincia),
      },
      { etiqueta: 'Catalunya', color: '--color-serie-catalunya', puntos: serie(datos.catalunya), discontinua: true },
    ];
  }, [datos, ventana, tipo]);

  const seriesVentas = useMemo<Serie[]>(() => {
    if (!datos) return [];
    return [
      {
        etiqueta: 'Compraventas inscritas (Registradores)',
        color: '--color-serie-municipio',
        puntos: new Map(datos.municipio.registradores[ventana].map((r) => [r.periodo, r.ventasTotal])),
        barras: true,
      },
      {
        etiqueta: 'Compraventas ante notario (MIVAU)',
        color: '--color-serie-comarca',
        puntos: new Map((datos.municipio.notarios?.[ventana] ?? []).map((n) => [n.periodo, n.total])),
      },
    ];
  }, [datos, ventana]);

  if (error) {
    return <p className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>;
  }
  if (!datos) return <p className="p-4 text-slate-500">Cargando…</p>;

  const { municipio: m } = datos;
  if (!periodo) {
    return (
      <section className="p-4">
        <h2 className="text-2xl font-semibold">{m.nombre}</h2>
        <p className="mt-2 text-slate-500">
          Sin datos suficientes: la estadística registral solo se publica para municipios de más de 5.000 habitantes
          (más de 2.000 desde 2025).
        </p>
      </section>
    );
  }

  const etiqueta = etiquetaPeriodo(periodo, ventana);
  const etiquetaAnterior = etiquetaPeriodo(addTrimestres(periodo, -4), ventana);
  const reg = registro(m, ventana, periodo);
  const m2 = valorConVariacion(m, ventana, periodo, CAMPO_M2[tipo]);
  const precio = valorConVariacion(m, ventana, periodo, CAMPO_PRECIO[tipo]);
  const ventas = valorConVariacion(m, ventana, periodo, 'ventasTotal');
  const notarial = notarialHasta(m, ventana, periodo);
  const notarialPrev = notarial && notarialHasta(m, ventana, addTrimestres(notarial.periodo, -4));
  const notarialVar =
    notarial && notarialPrev?.periodo === addTrimestres(notarial.periodo, -4)
      ? variacion(notarial.total, notarialPrev.total)
      : null;

  const filasComparacion = [
    { nombre: m.nombre, h: m, color: '--color-serie-municipio' },
    { nombre: `Comarca: ${datos.comarca.nombre}`, h: datos.comarca, color: '--color-serie-comarca' },
    { nombre: `Provincia: ${datos.provincia.nombre}`, h: datos.provincia, color: '--color-serie-provincia' },
    { nombre: 'Catalunya', h: datos.catalunya, color: '--color-serie-catalunya' },
  ];

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-semibold tracking-tight">{m.nombre}</h2>
        <p className="text-slate-600 dark:text-slate-300">
          {m.comarca?.nombre} · Provincia de {m.provincia?.nombre} · Código INE {m.id}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <Segmentado
          etiqueta="Periodo"
          valor={ventana}
          opciones={(['4T', 'T'] as const).map((v) => ({ valor: v, texto: ETIQUETA_VENTANA[v] }))}
          onChange={setVentana}
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {ventana === '4T' ? 'Cuatro trimestres hasta' : 'Trimestre'}
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={periodo}
            onChange={(e) => setPeriodoElegido(e.target.value)}
          >
            {periodos.map((p) => (
              <option key={p} value={p}>
                {etiquetaPeriodo(p, ventana)}
              </option>
            ))}
          </select>
        </label>
        <Segmentado
          etiqueta="Tipo de vivienda"
          valor={tipo}
          opciones={(['total', 'nuevo', 'usado'] as const).map((t) => ({ valor: t, texto: ETIQUETA_TIPO[t] }))}
          onChange={setTipo}
        />
      </div>

      <section aria-label="Cifras clave" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          titulo={`Precio medio por m² construido · ${ETIQUETA_TIPO[tipo]}`}
          valor={m2.valor}
          formato={fmtEurosM2}
          variacion={m2.variacion}
          comparadoCon={etiquetaAnterior}
          fuente={`${FUENTE_REG} · ${etiqueta}`}
        />
        <Cifra
          titulo={`Precio medio por vivienda · ${ETIQUETA_TIPO[tipo]}`}
          valor={precio.valor}
          formato={fmtEuros}
          variacion={precio.variacion}
          comparadoCon={etiquetaAnterior}
          detalle={reg?.[CAMPO_SUP[tipo]] != null ? <>Superficie media: {fmtM2(reg[CAMPO_SUP[tipo]]!)}</> : null}
          fuente={`${FUENTE_REG} · ${etiqueta}`}
        />
        <Cifra
          titulo="Compraventas inscritas"
          valor={ventas.valor}
          formato={fmtEntero}
          variacion={ventas.variacion}
          comparadoCon={etiquetaAnterior}
          detalle={
            reg && (
              <>
                Nueva libre {n0(reg.ventasNuevoLibre)} · protegida {n0(reg.ventasNuevoProtegido)} · usada{' '}
                {n0(reg.ventasUsado)}
              </>
            )
          }
          fuente={`${FUENTE_REG} · ${etiqueta}`}
        />
        <Cifra
          titulo="Compraventas ante notario"
          valor={notarial?.total ?? null}
          formato={fmtEntero}
          variacion={notarialVar}
          comparadoCon={notarial ? etiquetaPeriodo(addTrimestres(notarial.periodo, -4), ventana) : ''}
          detalle={
            notarial && (
              <>
                Nueva {n0(notarial.nueva)} · segunda mano {n0(notarial.segundaMano)}
              </>
            )
          }
          fuente={
            notarial ? (
              <>
                {FUENTE_NOT} · {etiquetaPeriodo(notarial.periodo, ventana)}
                {ventana === '4T' && ' (suma de 4 trimestres)'}
                {notarial.provisional && ' · incluye datos provisionales'}
                {notarial.periodo !== periodo && ' · último periodo publicado'}
              </>
            ) : (
              FUENTE_NOT
            )
          }
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold">
          Evolución del precio medio (€/m²) · {ETIQUETA_TIPO[tipo]} ·{' '}
          {ventana === '4T' ? 'media de 4 trimestres' : 'por trimestre'}
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {FUENTE_REG}. Los huecos corresponden a periodos sin datos suficientes (menos de 3 compraventas).
        </p>
        <GraficoSeries series={seriesPrecio} formato={fmtEurosM2} titulo="Evolución del precio por m²" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold">
          Evolución del número de compraventas · {ventana === '4T' ? 'suma de 4 trimestres' : 'por trimestre'}
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Dos fuentes distintas, no comparables entre sí: inscripciones en el Registro (fecha de inscripción) y
          escrituras ante notario (fecha de firma).
        </p>
        <GraficoSeries series={seriesVentas} formato={fmtEntero} alto={220} titulo="Evolución de las compraventas" />
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">
          Comparación · {ETIQUETA_TIPO[tipo]} · {etiqueta}
        </h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1 pr-4 font-medium">Territorio</th>
              <th className="py-1 pr-4 text-right font-medium">€/m²</th>
              <th className="py-1 pr-4 text-right font-medium">Var. anual</th>
              <th className="py-1 text-right font-medium">Compraventas</th>
            </tr>
          </thead>
          <tbody>
            {filasComparacion.map(({ nombre, h, color }) => {
              const v = valorConVariacion(h, ventana, periodo, CAMPO_M2[tipo]);
              const n = registro(h, ventana, periodo)?.ventasTotal ?? null;
              return (
                <tr key={nombre} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-4">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: `var(${color})` }}
                    />
                    {nombre}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-4 text-right">
                    {v.valor == null ? <span className="text-slate-400">sin datos</span> : fmtEurosM2(v.valor)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-4 text-right">
                    {v.variacion == null ? '—' : fmtPct(v.variacion)}
                  </td>
                  <td className="py-1.5 text-right">{n == null ? '—' : fmtEntero(n)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="text-sm text-slate-600 dark:text-slate-300">
        <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Fuentes</h3>
        <ul className="flex flex-col gap-2">
          {datos.fuentes.fuentes.map((f) => (
            <li key={f.id}>
              <a
                className="font-medium underline decoration-slate-400 underline-offset-2"
                href={f.url}
                target="_blank"
                rel="noreferrer"
              >
                {f.nombre}
              </a>{' '}
              — {f.organismo}. {f.ultimoPeriodo && <>Último periodo: {etiquetaPeriodo(f.ultimoPeriodo, 'T')}. </>}
              Descargado el {fmtFecha(f.descargado)}. {f.licencia}.
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Precio por m²: media de los precios por m² construido de cada compraventa inscrita, tal como la publica la
          Secretaria d’Habitatge. «Nueva» incluye solo la vivienda nueva libre. No se publica el precio cuando hay menos
          de 3 compraventas (secreto estadístico).
        </p>
      </section>
    </article>
  );
}
