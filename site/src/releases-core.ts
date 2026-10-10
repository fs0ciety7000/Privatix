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

export type PlatformId = 'win-setup' | 'win-portable' | 'mac-arm64' | 'mac-x64' | 'linux-appimage' | 'android-apk';
export type OsFamily = 'windows' | 'mac' | 'linux' | 'android' | 'other';

export interface PlatformDef {
  readonly id: PlatformId;
  readonly os: Exclude<OsFamily, 'other'>;
  readonly label: string;
  readonly detail: string;
  /** Nom stable publié dans chaque release (lien `releases/latest/download/<nom>`). */
  readonly stable: string;
}

/** Ordre d'affichage : Windows, macOS, Linux, Android. */
export const PLATFORMS: readonly PlatformDef[] = [
  { id: 'win-setup', os: 'windows', label: 'Windows', detail: 'Installeur (x64)', stable: 'Privatix-Setup.exe' },
  { id: 'win-portable', os: 'windows', label: 'Windows', detail: 'Portable, sans installation (x64)', stable: 'Privatix-Portable.exe' },
  { id: 'mac-arm64', os: 'mac', label: 'macOS', detail: 'Apple Silicon (M1 et suivants)', stable: 'Privatix-mac-arm64.dmg' },
  { id: 'mac-x64', os: 'mac', label: 'macOS', detail: 'Intel', stable: 'Privatix-mac-x64.dmg' },
  { id: 'linux-appimage', os: 'linux', label: 'Linux', detail: 'AppImage (x86_64)', stable: 'Privatix.AppImage' },
  { id: 'android-apk', os: 'android', label: 'Android', detail: 'APK (tablette)', stable: 'Privatix-Android.apk' },
];

/** Sous-ensemble des champs de l'API GitHub que l'on utilise (aussi le format de releases.json). */
export interface ApiAsset {
  readonly name: string;
  readonly size: number;
  readonly browser_download_url: string;
  /** Empreinte calculée par GitHub (« sha256:<hex> ») ; absente des anciennes releases. */
  readonly digest?: string | null;
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
  /** Empreinte SHA-256 en hexadécimal minuscule (64 caractères), null si GitHub n'en fournit pas. */
  readonly sha256: string | null;
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
  /** Fichier `SHA256SUMS.txt` publié avec la release (workflow desktop), null sinon. */
  readonly checksumsUrl: string | null;
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
  // APK signé uniquement : un artefact de test « -unsigned » n'est pas installable.
  if (n.endsWith('.apk')) return n.includes('unsigned') ? null : 'android-apk';
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

/** Nom du fichier d'empreintes publié par le workflow desktop dans chaque release. */
export const CHECKSUMS_NAME = 'SHA256SUMS.txt';

/** « sha256:<64 hex> » (champ `digest` de l'API) → hex minuscule ; tout autre format → null. */
export function parseSha256(digest: unknown): string | null {
  if (typeof digest !== 'string') return null;
  const m = /^sha256:([0-9a-f]{64})$/i.exec(digest.trim());
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** Empreinte abrégée pour l'affichage : 8 premiers et 8 derniers caractères. */
export function shortHash(hex: string, keep = 8): string {
  return hex.length <= keep * 2 + 1 ? hex : `${hex.slice(0, keep)}…${hex.slice(-keep)}`;
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
        sha256: parseSha256(hit.asset.digest),
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
    const assets = Array.isArray(r.assets) ? r.assets.filter((a) => typeof a === 'object' && a !== null && typeof a.name === 'string') : [];
    out.push({
      tag: r.tag_name,
      version: r.tag_name.replace(/^v/i, ''),
      title: r.name?.trim() || `Privatix ${r.tag_name}`,
      date: date && !Number.isNaN(date.getTime()) ? date : null,
      notes: summarizeNotes(r.body),
      url: r.html_url ?? `${RELEASES_PAGE}/tag/${encodeURIComponent(r.tag_name)}`,
      prerelease: r.prerelease === true,
      files: pickFiles(assets),
      checksumsUrl: assets.find((a) => a.name.toLowerCase() === CHECKSUMS_NAME.toLowerCase())?.browser_download_url ?? null,
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
    sha256: null,
  }));
}

/**
 * Famille d'OS d'après l'agent utilisateur. Les iPad récents se déclarent « Macintosh » : tactile ⇒
 * autre. Chrome sur tablette Android demande par défaut la « version pour ordinateur » et se déclare
 * alors « X11; Linux x86_64 » : un Linux tactile (plusieurs points de contact) est traité comme
 * Android, l'erreur inverse (PC Linux à écran tactile) restant rare et sans conséquence (la liste
 * complète des fichiers reste affichée).
 */
export function detectOs(ua: string, platform = '', touchPoints = 0): OsFamily {
  const s = `${ua} ${platform}`.toLowerCase();
  if (s.includes('android')) return 'android';
  if (/iphone|ipad|ipod|cros/.test(s)) return 'other';
  if (s.includes('win')) return 'windows';
  if (s.includes('mac')) return touchPoints > 1 ? 'other' : 'mac';
  if (s.includes('linux') || s.includes('x11')) return touchPoints > 1 ? 'android' : 'linux';
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
