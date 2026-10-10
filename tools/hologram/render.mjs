// Rendu de l'hologramme du héros pour le site vitrine (section « Le héros ») : boucle du héros en
// idle qui fait un tour complet sur lui-même, fond transparent, capturée image par image puis
// encodée en WebP animé (alpha) et affiche fixe ; WebM VP9 (alpha) en option.
//   node tools/hologram/render.mjs [--frames 120] [--fps 25] [--height 480] [--quality 60]
//                                  [--alpha-quality 50] [--webm] [--cache <dossier>] [--encode-only]
// Images brutes : <cache>/f0000.png… et box.json (hors dépôt, dossier temporaire par défaut) ;
// --encode-only réencode depuis ce cache sans relancer le rendu.
// Sorties : site/public/hologram/hero-holo.webp, hero-holo-poster.webp (et hero-holo.webm avec --webm,
// non servi par le site : Safari ne lit pas l'alpha du VP9).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHROMIUM_ARGS, ROOT, cli, playwright, vite } from '../artbook/lib.mjs';

const { opt, has } = cli();
const FRAMES = +opt('--frames', 120); // 120 images à 25 i/s = boucle de 4,8 s (deux cycles d'idle)
const FPS = +opt('--fps', 25);
const HEIGHT = +opt('--height', 480);
const QUALITY = +opt('--quality', 60);
const ALPHA_QUALITY = +opt('--alpha-quality', 50);
const CACHE = path.resolve(opt('--cache', path.join(os.tmpdir(), 'privatix-hologram')));
const DEST = path.join(ROOT, 'site', 'public', 'hologram');
const BOX = path.join(CACHE, 'box.json');
// Rendu suréchantillonné ×2 (contour ×2), réduit ensuite en lanczos : bords nets sans crénelage.
// Cadre large : la clé à tire-fond balaie loin autour du héros pendant le tour.
const W = 1344;
const H = 960;

fs.mkdirSync(DEST, { recursive: true });
if (!has('--encode-only')) await render();
const union = JSON.parse(fs.readFileSync(BOX, 'utf8'));

/** Rend la boucle image par image dans CACHE et y note l'union des silhouettes (box.json). */
async function render() {
  fs.rmSync(CACHE, { recursive: true, force: true });
  fs.mkdirSync(CACHE, { recursive: true });
  const { createServer } = await vite();
  const server = await createServer({
    root: path.join(ROOT, 'tools', 'hologram'),
    configFile: false,
    publicDir: path.join(ROOT, 'public'), // public/models (GLB et manifeste du jeu)
    resolve: { dedupe: ['three'] }, // une seule copie de three pour la page et toon.js de la visionneuse
    server: { port: 4197, strictPort: false, fs: { strict: false } },
    logLevel: 'error',
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];

  const browser = await playwright().chromium.launch({ args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`${url}?w=${W}&h=${H}&ow=2&frames=${FRAMES}`);
  await page.waitForFunction(() => window.holoReady === true || window.holoError, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.holoError);
  if (err) throw new Error(err);

  // Capture déterministe : chaque image est posée (mixer.setTime) puis dessinée une fois.
  const u = [W, H, -1, -1];
  for (let i = 0; i < FRAMES; i++) {
    const { png, box } = await page.evaluate((n) => window.holo.frame(n), i);
    fs.writeFileSync(path.join(CACHE, `f${String(i).padStart(4, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
    u[0] = Math.min(u[0], box[0]);
    u[1] = Math.min(u[1], box[1]);
    u[2] = Math.max(u[2], box[2]);
    u[3] = Math.max(u[3], box[3]);
    if (i % 20 === 0) process.stdout.write(`image ${i}/${FRAMES}\r`);
  }
  await browser.close();
  await server.close();
  if (u[2] < 0) throw new Error("silhouette vide : rien n'a été dessiné");
  fs.writeFileSync(BOX, JSON.stringify(u));
}

// Recadrage sur l'union des silhouettes de la boucle (+ marge de 5 % de la hauteur), centré
// horizontalement sur l'axe de rotation pour que le personnage ne dérive pas dans le cadre.
const margin = Math.round((union[3] - union[1]) * 0.05);
const half = Math.max(W / 2 - union[0], union[2] - W / 2) + margin;
const cw = Math.min(W, 2 * Math.ceil(half));
const cx = Math.round(W / 2 - cw / 2);
const cy = Math.max(0, union[1] - margin);
const ch = Math.min(H - cy, union[3] - union[1] + 2 * margin);
console.log(`silhouette ${union.join(',')} → recadrage ${cw}×${ch}+${cx}+${cy}`);

const kio = (p) => `${(fs.statSync(p).size / 1024).toFixed(0)} Kio`;
const webp = path.join(DEST, 'hero-holo.webp');
const poster = path.join(DEST, 'hero-holo-poster.webp');
const args = [CACHE, cx, cy, cw, ch, HEIGHT, FPS, QUALITY, ALPHA_QUALITY, webp, poster].map(String);
execFileSync('python3', [path.join(ROOT, 'tools', 'hologram', 'encode.py'), ...args], { stdio: 'inherit' });
let line = `hero-holo.webp ${kio(webp)} · affiche ${kio(poster)}`;
if (has('--webm')) {
  const webm = path.join(DEST, 'hero-holo.webm');
  const vf = `crop=${cw}:${ch}:${cx}:${cy},scale=-2:${HEIGHT}:flags=lanczos,format=yuva420p`;
  const input = ['-framerate', String(FPS), '-i', path.join(CACHE, 'f%04d.png')];
  const enc = ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '36', '-auto-alt-ref', '0', '-row-mt', '1', '-an'];
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...input, '-vf', vf, ...enc, webm], { stdio: 'inherit' });
  line += ` · webm ${kio(webm)}`;
}
const frames = fs.readdirSync(CACHE).filter((f) => f.endsWith('.png')).length;
console.log(`${frames} images (${(frames / FPS).toFixed(1)} s à ${FPS} i/s) · ${line}`);
