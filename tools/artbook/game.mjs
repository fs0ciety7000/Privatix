// Captures du jeu 3D pour l'artbook : décors (biomes, hub, arènes), loot et UI, VFX et télégraphes
// (images fixes en 1920×1080), et séquences d'images à 30 i/s pour les GIF/WebM (960×540).
//   node tools/artbook/game.mjs [stills|clips] [--only nom1,nom2]
// Sortie : tools/artbook/.cache/game/stills/<nom>.png, .cache/game/clips/<nom>/f0000.png…
// Le jeu tourne en temps virtuel (gamelib.mjs) : `advance` fait avancer la simulation sans dessiner
// (mise en place), `run`/`record` dessinent chaque image.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, cli } from './lib.mjs';
import { openGame } from './gamelib.mjs';

const { a, only } = cli();
const sessions = a.filter((x) => ['stills', 'clips'].includes(x));
const want = (n) => !only.length || only.includes(n);
const STILLS = path.join(CACHE, 'game', 'stills');
const CLIPS = path.join(CACHE, 'game', 'clips');

/**
 * Rendu de présentation des Shifts : énergie des lampes de salle ramenée au budget du preset bas
 * (2 lampes sur les 6 du preset haut). Sans cela, bloom et flaques additives voilent quais et hall.
 */
const LAMPS = 2 / 6;

/** Boss final : identifiant de simulation après et avant le renommage (Jean-Cul Lurcke). */
const LURCKE = ['lurcke', 'vanderslide'];

const HIDE_UI = '#ui, #dmg-layer, .px-hud, .hud3d { visibility: hidden !important; }';

/** Mise en place commune : Shift lancé, héros invincible, vagues coupées, salle vidée. */
async function toRun(g, biome = 0) {
  g.lamps = LAMPS;
  const s = await g.api('state');
  if (s.phase !== 'run') {
    await g.api('start');
    await g.api('advance', 600);
  }
  await g.api('cheat', 'G');
  await g.api('waves', false);
  if (biome > 0 || s.phase === 'run') {
    await g.api('biome', biome);
    await g.api('advance', 1200);
  }
  await g.api('cheat', 'K');
  await g.api('advance', 3200);
  await g.api('waves', false);
  await g.api('cheat', 'K');
  await g.api('advance', 1500);
}

async function hero(g) {
  return g.api('hero');
}

/** Fait apparaître des ennemis en arc devant le héros (dx, dy relatifs). */
async function spawnAll(g, list) {
  const ids = [];
  for (const [kind, dx, dy] of list) ids.push(await g.api('spawn', kind, dx, dy));
  return ids;
}

async function withUi(g, show, fn) {
  let tag = null;
  if (!show) tag = await g.page.addStyleTag({ content: HIDE_UI });
  try {
    await fn();
  } finally {
    if (tag) await tag.evaluate((n) => n.remove());
  }
}

/** Image fixe : quelques images dessinées pour que bloom, particules et interpolation se posent. */
async function still(g, name, { ui = false, settle = 100, clip, banner = false } = {}) {
  await withUi(g, ui, async () => {
    if (!banner) await g.page.evaluate(() => document.querySelectorAll('.hud-banner').forEach((b) => b.classList.remove('show')));
    await g.run(settle);
    await g.shot(path.join(STILLS, `${name}.png`), clip);
  });
  console.log(`  image : ${name}`);
}

/** Recentre le héros : il marche quelques pas vers le bas pour que la caméra montre la salle. */
async function place(g, dx, dy) {
  const h = await hero(g);
  await g.api('teleport', h.x + dx, h.y + dy);
  await g.api('advance', 400);
}

// ─── Images fixes (1920×1080) ────────────────────────────────────────────────────────────────

const STILL_TASKS = {
  async titre(g) {
    await g.run(200);
    await g.shot(path.join(STILLS, 'ui-titre.png'));
    console.log('  image : ui-titre');
  },
  async hub(g) {
    await g.click('button', 'Prendre son service');
    await g.run(150);
    await g.api('advance', 1500);
    await still(g, 'hub-salle-operations', { settle: 200 });
    await g.api('hubGoto', 'vieille-dame');
    await g.api('advance', 600);
    await still(g, 'hub-salle-operations-ui', { ui: true });
    await g.api('hubGoto', 'josiane');
    await g.api('advance', 800);
    await still(g, 'hub-cour-bag');
    await g.api('hubGoto', 'poubelles');
    await g.api('advance', 800);
    await still(g, 'hub-coin-poubelles');
    await g.api('hubGoto', 'josiane');
    await g.api('advance', 300);
    await g.api('press', 'interact');
    await g.api('advance', 200);
    await g.run(400);
    await still(g, 'ui-dpd-vestiaire', { ui: true });
    await g.page.keyboard.press('Escape');
    await g.run(300);
  },
  async quais(g) {
    await toRun(g, 0);
    await still(g, 'decor-b1-quais', { settle: 200 });
    // HUD en combat : consultants, borne, drone, télégraphes.
    const ids = await spawnAll(g, [
      ['consultant', -150, -50],
      ['consultant', 160, -40],
      ['borne', 30, -150],
      ['drone', -60, -120],
    ]);
    await g.api('advance', 1400);
    await still(g, 'ui-hud-combat', { ui: true });
    await g.api('attack', ids[0], 'quickwin');
    await g.api('attack', ids[1], 'diaporama');
    await g.api('advance', 200);
    await still(g, 'vfx-telegraphes-consultants', { settle: 34 });
    await g.api('cheat', 'K');
    await g.api('advance', 2600);
  },
  async combo(g) {
    await toRun(g, 0);
    const ids = await spawnAll(g, [
      ['consultant', -10, -50],
      ['consultant', 34, -44],
    ]);
    await g.api('advance', 1500);
    await g.api('aim', -Math.PI / 2);
    // Trois coups : on capture le smear et l'impact du coup 3.
    const h = await hero(g);
    const p = await g.api('screen', h.x, h.y - 30, 0.8);
    const clip = { x: Math.max(0, Math.min(1920 - 1200, p.x - 600)), y: Math.max(0, Math.min(1080 - 680, p.y - 380)), width: 1200, height: 680 };
    await g.api('press', 'attack');
    await g.api('advance', 100);
    await still(g, 'vfx-smear-coup1', { settle: 34, clip });
    await g.api('advance', 220);
    await g.api('press', 'attack');
    await g.api('advance', 330);
    await g.api('press', 'attack');
    await g.api('advance', 160);
    await still(g, 'vfx-impact-coup3', { settle: 34, clip });
    await g.api('release');
    void ids;
    await g.api('cheat', 'K');
    await g.api('advance', 2600);
  },
  async loot(g) {
    await toRun(g, 0);
    await place(g, 0, 30);
    await g.api('lootDrop', 'elite', -120, -40);
    await g.api('lootDrop', 'gardee', 120, -40);
    await g.api('lootDrop', 'wagon-bar', 0, -110);
    await g.api('lootDrop', 'boss', -40, -170);
    await g.api('advance', 1400);
    await still(g, 'loot-faisceaux', { settle: 300 });
    const l = await g.api('loot');
    const pat = l.ground.find((x) => x.rarity === 'patrimoine') ?? l.ground[l.ground.length - 1];
    await g.api('lootGoto', pat.id);
    await g.api('advance', 150);
    await still(g, 'ui-carte-comparaison', { ui: true });
    // Équipe des pièces visibles (casque, gilet, outil) pour le gros plan du héros.
    const visible = (d) => /^(casque|gilet|parka|cle|masse|pied|lanterne|pelle|perche|pince)/.test(d);
    for (let i = 0; i < 14; i += 1) {
      const lo = await g.api('loot');
      const t = lo.ground.find((x) => visible(x.defId));
      if (!t) {
        await g.api('lootDrop', 'boss', (i % 3) * 40 - 40, -70);
        await g.api('advance', 600);
        continue;
      }
      await g.api('lootGoto', t.id);
      await g.api('advance', 50);
      await g.api('lootAct', 'equip');
      await g.api('advance', 100);
    }
    await g.api('advance', 600);
    const h0 = await hero(g);
    await g.api('teleport', h0.x + 140, h0.y + 60);
    await g.api('advance', 700);
    const h = await hero(g);
    const p = await g.api('screen', h.x, h.y, 1.0);
    await still(g, 'loot-heros-equipe', { clip: { x: Math.max(0, p.x - 360), y: Math.max(0, p.y - 300), width: 720, height: 540 }, settle: 200 });
    await g.api('tenue');
    await g.run(500);
    await still(g, 'ui-tenue', { ui: true });
    await g.page.keyboard.press('Escape');
    await g.run(300);
  },
  async auditeur(g) {
    await toRun(g, 0);
    await g.api('waves', true);
    await g.api('cheat', 'B');
    await g.api('advance', 450);
    await still(g, 'ui-intro-auditeur', { ui: true, settle: 600, banner: true });
    await g.api('advance', 2600);
    const e = (await g.api('enemies')).find((x) => x.kind === 'auditeur');
    await g.api('teleport', e.x, e.y + 150);
    await g.api('advance', 300);
    await still(g, 'arene-auditeur', { settle: 200 });
    await g.api('attack', e.id, 'sweep');
    await g.api('advance', 600);
    await still(g, 'vfx-telegraphe-auditeur-bras', { ui: true });
    await g.api('advance', 1800);
    await g.api('attack', e.id, 'stamp');
    await g.api('advance', 500);
    await still(g, 'vfx-telegraphe-auditeur-tampon', { ui: true });
    await g.api('cheat', 'K');
    await g.api('advance', 4000);
  },
  async furet(g) {
    await toRun(g, 0);
    const id = await g.api('spawn', 'furet', 0, -110);
    await g.api('advance', 1500);
    await still(g, 'arene-furet', { settle: 200 });
    await g.api('attack', id, 'stink');
    await g.api('advance', 700);
    await still(g, 'vfx-furet-puanteur', { ui: true });
    await g.api('cheat', 'K');
    await g.api('advance', 3000);
  },
  async passerelle(g) {
    await toRun(g, 1);
    await still(g, 'decor-b2-passerelle', { settle: 200 });
    await g.api('waves', true);
    await g.api('gardee');
    await g.api('advance', 1800);
    await g.api('waves', false);
    const e = (await g.api('enemies')).find((x) => x.kind === 'fluidifieur');
    if (e) {
      await g.api('teleport', e.x, e.y + 130);
      await g.api('advance', 300);
      await still(g, 'arene-fluidifieur', { settle: 200 });
      await g.api('attack', e.id, 'slabs');
      await g.api('advance', 700);
      await still(g, 'vfx-fluidifieur-dalles', { ui: true });
    }
    await g.api('cheat', 'K');
    await g.api('advance', 3000);
  },
  async dirupo(g) {
    await toRun(g, 1);
    await g.api('waves', true);
    await g.api('cheat', 'B');
    await g.api('advance', 450);
    await still(g, 'ui-intro-dirupo', { ui: true, settle: 600, banner: true });
    await g.api('advance', 2600);
    const e = (await g.api('enemies')).find((x) => x.kind === 'dirupo');
    await g.api('teleport', e.x, e.y + 150);
    await g.api('advance', 300);
    await still(g, 'arene-dirupo', { settle: 200 });
    await g.api('attack', e.id, 'bowtie');
    await g.api('advance', 420);
    await still(g, 'vfx-dirupo-noeud-papillon', { ui: true });
    await g.api('advance', 2200);
    await g.api('hurt', e.id, 0.2);
    await g.api('advance', 2200);
    await still(g, 'vfx-dirupo-ruban', { ui: true });
    await g.api('attack', e.id, 'scissors');
    await g.api('advance', 700);
    await still(g, 'vfx-dirupo-ciseaux', { ui: true });
    await g.api('cheat', 'K');
    await g.api('advance', 4000);
  },
  async hall(g) {
    await toRun(g, 2);
    await still(g, 'decor-b3-hall-bag', { settle: 200 });
    await g.api('waves', true);
    await g.api('gardee');
    await g.api('advance', 1800);
    await g.api('waves', false);
    const e = (await g.api('enemies')).find((x) => x.kind === 'discosaure');
    if (e) {
      await g.api('teleport', e.x, e.y + 150);
      await g.api('advance', 300);
      await still(g, 'arene-discosaure', { settle: 200 });
      await g.api('attack', e.id, 'spots');
      await g.api('advance', 1200);
      await still(g, 'vfx-discosaure-piste', { ui: true });
      await g.api('advance', 1800);
      await g.api('hurt', e.id, 0.45);
      await g.api('advance', 1600);
      await g.api('attack', e.id, 'lasers');
      await g.api('advance', 1500);
      await still(g, 'vfx-discosaure-lasers', { ui: true });
    }
    await g.api('cheat', 'K');
    await g.api('advance', 3000);
  },
  async lurcke(g) {
    await toRun(g, 2);
    await g.api('waves', true);
    await g.api('cheat', 'B');
    await g.api('advance', 450);
    await still(g, 'ui-intro-lurcke', { ui: true, settle: 600, banner: true });
    await g.api('advance', 2600);
    const e = (await g.api('enemies')).find((x) => LURCKE.includes(x.kind));
    await g.api('teleport', e.x, e.y + 150);
    await g.api('advance', 300);
    await still(g, 'arene-lurcke', { settle: 200 });
    await g.api('attack', e.id, 'bullets');
    await g.api('advance', 700);
    await still(g, 'vfx-lurcke-bullet-points', { ui: true });
    await g.api('advance', 1600);
    await g.api('attack', e.id, 'charts');
    await g.api('advance', 700);
    await still(g, 'vfx-lurcke-graphiques', { ui: true });
    const h = await hero(g);
    const p = await g.api('screen', e.x, e.y, 1.6);
    void h;
    await still(g, 'lurcke-gros-plan', { clip: { x: Math.max(0, p.x - 380), y: Math.max(0, p.y - 330), width: 760, height: 600 } });
  },
};

// ─── Séquences (960×540, 30 i/s) ─────────────────────────────────────────────────────────────

const N = (s) => Math.round(s * 30);

const CLIP_TASKS = {
  async 'hub-pnj'(g) {
    await g.click('button', 'Prendre son service');
    await g.run(150);
    await g.api('advance', 1200);
    await g.api('hubGoto', 'rudy');
    await g.api('advance', 300);
    await g.api('move', -1, 0.15);
    await g.record(path.join(CLIPS, 'hub-pnj'), N(4.5));
    await g.api('release');
  },
  async combo(g) {
    await toRun(g, 0);
    await place(g, 0, 0);
    await spawnAll(g, [
      ['consultant', -20, -52],
      ['consultant', 26, -48],
      ['consultant', 0, -80],
    ]);
    await g.api('advance', 1600);
    await g.api('aim', -Math.PI / 2);
    await g.record(path.join(CLIPS, 'combo'), N(4), async (i) => {
      if ([4, 16, 30, 70, 82, 96].includes(i)) await g.api('press', 'attack');
    });
    await g.api('release');
    await g.api('cheat', 'K');
    await g.api('advance', 2600);
  },
  async dash(g) {
    await toRun(g, 0);
    const ids = await spawnAll(g, [
      ['consultant', 70, -30],
      ['consultant', -70, -40],
    ]);
    await g.api('advance', 1500);
    await g.record(path.join(CLIPS, 'dash'), N(3.5), async (i) => {
      if (i === 2) {
        await g.api('attack', ids[0], 'quickwin');
        await g.api('attack', ids[1], 'diaporama');
      }
      if (i === 8) await g.api('move', 1, 0);
      if (i === 14) await g.api('press', 'dash');
      if (i === 30) await g.api('move', -1, -0.3);
      if (i === 36) await g.api('press', 'dash');
      if (i === 52) await g.api('move', 0, 0);
      if (i === 60) await g.api('move', -0.6, 1);
      if (i === 64) await g.api('press', 'dash');
      if (i === 80) await g.api('move', 0, 0);
    });
    await g.api('release');
    await g.api('cheat', 'K');
    await g.api('advance', 2600);
  },
  async 'furet-surgit'(g) {
    await toRun(g, 0);
    const id = await g.api('spawn', 'furet', 0, -120);
    await g.api('advance', 1600);
    await g.api('attack', id, 'burrow');
    await g.record(path.join(CLIPS, 'furet-surgit'), N(4.5));
    await g.api('cheat', 'K');
    await g.api('advance', 2600);
  },
  async 'drop-patrimoine'(g) {
    await toRun(g, 0);
    await place(g, 0, 40);
    await g.api('advance', 300);
    await g.record(path.join(CLIPS, 'drop-patrimoine'), N(4), async (i) => {
      if (i === 6) await g.api('lootDrop', 'wagon-bar', 0, -70);
      if (i === 75) {
        const l = await g.api('loot');
        const pat = l.ground.find((x) => x.rarity === 'patrimoine') ?? l.ground[l.ground.length - 1];
        if (pat) await g.api('move', 0, -1);
      }
      if (i === 92) await g.api('move', 0, 0);
    });
    await g.api('release');
  },
  async auditeur(g) {
    await toRun(g, 0);
    await g.api('waves', true);
    await g.api('cheat', 'B');
    await g.api('advance', 3300);
    const e = (await g.api('enemies')).find((x) => x.kind === 'auditeur');
    await g.api('teleport', e.x + 40, e.y + 140);
    await g.api('advance', 300);
    await g.record(path.join(CLIPS, 'auditeur'), N(4.5), async (i) => {
      if (i === 2) await g.api('attack', e.id, 'stamp');
      if (i === 70) await g.api('attack', e.id, 'sweep');
    });
    await g.api('cheat', 'K');
    await g.api('advance', 4000);
  },
  async dirupo(g) {
    await toRun(g, 1);
    await g.api('waves', true);
    await g.api('cheat', 'B');
    await g.api('advance', 3300);
    const e = (await g.api('enemies')).find((x) => x.kind === 'dirupo');
    await g.api('teleport', e.x, e.y + 150);
    await g.api('advance', 300);
    await g.api('hurt', e.id, 0.2);
    await g.api('advance', 2000);
    await g.record(path.join(CLIPS, 'dirupo'), N(4.5), async (i) => {
      if (i === 2) await g.api('attack', e.id, 'bowtie');
      if (i === 75) await g.api('attack', e.id, 'scissors');
    });
    await g.api('cheat', 'K');
    await g.api('advance', 4000);
  },
  async discosaure(g) {
    await toRun(g, 2);
    await g.api('waves', true);
    await g.api('gardee');
    await g.api('advance', 1800);
    await g.api('waves', false);
    const e = (await g.api('enemies')).find((x) => x.kind === 'discosaure');
    await g.api('teleport', e.x, e.y + 150);
    await g.api('advance', 300);
    await g.record(path.join(CLIPS, 'discosaure'), N(5), async (i) => {
      if (i === 2) await g.api('attack', e.id, 'spots');
      if (i === 95) await g.api('attack', e.id, 'stomp');
    });
    await g.api('cheat', 'K');
    await g.api('advance', 3000);
  },
  async lurcke(g) {
    await toRun(g, 2);
    await g.api('waves', true);
    await g.api('cheat', 'B');
    await g.api('advance', 3300);
    const e = (await g.api('enemies')).find((x) => LURCKE.includes(x.kind));
    await g.api('teleport', e.x + 30, e.y + 150);
    await g.api('advance', 300);
    await g.record(path.join(CLIPS, 'lurcke'), N(4.5), async (i) => {
      if (i === 2) await g.api('attack', e.id, 'bullets');
      if (i === 70) await g.api('attack', e.id, 'charts');
    });
  },
};

for (const session of sessions.length ? sessions : ['stills', 'clips']) {
  const tasks = session === 'stills' ? STILL_TASKS : CLIP_TASKS;
  const names = Object.keys(tasks).filter(want);
  if (!names.length) continue;
  const size = session === 'stills' ? { width: 1920, height: 1080 } : { width: 960, height: 540 };
  console.log(`session ${session} (${size.width}×${size.height}) : ${names.join(', ')}`);
  const g = await openGame(size);
  // Le titre se capture avant tout ; les autres tâches partent de l'écran titre ou d'un Shift.
  if (session === 'stills' && want('titre')) {
    await STILL_TASKS.titre(g);
  }
  const needHub = names.includes(session === 'stills' ? 'hub' : 'hub-pnj');
  if (needHub) await tasks[session === 'stills' ? 'hub' : 'hub-pnj'](g);
  else {
    await g.click('button', 'Prendre son service');
    await g.run(150);
    await g.api('advance', 600);
  }
  for (const n of names) {
    if (['titre', 'hub', 'hub-pnj'].includes(n)) continue;
    const t0 = Date.now();
    console.log(`- ${n}`);
    try {
      await tasks[n](g);
    } catch (e) {
      console.error(`ÉCHEC ${n} : ${e.message}`);
      process.exitCode = 1;
    }
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  if (g.problems.length) console.log(`console : ${g.problems.slice(0, 8).join(' | ')}`);
  await g.close();
}
fs.mkdirSync(STILLS, { recursive: true });
