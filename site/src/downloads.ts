/**
 * Section « Télécharger » : versions publiées sur GitHub, mises à jour sans intervention.
 * Sources, dans l'ordre :
 *   1. l'API GitHub en direct (mise en cache dans sessionStorage pour la session) ;
 *   2. l'instantané `releases.json` écrit au build (scripts/fetch-releases.mjs) ;
 *   3. les liens stables `releases/latest/download/<nom stable>` (contenu HTML sans JS).
 */
import {
  API_URL,
  detectOs,
  formatDate,
  formatSize,
  normalizeReleases,
  PLATFORMS,
  stableFiles,
  type OsFamily,
  type Release,
  type ReleaseFile,
} from './releases-core';

const CACHE_KEY = 'privatix.releases.v1';
const CACHE_TTL_MS = 15 * 60 * 1000;

type Source = 'api' | 'snapshot';
interface Loaded {
  readonly releases: Release[];
  readonly source: Source;
}

function readCache(): unknown {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; data: unknown };
    return Date.now() - parsed.t < CACHE_TTL_MS ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCache(data: unknown): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* stockage indisponible (navigation privée, quota) : sans conséquence */
  }
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    ctrl.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: url.startsWith('https://api.github.com') ? { Accept: 'application/vnd.github+json' } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** null : aucune source n'a répondu (on garde alors les liens stables). */
export async function loadReleases(): Promise<Loaded | null> {
  const cached = readCache();
  if (Array.isArray(cached)) return { releases: normalizeReleases(cached), source: 'api' };
  try {
    const data = await getJson(API_URL, 6000);
    if (Array.isArray(data)) {
      writeCache(data);
      return { releases: normalizeReleases(data), source: 'api' };
    }
  } catch {
    /* limite de taux, hors ligne, réseau filtré : on passe à l'instantané */
  }
  try {
    const snap = await getJson(new URL('releases.json', document.baseURI).href, 4000);
    if (Array.isArray(snap) && snap.length > 0) return { releases: normalizeReleases(snap), source: 'snapshot' };
  } catch {
    /* pas d'instantané */
  }
  return null;
}

const OS_LABEL: Record<Exclude<OsFamily, 'other'>, string> = {
  windows: 'Windows',
  mac: 'macOS',
  linux: 'Linux',
};

export function visitorOs(): OsFamily {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOs(navigator.userAgent, nav.userAgentData?.platform ?? navigator.platform, navigator.maxTouchPoints);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c !== null) node.append(c);
  return node;
}

const DOWNLOAD_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0-4.5-4.5M12 14l4.5-4.5M4 17v3h16v-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function primaryButton(file: ReleaseFile, primary: boolean): HTMLAnchorElement {
  const a = el('a', { class: `btn ${primary ? 'btn--primary' : 'btn--secondary'} btn--lg`, href: file.url });
  a.innerHTML = DOWNLOAD_ICON;
  const size = formatSize(file.size);
  a.append(
    el(
      'span',
      {},
      `${file.platform.label} · ${file.platform.detail.split(' (')[0] ?? ''}`,
      el('small', {}, [size, file.name].filter(Boolean).join(' · ')),
    ),
  );
  return a;
}

function fileTile(file: ReleaseFile, current: boolean): HTMLLIElement {
  const size = formatSize(file.size);
  return el(
    'li',
    {},
    el(
      'a',
      { class: `dl-file${current ? ' dl-file--current' : ''}`, href: file.url },
      el('b', {}, file.platform.label),
      el('span', {}, size ? `${file.platform.detail} · ${size}` : file.platform.detail),
      el('code', {}, file.name),
    ),
  );
}

/** Fichiers à mettre en avant pour l'OS du visiteur (Mac : les deux puces, l'API ne dit pas laquelle). */
function featured(files: readonly ReleaseFile[], os: OsFamily): ReleaseFile[] {
  if (os === 'other') return [];
  return files.filter((f) => f.platform.os === os);
}

function renderLatest(root: HTMLElement, release: Release, os: OsFamily, source: Source): void {
  const head = el(
    'div',
    { class: 'dl__head' },
    el('p', { class: 'dl__version' }, `Version ${release.version}`),
    release.prerelease ? el('span', { class: 'badge badge--hors-serie' }, 'Préversion') : null,
    el('p', { class: 'dl__date' }, release.date ? `Publiée le ${formatDate(release.date)}` : ''),
    el('a', { class: 'link', href: release.url }, 'Notes de version'),
  );
  root.replaceChildren(head);
  if (release.notes) root.append(el('p', { class: 'dl__notes' }, release.notes));
  if (source === 'snapshot') {
    root.append(el('p', { class: 'dl__status' }, 'GitHub ne répond pas pour le moment : liste enregistrée lors du dernier déploiement.'));
  }

  const files = release.files.length > 0 ? release.files : stableFiles();
  const top = featured(files, os);
  if (top.length > 0) {
    const box = el('div', { class: 'dl__primary' });
    top.forEach((f, i) => box.append(primaryButton(f, i === 0)));
    root.append(box);
    if (os === 'mac') {
      root.append(el('p', { class: 'dl__status' }, 'Mac récent (puce M1, M2, M3…) : version Apple Silicon. Mac plus ancien : version Intel.'));
    }
  } else if (os === 'other') {
    root.append(
      el('p', { class: 'dl__status' }, 'Sur téléphone ou tablette, jouez directement dans le navigateur ; les applications sont pour ordinateur.'),
    );
  }
  const list = el('ul', { class: 'dl__files', role: 'list', 'aria-label': 'Tous les fichiers de cette version' });
  for (const f of files) list.append(fileTile(f, top.includes(f)));
  root.append(list);
}

function renderOlder(container: HTMLElement, list: HTMLElement, older: readonly Release[]): void {
  if (older.length === 0) return;
  list.replaceChildren(
    ...older.map((r) => {
      const ul = el('ul', { role: 'list' });
      for (const f of r.files) {
        const size = formatSize(f.size);
        ul.append(
          el(
            'li',
            {},
            el('a', { class: 'link', href: f.url }, `${f.platform.label} · ${f.platform.detail}`),
            el('span', {}, size ? ` · ${size}` : ''),
          ),
        );
      }
      if (r.files.length === 0) ul.append(el('li', {}, el('a', { class: 'link', href: r.url }, 'Voir la page de cette version')));
      return el(
        'details',
        { class: 'older' },
        el(
          'summary',
          {},
          `Version ${r.version}`,
          r.prerelease ? el('span', {}, '(préversion)') : null,
          el('span', {}, r.date ? formatDate(r.date) : ''),
        ),
        ul,
      );
    }),
  );
  container.hidden = false;
}

function renderNone(root: HTMLElement): void {
  root.replaceChildren(
    el('div', { class: 'dl__head' }, el('p', { class: 'dl__version' }, 'Bientôt sur vos quais')),
    el(
      'p',
      { class: 'dl__notes' },
      "Aucune version de bureau n'est encore publiée : la première est en préparation à l'atelier. En attendant, le jeu complet tourne dans votre navigateur.",
    ),
    el('div', { class: 'dl__primary' }, el('a', { class: 'btn btn--primary btn--lg', href: './jouer/play3d.html' }, 'Jouer dans le navigateur')),
  );
}

/** Met à jour le bouton « Télécharger » du hero et le badge de version. */
function updateHero(release: Release | null, os: OsFamily): void {
  const label = document.querySelector<HTMLElement>('[data-dl-hero-label]');
  const sub = document.querySelector<HTMLElement>('[data-dl-hero-sub]');
  const version = document.querySelector<HTMLElement>('[data-version]');
  if (label && os !== 'other') label.textContent = `Télécharger pour ${OS_LABEL[os]}`;
  if (release) {
    if (sub) sub.textContent = `Version ${release.version}${release.date ? ` · ${formatDate(release.date)}` : ''}`;
    if (version) {
      version.replaceChildren(el('span', { class: 'badge badge--reglementaire' }, `v${release.version}`));
      version.hidden = false;
    }
  }
}

export async function initDownloads(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-dl]');
  if (!root) return;
  const os = visitorOs();
  updateHero(null, os);
  const loaded = await loadReleases();
  if (!loaded) {
    // Rien n'a répondu : le HTML statique (liens stables) reste en place, avec l'OS mis en avant.
    const stable = new Map(PLATFORMS.map((p) => [p.stable, p]));
    root.querySelectorAll<HTMLAnchorElement>('.dl-file').forEach((a) => {
      const name = a.href.split('/').pop() ?? '';
      if (stable.get(name)?.os === os) a.classList.add('dl-file--current');
    });
    return;
  }
  // Dernière version stable en avant ; une préversion seulement s'il n'existe rien d'autre.
  const all = loaded.releases;
  const latest = all.find((r) => !r.prerelease) ?? all[0];
  if (!latest) {
    renderNone(root);
    return;
  }
  renderLatest(root, latest, os, loaded.source);
  updateHero(latest, os);
  const olderBox = document.querySelector<HTMLElement>('[data-dl-older]');
  const olderList = document.querySelector<HTMLElement>('[data-dl-older-list]');
  if (olderBox && olderList) renderOlder(olderBox, olderList, all.filter((r) => r !== latest));
}
