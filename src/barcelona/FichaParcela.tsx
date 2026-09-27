import { fmtEntero } from '../lib/format.ts';
import type { Parcela } from './catastro.ts';

export type EstadoParcela =
  { estado: 'cargando' } | { estado: 'error'; mensaje: string } | { estado: 'ok'; parcela: Parcela };

/** Informations publiques d'une parcelle cadastrale (aucun prix : le Catastro n'en publie pas). */
export function FichaParcela({ datos, onCerrar }: { datos: EstadoParcela; onCerrar: () => void }) {
  return (
    <section
      className="rounded-2xl bg-[var(--destacado)] p-4 ring-1 ring-[var(--borde)]"
      aria-label="Parcela catastral"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--acento)]">Parcela catastral</p>
        <button
          type="button"
          onClick={onCerrar}
          className="-m-1 rounded-full p-1 text-[var(--tinta-suave)] hover:bg-[var(--hover)]"
          aria-label="Cerrar la parcela"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {datos.estado === 'cargando' && (
        <p className="mt-2 animate-pulse text-sm text-[var(--tinta-suave)]">Consultando el Catastro…</p>
      )}
      {datos.estado === 'error' && <p className="mt-2 text-sm">{datos.mensaje}</p>}
      {datos.estado === 'ok' && <Detalle p={datos.parcela} />}
    </section>
  );
}

function Detalle({ p }: { p: Parcela }) {
  const viviendas = p.unidades.filter((u) => u.uso && /residencial|vivienda/i.test(u.uso));
  const sup = viviendas.map((u) => u.superficie).filter((x): x is number => x != null);
  const anios = p.unidades.map((u) => u.anio).filter((x): x is number => x != null);
  return (
    <div className="mt-1 flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold leading-snug">{p.direccion || 'Sin dirección'}</h3>
        <p className="font-mono text-xs text-[var(--tinta-suave)]">Ref. {p.referencia}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[var(--hover)] p-2">
          <dt className="text-[10px] text-[var(--tinta-suave)]">Inmuebles</dt>
          <dd className="font-bold tabular-nums">{fmtEntero(p.totalUnidades)}</dd>
        </div>
        <div className="rounded-lg bg-[var(--hover)] p-2">
          <dt className="text-[10px] text-[var(--tinta-suave)]">Viviendas</dt>
          <dd className="font-bold tabular-nums">{viviendas.length || '—'}</dd>
        </div>
        <div className="rounded-lg bg-[var(--hover)] p-2">
          <dt className="text-[10px] text-[var(--tinta-suave)]">Construcción</dt>
          <dd className="font-bold tabular-nums">{anios.length ? Math.min(...anios) : '—'}</dd>
        </div>
      </dl>
      {sup.length > 0 && (
        <p className="text-xs text-[var(--tinta-suave)]">
          Superficie de las viviendas: {fmtEntero(Math.min(...sup))} – {fmtEntero(Math.max(...sup))} m² construidos
        </p>
      )}
      {p.unidades.length > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Ver los {p.unidades.length} inmuebles</summary>
          <ul className="mt-2 max-h-48 overflow-y-auto pr-1">
            {p.unidades.map((u) => (
              <li
                key={u.referencia}
                className="flex justify-between gap-2 border-b border-[var(--borde)] py-1 last:border-0"
              >
                <span className="truncate">
                  {u.ubicacion ?? '—'} · {u.uso ?? 'uso desconocido'}
                </span>
                <span className="shrink-0 tabular-nums">{u.superficie ? `${fmtEntero(u.superficie)} m²` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {p.unidades.length === 1 && p.unidades[0]!.uso && (
        <p className="text-xs">
          Uso: {p.unidades[0]!.uso}
          {p.unidades[0]!.superficie ? ` · ${fmtEntero(p.unidades[0]!.superficie)} m²` : ''}
        </p>
      )}
      <a
        href={p.urlSede}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--acento)] hover:underline"
      >
        Ficha oficial y Valor de Referencia en la Sede del Catastro ↗
      </a>
      <p className="text-[10px] text-[var(--tinta-suave)]">
        Datos catastrales no protegidos. El Catastro no publica precios de venta; el Valor de Referencia se consulta en
        la Sede Electrónica.
      </p>
    </div>
  );
}
