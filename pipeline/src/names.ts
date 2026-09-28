/**
 * Normalisation des noms de lieux pour apparier des sources qui n'utilisent pas
 * de code (MIVAU, tableaux territoriaux d'Habitatge).
 *
 * Exemples ramenés à la même clé :
 *   « l'Ametlla de Mar » / « Ametlla de Mar (L') » / « AMETLLA DE MAR, L' »
 *   « la Llacuna » / « Llacuna (La) »
 */
const ARTICULOS = ['els', 'les', 'los', 'las', 'el', 'la', 'lo', 'es', 'sa', 'ses', 'l', 's'];

export function normalizarNombre(nombre: string): string {
  let s = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/l·l/g, 'll')
    .replace(/l\.l/g, 'll')
    .trim();

  // « Llacuna (La) » → « La Llacuna » ; « Ametlla de Mar, L' » → « L' Ametlla de Mar »
  const m = /^(.*?)\s*(?:\(([^)]+)\)|,\s*([a-z']+))$/.exec(s);
  if (m) {
    const art = (m[2] ?? m[3] ?? '').replace(/'$/, '');
    if (ARTICULOS.includes(art)) s = `${art} ${m[1]}`;
  }

  s = s
    .replace(/'/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const partes = s.split(' ');
  if (partes.length > 1 && ARTICULOS.includes(partes[0]!)) partes.shift();
  return partes.join(' ');
}
