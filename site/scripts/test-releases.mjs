// Test du classement des fichiers de release (Node 22, suppression des types TypeScript native).
// Lancement : npm test (dans site/). Données : fixtures/releases.sample.json (vraie v0.1.0 + cas limites).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyAsset,
  detectOs,
  formatSize,
  normalizeReleases,
  parseSha256,
  pickFiles,
  shortHash,
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

t('releases d\'assets (trailer, press kit) ignorées : seules les versions vX du jeu comptent', () => {
  const withAssets = [
    { tag_name: 'trailer-v1', name: 'Trailer', published_at: '2099-01-01T00:00:00Z', assets: [{ name: 'privatix-trailer-16x9.mp4', size: 1, browser_download_url: 'https://x/y' }] },
    ...sample,
  ];
  assert.deepEqual(normalizeReleases(withAssets).map((r) => r.tag), ['v0.1.0', 'v0.0.9']);
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

t('empreintes SHA-256 : champ digest de l\'API GitHub', () => {
  const hex = '92cb856ee228275764c5dc92b80961060f1381a860e28aeb4c0d41c99bdfe8ee';
  assert.equal(parseSha256(`sha256:${hex}`), hex);
  assert.equal(parseSha256(`SHA256:${hex.toUpperCase()}`), hex);
  assert.equal(parseSha256(`  sha256:${hex}\n`), hex);
  assert.equal(parseSha256(`sha512:${hex}`), null);
  assert.equal(parseSha256(`sha256:${hex.slice(1)}`), null);
  assert.equal(parseSha256(`sha256:${hex.slice(1)}z`), null);
  assert.equal(parseSha256(null), null);
  assert.equal(parseSha256(undefined), null);
  assert.equal(parseSha256(42), null);
  assert.equal(shortHash(hex), '92cb856e…9bdfe8ee');
  assert.equal(shortHash('abcd'), 'abcd');
});

t('empreintes de la vraie v0.1.0, repli sans digest', () => {
  const [latest, old] = normalizeReleases(sample);
  const setup = latest.files.find((f) => f.platform.id === 'win-setup');
  assert.equal(setup.sha256, '92cb856ee228275764c5dc92b80961060f1381a860e28aeb4c0d41c99bdfe8ee');
  assert.ok(latest.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
  // release ancienne (pas de champ digest) : rien à afficher
  assert.ok(old.files.every((f) => f.sha256 === null));
  assert.equal(latest.checksumsUrl, null);
  assert.ok(stableFiles().every((f) => f.sha256 === null));
});

t('fichier SHA256SUMS.txt de la release', () => {
  const url = 'https://github.com/fs0ciety7000/Privatix/releases/download/v0.3.0/SHA256SUMS.txt';
  const [r] = normalizeReleases([
    {
      tag_name: 'v0.3.0',
      published_at: '2026-11-01T00:00:00Z',
      assets: [
        { name: 'Privatix-0.3.0-setup-x64.exe', size: 1, browser_download_url: 'https://x/setup.exe', digest: 'sha256:zz' },
        { name: 'SHA256SUMS.txt', size: 500, browser_download_url: url, digest: null },
        null,
      ],
    },
  ]);
  assert.equal(r.checksumsUrl, url);
  assert.equal(r.files.length, 1);
  assert.equal(r.files[0].sha256, null, 'digest malformé ignoré');
});

console.log(`${n} tests passés`);
