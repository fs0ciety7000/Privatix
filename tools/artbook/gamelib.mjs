// Pilotage du jeu 3D (play3d.html, `?demo&cheat`) pour les captures de l'artbook, en TEMPS VIRTUEL :
// `performance.now` et `requestAnimationFrame` sont remplacés dans la page, si bien que chaque image
// est calculée à pas fixe (1000/30 ms) quel que soit le temps que met SwiftShader à la dessiner.
// Les GIF sont donc fluides et reproductibles même avec un rendu logiciel lent.
import fs from 'node:fs';
import path from 'node:path';
import { CHROMIUM_ARGS, ROOT, playwright, vite } from './lib.mjs';

/** Script injecté avant le jeu : horloge virtuelle (mode manuel activé par `__vt.enter()`). */
const VIRTUAL_TIME = () => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const vt = { manual: false, now: 0, queue: [], id: 1 };
  performance.now = () => (vt.manual ? vt.now : realNow());
  window.requestAnimationFrame = (cb) => {
    if (vt.manual) {
      const id = vt.id++;
      vt.queue.push({ id, cb });
      return id;
    }
    return realRaf((t) => cb(vt.manual ? vt.now : t));
  };
  const realCancel = window.cancelAnimationFrame.bind(window);
  window.cancelAnimationFrame = (id) => {
    vt.queue = vt.queue.filter((q) => q.id !== id);
    realCancel(id);
  };
  vt.enter = () => {
    if (vt.manual) return;
    vt.now = realNow();
    vt.manual = true;
  };
  vt.exit = () => {
    if (!vt.manual) return;
    vt.manual = false;
    const q = vt.queue;
    vt.queue = [];
    for (const { cb } of q) realRaf(cb);
  };
  /** Avance l'horloge de `ms` et exécute les callbacks rAF en attente (une image du jeu). */
  vt.step = (ms) => {
    vt.now += ms;
    const q = vt.queue;
    vt.queue = [];
    for (const { cb } of q) cb(vt.now);
    return q.length;
  };
  window.__vt = vt;

  // Accès à la scène Three.js par le crochet officiel des devtools (aucune modification du jeu).
  const hook = new EventTarget();
  hook.scenes = [];
  hook.addEventListener('observe', (e) => {
    const o = e.detail;
    if (o && o.isScene) hook.scenes.push(o);
  });
  window.__THREE_DEVTOOLS__ = hook;
  /**
   * Rendu de présentation : ramène l'énergie des lampes de salle (lumières ponctuelles de portée
   * 11 m et leurs flaques additives de 5,5 m) au budget du preset bas, réparti sur les lampes du
   * preset courant. Le preset haut en allume 6 sans normaliser : quais et hall sont surexposés.
   */
  window.__artbookLamps = (factor) => {
    let n = 0;
    for (const scene of hook.scenes) {
      scene.traverse((o) => {
        if (o.userData.__artbook) return;
        if (o.isPointLight && o.distance === 12) {
          // Néon Privatix du mur de fond : 22 en continu (6 quand il grésille). La vue réécrit son
          // intensité à chaque image : on intercepte l'écriture.
          let v = o.intensity;
          Object.defineProperty(o, 'intensity', {
            get: () => v,
            set: (x) => {
              v = x * Math.min(1, factor * 1.35);
            },
          });
          o.intensity = v;
          o.userData.__artbook = true;
          n += 1;
        } else if (o.isMesh && !o.material?.userData?.__artbook && o.material?.color && o.material.color.r > 2 && o.material.color.r === o.material.color.b) {
          // Tube du néon (couleur HDR 2,6 réécrite à chaque image) : même interception.
          const c = o.material.color;
          const setScalar = c.setScalar.bind(c);
          c.setScalar = (x) => setScalar(x > 1 ? 1 + (x - 1) * 0.35 : x);
          c.setScalar(c.r);
          o.material.userData.__artbook = true;
          o.userData.__artbook = true;
          n += 1;
        } else if (o.isPointLight && o.distance === 11) {
          o.intensity *= factor;
          o.userData.__artbook = true;
          n += 1;
        } else if (o.isMesh && o.geometry?.parameters?.width === 5.5 && o.material?.blending === 2) {
          o.material = o.material.clone();
          o.material.opacity *= factor;
          o.userData.__artbook = true;
          n += 1;
        }
      });
    }
    return n;
  };
};

export async function openGame({ width = 1280, height = 720, quality = 'haut', seed = 7, extra = '', virtual = true } = {}) {
  const { createServer } = await vite();
  // ARTBOOK_GAME_ROOT : capturer une autre version du jeu (copie extraite d'un commit, par exemple).
  const root = process.env.ARTBOOK_GAME_ROOT ?? ROOT;
  const server = await createServer({ root, server: { port: 4195, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const url = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await playwright().chromium.launch({ args: CHROMIUM_ARGS });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (virtual) await ctx.addInitScript(VIRTUAL_TIME);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${url}/play3d.html?cheat&demo&q=${quality}&seed=${seed}${extra}`);
  await page.waitForSelector('.px-btn--primary', { timeout: 240000 });
  await page.waitForFunction(() => '__privatix3d' in window, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  // Dès lors, le jeu n'avance plus qu'image par image (temps virtuel) : la page reste réactive.
  if (virtual) await page.evaluate(() => window.__vt.enter());

  const api = (fn, ...args) => page.evaluate(([f, a]) => window.__privatix3d[f](...a), [fn, args]);
  const g = {
    page,
    api,
    problems,
    /** Temps virtuel : le jeu n'avance plus qu'avec `frame()`. */
    manual: () => page.evaluate(() => window.__vt.enter()),
    realtime: () => page.evaluate(() => window.__vt.exit()),
    /** Une image du jeu (simulation + rendu) de `ms` millisecondes. */
    frame: (ms = 1000 / 30) => page.evaluate((m) => window.__vt.step(m), ms),
    /** Facteur appliqué aux nouvelles lampes de salle (voir `__artbookLamps`), 1 = jeu tel quel. */
    lamps: 1,
    normalize: () => (g.lamps === 1 ? 0 : page.evaluate((f) => window.__artbookLamps(f), g.lamps)),
    /** Avance de `ms` en images de 1000/30 ms (le rendu suit, bloom et particules compris). */
    async run(ms, step = 1000 / 30) {
      await g.normalize();
      for (let t = 0; t < ms; t += step) await page.evaluate((m) => window.__vt.step(m), step);
    },
    async shot(file, clip) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
    },
    /** Séquence d'images PNG (GIF/WebM) : `n` images à 30 i/s, `each` appelé avant chaque image. */
    async record(dir, n, each, clip) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      for (let i = 0; i < n; i += 1) {
        if (each) await each(i);
        await g.normalize();
        await page.evaluate((m) => window.__vt.step(m), 1000 / 30);
        await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`), ...(clip ? { clip } : {}) });
      }
    },
    /** Clic DOM direct (pas d'attente d'animation : le temps est virtuel). */
    async click(selector, text) {
      await page.evaluate(
        ([sel, txt]) => {
          const el = [...document.querySelectorAll(sel)].find((n) => !txt || n.textContent.includes(txt));
          if (!el) throw new Error(`introuvable : ${sel} ${txt ?? ''}`);
          el.click();
        },
        [selector, text ?? null],
      );
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
  return g;
}
