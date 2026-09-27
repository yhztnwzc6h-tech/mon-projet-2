import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve(import.meta.dirname, '../.cache');

// Certains serveurs publics (MIVAU) refusent les requêtes sans User-Agent de navigateur.
const USER_AGENT = 'Mozilla/5.0 (compatible; DataSpain/0.1; +https://github.com/yhztnwzc6h-tech/mon-projet-2)';

export interface FetchOptions {
  /** Réutiliser la copie locale si elle a moins de `maxAgeHours` heures. */
  maxAgeHours?: number;
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) return res;
      // 4xx : inutile de réessayer.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status} pour ${url}`);
      }
      lastError = new Error(`HTTP ${res.status} pour ${url}`);
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith('HTTP 4')) throw err;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function cachePath(url: string): string {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const base = path.basename(new URL(url).pathname) || 'index';
  return path.join(CACHE_DIR, `${hash}-${base}`);
}

/** Télécharge une ressource (avec cache disque) et renvoie son contenu brut. */
export async function download(url: string, opts: FetchOptions = {}): Promise<Buffer> {
  const file = cachePath(url);
  const maxAgeMs = (opts.maxAgeHours ?? 12) * 3600_000;
  try {
    const s = await stat(file);
    if (Date.now() - s.mtimeMs < maxAgeMs) return await readFile(file);
  } catch {
    // pas en cache
  }
  const res = await fetchWithRetry(url);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, buf);
  return buf;
}

export async function downloadText(url: string, opts?: FetchOptions): Promise<string> {
  return (await download(url, opts)).toString('utf8');
}
