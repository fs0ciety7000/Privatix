// Instantané des GitHub Releases au moment du build (repli du site quand l'API est injoignable
// côté visiteur : limite de taux, réseau filtré). Écrit public/releases.json, copié tel quel par Vite.
// Ne casse jamais le build : en cas d'échec, écrit une liste vide.
// GITHUB_TOKEN (facultatif) relève la limite de taux de l'API pendant le build.
import { mkdirSync, writeFileSync } from 'node:fs';

const API = 'https://api.github.com/repos/fs0ciety7000/Privatix/releases?per_page=10';
const OUT = new URL('../public/releases.json', import.meta.url);
const KEEP = ['tag_name', 'name', 'body', 'html_url', 'published_at', 'draft', 'prerelease'];

function write(list, note) {
  mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify(list));
  console.info(`[releases] ${note} -> public/releases.json (${list.length} release(s))`);
}

async function get(withToken) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'privatix-site-build' };
  if (withToken) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(API, { headers, signal: AbortSignal.timeout(10_000) });
}

try {
  const token = Boolean(process.env.GITHUB_TOKEN);
  let res = await get(token);
  // Jeton refusé (expiré, mauvaise portée) : le dépôt est public, on retente sans.
  if (token && (res.status === 401 || res.status === 403)) res = await get(false);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('réponse inattendue');
  const slim = data
    .filter((r) => r && !r.draft)
    .map((r) => ({
      ...Object.fromEntries(KEEP.map((k) => [k, r[k] ?? null])),
      assets: (r.assets ?? []).map((a) => ({
        name: a.name,
        size: a.size,
        browser_download_url: a.browser_download_url,
      })),
    }));
  write(slim, 'instantané à jour');
} catch (e) {
  write([], `API indisponible (${e instanceof Error ? e.message : String(e)}), liste vide`);
}
