import * as maplibregl from 'maplibre-gl';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 charge son worker (module ES) depuis une URL : Vite le regroupe et fournit l'URL.
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import { alturaNormalizada, colorDe, SIN_DATOS, type Escala } from './escala.ts';

maplibregl.setWorkerUrl(urlWorker);

export type Nivel = 'barrio' | 'distrito';

export interface ValorZona {
  id: string;
  valor: number | null;
}

interface Props {
  barrios: GeoJSON.FeatureCollection;
  distritos: GeoJSON.FeatureCollection;
  nivel: Nivel;
  valores: ValorZona[];
  escala: Escala;
  seleccion: string | null;
  modo3d: boolean;
  oscuro: boolean;
  formatear: (x: number) => string;
  nombreDe: (id: string) => string;
  onSeleccion: (id: string | null) => void;
  onParcela: (lngLat: { lng: number; lat: number }) => void;
  /** Point à montrer (recherche d'adresse) ; `clave` change à chaque nouvelle demande. */
  destino: { lng: number; lat: number; clave: number } | null;
  /** Parcelle consultée, marquée d'un repère. */
  marcador: { lng: number; lat: number } | null;
}

const ESTILO = {
  claro: 'https://tiles.openfreemap.org/styles/positron',
  oscuro: 'https://tiles.openfreemap.org/styles/dark',
};

const CATASTRO_WMS =
  'https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&LAYERS=CP.CadastralParcel&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256' +
  '&FORMAT=image/png&TRANSPARENT=true';

/** Zoom à partir duquel les parcelles cadastrales apparaissent et deviennent cliquables. */
export const ZOOM_PARCELAS = 16;
const ALTURA_MAX = 850; // mètres, pour la valeur maximale de l'échelle
const VISTA_INICIAL = { pitch: 50, bearing: -17 };
const LIMITES_BCN: [[number, number], [number, number]] = [
  [2.07, 41.32],
  [2.23, 41.47],
];

/** Hauteur des volumes : réduite quand on zoome, pour que les barris voisins ne masquent pas la vue. */
function expresionAltura(modo3d: boolean): maplibregl.ExpressionSpecification {
  const h: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'h'], 0];
  const f = modo3d ? 1 : 0;
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    11,
    ['*', h, ALTURA_MAX * f],
    13.5,
    ['*', h, ALTURA_MAX * 0.35 * f],
    16,
    ['*', h, 40 * f],
  ];
}

/** Marges de la carte laissées libres par les panneaux flottants. */
function margenes() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w >= 900) return { top: 60, bottom: 110, left: 410, right: 430 };
  if (w >= 640) return { top: 60, bottom: 110, left: 20, right: 420 };
  return { top: Math.round(h * 0.33), bottom: Math.round(h * 0.47), left: 10, right: 10 };
}

function estiloMinimo(oscuro: boolean): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {},
    layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': oscuro ? '#0b0f16' : '#eef0f3' } }],
  };
}

const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hexARgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbAHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}
const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function bbox(f: GeoJSON.Feature): [[number, number], [number, number]] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const visitar = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as [number, number];
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    } else if (Array.isArray(c)) c.forEach(visitar);
  };
  visitar((f.geometry as GeoJSON.Polygon).coordinates);
  return [
    [x0, y0],
    [x1, y1],
  ];
}

interface EstadoZona {
  h: number;
  rgb: [number, number, number];
}

export function Mapa(props: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const estado = useRef(new Map<string, EstadoZona>());
  const animacion = useRef<number | null>(null);
  const hoverId = useRef<string | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string } | null>(null);

  const fuenteActiva = props.nivel === 'barrio' ? 'barrios' : 'distritos';

  // --- Création de la carte et des couches ---------------------------------
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const m = new maplibregl.Map({
      container: el,
      style: propsRef.current.oscuro ? ESTILO.oscuro : ESTILO.claro,
      bounds: LIMITES_BCN,
      fitBoundsOptions: { padding: margenes() },
      pitch: 0,
      bearing: 0,
      maxBounds: [
        [1.95, 41.25],
        [2.4, 41.55],
      ],
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    // Repli : si le fond de carte distant ne répond pas (hors ligne, service indisponible),
    // on affiche les zones sur un fond uni plutôt qu'une carte vide.
    const repli = window.setTimeout(() => {
      if (!listo.current) m.setStyle(estiloMinimo(propsRef.current.oscuro));
    }, 9000);
    m.on('error', (e) => {
      if (!listo.current && /styles|sprites|glyphs/.test(String((e.error as Error | undefined)?.message))) {
        window.clearTimeout(repli);
        m.setStyle(estiloMinimo(propsRef.current.oscuro));
      }
    });

    m.on('style.load', () => {
      window.clearTimeout(repli);
      instalarCapas(m);
      listo.current = true;
      estado.current.clear();
      aplicarValores(true);
      // Sélection reçue avant que la carte soit prête (lien direct #b07).
      if (propsRef.current.seleccion) setTimeout(() => volarA(propsRef.current.seleccion), 400);
    });

    // Vol d'introduction dès que le style est prêt (sans attendre toutes les tuiles).
    m.once('style.load', () => {
      const camara = m.cameraForBounds(LIMITES_BCN, { padding: margenes(), ...VISTA_INICIAL });
      if (!camara) return;
      if (!reducirMovimiento()) m.easeTo({ ...camara, ...VISTA_INICIAL, duration: 2600, easing: suavizar });
      else m.jumpTo({ ...camara, ...VISTA_INICIAL });
    });

    const moverRaton = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = (f?.properties?.id as string | undefined) ?? null;
      const fuente = f?.source;
      if (hoverId.current && hoverId.current !== id) {
        for (const s of ['barrios', 'distritos'])
          m.setFeatureState({ source: s, id: hoverId.current }, { hover: false });
      }
      hoverId.current = id;
      if (id && fuente) m.setFeatureState({ source: fuente, id }, { hover: true });
      m.getCanvas().style.cursor = id ? 'pointer' : '';
      setTooltip(id ? { x: e.point.x, y: e.point.y, id } : null);
    };
    const salir = () => {
      if (hoverId.current) {
        for (const s of ['barrios', 'distritos'])
          m.setFeatureState({ source: s, id: hoverId.current }, { hover: false });
      }
      hoverId.current = null;
      m.getCanvas().style.cursor = '';
      setTooltip(null);
    };
    m.on('mousemove', 'zonas-3d', moverRaton);
    m.on('mouseleave', 'zonas-3d', salir);
    m.on('click', (e) => {
      if (m.getZoom() >= ZOOM_PARCELAS) {
        propsRef.current.onParcela(e.lngLat);
        return;
      }
      const f = m.queryRenderedFeatures(e.point, { layers: ['zonas-3d'] })[0] as MapGeoJSONFeature | undefined;
      propsRef.current.onSeleccion((f?.properties?.id as string | undefined) ?? null);
    });

    return () => {
      if (animacion.current) cancelAnimationFrame(animacion.current);
      m.remove();
      mapa.current = null;
      listo.current = false;
    };
    // La carte est créée une seule fois ; les changements passent par les effets ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function instalarCapas(m: maplibregl.Map) {
    const p = propsRef.current;
    const sinDatos = p.oscuro ? SIN_DATOS.oscuro : SIN_DATOS.claro;
    m.addSource('barrios', { type: 'geojson', data: p.barrios, promoteId: 'id' });
    m.addSource('distritos', { type: 'geojson', data: p.distritos, promoteId: 'id' });
    m.addSource('catastro', {
      type: 'raster',
      tiles: [CATASTRO_WMS],
      tileSize: 256,
      minzoom: ZOOM_PARCELAS - 1,
      attribution:
        '© <a href="https://www.catastro.hacienda.gob.es" target="_blank">Dirección General del Catastro</a>',
    });

    // Les bâtiments 3D du fond de carte se mélangeraient aux volumes des barris.
    for (const capa of m.getStyle().layers ?? []) {
      if (capa.type === 'fill-extrusion' && capa.id !== 'zonas-3d') m.removeLayer(capa.id);
    }

    // Insère les zones sous les libellés du fond de carte.
    // Premier calque du bloc final de libellés : tout ce qui est dessous (rues, bâtiments)
    // reste sous les zones, les noms de rues et de lieux restent au-dessus.
    const capas = m.getStyle().layers ?? [];
    let k = capas.length;
    while (k > 0 && capas[k - 1]!.type === 'symbol') k--;
    const primeraEtiqueta = capas[k]?.id;
    const fuente = p.nivel === 'barrio' ? 'barrios' : 'distritos';

    m.addLayer(
      {
        id: 'zonas-3d',
        type: 'fill-extrusion',
        source: fuente,
        paint: {
          'fill-extrusion-color': ['to-color', ['coalesce', ['feature-state', 'color'], sinDatos]],
          'fill-extrusion-height': expresionAltura(p.modo3d),
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.92, ZOOM_PARCELAS + 0.3, 0.15],
          'fill-extrusion-vertical-gradient': true,
        },
      },
      primeraEtiqueta,
    );
    m.addLayer({
      id: 'catastro',
      type: 'raster',
      source: 'catastro',
      minzoom: ZOOM_PARCELAS,
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], ZOOM_PARCELAS, 0, ZOOM_PARCELAS + 0.6, 0.95],
        // En sombre, les traits noirs du Catastro sont inversés pour rester lisibles.
        ...(p.oscuro ? { 'raster-brightness-min': 1, 'raster-brightness-max': 0.15, 'raster-saturation': -0.6 } : {}),
      },
    });
    m.addLayer({
      id: 'zonas-borde',
      type: 'line',
      source: fuente,
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'seleccion'], false],
          p.oscuro ? '#ffd166' : '#b45309',
          ['boolean', ['feature-state', 'hover'], false],
          p.oscuro ? '#ffffff' : '#111827',
          p.oscuro ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'seleccion'], false],
          3,
          ['boolean', ['feature-state', 'hover'], false],
          2,
          0.6,
        ],
      },
    });
    m.addLayer({
      id: 'zonas-nombre',
      type: 'symbol',
      source: fuente,
      minzoom: p.nivel === 'barrio' ? 13.2 : 11,
      maxzoom: ZOOM_PARCELAS,
      layout: {
        'text-field': ['get', 'nombre'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-max-width': 8,
      },
      paint: {
        'text-color': p.oscuro ? '#f1f5f9' : '#0f172a',
        'text-halo-color': p.oscuro ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.4,
      },
    });
    marcarSeleccion(m, null, p.seleccion);
  }

  function marcarSeleccion(m: maplibregl.Map, anterior: string | null, nueva: string | null) {
    const fuente = propsRef.current.nivel === 'barrio' ? 'barrios' : 'distritos';
    if (anterior && m.getSource(fuente)) m.setFeatureState({ source: fuente, id: anterior }, { seleccion: false });
    if (nueva && m.getSource(fuente)) m.setFeatureState({ source: fuente, id: nueva }, { seleccion: true });
  }

  /** Anime hauteurs et couleurs vers les valeurs courantes. */
  function aplicarValores(intro = false) {
    const m = mapa.current;
    if (!m || !listo.current) return;
    const p = propsRef.current;
    const fuente = p.nivel === 'barrio' ? 'barrios' : 'distritos';
    const sinDatos = hexARgb(p.oscuro ? SIN_DATOS.oscuro : SIN_DATOS.claro);
    const objetivos = new Map<string, EstadoZona>();
    for (const { id, valor } of p.valores) {
      objetivos.set(
        id,
        valor == null
          ? { h: 0.012, rgb: sinDatos }
          : { h: 0.04 + 0.96 * alturaNormalizada(p.escala, valor), rgb: hexARgb(colorDe(p.escala, valor)) },
      );
    }
    const inicio = new Map<string, EstadoZona>();
    for (const [id, obj] of objetivos) {
      inicio.set(id, estado.current.get(id) ?? { h: 0, rgb: obj.rgb });
    }
    if (animacion.current) cancelAnimationFrame(animacion.current);

    const duracion = reducirMovimiento() ? 0 : intro ? 2200 : 650;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = duracion === 0 ? 1 : Math.min(1, (ahora - t0) / duracion);
      const k = suavizar(t);
      for (const [id, obj] of objetivos) {
        const a = inicio.get(id)!;
        const actual: EstadoZona = {
          h: a.h + (obj.h - a.h) * k,
          rgb: [0, 1, 2].map((c) => a.rgb[c]! + (obj.rgb[c]! - a.rgb[c]!) * k) as [number, number, number],
        };
        estado.current.set(id, actual);
        m.setFeatureState({ source: fuente, id }, { h: actual.h, color: rgbAHex(actual.rgb) });
      }
      animacion.current = t < 1 ? requestAnimationFrame(paso) : null;
    };
    animacion.current = requestAnimationFrame(paso);
  }

  // --- Réactions aux changements ------------------------------------------
  useEffect(() => {
    aplicarValores();
  }, [props.valores, props.escala]);

  // Changement de niveau (barris ↔ districtes) : la source des couches change.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    // Recrée les couches sur la nouvelle source.
    for (const id of ['zonas-nombre', 'zonas-borde', 'catastro', 'zonas-3d']) if (m.getLayer(id)) m.removeLayer(id);
    for (const id of ['barrios', 'distritos', 'catastro']) if (m.getSource(id)) m.removeSource(id);
    estado.current.clear();
    instalarCapas(m);
    aplicarValores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuenteActiva]);

  // Thème : nouveau fond de carte, puis réinstallation des couches (événement style.load).
  const temaInicial = useRef(props.oscuro);
  useEffect(() => {
    const m = mapa.current;
    if (!m || temaInicial.current === props.oscuro) return;
    temaInicial.current = props.oscuro;
    listo.current = false;
    m.setStyle(props.oscuro ? ESTILO.oscuro : ESTILO.claro);
  }, [props.oscuro]);

  // 2D / 3D
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    m.setPaintProperty('zonas-3d', 'fill-extrusion-height', expresionAltura(props.modo3d));
    m.easeTo({
      pitch: props.modo3d ? VISTA_INICIAL.pitch : 0,
      bearing: props.modo3d ? m.getBearing() : 0,
      duration: 900,
    });
  }, [props.modo3d]);

  // Sélection : contour et vol vers la zone.
  const seleccionAnterior = useRef<string | null>(null);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    marcarSeleccion(m, seleccionAnterior.current, props.seleccion);
    seleccionAnterior.current = props.seleccion;
    volarA(props.seleccion);
  }, [props.seleccion]);

  function volarA(id: string | null) {
    const m = mapa.current;
    if (!m || !id) return;
    const p = propsRef.current;
    const fc = p.nivel === 'barrio' ? p.barrios : p.distritos;
    const f = fc.features.find((x) => x.properties?.id === id);
    if (!f) return;
    m.fitBounds(bbox(f), {
      padding: margenes(),
      pitch: p.modo3d ? 50 : 0,
      bearing: p.modo3d ? m.getBearing() : 0,
      maxZoom: window.innerWidth < 640 ? 12.4 : 13.2,
      duration: reducirMovimiento() ? 0 : 1400,
    });
  }

  // Vol vers une adresse recherchée : zoom au niveau des parcelles.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !props.destino) return;
    m.flyTo({
      center: [props.destino.lng, props.destino.lat],
      zoom: ZOOM_PARCELAS + 1.2,
      pitch: props.modo3d ? 45 : 0,
      duration: reducirMovimiento() ? 0 : 2200,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.destino?.clave]);

  // Repère de la parcelle consultée.
  const marcador = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = mapa.current;
    marcador.current?.remove();
    marcador.current = null;
    if (!m || !props.marcador) return;
    const el = document.createElement('div');
    el.className = 'marcador-parcela';
    marcador.current = new maplibregl.Marker({ element: el })
      .setLngLat([props.marcador.lng, props.marcador.lat])
      .addTo(m);
  }, [props.marcador]);

  const valorTooltip = tooltip ? props.valores.find((v) => v.id === tooltip.id)?.valor : undefined;

  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="h-full w-full" data-testid="mapa" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg bg-[var(--panel-fuerte)] px-3 py-2 text-sm shadow-lg ring-1 ring-[var(--borde)] backdrop-blur"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold">{props.nombreDe(tooltip.id)}</div>
          <div className="tabular-nums text-[var(--tinta-suave)]">
            {valorTooltip == null ? 'Sin datos suficientes' : props.formatear(valorTooltip)}
          </div>
        </div>
      )}
    </div>
  );
}
