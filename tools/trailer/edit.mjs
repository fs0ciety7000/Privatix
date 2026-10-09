// Montage du trailer (60 s, 60 i/s) à partir des plans tournés (`shoot.mjs`) et des cartons
// (`cards.mjs`), au timecode du script (SCRIPT.md § 3.3) et de la bande-son (`cues.json`).
//
//   node tools/trailer/edit.mjs --frames <plans> --cards <cartons> --format 16x9|3x2|1x1|9x16
//        --out <dossier> [--audio mix.wav] [--preview] [--keep]
//
// - Chaque plan est calé par une **ancre** : un événement de la sim enregistré au tournage
//   (`events.json` : `swing:3`, `perfectDash`, `bossPhase`…) posé au timecode de la bande-son
//   (cues.json), à l'image près. À défaut d'événement, on prend le point d'entrée `in`.
// - 3:2 et 1:1 sont recadrés dans le master 16:9 (même hauteur de 1080 px : définition native) ;
//   le 9:16 est tourné nativement (`shoot.mjs --format 9x16`).
// - Effets (SCRIPT.md § 6.2) : coupes franches, flash blanc ≤ 3 images sur les impacts autorisés,
//   zoom numérique ≤ 115 %, un seul ralenti ajouté (0,5 par images doublées avant le coup final),
//   fondus aux actes IV et V, étalonnage léger commun.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const FPS = 60;
const format = opt('format', '16x9');
const preview = flag('preview');
const framesRoot = path.resolve(opt('frames', 'trailer-frames'));
const cardsRoot = path.resolve(opt('cards', 'trailer-cards'));
const outDir = path.resolve(opt('out', 'trailer-out'));
const audio = opt('audio', null);
const work = path.join(outDir, `work-${format}${preview ? '-preview' : ''}`);
mkdirSync(work, { recursive: true });

const SIZES = { '16x9': [1920, 1080], '3x2': [1620, 1080], '1x1': [1080, 1080], '9x16': [1080, 1920] };
const scale = preview ? 1 / 3 : 1;
const [OW, OH] = SIZES[format].map((v) => Math.round(v * scale / 2) * 2);
const source = format === '9x16' ? '9x16' : '16x9';
const shotDir = (shot) => path.join(framesRoot, `${source}${preview ? '-preview' : ''}`, shot);

/**
 * Le montage. `t` et `d` en secondes (timeline finale) ; `anchor` = [étiquette d'événement (préfixe),
 * occurrence, timecode] ; `zoom` = [départ, arrivée, durée (s), courbe] ; `cx` = centre du recadrage
 * 1:1 / 3:2 (0 à 1) ; `xfade` = fondu enchaîné (images) avec le plan suivant ; `fadeIn` / `fadeOut`
 * = fondu au noir (images).
 */
const EDIT = [
  // ACTE I — la prise de poste (OCC, nuit).
  { id: '01', shot: 's01', t: 0.0, d: 3.0, in: 0, fadeIn: 36 },
  { id: '02', shot: 's02', t: 3.0, d: 2.5, in: 10, zoom: [1, 1.12, 2.5, 'rail'] },
  { id: '03', shot: 's03', t: 5.5, d: 2.5, in: 20 },
  // ACTE II — premier train supprimé (Quais & Voies).
  { id: '04', shot: 's04', t: 8.0, d: 2.0, anchor: ['enemySpawn', 0, 8.55] },
  { id: '05', shot: 's05', t: 10.0, d: 1.8, anchor: ['swing:2', 0, 11.52] },
  { id: '06', shot: 's06', t: 11.8, d: 1.4, anchor: ['projectileFired', 0, 11.9] },
  { id: '07', shot: 's07', t: 13.2, d: 1.4, anchor: ['text:Gorg', 0, 13.7], zoom: [1.1, 1.1, 1, 'none'] },
  { id: '08', shot: 's08', t: 14.6, d: 1.6, anchor: ['perfectDash', 0, 15.4] },
  { id: '09', shot: 's09', t: 16.2, d: 1.8, anchor: ['special:whistle', 0, 16.4] },
  { id: '10', shot: 's10', t: 18.0, d: 2.0, anchor: ['roomCleared', 0, 18.2] },
  // ACTE III — le Shift déborde.
  { id: '11', shot: 's11', t: 20.0, d: 1.6, anchor: ['lootDropped', 0, 20.0], zoom: [1, 1.15, 0.4, 'ballast'], fy: 0.45 },
  { id: '12', shot: 's12', t: 21.6, d: 1.2, anchor: ['swing:2', 0, 22.25] },
  { id: '13', shot: 's13', t: 22.8, d: 1.6, anchor: ['fx:burrow', 0, 22.85] },
  { id: '14', shot: 's14', t: 24.4, d: 1.2, anchor: ['dash', 0, 24.5] },
  { id: '15', shot: 's15', t: 25.6, d: 2.0, anchor: ['bossIntro', 0, 25.6] },
  { id: '16', shot: 's16', t: 27.6, d: 1.4, anchor: ['dash', 0, 28.05] },
  { id: '17', shot: 's17', t: 29.0, d: 1.4, anchor: ['enemyKilled:dirupo', 0, 29.1] },
  { id: '18', shot: 's18', t: 30.4, d: 1.6, anchor: ['hazardImpact', 0, 30.4] },
  { id: '19', shot: 's19', t: 32.0, d: 1.2, anchor: ['dash', 0, 32.25] },
  { id: '20', shot: 's20', t: 33.2, d: 1.0, anchor: ['fx:discoBlackout', 0, 33.6] },
  { id: '21', shot: 's21', t: 34.2, d: 2.2, anchor: ['bossIntro', 0, 34.2] },
  { id: '22', shot: 's22', t: 36.4, d: 0.8, anchor: ['swing:2', 0, 36.78] },
  { id: '23', shot: 's22', t: 37.2, d: 0.7, anchor: ['bossPhase', 0, 37.2] },
  { id: '24a', shot: 's22', t: 37.9, d: 0.7, anchor: ['special:preavis', 0, 37.9] },
  { id: '24b', shot: 's22', t: 38.6, d: 0.8, anchor: ['dash', 1, 38.9] },
  {
    id: '24c',
    shot: 's22',
    t: 39.4,
    d: 3.0,
    anchor: ['enemyKilled:vanderslide', 0, 41.4],
    slow: { frames: 24, factor: 2 },
    zoom: [1.15, 1.15, 1, 'none'],
  },
  { id: '24d', shot: 's22', t: 42.4, d: 2.6, anchor: ['enemyKilled:vanderslide', 0, 41.4], xfade: 12 },
  // ACTE IV — fin de service.
  { id: '25', shot: 's25', t: 45.0, d: 3.4, in: 0, zoom: [1, 1.06, 3.4, 'rail'], fadeOut: 6 },
  { id: '26', shot: 's26', t: 48.4, d: 3.2, in: 0, fadeIn: 6, xfade: 8 },
  { id: '27', shot: 's27', t: 51.6, d: 3.4, in: 0, fadeOut: 18 },
  // ACTE V — carte de fin (fond nuit + synoptique flouté à 25 %).
  { id: '28', shot: 's27', t: 55.0, d: 5.0, in: 0, endcard: true },
];

/** Cartons (cards.html) : début sur la timeline. */
const CARDS = [
  ['C1', 0.8],
  ['C2', 8.4],
  ['C3', 18.3],
  ['C4', 20.4],
  ['C5', 34.6],
  ['C6', 49.0],
  ['END', 55.0],
];

/** Flashs blancs (≤ 3 images, cues.json `flashes`) : coup 3, dernier kill, phase 2, coup final. */
const FLASHES = [11.6, 18.2, 37.2, 41.4];

/** Étalonnage commun, léger : un peu de contraste et de densité, noirs violets préservés. */
const GRADE = 'eq=contrast=1.05:saturation=1.06:gamma=0.98';

const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });

function eventsOf(shot) {
  const f = path.join(shotDir(shot), 'events.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
}

function frameCount(shot) {
  return readdirSync(shotDir(shot)).filter((f) => f.endsWith('.jpg')).length;
}

/** Image (dans le plan) de la n-ième occurrence d'un événement dont l'étiquette commence par `tag`. */
function findEvent(shot, tag, n) {
  const ev = eventsOf(shot);
  let k = 0;
  for (const f of Object.keys(ev).map(Number).sort((a, b) => a - b)) {
    for (const e of ev[f]) {
      if (!e.startsWith(tag)) continue;
      if (k === n) return f;
      k += 1;
    }
  }
  return null;
}

/** Liste des images source d'un plan (indices), longueur exacte, avec ralenti éventuel. */
function frameList(seg, head, tail) {
  // Carte de fin : synoptique ralenti 0,5 (images doublées), donc deux fois moins d'images source.
  const total = Math.round((seg.endcard ? seg.d / 2 : seg.d) * FPS) + head + tail;
  const count = frameCount(seg.shot);
  let first = seg.in ?? 0;
  let list;
  if (seg.anchor) {
    const [tag, n, at] = seg.anchor;
    const f = findEvent(seg.shot, tag, n);
    if (f === null) console.warn(`  ${seg.id} : ancre ${tag}#${String(n)} introuvable, entrée ${String(first)}`);
    const pos = Math.round((at - seg.t) * FPS) + head; // position de l'ancre dans la liste
    if (f !== null && seg.slow) {
      const { frames, factor } = seg.slow;
      const slowOut = frames * factor;
      const before = pos - slowOut;
      list = [];
      for (let i = before; i > 0; i -= 1) list.push(f - frames - i);
      for (let i = frames; i > 0; i -= 1) for (let r = 0; r < factor; r += 1) list.push(f - i);
      for (let i = 0; list.length < total; i += 1) list.push(f + i);
    } else if (f !== null) first = f - pos;
  }
  list ??= Array.from({ length: total }, (_, i) => first + i);
  const bad = list.filter((i) => i < 0 || i >= count).length;
  if (bad > 0) console.warn(`  ${seg.id} : ${String(bad)} image(s) hors du plan ${seg.shot} (${String(count)}), bornées`);
  return list.map((i) => Math.max(0, Math.min(count - 1, i)));
}

const EASES = {
  none: (p) => `${p}`,
  rail: (p) => `(${p}*${p}*(3-2*${p}))`,
  ballast: (p) => `(1-pow(2,-10*${p}))`,
};

/** Recadrage du format dans la source, puis zoom numérique (zoompan sur une image agrandie ×2). */
function videoFilter(seg, n) {
  const f = [];
  const srcW = Math.round((source === '9x16' ? 1080 : 1920) * scale);
  const srcH = Math.round((source === '9x16' ? 1920 : 1080) * scale);
  if (source === '16x9' && format !== '16x9') {
    const cw = Math.round((srcH * SIZES[format][0]) / SIZES[format][1] / 2) * 2;
    const cx = seg.cx ?? 0.5;
    f.push(`crop=${cw}:${srcH}:${Math.round((srcW - cw) * cx)}:0`);
  }
  f.push(`scale=${OW}:${OH}:flags=lanczos`);
  if (seg.zoom) {
    const [z0, z1, dur, ease] = seg.zoom;
    const nz = Math.max(1, Math.round(dur * FPS));
    const p = `min(on/${nz},1)`;
    const z = `${z0}+(${z1 - z0})*${EASES[ease](p)}`;
    const fx = seg.fx ?? 0.5;
    const fy = seg.fy ?? 0.5;
    f.push(`scale=${OW * 2}:${OH * 2}:flags=lanczos`);
    f.push(
      `zoompan=z='${z}':x='(iw-iw/zoom)*${fx}':y='(ih-ih/zoom)*${fy}':d=1:s=${OW}x${OH}:fps=${FPS}`,
    );
  }
  f.push(GRADE);
  if (seg.fadeIn) f.push(`fade=t=in:s=0:n=${seg.fadeIn}`);
  if (seg.fadeOut) f.push(`fade=t=out:s=${n - seg.fadeOut}:n=${seg.fadeOut}`);
  f.push('format=yuv420p');
  return f.join(',');
}

/** Rend un plan en fichier intermédiaire (H.264 quasi sans perte), à la bonne durée. */
function renderSegment(seg, i) {
  const prev = EDIT[i - 1];
  const head = prev?.xfade ? Math.floor(prev.xfade / 2) : 0;
  const tail = seg.xfade ? Math.ceil(seg.xfade / 2) : 0;
  const list = frameList(seg, head, tail);
  const tmp = path.join(work, `seq-${seg.id}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  list.forEach((src, k) => {
    symlinkSync(path.join(shotDir(seg.shot), `${String(src).padStart(5, '0')}.jpg`), path.join(tmp, `${String(k).padStart(5, '0')}.jpg`));
  });
  const out = path.join(work, `seg-${seg.id}.mp4`);
  if (seg.endcard) {
    // Fond nuit, synoptique flouté à 25 % (ralenti par images doublées), fondu d'ouverture.
    ff([
      '-framerate', String(FPS / 2), '-i', path.join(tmp, '%05d.jpg'),
      '-f', 'lavfi', '-i', `color=c=0x0A0818:s=${OW}x${OH}:r=${FPS}`,
      '-filter_complex',
      `[0]fps=${FPS},${videoFilter({ ...seg, fadeIn: 0 }, list.length).replace(',format=yuv420p', '')},gblur=sigma=${14 * scale}[g];` +
        `[1][g]blend=all_mode=normal:all_opacity=0.25,fade=t=in:s=0:n=12,format=yuv420p[v]`,
      '-map', '[v]', '-frames:v', String(Math.round(seg.d * FPS)), '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-r', String(FPS), out,
    ]);
  } else {
    ff([
      '-framerate', String(FPS), '-i', path.join(tmp, '%05d.jpg'),
      '-vf', videoFilter(seg, list.length),
      '-frames:v', String(list.length), '-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-r', String(FPS), out,
    ]);
  }
  rmSync(tmp, { recursive: true, force: true });
  return { out, frames: seg.endcard ? Math.round(seg.d * FPS) : list.length, head, tail, list };
}

console.log(`montage ${format}${preview ? ' (aperçu)' : ''} : ${String(OW)}×${String(OH)}`);
const segs = EDIT.map((s, i) => {
  const r = renderSegment(s, i);
  console.log(`  plan ${s.id} (${s.shot}) : ${String(r.frames)} images`);
  return { ...s, ...r };
});

// Assemblage : coupes (concat) par groupes, fondus enchaînés (xfade) entre les groupes.
const inputs = [];
const parts = [];
segs.forEach((s, i) => {
  inputs.push('-i', s.out);
  parts.push(`[${String(i)}:v]setpts=PTS-STARTPTS[v${String(i)}]`);
});
const groups = [[]];
segs.forEach((s, i) => {
  groups[groups.length - 1].push(i);
  if (s.xfade) groups.push([]);
});
const graph = [...parts];
let lengths = [];
groups.forEach((g, gi) => {
  graph.push(`${g.map((i) => `[v${String(i)}]`).join('')}concat=n=${String(g.length)}:v=1:a=0[g${String(gi)}]`);
  lengths.push(g.reduce((acc, i) => acc + segs[i].frames, 0));
});
let cur = '[g0]';
let len = lengths[0];
for (let gi = 1; gi < groups.length; gi += 1) {
  const x = segs[groups[gi - 1].at(-1)].xfade;
  const off = (len - x) / FPS;
  graph.push(`${cur}[g${String(gi)}]xfade=transition=fade:duration=${(x / FPS).toFixed(4)}:offset=${off.toFixed(4)}[x${String(gi)}]`);
  cur = `[x${String(gi)}]`;
  len = len + lengths[gi] - x;
}
console.log(`  durée image : ${String(len)} images (${(len / FPS).toFixed(3)} s)`);

// Cartons (PNG RGBA à 60 i/s) puis flashs blancs.
let n = segs.length;
const cardFormat = format;
for (const [card, at] of CARDS) {
  const dir = path.join(cardsRoot, cardFormat, card);
  if (!existsSync(dir)) {
    console.warn(`  carton ${card} absent (${dir})`);
    continue;
  }
  inputs.push('-framerate', String(FPS), '-i', path.join(dir, '%05d.png'));
  const scaled = preview ? `,scale=${OW}:${OH}` : '';
  graph.push(`[${String(n)}:v]setpts=PTS-STARTPTS+${at}/TB${scaled}[c${String(n)}]`);
  graph.push(`${cur}[c${String(n)}]overlay=eof_action=pass:format=auto[o${String(n)}]`);
  cur = `[o${String(n)}]`;
  n += 1;
}
const flash = FLASHES.map((t) => {
  const f0 = Math.round(t * FPS);
  return [0.85, 0.5, 0.2]
    .map((a, k) => `drawbox=x=0:y=0:w=iw:h=ih:color=white@${a}:t=fill:enable='eq(n\\,${String(f0 + k)})'`)
    .join(',');
});
graph.push(`${cur}${flash.join(',')},trim=end_frame=${String(Math.round(60 * FPS))},format=yuv420p[out]`);

const master = path.join(outDir, `master-${format}${preview ? '-preview' : ''}.mp4`);
ff([
  ...inputs,
  '-filter_complex', graph.join(';'),
  '-map', '[out]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-r', String(FPS), master,
]);
console.log(`  master : ${master}`);

// Livrable : H.264 High, 60 i/s, CRF 18 (plafonné pour tenir sous 40 Mo), AAC 192 kbit/s.
const final = path.join(outDir, `privatix-trailer-${format}${preview ? '-preview' : ''}.mp4`);
const audioIn = audio && existsSync(audio) ? ['-i', audio] : ['-f', 'lavfi', '-t', '60', '-i', 'anullsrc=r=48000:cl=stereo'];
ff([
  '-i', master, ...audioIn,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '18', '-maxrate', '5000k', '-bufsize', '10000k',
  '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '120',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', '60', '-movflags', '+faststart', final,
]);
console.log(`  livrable : ${final}`);
if (!flag('keep')) for (const s of segs) rmSync(s.out, { force: true });
writeFileSync(
  path.join(outDir, `edl-${format}.json`),
  JSON.stringify(segs.map(({ out: _o, list: _l, ...s }) => s), null, 1),
);
// Images utiles par plan (avec 4 images de marge) : `shoot.mjs --need` ne dessine que celles-là.
const need = {};
for (const s of segs) {
  const lo = Math.max(0, Math.min(...s.list) - 4);
  const hi = Math.max(...s.list) + 4;
  (need[s.shot] ??= []).push([lo, hi]);
}
writeFileSync(path.join(outDir, `need-${source}.json`), JSON.stringify(need, null, 1));
