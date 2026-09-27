import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { DatosBarcelona, Fuentes } from '../shared/schema.ts';
import type { Ventana } from '../shared/periods.ts';
import { Buscador } from './barcelona/Buscador.tsx';
import { consultarParcela } from './barcelona/catastro.ts';
import { crearEscala } from './barcelona/escala.ts';
import { Ficha } from './barcelona/Ficha.tsx';
import { FichaParcela, type EstadoParcela } from './barcelona/FichaParcela.tsx';
import { FORMATO } from './barcelona/formatos.ts';
import { zonaEnPunto } from './barcelona/geo.ts';
import { Leyenda } from './barcelona/Leyenda.tsx';
import { LineaTiempo } from './barcelona/LineaTiempo.tsx';
import type { Nivel } from './barcelona/Mapa.tsx';
import { INDICADORES, Modelo, TIPOS, type Indicador, type Tipo } from './barcelona/modelo.ts';
import { Resumen } from './barcelona/Resumen.tsx';
import { Fuentes as PanelFuentes } from './barcelona/Fuentes.tsx';
import { useTemaOscuro } from './lib/tema.ts';

const BASE = `${import.meta.env.BASE_URL}data/`;

// MapLibre est volumineux : chargé à part pour afficher les chiffres sans attendre la carte.
const Mapa = lazy(() => import('./barcelona/Mapa.tsx').then((m) => ({ default: m.Mapa })));

interface Cargado {
  modelo: Modelo;
  barrios: GeoJSON.FeatureCollection;
  distritos: GeoJSON.FeatureCollection;
  fuentes: Fuentes;
}

async function cargar(): Promise<Cargado> {
  const get = (r: string) =>
    fetch(BASE + r).then((x) => {
      if (!x.ok) throw new Error(`No se pudo cargar ${r} (HTTP ${x.status}).`);
      return x.json();
    });
  const [datos, barrios, distritos, fuentes] = await Promise.all([
    get('barcelona/datos.json') as Promise<DatosBarcelona>,
    get('barcelona/barrios.geojson'),
    get('barcelona/distritos.geojson'),
    get('sources.json') as Promise<Fuentes>,
  ]);
  return { modelo: new Modelo(datos), barrios, distritos, fuentes };
}

function idDesdeHash(): string | null {
  const h = window.location.hash.slice(1);
  return /^(bcn|d\d{2}|b\d{2})$/.test(h) ? h : null;
}

function Segmento<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: T;
  opciones: { id: T; texto: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex rounded-xl bg-[var(--hover)] p-0.5">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition-all ${
            valor === o.id
              ? 'bg-[var(--panel-fuerte)] text-[var(--tinta)] shadow'
              : 'text-[var(--tinta-suave)] hover:text-[var(--tinta)]'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [cargado, setCargado] = useState<Cargado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indicador, setIndicador] = useState<Indicador>('m2');
  const [tipo, setTipo] = useState<Tipo>('total');
  const [ventana, setVentanaEstado] = useState<Ventana>('4T');
  const [indice, setIndice] = useState<number | null>(null);
  const [nivel, setNivel] = useState<Nivel>(() => (idDesdeHash()?.startsWith('d') ? 'distrito' : 'barrio'));
  const [seleccion, setSeleccionEstado] = useState<string | null>(idDesdeHash);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [modo3d, setModo3d] = useState(true);
  // Couleurs : quantiles de la période affichée, ou de toutes les périodes (comparables dans le temps).
  const [escalaHistorica, setEscalaHistorica] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [verFuentes, setVerFuentes] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [parcela, setParcela] = useState<{ lng: number; lat: number; datos: EstadoParcela } | null>(null);
  const [destino, setDestino] = useState<{ lng: number; lat: number; clave: number } | null>(null);
  const oscuro = useTemaOscuro();

  useEffect(() => {
    cargar()
      .then(setCargado)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const modelo = cargado?.modelo;
  const periodos = useMemo(() => modelo?.periodos(ventana) ?? [], [modelo, ventana]);
  const i = indice == null || indice >= periodos.length ? periodos.length - 1 : indice;

  const setSeleccion = useCallback((id: string | null) => {
    setSeleccionEstado(id);
    // Sélectionner un barri en vue « districtes » (et inversement) change le niveau affiché.
    if (id?.startsWith('b')) setNivel('barrio');
    if (id?.startsWith('d')) setNivel('distrito');
    setPanelAbierto(true);
    history.replaceState(null, '', id ? `#${id}` : window.location.pathname + window.location.search);
  }, []);

  // Changer de fenêtre garde le même trimestre de fin quand il existe.
  const setVentana = (v: Ventana) => {
    if (modelo && i >= 0) {
      const actual = modelo.periodos(ventana)[i];
      const j = modelo.periodos(v).indexOf(actual ?? '');
      setIndice(j >= 0 ? j : null);
    }
    setVentanaEstado(v);
  };

  const valores = useMemo(() => {
    if (!modelo || i < 0) return [];
    const lista = nivel === 'barrio' ? modelo.barrios : modelo.distritos;
    return lista.map((e) => ({ id: e.id, valor: modelo.indicador(e.id, indicador, tipo, ventana, i) }));
  }, [modelo, nivel, indicador, tipo, ventana, i]);

  const historico = useMemo(
    () => modelo?.todosLosValores(indicador, tipo, ventana, nivel) ?? [],
    [modelo, indicador, tipo, ventana, nivel],
  );
  const escala = useMemo(() => {
    if (!modelo) return null;
    const actuales = valores.map((v) => v.valor).filter((x): x is number => x != null);
    return crearEscala(indicador, escalaHistorica ? historico : actuales, historico, oscuro);
  }, [modelo, indicador, valores, historico, escalaHistorica, oscuro]);

  const consultar = useCallback(
    (p: { lng: number; lat: number }) => {
      setParcela({ ...p, datos: { estado: 'cargando' } });
      setPanelAbierto(true);
      if (cargado) {
        const zona = zonaEnPunto(cargado.barrios, p.lng, p.lat);
        if (zona) setSeleccion(zona);
      }
      consultarParcela(p.lng, p.lat)
        .then((parcela) => setParcela({ ...p, datos: { estado: 'ok', parcela } }))
        .catch((e: unknown) =>
          setParcela({ ...p, datos: { estado: 'error', mensaje: e instanceof Error ? e.message : String(e) } }),
        );
    },
    [cargado, setSeleccion],
  );

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <p className="max-w-md rounded-2xl bg-[var(--panel-fuerte)] p-6 ring-1 ring-[var(--borde)]">{error}</p>
      </div>
    );
  }

  const indDef = INDICADORES.find((x) => x.id === indicador)!;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {cargado && escala && modelo && (
        <Suspense fallback={null}>
          <Mapa
            barrios={cargado.barrios}
            distritos={cargado.distritos}
            nivel={nivel}
            valores={valores}
            escala={escala}
            seleccion={seleccion}
            modo3d={modo3d}
            oscuro={oscuro}
            formatear={FORMATO[indicador]}
            nombreDe={(id) => modelo.entidad(id)?.nombre ?? id}
            onSeleccion={setSeleccion}
            onParcela={consultar}
            destino={destino}
            marcador={parcela}
          />
        </Suspense>
      )}
      {!cargado && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="animate-pulse text-sm font-medium text-[var(--tinta-suave)]">Cargando Barcelona…</p>
        </div>
      )}

      {/* Bandeau permanent */}
      <div
        role="note"
        className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top,0px)] z-20 flex justify-center px-4 pt-2"
      >
        <p className="rounded-full bg-[var(--panel-fuerte)] px-3 py-1 text-[11px] font-medium text-[var(--tinta-suave)] shadow ring-1 ring-[var(--borde)] backdrop-blur-xl">
          Datos agregados por zona — no son precios de venta individuales
        </p>
      </div>

      {/* Barre du haut : titre, recherche, indicateurs */}
      <header className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+2.6rem)] z-20 flex flex-col gap-2 sm:right-auto sm:w-[380px] lg:left-4">
        <div className="panel flex flex-col gap-2 p-2.5 sm:gap-3 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-extrabold tracking-tight sm:text-lg">
              Data Spain <span className="font-semibold text-[var(--acento)]">Barcelona</span>
            </h1>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFiltrosAbiertos((x) => !x)}
                className="rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-[var(--borde)] hover:bg-[var(--hover)] sm:hidden"
                aria-expanded={filtrosAbiertos}
                aria-controls="filtros"
              >
                Filtros
              </button>
              <button
                type="button"
                onClick={() => setModo3d((x) => !x)}
                className="rounded-lg px-2 py-1 text-xs font-bold ring-1 ring-[var(--borde)] hover:bg-[var(--hover)]"
                aria-pressed={modo3d}
                aria-label={modo3d ? 'Ver en 2D' : 'Ver en 3D'}
              >
                {modo3d ? '2D' : '3D'}
              </button>
              <button
                type="button"
                onClick={() => setVerFuentes(true)}
                className="rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-[var(--borde)] hover:bg-[var(--hover)]"
              >
                Fuentes
              </button>
            </div>
          </div>
          {modelo && (
            <Buscador
              modelo={modelo}
              onZona={setSeleccion}
              onDireccion={(d) => {
                setDestino({ lng: d.lng, lat: d.lat, clave: Date.now() });
                consultar(d);
              }}
            />
          )}
          <Segmento
            etiqueta="Indicador"
            valor={indicador}
            opciones={INDICADORES.map((x) => ({ id: x.id, texto: x.corto }))}
            onChange={setIndicador}
          />
          <div id="filtros" className={`${filtrosAbiertos ? 'flex' : 'hidden'} gap-2 sm:flex`}>
            <div className="flex-[3]">
              <Segmento etiqueta="Tipo de vivienda" valor={tipo} opciones={TIPOS} onChange={setTipo} />
            </div>
            <div className="flex-[2]">
              <Segmento
                etiqueta="Nivel"
                valor={nivel}
                opciones={[
                  { id: 'barrio', texto: 'Barrios' },
                  { id: 'distrito', texto: 'Distritos' },
                ]}
                onChange={(n) => {
                  setNivel(n);
                  setSeleccion(null);
                }}
              />
            </div>
          </div>
        </div>
        {escala && (
          <div className="panel hidden p-3 sm:block">
            <Leyenda
              escala={escala}
              indicador={indicador}
              oscuro={oscuro}
              historica={escalaHistorica}
              onHistorica={setEscalaHistorica}
            />
          </div>
        )}
      </header>

      {/* Panneau latéral (bureau) / volet inférieur (téléphone) */}
      {modelo && escala && i >= 0 && (
        <aside
          className={`panel absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] z-20 flex max-h-[42dvh] flex-col transition-transform duration-500 ease-out sm:inset-x-auto sm:bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:right-4 sm:top-[calc(env(safe-area-inset-top,0px)+2.6rem)] sm:max-h-none sm:w-[400px] ${
            panelAbierto ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)] sm:translate-y-0'
          }`}
          aria-label={seleccion ? 'Ficha de la zona' : 'Resumen de Barcelona'}
        >
          <button
            type="button"
            onClick={() => setPanelAbierto((x) => !x)}
            className="flex h-6 shrink-0 items-center justify-center sm:hidden"
            aria-label={panelAbierto ? 'Reducir el panel' : 'Abrir el panel'}
          >
            <span className="h-1 w-10 rounded-full bg-[var(--borde-fuerte)]" />
          </button>
          <div
            key={seleccion ?? 'resumen'}
            className="entrada min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:pt-4"
          >
            {parcela && (
              <div className="mb-4">
                <FichaParcela datos={parcela.datos} onCerrar={() => setParcela(null)} />
              </div>
            )}
            {seleccion && modelo.entidad(seleccion) ? (
              <Ficha
                modelo={modelo}
                id={seleccion}
                indicador={indicador}
                tipo={tipo}
                ventana={ventana}
                indice={i}
                onCerrar={() => {
                  setSeleccion(null);
                  setParcela(null);
                }}
                onSeleccion={setSeleccion}
              />
            ) : (
              <Resumen
                modelo={modelo}
                indicador={indicador}
                tipo={tipo}
                ventana={ventana}
                indice={i}
                nivel={nivel}
                escala={escala}
                onSeleccion={setSeleccion}
              />
            )}
          </div>
        </aside>
      )}

      {/* Frise temporelle */}
      {modelo && i >= 0 && (
        <footer className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-20 sm:left-4 sm:right-[432px] lg:right-[440px]">
          <div className="panel mx-auto max-w-3xl px-3 py-2.5">
            <LineaTiempo
              periodos={periodos}
              indice={i}
              ventana={ventana}
              reproduciendo={reproduciendo}
              onIndice={setIndice}
              onReproducir={setReproduciendo}
              onVentana={setVentana}
            />
            <p className="sr-only" aria-live="polite">
              {indDef.largo}
            </p>
          </div>
        </footer>
      )}

      {verFuentes && cargado && <PanelFuentes fuentes={cargado.fuentes} onCerrar={() => setVerFuentes(false)} />}
    </div>
  );
}
