import type { Fuentes, Historico, Municipio } from '../../shared/schema.ts';

const BASE = `${import.meta.env.BASE_URL}data/`;

const cache = new Map<string, Promise<unknown>>();

async function getJson<T>(ruta: string): Promise<T> {
  let p = cache.get(ruta);
  if (!p) {
    p = fetch(BASE + ruta).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (HTTP ${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(ruta));
    cache.set(ruta, p);
  }
  return p as Promise<T>;
}

export const cargarMunicipios = () => getJson<Municipio[]>('municipios.json');
export const cargarFuentes = () => getJson<Fuentes>('sources.json');
export const cargarHistoricoMunicipio = (ine: string) => getJson<Historico>(`historico/municipio/${ine}.json`);
export const cargarHistoricoComarca = (id: string) => getJson<Historico>(`historico/comarca/${id}.json`);
export const cargarHistoricoProvincia = (id: string) => getJson<Historico>(`historico/provincia/${id}.json`);
export const cargarHistoricoCatalunya = () => getJson<Historico>('historico/catalunya.json');
