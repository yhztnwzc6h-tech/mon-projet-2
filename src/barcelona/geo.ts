/** Point dans un polygone (lancer de rayon), pour rattacher une adresse à son barri. */
function enAnillo([x, y]: [number, number], anillo: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i] as [number, number];
    const [xj, yj] = anillo[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function enPoligono(p: [number, number], anillos: number[][][]): boolean {
  if (!anillos[0] || !enAnillo(p, anillos[0])) return false;
  return !anillos.slice(1).some((hueco) => enAnillo(p, hueco));
}

export function zonaEnPunto(fc: GeoJSON.FeatureCollection, lng: number, lat: number): string | null {
  const p: [number, number] = [lng, lat];
  for (const f of fc.features) {
    const g = f.geometry;
    const dentro =
      g.type === 'Polygon'
        ? enPoligono(p, g.coordinates)
        : g.type === 'MultiPolygon'
          ? g.coordinates.some((poly) => enPoligono(p, poly))
          : false;
    if (dentro) return (f.properties?.id as string) ?? null;
  }
  return null;
}
