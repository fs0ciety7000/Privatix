// Contrôles d'un livrable du trailer : durée, cadence, résolution (ffprobe) et clignotements
// (WCAG 2.3.1 : pas plus de 3 flashs par seconde). Un « flash » = une variation de luminance moyenne
// de plus de 10 % de la pleine échelle qui s'inverse ensuite (montée puis descente, ou l'inverse).
//   node tools/trailer/check.mjs fichier.mp4 [...]
import { execFileSync } from 'node:child_process';

for (const file of process.argv.slice(2)) {
  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
      encoding: 'utf8',
    }),
  );
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  const size = Number(probe.format.size) / 1e6;
  console.log(
    `${file}\n  ${String(v.width)}×${String(v.height)} ${v.codec_name} ${v.profile ?? ''} ${v.r_frame_rate} i/s, ` +
      `${Number(probe.format.duration).toFixed(3)} s, ${size.toFixed(2)} Mo, ` +
      `audio : ${a ? `${a.codec_name} ${String(Math.round(Number(a.bit_rate) / 1000))} kbit/s` : 'aucun'}`,
  );
  // Luminance moyenne par image (signalstats), en 64×36 pour aller vite.
  const out = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', 'scale=64:36,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const y = [...out.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]) / 255);
  const fps = 60;
  // Extrema locaux de la luminance : un flash est une paire de transitions opposées > 10 %.
  const transitions = [];
  let ref = y[0] ?? 0;
  let dir = 0;
  for (let i = 1; i < y.length; i += 1) {
    const d = (y[i] ?? 0) - ref;
    if (Math.abs(d) >= 0.1 && Math.sign(d) !== dir) {
      transitions.push(i);
      dir = Math.sign(d);
      ref = y[i] ?? 0;
    } else if (Math.sign(d) === dir) ref = dir > 0 ? Math.max(ref, y[i] ?? 0) : Math.min(ref, y[i] ?? 0);
  }
  let worst = 0;
  let at = 0;
  for (let i = 0; i < transitions.length; i += 1) {
    const inWindow = transitions.filter((t) => t >= transitions[i] && t < transitions[i] + fps).length;
    const flashes = Math.floor(inWindow / 2);
    if (flashes > worst) {
      worst = flashes;
      at = transitions[i] / fps;
    }
  }
  console.log(`  clignotements : au plus ${String(worst)} flash(s) par seconde (vers ${at.toFixed(2)} s) ${worst > 3 ? '— ÉCHEC' : '— conforme'}`);
}
