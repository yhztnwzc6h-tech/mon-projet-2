/**
 * Consultation du Catastro pour UN clic de l'utilisateur (services officiels OVC,
 * CORS ouvert). Aucune consultation en masse, aucun accès à la Sede Electrónica.
 */

const RCCOOR =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326';
const DNPRC = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=';

export interface Unidad {
  referencia: string;
  uso: string | null;
  superficie: number | null; // m² construits
  anio: number | null;
  ubicacion: string | null; // escalier / étage / porte
}

export interface Parcela {
  referencia: string; // 14 caractères (parcelle)
  direccion: string;
  unidades: Unidad[];
  totalUnidades: number;
  urlSede: string;
}

export function urlSede(pc1: string, pc2: string): string {
  return `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${pc1}&rc2=${pc2}`;
}

export function parseRccoor(xml: string): { pc1: string; pc2: string; direccion: string } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const t = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
  const pc1 = t('pc1');
  const pc2 = t('pc2');
  if (!pc1 || !pc2) {
    const des = t('des');
    throw new Error(des || 'No hay ninguna parcela catastral en este punto.');
  }
  return { pc1, pc2, direccion: t('ldt') };
}

type Json = Record<string, unknown>;
const obj = (x: unknown): Json => (x && typeof x === 'object' ? (x as Json) : {});
const num = (x: unknown): number | null => {
  const n = typeof x === 'string' ? Number(x.replace(',', '.')) : typeof x === 'number' ? x : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

function unidadDe(rcRaw: unknown, dtRaw: unknown, debiRaw: unknown): Unidad {
  const rc = obj(rcRaw);
  const debi = obj(debiRaw);
  const loint = obj(obj(obj(obj(obj(dtRaw).locs).lous).lourb).loint);
  const partes = [
    loint.es ? `Esc. ${String(loint.es)}` : null,
    loint.pt ? `Planta ${String(loint.pt)}` : null,
    loint.pu ? `Puerta ${String(loint.pu)}` : null,
  ].filter(Boolean);
  return {
    referencia: [rc.pc1, rc.pc2, rc.car, rc.cc1, rc.cc2].map((x) => (x == null ? '' : String(x))).join(''),
    uso: typeof debi.luso === 'string' ? debi.luso : null,
    superficie: num(debi.sfc),
    anio: num(debi.ant),
    ubicacion: partes.length ? partes.join(' · ') : null,
  };
}

/** Interprète la réponse JSON « Consulta_DNPRC » (un seul bien : `bico` ; plusieurs : `lrcdnp`). */
export function parseDnprc(json: unknown): { unidades: Unidad[]; total: number } {
  const r = obj(obj(json).consulta_dnprcResult);
  const control = obj(r.control);
  const errores = obj(r.lerr).err;
  if (errores) {
    const e = Array.isArray(errores) ? errores[0] : errores;
    throw new Error(String(obj(e).des ?? 'Error en la consulta del Catastro.'));
  }
  const bico = obj(r.bico);
  if (bico.bi) {
    const bi = obj(bico.bi);
    return { unidades: [unidadDe(obj(bi.idbi).rc, bi.dt, bi.debi)], total: 1 };
  }
  const lista = obj(r.lrcdnp).rcdnp;
  const arr = Array.isArray(lista) ? lista : lista ? [lista] : [];
  const unidades = arr.map((x) => {
    const o = obj(x);
    return unidadDe(o.rc, o.dt, o.debi);
  });
  return { unidades, total: Number(control.cudnp ?? unidades.length) };
}

export async function consultarParcela(lng: number, lat: number, signal?: AbortSignal): Promise<Parcela> {
  const xml = await fetch(`${RCCOOR}&Coordenada_X=${lng.toFixed(6)}&Coordenada_Y=${lat.toFixed(6)}`, { signal }).then(
    (r) => {
      if (!r.ok) throw new Error(`El Catastro no responde (HTTP ${r.status}).`);
      return r.text();
    },
  );
  const { pc1, pc2, direccion } = parseRccoor(xml);
  const json = await fetch(DNPRC + pc1 + pc2, { signal }).then((r) => {
    if (!r.ok) throw new Error(`El Catastro no responde (HTTP ${r.status}).`);
    return r.json();
  });
  const { unidades, total } = parseDnprc(json);
  return { referencia: pc1 + pc2, direccion, unidades, totalUnidades: total, urlSede: urlSede(pc1, pc2) };
}
