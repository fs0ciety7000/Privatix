// Test de l'archive du press kit : ZIP lisible (en-têtes, répertoire central, CRC, décompression)
// et pages du site cohérentes avec les fichiers de public/artbook/ (aucun lien mort).
// Lancement : npm test (dans site/).
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { ENTRIES, buildPresskit, crc32, zip } from './presskit.mjs';

const SITE = fileURLToPath(new URL('..', import.meta.url));
let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

/** Lit un ZIP via son répertoire central : [{ name, data }]. */
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'fin de répertoire central absente');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'entrée du répertoire central');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    assert.equal(buf.readUInt32LE(off), 0x04034b50, `en-tête local de ${name}`);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(data.length, size, `taille de ${name}`);
    assert.equal(crc32(data), crc, `CRC de ${name}`);
    out.push({ name, data });
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

t('ZIP minimal relu à l’identique (stocké et compressé)', () => {
  const files = [
    ['a/texte.md', Buffer.from('# Privatix\n\nLe rail n’est pas à vendre.\n'.repeat(20))],
    ['a/image.png', Buffer.from([137, 80, 78, 71, 1, 2, 3, 4])],
  ];
  const back = unzip(zip(files));
  assert.deepEqual(
    back.map((f) => [f.name, f.data.toString('hex')]),
    files.map(([nm, d]) => [nm, d.toString('hex')]),
  );
});

t('CRC-32 de référence', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

t('archive du press kit complète', () => {
  const dir = mkdtempSync(join(tmpdir(), 'presskit-'));
  try {
    const out = buildPresskit(join(dir, 'kit.zip'));
    assert.ok(out, 'archive créée');
    const names = unzip(readFileSync(out)).map((f) => f.name);
    for (const [name, rel] of ENTRIES) if (existsSync(join(SITE, rel))) assert.ok(names.includes(name), name);
    assert.ok(names.includes('privatix-press-kit/presentation.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

t('liens de artbook.html vers public/ tous présents', () => {
  const html = readFileSync(join(SITE, 'artbook.html'), 'utf8');
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href|srcset|data-webm|data-mp4|data-poster|poster)="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith('/artbook/')) urls.add(u);
    }
  }
  assert.ok(urls.size > 40, `assez de fichiers référencés (${urls.size})`);
  const zipUrl = '/artbook/presskit/privatix-press-kit.zip';
  for (const u of urls) {
    if (u === zipUrl) continue; // produit au build
    assert.ok(existsSync(join(SITE, 'public', u)), `fichier manquant : public${u}`);
  }
  assert.ok(urls.has(zipUrl), 'lien de téléchargement du press kit');
});

t('aucun ancien nom du boss final', () => {
  const html = readFileSync(join(SITE, 'artbook.html'), 'utf8');
  assert.ok(!/Vanderslide|Gontran/.test(html));
  assert.ok(/Jean-Cul Lurcke/.test(html));
});

console.log(`${n} tests ok`);
