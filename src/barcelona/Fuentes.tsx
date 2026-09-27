import { useEffect, useRef } from 'react';
import type { Fuentes as TFuentes } from '../../shared/schema.ts';
import { etiquetaPeriodo } from '../../shared/periods.ts';
import { fmtFecha } from '../lib/format.ts';

/** Fenêtre « Fuentes y metodología ». */
export function Fuentes({ fuentes, onCerrar }: { fuentes: TFuentes; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const lista = fuentes.fuentes.filter((f) => ['registradores-bcn', 'barris', 'catastro'].includes(f.id));
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl bg-[var(--panel-fuerte)] p-0 text-[var(--tinta)] shadow-2xl ring-1 ring-[var(--borde)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[80dvh] flex-col gap-4 overflow-y-auto p-6 text-sm leading-relaxed">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight">Fuentes y metodología</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-full px-2 text-lg"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <p>
          España no publica los precios de venta individuales. Esta aplicación muestra{' '}
          <strong>estadísticas agregadas</strong> por barrio y distrito, tal como las publica la administración, sin
          estimaciones ni interpolaciones.
        </p>
        <ul className="flex flex-col gap-3">
          {lista.map((f) => (
            <li key={f.id} className="rounded-xl p-3 ring-1 ring-[var(--borde)]">
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--acento)] hover:underline"
              >
                {f.nombre} ↗
              </a>
              <p className="text-xs text-[var(--tinta-suave)]">
                {f.organismo}. {f.licencia}.
                {f.ultimoPeriodo && ` Último periodo: ${etiquetaPeriodo(f.ultimoPeriodo, 'T')}.`} Descargado el{' '}
                {fmtFecha(f.descargado)}.
              </p>
            </li>
          ))}
        </ul>
        <h3 className="font-semibold">Definiciones</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Precio medio por m²</strong>: media de los precios por m² <em>construido</em> de cada compraventa
            inscrita en el Registro de la Propiedad (fecha de inscripción, no de firma).
          </li>
          <li>
            <strong>Precio medio</strong>: precio total declarado en la escritura inscrita. <strong>Superficie</strong>:
            m² construidos.
          </li>
          <li>
            <strong>Nueva</strong>: solo vivienda nueva libre. <strong>Usada</strong>: segunda mano. «Todas» incluye
            también la vivienda protegida.
          </li>
          <li>
            <strong>12 meses</strong>: los 4 trimestres que terminan en el periodo elegido, tal como los publica la
            Generalitat (no recalculados).
          </li>
          <li>
            <strong>Secreto estadístico</strong>: no se publica el precio con menos de 3 compraventas; la zona aparece
            en gris «sin datos suficientes». La fuente tampoco publica algunos barrios con muchas viviendas protegidas.
          </li>
          <li>
            Los totales de Barcelona no coinciden exactamente con la suma de barrios: algunas viviendas no se pudieron
            geolocalizar.
          </li>
          <li>
            <strong>Colores</strong>: 6 clases por cuantiles calculadas sobre todos los barrios y todos los periodos,
            para que el color sea comparable en el tiempo.
          </li>
          <li>
            <strong>Parcelas</strong>: a partir del zoom 16, la cartografía catastral oficial; al pulsar, datos no
            protegidos (uso, superficie, año) consultados en el momento. Sin precios.
          </li>
        </ul>
      </div>
    </dialog>
  );
}
