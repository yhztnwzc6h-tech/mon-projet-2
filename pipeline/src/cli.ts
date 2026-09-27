/**
 * Point d'entrée du pipeline.
 *
 *   npm run pipeline                       → commune pilote (Girona)
 *   npm run pipeline -- --municipios=17079,08019
 *   npm run pipeline -- --todos            → toutes les communes
 */
import path from 'node:path';
import { build } from './build.ts';

/** Commune de test de l'étape 2. */
const MUNICIPIOS_PILOTO = ['17079'];

function argumento(nombre: string): string | undefined {
  const pref = `--${nombre}=`;
  return process.argv.find((a) => a.startsWith(pref))?.slice(pref.length);
}

const todos = process.argv.includes('--todos');
const lista = argumento('municipios')
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

try {
  await build({
    salida: path.resolve(import.meta.dirname, '../../public/data'),
    municipios: todos ? null : (lista ?? MUNICIPIOS_PILOTO),
    anioActual: new Date().getFullYear(),
  });
} catch (err) {
  console.error('\n[pipeline] ÉCHEC :', err instanceof Error ? err.message : err);
  process.exit(1);
}
