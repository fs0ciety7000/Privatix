// Test du classement des fichiers de release (Node 22, suppression des types TypeScript native).
// Lancement : npm test (dans site/). Données : fixtures/releases.sample.json (vraie v0.1.0 + cas limites).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyAsset,
  detectOs,
  formatSize,
  normalizeReleases,
  pickFiles,
  stableFiles,
  summarizeNotes,
} from '../src/releases-core.ts';

const sample = JSON.parse(readFileSync(new URL('./fixtures/releases.sample.json', import.meta.url), 'utf8'));
let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

t('classement par motif', () => {
  assert.equal(classifyAsset('Privatix-0.1.0-setup-x64.exe'), 'win-setup');
  assert.equal(classifyAsset('Privatix-Setup.exe'), 'win-setup');
  assert.equal(classifyAsset('Privatix-0.1.0-portable-x64.exe'), 'win-portable');
  assert.equal(classifyAsset('Privatix-Portable.exe'), 'win-portable');
  assert.equal(classifyAsset('Privatix-0.1.0-mac-arm64.dmg'), 'mac-arm64');
  assert.equal(classifyAsset('Privatix-mac-x64.dmg'), 'mac-x64');
  assert.equal(classifyAsset('Privatix-0.1.0-linux-x86_64.AppImage'), 'linux-appimage');
  assert.equal(classifyAsset('Privatix.AppImage'), 'linux-appimage');
  assert.equal(classifyAsset('Privatix-0.1.0-setup-x64.exe.blockmap'), null);
  assert.equal(classifyAsset('latest-mac.yml'), null);
  assert.equal(classifyAsset('Privatix-0.1.0.dmg'), null);
});

t('vraie release v0.1.0 : noms versionnés, doublons stables ignorés', () => {
  const [latest] = normalizeReleases(sample);
  assert.equal(latest.version, '0.1.0');
  assert.equal(latest.files.length, 5);
  for (const f of latest.files) assert.match(f.name, /^Privatix-0\.1\.0-/, f.name);
  assert.deepEqual(
    latest.files.map((f) => f.platform.id),
    ['win-setup', 'win-portable', 'mac-arm64', 'mac-x64', 'linux-appimage'],
  );
  assert.ok(latest.files.every((f) => f.url.startsWith('https://github.com/fs0ciety7000/Privatix/releases/download/v0.1.0/')));
});

t('release ancienne : nom stable seul conservé, annexes ignorées, brouillon exclu', () => {
  const all = normalizeReleases(sample);
  assert.deepEqual(all.map((r) => r.tag), ['v0.1.0', 'v0.0.9']);
  const old = all[1];
  assert.equal(old.prerelease, true);
  assert.equal(old.title, 'Privatix v0.0.9');
  assert.deepEqual(old.files.map((f) => f.name), ['Privatix-Setup.exe', 'Privatix-0.0.9-arm64.dmg', 'Privatix-0.0.9.AppImage']);
  assert.equal(old.notes, 'Première version de test avec notes. Corrections.');
});

t('entrées invalides', () => {
  assert.deepEqual(normalizeReleases(null), []);
  assert.deepEqual(normalizeReleases({ message: 'API rate limit exceeded' }), []);
  assert.deepEqual(pickFiles([]), []);
  assert.equal(summarizeNotes(''), '');
});

t('liens stables de repli', () => {
  const s = stableFiles();
  assert.equal(s.length, 5);
  assert.equal(s[0].url, 'https://github.com/fs0ciety7000/Privatix/releases/latest/download/Privatix-Setup.exe');
});

t('détection de l\'OS', () => {
  assert.equal(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows');
  assert.equal(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), 'mac');
  assert.equal(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), 'other');
  assert.equal(detectOs('Mozilla/5.0 (X11; Linux x86_64)'), 'linux');
  assert.equal(detectOs('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'other');
  assert.equal(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'other');
});

t('tailles', () => {
  assert.equal(formatSize(115125798), '115 Mo');
  assert.equal(formatSize(52_400_000), '52,4 Mo');
  assert.equal(formatSize(0), '');
});

console.log(`${n} tests passés`);
