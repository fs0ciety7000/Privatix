// Assemble les séquences d'images de `game.mjs clips` (30 i/s) en :
//   - WebM VP9 et MP4 H.264 légers (960×540, sans son) pour la page Artbook du site ;
//   - GIF optimisé (palette par séquence, tramage ordonné, ≤ 4 Mo) pour GitHub et le téléchargement ;
//   - affiche WebP (image de la séquence) pour le chargement paresseux.
//   node tools/artbook/anim.mjs [--only combo,dash]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, OUT, cli } from './lib.mjs';

const { only } = cli();
const CLIPS = path.join(CACHE, 'game', 'clips');
const DEST = path.join(OUT, 'anim');
fs.mkdirSync(DEST, { recursive: true });
const MAX_GIF = 4 * 1024 * 1024;

/** Séquences : nom → image de l'affiche (indice) et éventuel recadrage (x, y, w, h en px 960×540). */
export const ANIMS = {
  combo: { poster: 84 },
  dash: { poster: 40 },
  'furet-surgit': { poster: 70 },
  'drop-patrimoine': { poster: 60 },
  auditeur: { poster: 40 },
  dirupo: { poster: 40 },
  discosaure: { poster: 60 },
  lurcke: { poster: 50 },
  'hub-pnj': { poster: 30 },
};

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const kio = (p) => `${(fs.statSync(p).size / 1024).toFixed(0)} Kio`;

for (const name of fs.readdirSync(CLIPS).sort()) {
  if (only.length && !only.includes(name)) continue;
  const dir = path.join(CLIPS, name);
  const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length;
  if (!frames) continue;
  const input = ['-framerate', '30', '-i', path.join(dir, 'f%04d.png')];
  const webm = path.join(DEST, `${name}.webm`);
  const mp4 = path.join(DEST, `${name}.mp4`);
  const gif = path.join(DEST, `${name}.gif`);
  const poster = path.join(DEST, `${name}-poster.webp`);
  ff([...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-an', webm]);
  ff([...input, '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  // GIF : palette commune à la séquence (mode diff : les couleurs qui bougent priment), tramage
  // Bayer (compresse mieux que Floyd-Steinberg en LZW), largeur réduite tant que > 4 Mo.
  for (const width of [640, 576, 512, 448]) {
    const vf = `fps=30,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
    ff([...input, '-vf', vf, '-loop', '0', gif]);
    if (fs.statSync(gif).size <= MAX_GIF) break;
  }
  const idx = Math.min(frames - 1, ANIMS[name]?.poster ?? Math.floor(frames / 2));
  ff(['-i', path.join(dir, `f${String(idx).padStart(4, '0')}.png`), '-c:v', 'libwebp', '-quality', '80', poster]);
  console.log(`${name.padEnd(16)} ${frames} images · webm ${kio(webm)} · mp4 ${kio(mp4)} · gif ${kio(gif)} · affiche ${kio(poster)}`);
}
