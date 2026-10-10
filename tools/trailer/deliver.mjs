// Déclinaisons du trailer à partir du master 16:9 livré par edit.mjs :
// WebM VP9 1080p (site, ≤ 12 Mo), MP4 720p léger (≤ 8 Mo), affiche JPG + WebP, planche de
// 12 vignettes (contact.png), puis copie pour le site (site/public/trailer/).
//   node tools/trailer/deliver.mjs --out <dossier des livrables> [--poster 33.0] [--site site/public/trailer]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const out = path.resolve(opt('out', 'trailer-out'));
const site = opt('site', null);
const posterAt = opt('poster', '33.0');
const src = path.join(out, 'privatix-trailer-16x9.mp4');
const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const mb = (f) => (statSync(f).size / 1e6).toFixed(2);
const pass = path.join(out, 'ffpass');
const cleanPasses = () => {
  for (const f of readdirSync(out)) if (f.startsWith('ffpass')) rmSync(path.join(out, f), { force: true });
};

// WebM VP9 1080p, deux passes à 1,35 Mbit/s (+ Opus 96 kbit/s) : ≈ 11 Mo pour 60 s.
const webm = path.join(out, 'privatix-trailer-16x9.webm');
const vp9 = ['-c:v', 'libvpx-vp9', '-b:v', '1350k', '-maxrate', '2000k', '-bufsize', '4000k', '-row-mt', '1', '-tile-columns', '2', '-g', '240', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p'];
ff(['-i', src, ...vp9, '-pass', '1', '-passlogfile', pass, '-an', '-f', 'webm', '/dev/null']);
ff(['-i', src, ...vp9, '-pass', '2', '-passlogfile', pass, '-c:a', 'libopus', '-b:a', '96k', webm]);
console.log(`${webm} : ${mb(webm)} Mo`);

// MP4 720p léger, deux passes à 880 kbit/s (+ AAC 96 kbit/s) : ≈ 7,3 Mo.
const mp4 = path.join(out, 'privatix-trailer-720p.mp4');
const x264 = ['-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-b:v', '880k', '-maxrate', '1400k', '-bufsize', '2800k', '-pix_fmt', 'yuv420p', '-g', '120'];
ff(['-i', src, ...x264, '-pass', '1', '-passlogfile', pass, '-an', '-f', 'mp4', '/dev/null']);
ff(['-i', src, ...x264, '-pass', '2', '-passlogfile', pass, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', mp4]);
console.log(`${mp4} : ${mb(mp4)} Mo`);

// Affiche (image du trailer, sans carton) et planche de 12 vignettes (une toutes les 5 s).
const posterJpg = path.join(out, 'privatix-trailer-poster.jpg');
const posterWebp = path.join(out, 'privatix-trailer-poster.webp');
ff(['-ss', posterAt, '-i', src, '-frames:v', '1', '-q:v', '3', posterJpg]);
ff(['-i', posterJpg, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libwebp', '-quality', '82', posterWebp]);
const contact = path.join(out, 'contact.png');
ff([
  '-i', src,
  '-vf', "select='eq(n\\,90)+eq(n\\,390)+eq(n\\,690)+eq(n\\,990)+eq(n\\,1290)+eq(n\\,1590)+eq(n\\,1890)+eq(n\\,2190)+eq(n\\,2490)+eq(n\\,2790)+eq(n\\,3090)+eq(n\\,3420)',scale=480:-2,drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=4x3:padding=6:margin=6:color=0x0A0818",
  '-frames:v', '1', '-fps_mode', 'passthrough', contact,
]);
console.log(`${posterJpg}, ${posterWebp}, ${contact}`);
cleanPasses();

if (site) {
  mkdirSync(site, { recursive: true });
  for (const f of [webm, mp4, posterWebp, posterJpg]) copyFileSync(f, path.join(site, path.basename(f)));
  console.log(`copié dans ${site}`);
}
