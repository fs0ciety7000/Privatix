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
  REPO,
  shortHash,
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
  android: 'Android',
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

/** Copie dans le presse-papiers (API asynchrone, sinon sélection + execCommand). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { readonly: '', 'aria-hidden': 'true', style: 'position:fixed;opacity:0;pointer-events:none' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Annonce discrète aux lecteurs d'écran (zone polie unique, créée à la demande). */
function announce(msg: string): void {
  let live = document.querySelector<HTMLElement>('[data-dl-announce]');
  if (!live) {
    live = el('p', { class: 'sr-only', 'aria-live': 'polite', 'data-dl-announce': '' });
    document.body.append(live);
  }
  live.textContent = '';
  window.setTimeout(() => {
    if (live) live.textContent = msg;
  }, 30);
}

/**
 * Empreinte SHA-256 d'un fichier : abrégée (valeur complète au survol et dans un <details>), avec
 * un bouton « Copier ». Rien si GitHub ne fournit pas d'empreinte (anciennes releases, repli).
 */
function hashLine(file: ReleaseFile): HTMLElement | null {
  const hex = file.sha256;
  if (!hex) return null;
  const btn = el('button', { type: 'button', class: 'dl-hash__copy', 'aria-label': `Copier l'empreinte SHA-256 de ${file.name}` }, 'Copier');
  let timer = 0;
  btn.addEventListener('click', () => {
    void copyText(hex).then((ok) => {
      btn.textContent = ok ? 'Copié' : 'Échec';
      btn.dataset.state = ok ? 'ok' : 'err';
      announce(ok ? `Empreinte SHA-256 de ${file.name} copiée.` : 'Copie impossible : sélectionnez l\'empreinte complète.');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        btn.textContent = 'Copier';
        delete btn.dataset.state;
      }, 2000);
    });
  });
  return el(
    'div',
    { class: 'dl-hash' },
    el(
      'details',
      { class: 'dl-hash__details' },
      el('summary', { title: hex }, el('span', { class: 'dl-hash__label' }, 'SHA-256'), el('code', { class: 'dl-hash__short' }, shortHash(hex, 6))),
      el('code', { class: 'dl-hash__full' }, hex),
    ),
    btn,
  );
}

function fileTile(file: ReleaseFile, current: boolean): HTMLLIElement {
  const size = formatSize(file.size);
  return el(
    'li',
    { class: 'dl-item' },
    el(
      'a',
      { class: `dl-file${current ? ' dl-file--current' : ''}`, href: file.url },
      el('b', {}, file.platform.label),
      el('span', {}, size ? `${file.platform.detail} · ${size}` : file.platform.detail),
      el('code', {}, file.name),
    ),
    hashLine(file),
  );
}

function cmd(label: string, line: string): HTMLLIElement {
  return el('li', {}, el('span', {}, label), el('code', {}, line));
}

/** Encart « Vérifier votre téléchargement » : seulement si GitHub fournit des empreintes. */
function verifyBox(release: Release, files: readonly ReleaseFile[]): HTMLElement | null {
  if (!files.some((f) => f.sha256)) return null;
  const sums = release.checksumsUrl;
  const nameOf = (os: OsFamily, fallback: string): string => files.find((f) => f.platform.os === os)?.name ?? fallback;
  return el(
    'details',
    { class: 'dl-verify' },
    el('summary', {}, 'Vérifier votre téléchargement'),
    el(
      'div',
      { class: 'dl-verify__body' },
      el(
        'p',
        {},
        "Calculez l'empreinte SHA-256 du fichier téléchargé et comparez-la à celle affichée sous son nom (ou dans ",
        sums ? el('a', { class: 'link', href: sums }, 'SHA256SUMS.txt') : el('a', { class: 'link', href: release.url }, 'la page de la version'),
        ') : elles doivent être identiques, caractère pour caractère.',
      ),
      el(
        'ul',
        { class: 'dl-verify__cmds', role: 'list' },
        cmd('Windows (PowerShell)', `Get-FileHash .\\${nameOf('windows', 'Privatix-Setup.exe')} -Algorithm SHA256`),
        cmd('macOS (Terminal)', `shasum -a 256 ${nameOf('mac', 'Privatix-mac-arm64.dmg')}`),
        cmd('Linux', `sha256sum ${nameOf('linux', 'Privatix.AppImage')}`),
        files.some((f) => f.platform.os === 'android')
          ? cmd('Android (sur ordinateur, avant de copier)', `sha256sum ${nameOf('android', 'Privatix-Android.apk')}`)
          : null,
      ),
      el(
        'p',
        {},
        'Chaque version publiée par le workflow GitHub porte aussi une attestation de provenance (Sigstore) : ',
        el('code', {}, `gh attestation verify <fichier> -R ${REPO}`),
        ' confirme que le fichier a été construit par le dépôt officiel.',
      ),
      el(
        'p',
        { class: 'dl-verify__note' },
        "Les exécutables de bureau ne sont pas encore signés par un certificat d'éditeur : SmartScreen (Windows) et Gatekeeper (macOS) afficheront un avertissement au premier lancement (voir l'encart ci-dessous). L'APK Android est signé par la clé du projet, toujours la même : les mises à jour s'installent par-dessus.",
      ),
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
    if (os === 'android') {
      root.append(
        el(
          'p',
          { class: 'dl__status' },
          "Pensé pour tablette, en paysage. À l'ouverture du fichier, Android demande d'autoriser l'installation depuis votre navigateur (voir l'encart ci-dessous). Sur téléphone, le navigateur reste le plus simple.",
        ),
      );
    }
  } else if (os === 'other') {
    root.append(
      el('p', { class: 'dl__status' }, 'Sur iPhone, iPad ou Chromebook, jouez directement dans le navigateur ; les applications sont pour ordinateur et tablette Android.'),
    );
  }
  const list = el('ul', { class: 'dl__files', role: 'list', 'aria-label': 'Tous les fichiers de cette version' });
  for (const f of files) list.append(fileTile(f, top.includes(f)));
  root.append(list);
  const verify = verifyBox(release, files);
  if (verify) root.append(verify);
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
            hashLine(f),
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

/** Met à jour le bouton « Télécharger » du hero (OS du visiteur, version et date). */
function updateHero(release: Release | null, os: OsFamily): void {
  const label = document.querySelector<HTMLElement>('[data-dl-hero-label]');
  const sub = document.querySelector<HTMLElement>('[data-dl-hero-sub]');
  if (label && os !== 'other') label.textContent = `Télécharger pour ${OS_LABEL[os]}`;
  if (release && sub) sub.textContent = `Version ${release.version}${release.date ? ` · ${formatDate(release.date)}` : ''}`;
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
    const sub = document.querySelector<HTMLElement>('[data-dl-hero-sub]');
    if (sub) sub.textContent = 'Applications de bureau bientôt disponibles';
    return;
  }
  renderLatest(root, latest, os, loaded.source);
  updateHero(latest, os);
  const olderBox = document.querySelector<HTMLElement>('[data-dl-older]');
  const olderList = document.querySelector<HTMLElement>('[data-dl-older-list]');
  if (olderBox && olderList) renderOlder(olderBox, olderList, all.filter((r) => r !== latest));
}
