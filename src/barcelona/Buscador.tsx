import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Modelo } from './modelo.ts';

interface Props {
  modelo: Modelo;
  onZona: (id: string) => void;
  onDireccion: (d: { lng: number; lat: number; etiqueta: string }) => void;
}

type Opcion =
  | { tipo: 'zona'; id: string; texto: string; detalle: string }
  | { tipo: 'direccion'; lng: number; lat: number; texto: string; detalle: string };

const GEOCODER = 'https://eines.icgc.cat/geocodificador/autocompletar';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recherche d'un barri, d'un districte ou d'une adresse (géocodeur de l'ICGC). */
export function Buscador({ modelo, onZona, onDireccion }: Props) {
  const [texto, setTexto] = useState('');
  const [direcciones, setDirecciones] = useState<Opcion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const listaId = useId();
  const input = useRef<HTMLInputElement>(null);

  const zonas = useMemo<Opcion[]>(() => {
    const q = normalizar(texto.trim());
    if (q.length < 2) return [];
    return modelo.entidades
      .filter((e) => e.nivel !== 'ciudad' && normalizar(e.nombre).includes(q))
      .slice(0, 6)
      .map((e) => ({
        tipo: 'zona' as const,
        id: e.id,
        texto: e.nombre,
        detalle: e.nivel === 'barrio' ? `Barrio · ${modelo.entidad(e.distrito!)?.nombre ?? ''}` : 'Distrito',
      }));
  }, [texto, modelo]);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 4) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${GEOCODER}?text=${encodeURIComponent(`${q} Barcelona`)}&size=8`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((d: { features?: GeoJSON.Feature<GeoJSON.Point>[] }) => {
          setDirecciones(
            (d.features ?? [])
              .filter((f) => f.properties?.municipi === 'Barcelona' && f.geometry?.type === 'Point')
              .slice(0, 5)
              .map((f) => ({
                tipo: 'direccion' as const,
                lng: f.geometry.coordinates[0]!,
                lat: f.geometry.coordinates[1]!,
                texto: String(f.properties?.etiqueta ?? f.properties?.nom ?? ''),
                detalle: 'Dirección',
              })),
          );
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [texto]);

  // Les adresses ne sont proposées qu'à partir de 4 caractères.
  const opciones = [...zonas, ...(texto.trim().length >= 4 ? direcciones : [])];

  const elegir = (o: Opcion) => {
    if (o.tipo === 'zona') onZona(o.id);
    else onDireccion({ lng: o.lng, lat: o.lat, etiqueta: o.texto });
    setTexto(o.texto);
    setAbierto(false);
    input.current?.blur();
  };

  return (
    <div className="relative">
      <label htmlFor="buscador" className="sr-only">
        Buscar un barrio o una dirección
      </label>
      <div className="flex items-center gap-2 rounded-xl bg-[var(--hover)] px-3 ring-1 ring-transparent focus-within:ring-[var(--acento)]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="shrink-0 text-[var(--tinta-suave)]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={input}
          id="buscador"
          type="search"
          autoComplete="off"
          placeholder="Barrio o dirección…"
          value={texto}
          role="combobox"
          aria-expanded={abierto && opciones.length > 0}
          aria-controls={listaId}
          aria-activedescendant={abierto && opciones[activo] ? `${listaId}-${activo}` : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setActivo(0);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActivo((a) => Math.min(a + 1, opciones.length - 1));
            else if (e.key === 'ArrowUp') setActivo((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && opciones[activo]) {
              e.preventDefault();
              elegir(opciones[activo]);
            } else if (e.key === 'Escape') setAbierto(false);
          }}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-[var(--tinta-suave)]"
        />
      </div>
      {abierto && opciones.length > 0 && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl bg-[var(--panel-fuerte)] py-1 shadow-2xl ring-1 ring-[var(--borde)] backdrop-blur-xl"
        >
          {opciones.map((o, i) => (
            <li
              key={`${o.tipo}-${o.texto}-${i}`}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === activo}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
              onMouseEnter={() => setActivo(i)}
              className={`cursor-pointer px-3 py-2 ${i === activo ? 'bg-[var(--hover)]' : ''}`}
            >
              <span className="block text-sm font-medium">{o.texto}</span>
              <span className="block text-xs text-[var(--tinta-suave)]">{o.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
