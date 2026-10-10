#!/usr/bin/env node
// Système de logo Privatix (logo A1 retenu), étape 2 sur 2 : compose les lockups, le
// wordmark et les icônes en SVG à partir des sources de prepare.py, puis les rend en PNG
// transparents avec Chromium (Playwright). Aucune dépendance npm hors Playwright.
//
//   python3 tools/marketing/logo/prepare.py      # emblème détouré, emblème vectorisé, wordmark
//   node tools/marketing/logo/build.mjs           # → docs/marketing/officiel/logo/
//
// Repère : unités de la police (1 em = 1000), wordmark à l'échelle 1, ligne de base y = 0.
// Néon : même recette que `.neon` du site (site/src/styles/site.css), traduite en filtre SVG
// (flous en écart type = rayon CSS / 2), ombre dure encrée du design system.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const OUT = join(root, 'docs/marketing/officiel/logo');
const ICONS = join(OUT, 'icone');
mkdirSync(ICONS, { recursive: true });

const WM = JSON.parse(readFileSync(join(here, 'wordmark.json'), 'utf8'));
const MONO = JSON.parse(readFileSync(join(here, 'embleme-mono.json'), 'utf8'));
const EMB_PNG = join(OUT, 'embleme.png');
const EMB_RATIO = MONO.height / MONO.width; // même cadrage que embleme.png (à 1 px près)

const C = {
  ink: '#14101A',
  night: '#0A0818',
  tube: '#FFE3F3',
  magenta: '#FF3EA5',
};

// ─── Emblème couleur embarqué (PNG réduit, base64) ───
function embeddedEmblem(width) {
  const tmp = join(OUT, `.emb-${width}.png`);
  execFileSync('convert', [EMB_PNG, '-filter', 'Lanczos', '-resize', `${width}x`, '-strip', tmp]);
  const b64 = readFileSync(tmp).toString('base64');
  rmSync(tmp);
  return `data:image/png;base64,${b64}`;
}
const EMB_SVG = embeddedEmblem(1024); // lockups
const EMB_ICON = embeddedEmblem(1024); // icône maîtresse
const EMB_FAVICON = embeddedEmblem(96); // favicon.svg : léger

// ─── Variantes ───
// sombre : néon du site ; clair : tube magenta cerné d'encre, lueur discrète ;
// mono-blanc / mono-noir : aplats, sans lueur ni ombre.
const VARIANTS = {
  sombre: { pad: 520, bg: C.night },
  clair: { pad: 300, bg: '#F4F1FA' },
  'mono-blanc': { pad: 160, bg: C.night, mono: '#FFFFFF' },
  'mono-noir': { pad: 160, bg: '#FFFFFF', mono: '#000000' },
};

function defs(v, box) {
  const area = `filterUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" color-interpolation-filters="sRGB"`;
  const glow = (id, sd, color, op = 1) =>
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${sd}" result="b${id}"/><feFlood flood-color="${color}" flood-opacity="${op}"/><feComposite in2="b${id}" operator="in" result="g${id}"/>`;
  if (v === 'sombre')
    return `<filter id="neon" ${area}>
  <feOffset in="SourceAlpha" dy="50" result="o"/><feFlood flood-color="${C.ink}"/><feComposite in2="o" operator="in" result="drop"/>
  ${glow(0, 9, C.magenta)}${glow(3, 190, C.magenta, 0.9)}${glow(2, 80, C.magenta)}${glow(1, 27, '#FFFFFF')}
  <feMerge><feMergeNode in="drop"/><feMergeNode in="g0"/><feMergeNode in="g3"/><feMergeNode in="g2"/><feMergeNode in="g2"/><feMergeNode in="g1"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;
  if (v === 'clair')
    return `<filter id="neon" ${area}>
  <feOffset in="SourceAlpha" dy="55" result="o"/><feFlood flood-color="${C.ink}"/><feComposite in2="o" operator="in" result="drop"/>
  ${glow(2, 90, C.magenta, 0.45)}
  <feMerge><feMergeNode in="g2"/><feMergeNode in="drop"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;
  return '';
}

function wordmark(v, x, y) {
  const t = `translate(${x} ${y})`;
  const m = VARIANTS[v].mono;
  if (m) return `<path transform="${t}" fill="${m}" d="${WM.d}"/>`;
  if (v === 'sombre') return `<g filter="url(#neon)"><path transform="${t}" fill="${C.tube}" d="${WM.d}"/></g>`;
  // clair : tube magenta cerné d'encre (le trait intérieur est recouvert par le remplissage)
  return `<g filter="url(#neon)"><path transform="${t}" fill="${C.magenta}" stroke="${C.ink}" stroke-width="44" stroke-linejoin="round" paint-order="stroke" d="${WM.d}"/></g>`;
}

function emblem(v, x, y, w) {
  const h = w * EMB_RATIO;
  const m = VARIANTS[v].mono;
  if (m) {
    const s = w / MONO.width;
    return `<path transform="translate(${x} ${y}) scale(${s})" fill="${m}" fill-rule="evenodd" d="${MONO.d}"/>`;
  }
  return `<image href="${EMB_SVG}" x="${x}" y="${y}" width="${w}" height="${h.toFixed(1)}" preserveAspectRatio="none"/>`;
}

function svg(box, body, v, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="${box.w / 10}" height="${box.h / 10}" role="img" aria-label="${title}">
<title>${title}</title>
<defs>${defs(v, box)}</defs>
${body}
</svg>
`;
}

const W = WM.width;
const CAP = WM.capHeight;

const layouts = {
  // Wordmark seul
  wordmark(v) {
    const p = VARIANTS[v].pad;
    const box = { x: -p, y: -CAP - p, w: W + 2 * p, h: CAP + 2 * p };
    return svg(box, wordmark(v, 0, 0), v, 'PRIVATIX');
  },
  // Lockup vertical : emblème centré au-dessus (≈ 45 % de la largeur du mot, comme A1)
  'lockup-vertical'(v) {
    const p = VARIANTS[v].pad;
    const ew = Math.round(W * 0.45);
    const eh = ew * EMB_RATIO;
    const gap = 300;
    const top = -CAP - gap - eh;
    const box = { x: -p, y: Math.round(top - p * 0.6), w: W + 2 * p, h: Math.round(eh + gap + CAP + p * 1.6) };
    return svg(box, emblem(v, (W - ew) / 2, top, ew) + '\n' + wordmark(v, 0, 0), v, 'PRIVATIX');
  },
  // Lockup horizontal 3:1 : emblème à gauche, wordmark centré sur sa hauteur
  'lockup-horizontal'(v) {
    const eh = Math.round(CAP * 2.6);
    const ew = Math.round(eh / EMB_RATIO);
    const gap = 360;
    const cw = ew + gap + W;
    const w = cw + 1000;
    const h = Math.round(w / 3);
    const x0 = -ew - gap;
    const cy = -CAP / 2; // milieu des capitales
    const box = { x: x0 - 500, y: Math.round(cy - h / 2), w, h };
    return svg(box, emblem(v, x0, cy - eh / 2, ew) + '\n' + wordmark(v, 0, 0), v, 'PRIVATIX');
  },
};

// ─── Icône carrée : emblème seul sur fond nuit arrondi ───
function icon({ size = 1024, radius = 0.2, inset = 0, scale = 0.84, favicon = false, bleed = false } = {}) {
  const s = size;
  const i = inset * s;
  const r = bleed ? 0 : radius * (s - 2 * i);
  const ew = (s - 2 * i) * scale;
  const eh = ew * EMB_RATIO;
  const ex = (s - ew) / 2;
  const ey = (s - eh) / 2 + s * 0.015;
  const href = favicon ? EMB_FAVICON : EMB_ICON;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
<defs>
  <radialGradient id="bg" cx="50%" cy="56%" r="70%">
    <stop offset="0" stop-color="#4A1A5E"/><stop offset=".45" stop-color="#22103A"/><stop offset="1" stop-color="${C.night}"/>
  </radialGradient>
  <radialGradient id="halo" cx="50%" cy="60%" r="50%">
    <stop offset="0" stop-color="${C.magenta}" stop-opacity=".38"/><stop offset="1" stop-color="${C.magenta}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect x="${i}" y="${i}" width="${s - 2 * i}" height="${s - 2 * i}" rx="${r}" fill="url(#bg)"/>
<ellipse cx="${s / 2}" cy="${s * 0.6}" rx="${s * 0.42}" ry="${s * 0.22}" fill="url(#halo)"/>
${favicon ? '' : `<rect x="${i + s * 0.012}" y="${i + s * 0.012}" width="${s - 2 * i - s * 0.024}" height="${s - 2 * i - s * 0.024}" rx="${Math.max(0, r - s * 0.012)}" fill="none" stroke="#B05CFF" stroke-opacity=".35" stroke-width="${s * 0.008}"/>`}
<image href="${href}" x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" width="${ew.toFixed(1)}" height="${eh.toFixed(1)}"/>
</svg>
`;
}

// ─── Rendu PNG (Chromium) ───
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const g = execFileSync('npm', ['root', '-g']).toString().trim();
    return require(join(g, 'playwright'));
  }
}
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

async function png(svgPath, outPath, long = 2048, { opaque = false } = {}) {
  const src = readFileSync(svgPath, 'utf8');
  const [, , vw, vh] = src.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  const w = vw >= vh ? long : Math.round((long * vw) / vh);
  const h = vw >= vh ? Math.round((long * vh) / vw) : long;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const html = join(OUT, '.render.html');
  writeFileSync(html, `<!doctype html><body style="margin:0;background:transparent"><img src="${pathToFileURL(svgPath).href}" width="${w}" height="${h}" style="display:block"></body>`);
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: outPath, omitBackground: !opaque });
  await page.close();
  rmSync(html);
  return [w, h];
}

const made = [];
try {
  for (const [name, fn] of Object.entries(layouts)) {
    for (const v of Object.keys(VARIANTS)) {
      const base = join(OUT, `privatix-${name}-${v}`);
      writeFileSync(`${base}.svg`, fn(v));
      const [w, h] = await png(`${base}.svg`, `${base}.png`);
      made.push(`${base}.png ${w}×${h}`);
    }
  }
  // Emblème monochrome seul (vectoriel)
  for (const [v, col] of [['mono-blanc', '#FFFFFF'], ['mono-noir', '#000000']]) {
    const base = join(OUT, `embleme-${v}`);
    writeFileSync(
      `${base}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MONO.width} ${MONO.height}" width="${MONO.width}" height="${MONO.height}"><path fill="${col}" fill-rule="evenodd" d="${MONO.d}"/></svg>\n`,
    );
    await png(`${base}.svg`, `${base}.png`);
  }

  // Icônes
  writeFileSync(join(ICONS, 'privatix-icone.svg'), icon());
  const master = join(ICONS, 'privatix-icone-1024.png');
  await png(join(ICONS, 'privatix-icone.svg'), master, 1024);
  for (const s of [512, 256, 128]) {
    execFileSync('convert', [master, '-filter', 'Lanczos', '-resize', `${s}x${s}`, '-strip', join(ICONS, `privatix-icone-${s}.png`)]);
  }
  // Petites tailles : emblème plein cadre et accentué, sinon la clé se perd sous 64 px
  writeFileSync(join(ICONS, '.petit.svg'), icon({ scale: 1.02, radius: 0.16 }));
  const small = join(ICONS, '.petit.png');
  await png(join(ICONS, '.petit.svg'), small, 1024);
  for (const s of [64, 32, 16]) {
    execFileSync('convert', [small, '-filter', 'Lanczos', '-resize', `${s}x${s}`, '-unsharp', '0x0.6+0.8+0', '-modulate', '108,115', '-strip', join(ICONS, `privatix-icone-${s}.png`)]);
  }
  // Variantes de plateforme : plein cadre (apple-touch-icon, iOS arrondit lui-même),
  // masquable (zone sûre de 80 % du manifeste), grille macOS (824 px sur 1024, coins de 185 px).
  writeFileSync(join(ICONS, '.plein.svg'), icon({ bleed: true }));
  await png(join(ICONS, '.plein.svg'), join(ICONS, '.plein.png'), 1024, { opaque: true });
  execFileSync('convert', [join(ICONS, '.plein.png'), '-filter', 'Lanczos', '-resize', '180x180', '-strip', join(ICONS, 'apple-touch-icon-180.png')]);
  writeFileSync(join(ICONS, '.masquable.svg'), icon({ bleed: true, scale: 0.7 }));
  await png(join(ICONS, '.masquable.svg'), join(ICONS, '.masquable.png'), 1024, { opaque: true });
  execFileSync('convert', [join(ICONS, '.masquable.png'), '-filter', 'Lanczos', '-resize', '512x512', '-strip', join(ICONS, 'privatix-icone-masquable-512.png')]);
  writeFileSync(join(ICONS, '.macos.svg'), icon({ inset: 100 / 1024, radius: 185 / 824 }));
  await png(join(ICONS, '.macos.svg'), join(ICONS, 'privatix-icone-macos-1024.png'), 1024);
  for (const f of ['.plein.svg', '.plein.png', '.masquable.svg', '.masquable.png', '.macos.svg']) rmSync(join(ICONS, f));

  // Favicon SVG (emblème réduit embarqué) et ICO multi-tailles (PNG embarqués)
  writeFileSync(join(ICONS, 'favicon.svg'), icon({ size: 64, favicon: true, scale: 1.02, radius: 0.16 }));
  writeIco(join(ICONS, 'favicon.ico'), [16, 32, 48].map((s) => icoPng(small, s)));
  rmSync(small);
  rmSync(join(ICONS, '.petit.svg'));
  made.push(`${ICONS}/ (1024 → 16, favicon.svg, favicon.ico, apple-touch-icon-180, masquable, macOS)`);
} finally {
  await browser.close();
}

function icoPng(src, s) {
  const tmp = join(ICONS, `.ico-${s}.png`);
  execFileSync('convert', [src, '-filter', 'Lanczos', '-resize', `${s}x${s}`, '-unsharp', '0x0.6+0.8+0', '-modulate', '108,115', '-strip', `PNG32:${tmp}`]);
  const buf = readFileSync(tmp);
  rmSync(tmp);
  return [s, buf];
}

/** ICO à entrées PNG (Windows Vista et suivants, tous les navigateurs). */
export function writeIco(path, entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let off = head.length;
  entries.forEach(([s, buf], k) => {
    const e = 6 + 16 * k;
    head.writeUInt8(s >= 256 ? 0 : s, e);
    head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8);
    head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  writeFileSync(path, Buffer.concat([head, ...entries.map(([, b]) => b)]));
}

console.log(made.join('\n'));
