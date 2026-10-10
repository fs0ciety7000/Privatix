/**
 * Logique pure des téléchargements : classement des fichiers d'une GitHub Release par plateforme,
 * détection de l'OS du visiteur et mise en forme. Aucun accès au DOM ni au réseau ici : ce module est
 * testé sous Node (`npm test`, scripts/test-releases.mjs) avec un JSON d'exemple.
 *
 * Chaque release publie deux fois chaque binaire : un nom versionné (`Privatix-0.2.0-setup-x64.exe`)
 * et un nom stable (`Privatix-Setup.exe`, pour les liens `releases/latest/download/...`). Pour une
 * release donnée, on affiche le nom versionné et on ignore le doublon stable.
 */

export const REPO = 'fs0ciety7000/Privatix';
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
export const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=10`;

export type PlatformId = 'win-setup' | 'win-portable' | 'mac-arm64' | 'mac-x64' | 'linux-appimage';
export type OsFamily = 'windows' | 'mac' | 'linux' | 'other';

export interface PlatformDef {
  readonly id: PlatformId;
  readonly os: Exclude<OsFamily, 'other'>;
  readonly label: string;
  readonly detail: string;
  /** Nom stable publié dans chaque release (lien `releases/latest/download/<nom>`). */
  readonly stable: string;
}

/** Ordre d'affichage : Windows, macOS, Linux. */
export const PLATFORMS: readonly PlatformDef[] = [
  { id: 'win-setup', os: 'windows', label: 'Windows', detail: 'Installeur (x64)', stable: 'Privatix-Setup.exe' },
  { id: 'win-portable', os: 'windows', label: 'Windows', detail: 'Portable, sans installation (x64)', stable: 'Privatix-Portable.exe' },
  { id: 'mac-arm64', os: 'mac', label: 'macOS', detail: 'Apple Silicon (M1 et suivants)', stable: 'Privatix-mac-arm64.dmg' },
  { id: 'mac-x64', os: 'mac', label: 'macOS', detail: 'Intel', stable: 'Privatix-mac-x64.dmg' },
  { id: 'linux-appimage', os: 'linux', label: 'Linux', detail: 'AppImage (x86_64)', stable: 'Privatix.AppImage' },
];

/** Sous-ensemble des champs de l'API GitHub que l'on utilise (aussi le format de releases.json). */
export interface ApiAsset {
  readonly name: string;
  readonly size: number;
  readonly browser_download_url: string;
}
export interface ApiRelease {
  readonly tag_name: string;
  readonly name?: string | null;
  readonly body?: string | null;
  readonly html_url?: string;
  readonly published_at?: string | null;
  readonly draft?: boolean;
  readonly prerelease?: boolean;
  readonly assets: readonly ApiAsset[];
}

export interface ReleaseFile {
  readonly platform: PlatformDef;
  readonly name: string;
  readonly size: number;
  readonly url: string;
}
export interface Release {
  readonly tag: string;
  readonly version: string;
  readonly title: string;
  readonly date: Date | null;
  readonly notes: string;
  readonly url: string;
  readonly prerelease: boolean;
  readonly files: readonly ReleaseFile[];
}

const STABLE_NAMES = new Set(PLATFORMS.map((p) => p.stable.toLowerCase()));

/**
 * Plateforme d'un fichier d'après son nom, par motifs (insensible à la casse). Les fichiers annexes
 * d'electron-builder (`.blockmap`, `latest*.yml`, `.zip` de mise à jour) sont ignorés.
 */
export function classifyAsset(name: string): PlatformId | null {
  const n = name.toLowerCase();
  if (n.endsWith('.blockmap') || n.endsWith('.yml') || n.endsWith('.yaml')) return null;
  if (n.endsWith('.appimage')) return 'linux-appimage';
  if (n.endsWith('.dmg')) {
    if (/(arm64|aarch64|apple-?silicon)/.test(n)) return 'mac-arm64';
    if (/(x64|x86_64|intel|amd64)/.test(n)) return 'mac-x64';
    return null;
  }
  if (n.endsWith('.exe')) {
    if (n.includes('portable')) return 'win-portable';
    if (/(setup|install)/.test(n)) return 'win-setup';
    return null;
  }
  return null;
}

export function isStableName(name: string): boolean {
  return STABLE_NAMES.has(name.toLowerCase());
}

/**
 * Un fichier par plateforme : le nom versionné d'abord, le nom stable seulement s'il est seul
 * (release ancienne ou incomplète).
 */
export function pickFiles(assets: readonly ApiAsset[]): ReleaseFile[] {
  const best = new Map<PlatformId, { asset: ApiAsset; stable: boolean }>();
  for (const asset of assets) {
    const id = classifyAsset(asset.name);
    if (!id) continue;
    const stable = isStableName(asset.name);
    const cur = best.get(id);
    if (!cur || (cur.stable && !stable)) best.set(id, { asset, stable });
  }
  const out: ReleaseFile[] = [];
  for (const platform of PLATFORMS) {
    const hit = best.get(platform.id);
    if (hit) {
      out.push({
        platform,
        name: hit.asset.name,
        size: hit.asset.size,
        url: hit.asset.browser_download_url,
      });
    }
  }
  return out;
}

/** Premier paragraphe des notes, sans syntaxe Markdown, tronqué proprement. */
export function summarizeNotes(body: string | null | undefined, max = 220): string {
  if (!body) return '';
  const para = body
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith('#'));
  if (!para) return '';
  const plain = para
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

/** Releases publiées (sans brouillons), de la plus récente à la plus ancienne. */
export function normalizeReleases(raw: unknown): Release[] {
  if (!Array.isArray(raw)) return [];
  const out: Release[] = [];
  for (const r of raw as ApiRelease[]) {
    if (typeof r !== 'object' || typeof r.tag_name !== 'string' || r.draft === true) continue;
    // Seules les versions du jeu (v1.2.3) : les releases d'assets (trailer-…, presskit-…) sont ignorées.
    if (!/^v\d/i.test(r.tag_name)) continue;
    const date = r.published_at ? new Date(r.published_at) : null;
    out.push({
      tag: r.tag_name,
      version: r.tag_name.replace(/^v/i, ''),
      title: r.name?.trim() || `Privatix ${r.tag_name}`,
      date: date && !Number.isNaN(date.getTime()) ? date : null,
      notes: summarizeNotes(r.body),
      url: r.html_url ?? `${RELEASES_PAGE}/tag/${encodeURIComponent(r.tag_name)}`,
      prerelease: r.prerelease === true,
      files: pickFiles(Array.isArray(r.assets) ? r.assets : []),
    });
  }
  out.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return out;
}

/** Liens stables de repli, quand ni l'API ni l'instantané ne répondent. */
export function stableFiles(): ReleaseFile[] {
  return PLATFORMS.map((platform) => ({
    platform,
    name: platform.stable,
    size: 0,
    url: `${RELEASES_PAGE}/latest/download/${platform.stable}`,
  }));
}

/** Famille d'OS d'après l'agent utilisateur (les iPad récents se déclarent « Macintosh » : tactile ⇒ autre). */
export function detectOs(ua: string, platform = '', touchPoints = 0): OsFamily {
  const s = `${ua} ${platform}`.toLowerCase();
  if (/android|iphone|ipad|ipod|cros/.test(s)) return 'other';
  if (s.includes('win')) return 'windows';
  if (s.includes('mac')) return touchPoints > 1 ? 'other' : 'mac';
  if (s.includes('linux') || s.includes('x11')) return 'linux';
  return 'other';
}

/** Taille lisible en français (Mo décimaux, comme GitHub). */
export function formatSize(bytes: number): string {
  if (!(bytes > 0)) return '';
  const mo = bytes / 1_000_000;
  return `${mo >= 100 ? Math.round(mo) : mo.toFixed(1).replace('.', ',')} Mo`;
}

export function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}
