/**
 * Privatix - process principal Electron.
 *
 * - Sert le contenu web de desktop/app/ via le protocole personnalisé app://game/
 *   (chemins relatifs, fetch et localStorage fonctionnent, contrairement à file://).
 * - Sécurité : contextIsolation, sandbox, pas de Node dans la page, CSP stricte,
 *   aucune navigation ni requête réseau externe.
 * - Perf WebGL : GPU haute performance, blocklist GPU ignorée, rasterisation GPU.
 *
 * Options de ligne de commande (aussi en variables d'env) :
 *   --debug           (PRIVATIX_DEBUG=1)          DevTools (F12), Ctrl+R, infos GPU dans la console
 *   --unlimited-fps   (PRIVATIX_UNLIMITED_FPS=1)  supprime la limite de fps et le vsync (mesure de perf)
 *   --safe-gpu        (PRIVATIX_SAFE_GPU=1)       n'applique pas les flags GPU agressifs (pilote instable)
 *   --entry=<clé>     (PRIVATIX_ENTRY=<clé>)      démarre sur un build extra, ex. --entry=3d
 *   --fullscreen / --windowed                     force le mode d'affichage au démarrage
 */
import { app, BrowserWindow, Menu, protocol, screen, session } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = normalize(join(HERE, '..', 'app'));
const SCHEME = 'app';
const HOST = 'game';
const ORIGIN = `${SCHEME}://${HOST}`;

const argv = process.argv.slice(1);
const hasFlag = (name, env) => argv.includes(`--${name}`) || process.env[env] === '1';
const argValue = (name, env) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : process.env[env];
};

const DEBUG = hasFlag('debug', 'PRIVATIX_DEBUG');
const UNLIMITED_FPS = hasFlag('unlimited-fps', 'PRIVATIX_UNLIMITED_FPS');
const SAFE_GPU = hasFlag('safe-gpu', 'PRIVATIX_SAFE_GPU');
const SMOKE = process.env.PRIVATIX_SMOKE === '1';

// ---------------------------------------------------------------------------
// Flags Chromium : à poser AVANT app.ready.
// ---------------------------------------------------------------------------
if (!SAFE_GPU) {
  // Portables double GPU : demande le GPU dédié (macOS : bascule effective ;
  // Windows/Linux : préférence transmise au GPU process, voir README).
  app.commandLine.appendSwitch('force_high_performance_gpu');
  // Les pilotes « blocklistés » (vieux Intel, etc.) retombent sinon en rendu logiciel.
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}
if (UNLIMITED_FPS) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}
// Après un crash GPU, Chromium bloque WebGL pour le « domaine » : inutile pour une app locale.
app.disableDomainBlockingFor3DAPIs();

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// ---------------------------------------------------------------------------
// Protocole app:// -> fichiers de desktop/app/
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.ktx2': 'image/ktx2',
  '.basis': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.xml': 'application/xml',
  '.fnt': 'application/xml',
};

// CSP stricte : tout vient de app://game, aucun réseau externe.
// 'unsafe-inline' pour les styles seulement (index.html contient un <style>).
// 'wasm-unsafe-eval' autorise WebAssembly (décodeurs Draco/Basis de Three.js) sans autoriser eval().
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

async function serveApp(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return notFound();

  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const filePath = normalize(join(APP_DIR, rel));
  if (filePath !== APP_DIR && !filePath.startsWith(APP_DIR + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  let target = filePath;
  try {
    const st = await stat(target);
    if (st.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        // app://game/3d -> app://game/3d/ pour que les chemins relatifs se résolvent.
        return new Response(null, { status: 301, headers: { location: `${url.pathname}/${url.search}` } });
      }
      target = join(target, 'index.html');
    }
  } catch {
    return notFound();
  }

  let body;
  try {
    body = await readFile(target); // fs est « asar-aware » : marche aussi une fois packagé.
  } catch {
    return notFound();
  }

  const ext = extname(target).toLowerCase();
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
  };
  if (ext === '.html') headers['content-security-policy'] = CSP;

  // Requêtes Range (balises <audio>/<video> qui cherchent dans un fichier).
  const range = request.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] || m[2])) {
    const size = body.length;
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    }
    return new Response(body.subarray(start, end + 1), {
      status: 206,
      headers: {
        ...headers,
        'content-range': `bytes ${start}-${end}/${size}`,
        'content-length': String(end - start + 1),
      },
    });
  }
  // content-length : sans lui, Chromium tient un média pour non « seekable » (pas de saut, pas de boucle).
  return new Response(body, { status: 200, headers: { ...headers, 'content-length': String(body.length) } });
}

// ---------------------------------------------------------------------------
// Entrées (build principal + extras comme 3d/) et état de fenêtre
// ---------------------------------------------------------------------------
function readEntries() {
  try {
    const manifest = JSON.parse(readFileSync(join(APP_DIR, 'desktop-manifest.json'), 'utf8'));
    if (Array.isArray(manifest.entries) && manifest.entries.length) return manifest.entries;
  } catch {
    /* manifest absent : seulement le build principal */
  }
  return [''];
}
const ENTRIES = readEntries();
const entryUrl = (key) => `${ORIGIN}/${key ? `${key}/` : ''}`;

const stateFile = () => join(app.getPath('userData'), 'window-state.json');
function loadWindowState() {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveWindowState(win) {
  try {
    const fullscreen = win.isFullScreen();
    const prev = loadWindowState();
    const b = fullscreen ? prev.bounds : win.getNormalBounds();
    writeFileSync(stateFile(), JSON.stringify({ fullscreen, bounds: b }));
  } catch {
    /* non bloquant */
  }
}

function initialBounds(saved) {
  const { workArea } = screen.getPrimaryDisplay();
  if (saved?.bounds?.width >= 640 && saved?.bounds?.height >= 360) {
    const visible = screen.getAllDisplays().some(({ workArea: w }) => {
      const b = saved.bounds;
      return b.x < w.x + w.width && b.x + b.width > w.x && b.y < w.y + w.height && b.y + b.height > w.y;
    });
    if (visible) return saved.bounds;
  }
  // 16:9, ~80 % de l'écran, au plus 1600x900.
  let width = Math.min(1600, Math.round(workArea.width * 0.8));
  let height = Math.round((width * 9) / 16);
  if (height > workArea.height * 0.85) {
    height = Math.round(workArea.height * 0.85);
    width = Math.round((height * 16) / 9);
  }
  return {
    width,
    height,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
  };
}

// ---------------------------------------------------------------------------
// Durcissement global des webContents
// ---------------------------------------------------------------------------
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

function hardenSession(ses) {
  const ALLOWED = new Set(['fullscreen', 'pointerLock']);
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(ALLOWED.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  // Ceinture + bretelles avec la CSP : aucune requête réseau sortante.
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) =>
    cb({ cancel: true }),
  );
}

// ---------------------------------------------------------------------------
// Fenêtre
// ---------------------------------------------------------------------------
function createWindow() {
  const saved = SMOKE ? {} : loadWindowState();
  const bounds = initialBounds(saved);
  let fullscreen = !!saved.fullscreen;
  if (argv.includes('--fullscreen')) fullscreen = true;
  if (argv.includes('--windowed')) fullscreen = false;

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 640,
    minHeight: 360,
    fullscreen,
    show: false,
    backgroundColor: '#14101a',
    title: 'Privatix',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: DEBUG || SMOKE,
      backgroundThrottling: false, // le jeu ne doit pas ralentir quand la fenêtre perd le focus
    },
  });
  win.setMenu(null);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta;
    if (input.key === 'F11' || (process.platform === 'darwin' && input.meta && input.control && input.code === 'KeyF')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (process.platform === 'darwin' && input.meta && input.code === 'KeyQ') {
      app.quit(); // le menu étant supprimé, Cmd+Q doit être géré à la main
    } else if (mod && !input.shift && !input.alt && /^Digit[1-9]$/.test(input.code)) {
      const key = ENTRIES[Number(input.code.slice(5)) - 1];
      if (key !== undefined) {
        win.loadURL(entryUrl(key));
        event.preventDefault();
      }
    } else if (DEBUG && (input.key === 'F12' || (mod && input.shift && input.code === 'KeyI'))) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    } else if (DEBUG && mod && input.code === 'KeyR') {
      win.webContents.reloadIgnoringCache();
      event.preventDefault();
    }
  });

  if (!SMOKE) {
    win.once('ready-to-show', () => win.show());
    win.on('close', () => saveWindowState(win));
  }

  const start = argValue('entry', 'PRIVATIX_ENTRY') ?? '';
  win.loadURL(entryUrl(ENTRIES.includes(start) ? start : ''));
  return win;
}

// ---------------------------------------------------------------------------
// Mode « smoke test » (CI / vérification locale) : charge chaque entrée,
// collecte erreurs console / chargement, affiche un rapport JSON puis quitte.
// ---------------------------------------------------------------------------
async function runSmoke(win) {
  const report = { gpu: app.getGPUFeatureStatus(), entries: [] };
  const wc = win.webContents;
  let current = null;
  wc.on('console-message', ({ level, message }) => {
    if (current && level === 'error') current.errors.push(String(message));
    if (current && level === 'warning') current.warnings.push(String(message));
  });
  wc.on('did-fail-load', (_e, code, desc, url) => current?.errors.push(`did-fail-load ${code} ${desc} ${url}`));
  wc.on('render-process-gone', (_e, d) => current?.errors.push(`render-process-gone ${d.reason}`));

  for (const key of ENTRIES) {
    current = { entry: entryUrl(key), errors: [], warnings: [] };
    report.entries.push(current);
    try {
      await win.loadURL(entryUrl(key));
      await new Promise((r) => setTimeout(r, Number(process.env.PRIVATIX_SMOKE_WAIT_MS ?? 5000)));
      current.page = await wc.executeJavaScript(`(async () => {
        const persistedFromPreviousRun = localStorage.getItem('__desktop_smoke') === '1';
        localStorage.setItem('__desktop_smoke', '1');
        const csp = (await fetch(location.href)).headers.get('content-security-policy');
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
        return {
          title: document.title,
          canvases: document.querySelectorAll('canvas').length,
          webgl: gl ? (gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1') : null,
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
          localStorage: localStorage.getItem('__desktop_smoke') === '1',
          persistedFromPreviousRun,
          cspHeader: !!csp,
          origin: location.origin,
        };
      })()`);
    } catch (err) {
      current.errors.push(`exception ${err?.message ?? err}`);
    }
  }
  current = null;
  const ok = report.entries.every((e) => e.errors.length === 0 && e.page?.canvases > 0);
  console.log(`SMOKE_RESULT ${JSON.stringify({ ok, ...report })}`);
  app.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------------------
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    hardenSession(session.defaultSession);
    protocol.handle(SCHEME, serveApp);
    if (DEBUG) {
      app.getGPUInfo('basic').then((info) => console.log('[gpu]', JSON.stringify(info.gpuDevice)));
      console.log('[gpu] features', JSON.stringify(app.getGPUFeatureStatus()));
    }
    const win = createWindow();
    if (SMOKE) runSmoke(win);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
