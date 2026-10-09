#!/usr/bin/env node
/**
 * Lance l'app en mode « smoke test » (fenêtre cachée), charge chaque build embarqué
 * et échoue si la page logue une erreur ou n'affiche aucun canvas.
 *
 *   node scripts/smoke-test.mjs                 -> electron . (sources)
 *   node scripts/smoke-test.mjs <exécutable>    -> binaire packagé (ex. dist/linux-unpacked/privatix-desktop)
 *
 * Sous Linux sans écran, préfixer par xvfb-run :  xvfb-run -a node scripts/smoke-test.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const exe = process.argv[2] ? resolve(process.argv[2]) : require('electron');
const args = process.argv[2] ? [] : ['.'];
// root, ou runner CI Ubuntu 24.04 (AppArmor bloque les user namespaces du sandbox Chromium).
if (process.platform === 'linux' && (process.getuid?.() === 0 || process.env.CI)) args.push('--no-sandbox');

const child = spawn(exe, args, {
  cwd: desktopDir,
  env: { ...process.env, PRIVATIX_SMOKE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => process.stderr.write(d));
const timer = setTimeout(() => {
  console.error('[smoke] délai dépassé');
  child.kill('SIGKILL');
}, 90_000);
child.on('exit', (code) => {
  clearTimeout(timer);
  const line = out.split('\n').find((l) => l.startsWith('SMOKE_RESULT '));
  if (!line) {
    console.error('[smoke] aucun rapport reçu\n' + out);
    process.exit(1);
  }
  const report = JSON.parse(line.slice('SMOKE_RESULT '.length));
  console.log(JSON.stringify(report, null, 2));
  process.exit(code ?? 1);
});
