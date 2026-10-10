// Assemble l'archive du press kit (public/artbook/presskit/privatix-press-kit.zip) au build du site,
// à partir des fichiers versionnés de public/artbook/ (produits par tools/artbook/build.mjs).
// L'archive n'est pas versionnée (.gitignore) : elle est toujours le reflet des fichiers du dépôt.
// ZIP écrit à la main (aucune dépendance) : images déjà compressées stockées telles quelles, textes
// compressés (deflate).
//   node scripts/presskit.mjs [--out chemin.zip]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const ART = join(SITE, 'public', 'artbook');

/** Contenu de l'archive : chemin dans le ZIP → fichier source (relatif à site/). */
export const ENTRIES = [
  ['privatix-press-kit/presentation.md', 'public/artbook/presskit/presentation.md'],
  ['privatix-press-kit/privatix-presskit-couverture.pdf', 'public/artbook/presskit/privatix-presskit-couverture.pdf'],
  ['privatix-press-kit/privatix-presskit-couverture.jpg', 'public/artbook/presskit/privatix-presskit-couverture.jpg'],
  ['privatix-press-kit/logo/privatix-logo-mono-blanc.svg', 'public/artbook/presskit/logo/privatix-logo-mono-blanc.svg'],
  ['privatix-press-kit/logo/privatix-logo-mono-noir.svg', 'public/artbook/presskit/logo/privatix-logo-mono-noir.svg'],
  ['privatix-press-kit/logo/privatix-logo-mono-blanc.png', 'public/artbook/presskit/logo/privatix-logo-mono-blanc.png'],
  ['privatix-press-kit/logo/privatix-logo-mono-noir.png', 'public/artbook/presskit/logo/privatix-logo-mono-noir.png'],
  ['privatix-press-kit/logo/privatix-icone-1024.png', 'public/artbook/presskit/logo/privatix-icone-1024.png'],
  ['privatix-press-kit/affiches/privatix-affiche-suisse-jaune.jpg', 'public/artbook/presskit/affiches/privatix-affiche-suisse-jaune.jpg'],
  ['privatix-press-kit/affiches/privatix-affiche-suisse-jeu.jpg', 'public/artbook/presskit/affiches/privatix-affiche-suisse-jeu.jpg'],
  ['privatix-press-kit/affiches/privatix-affiche-constructiviste.jpg', 'public/artbook/presskit/affiches/privatix-affiche-constructiviste.jpg'],
  ['privatix-press-kit/affiches/privatix-affiche-film-70s.jpg', 'public/artbook/presskit/affiches/privatix-affiche-film-70s.jpg'],
  ['privatix-press-kit/affiches/privatix-affiche-riso.jpg', 'public/artbook/presskit/affiches/privatix-affiche-riso.jpg'],
  ['privatix-press-kit/affiches/privatix-affiche-minimal-cle.jpg', 'public/artbook/presskit/affiches/privatix-affiche-minimal-cle.jpg'],
  ['privatix-press-kit/privatix-banniere.jpg', 'public/artbook/presskit/privatix-banniere.jpg'],
  ['privatix-press-kit/privatix-capture-1.jpg', 'public/artbook/presskit/privatix-capture-1.jpg'],
  ['privatix-press-kit/privatix-capture-2.jpg', 'public/artbook/presskit/privatix-capture-2.jpg'],
  ['privatix-press-kit/privatix-capture-3.jpg', 'public/artbook/presskit/privatix-capture-3.jpg'],
  ['privatix-press-kit/privatix-capture-4.jpg', 'public/artbook/presskit/privatix-capture-4.jpg'],
  ['privatix-press-kit/studio/occ-interactive-dragon.svg', 'src/assets/brand/interactive.svg'],
  ['privatix-press-kit/studio/occ-interactive-mot-symbole.svg', 'src/assets/brand/occ-interactive-wordmark.svg'],
  ['privatix-press-kit/studio/cardor-media-mot-symbole.svg', 'src/assets/brand/cardor-media-wordmark.svg'],
  ['privatix-press-kit/animations/combo.gif', 'public/artbook/anim/combo.gif'],
  ['privatix-press-kit/animations/discosaure.gif', 'public/artbook/anim/discosaure.gif'],
  ['privatix-press-kit/animations/drop-patrimoine.gif', 'public/artbook/anim/drop-patrimoine.gif'],
];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Date et heure DOS (fixes : l'archive est reproductible d'un build à l'autre). */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 9;

/** Construit un ZIP (Buffer) à partir de [nom, contenu]. */
export function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflate = /\.(md|txt|json|svg)$/i.test(name);
    const body = deflate ? zlib.deflateRawSync(data, { level: 9 }) : data;
    const method = deflate ? 8 : 0;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function buildPresskit(out = join(ART, 'presskit', 'privatix-press-kit.zip')) {
  const files = [];
  const missing = [];
  for (const [name, rel] of ENTRIES) {
    const p = join(SITE, rel);
    if (existsSync(p)) files.push([name, readFileSync(p)]);
    else missing.push(rel);
  }
  if (!files.length) {
    console.warn('press kit : aucun fichier source, archive non créée');
    return null;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, zip(files));
  if (missing.length) console.warn(`press kit : fichiers absents ignorés : ${missing.join(', ')}`);
  console.log(`press kit : ${files.length} fichiers, ${(statSync(out).size / 1024 / 1024).toFixed(1)} Mo → ${out}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--out');
  buildPresskit(i > 0 ? process.argv[i + 1] : undefined);
}
