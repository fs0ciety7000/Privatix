#!/usr/bin/env node
/**
 * Génère build/icon.png (1024x1024) sans dépendance : un simple pictogramme
 * géométrique (rails stylisés sur fond sombre). Aucune marque, aucun logo réel.
 * electron-builder en dérive automatiquement .ico (Windows) et .icns (macOS).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;
const out = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'build', 'icon.png');

const BG = [20, 16, 26]; // #14101a, fond du jeu
const PANEL = [46, 36, 62];
const RAIL = [232, 196, 92];
const TIE = [150, 96, 60];

const px = Buffer.alloc(SIZE * SIZE * 4);
const set = (x, y, [r, g, b], a = 255) => {
  const i = (y * SIZE + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
};

const R = 200; // rayon des coins arrondis
const inRounded = (x, y) => {
  const cx = Math.min(Math.max(x, R), SIZE - 1 - R);
  const cy = Math.min(Math.max(y, R), SIZE - 1 - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
};

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (!inRounded(x, y)) {
      set(x, y, [0, 0, 0], 0);
      continue;
    }
    // Perspective : deux rails qui convergent vers l'horizon (y = 260).
    const t = Math.max(0, (y - 260) / (SIZE - 260)); // 0 à l'horizon, 1 en bas
    const half = 40 + 300 * t; // demi-écartement des rails
    const w = 6 + 30 * t; // épaisseur des rails
    const d = Math.abs(x - SIZE / 2);
    let c = y < 260 ? PANEL : BG;
    if (y >= 260) {
      // Traverses espacées de façon perspective.
      const phase = Math.sqrt(t) * 12;
      if (phase % 1 < 0.35 && d < half + 60 * t + 10) c = TIE;
      if (Math.abs(d - half) < w) c = RAIL;
    }
    set(x, y, c);
  }
}

// Encodage PNG minimal (RGBA 8 bits, filtre 0).
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // profondeur
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(`[make-icon] ${out}`);
