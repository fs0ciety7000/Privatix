import { describe, expect, it } from 'vitest';
import type { EnemyKind } from '@/config/balance';
import {
  DIRUPO,
  DISCOSAURE,
  ENEMY_RULES,
  ENVIRONMENT,
  FLUIDIFIEUR,
  FURET,
  SHIFT,
  LURCKE,
} from '@/config/balance';
import { TILE } from '@/config/constants';
import { SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { DiRupoSim } from '@/sim/enemies/DiRupoSim';
import type { DiscosaureSim } from '@/sim/enemies/DiscosaureSim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { FluidifieurSim } from '@/sim/enemies/FluidifieurSim';
import type { FuretSim } from '@/sim/enemies/FuretSim';
import type { LurckeSim } from '@/sim/enemies/LurckeSim';
import type { SimEvent } from '@/sim/events';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import { DOOR_FADE_MS, doorLabel } from '@/sim/RunDirector';
import { World } from '@/sim/World';
import { maxEnergy } from '@/systems/meta/RunState';
import type { DoorChoice, RoomType } from '@/systems/procedural/ShiftPlan';
import {
  biomeOf,
  bossRoomOf,
  doorsFor,
  FINAL_BOSS_ROOM,
  firstRoomOf,
  localRoom,
  restRoomOf,
  roomIndex,
  templateFor,
} from '@/systems/procedural/ShiftPlan';
import type { RoomTemplateId } from '@/systems/procedural/roomTemplates';

function play(world: World, ms: number, intent: Partial<PlayerIntent> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  world.queueIntent({ ...NO_INTENT, ...intent });
  const steps = Math.round(ms / SIM_DT_MS);
  for (let i = 0; i < steps; i += 1) {
    world.snapshot();
    world.step(SIM_DT_MS);
    events.push(...world.drainEvents());
    world.queueIntent({
      ...NO_INTENT,
      ...intent,
      attack: false,
      dash: false,
      special: false,
      coffee: false,
      interact: false,
    });
  }
  return events;
}

function quiet(room: RoomTemplateId = 'quai-1', seed = 11): World {
  return new World({ seed, waves: false, room });
}

function enemyAt(world: World, kind: EnemyKind, dx: number, dy: number): EnemySim {
  const h = world.hero.body;
  const e = world.spawnEnemy(kind, h.x + dx, h.y + dy, true);
  if (!e) throw new Error('apparition refusée');
  return e;
}

function hitFor(e: EnemySim, amount: number): void {
  e.takeHit({
    amount,
    crit: false,
    fromX: e.body.x,
    fromY: e.body.y + 30,
    knockbackAngle: 0,
    knockbackPx: 0,
    knockbackMs: 0,
    stunMs: 0,
    slow: 0,
    slowMs: 0,
    vulnerable: 0,
    meltdownStun: false,
    heavy: false,
  });
}

/** Durée du windup d'une attaque forcée. */
function windupOf(world: World, e: EnemySim, attack: string): number {
  e.debugAttack(attack);
  play(world, SIM_DT_MS);
  const start = world.now();
  for (let t = 0; t < 4000; t += SIM_DT_MS) {
    if (e.state !== 'windup') return world.now() - start + SIM_DT_MS;
    play(world, SIM_DT_MS);
  }
  return -1;
}

/** Le directeur entre dans la salle `door` (fondu compris). */
function enter(world: World, door: DoorChoice): SimEvent[] {
  world.director.goThrough(door);
  return play(world, DOOR_FADE_MS + 50);
}

describe('plan du Shift sur trois biomes (GDD § 3)', () => {
  it('numérote les biomes : 8 + 8 + 9 salles, chacun suivi des pauses et de son boss', () => {
    expect(firstRoomOf(0)).toBe(1);
    expect(restRoomOf(0)).toBe(9);
    expect(bossRoomOf(0)).toBe(10);
    expect(firstRoomOf(1)).toBe(11);
    expect(bossRoomOf(1)).toBe(20);
    expect(firstRoomOf(2)).toBe(21);
    expect(restRoomOf(2)).toBe(30);
    expect(FINAL_BOSS_ROOM).toBe(31);
    expect(biomeOf(10)).toBe(0);
    expect(biomeOf(11)).toBe(1);
    expect(biomeOf(31)).toBe(2);
    expect(localRoom(18)).toBe(8);
  });

  it('indice r du GDD § 3.2 : boss 9, 18 et 28 ; la pause garde l’indice précédent', () => {
    expect(roomIndex(8)).toBe(8);
    expect(roomIndex(9)).toBe(8);
    expect(roomIndex(10)).toBe(9);
    expect(roomIndex(11)).toBe(10);
    expect(roomIndex(18)).toBe(17);
    expect(roomIndex(19)).toBe(17);
    expect(roomIndex(20)).toBe(18);
    expect(roomIndex(21)).toBe(19);
    expect(roomIndex(29)).toBe(27);
    expect(roomIndex(31)).toBe(28);
  });

  it('chaque biome a ses gabarits, sa Salle gardée et son arène de boss', () => {
    expect(templateFor(3, bossRoomOf(0), 'boss')).toBe('arene-auditeur');
    expect(templateFor(3, bossRoomOf(1), 'boss')).toBe('belvedere');
    expect(templateFor(3, bossRoomOf(2), 'boss')).toBe('salle-conseil');
    expect(templateFor(3, 18, 'gardee')).toBe('arene-fluidifieur');
    expect(templateFor(3, 26, 'gardee')).toBe('afterwork');
    const b2 = new Set<string>();
    const b3 = new Set<string>();
    for (let room = 12; room <= 17; room += 1) b2.add(templateFor(9, room, 'combat'));
    for (let room = 22; room <= 28; room += 1) b3.add(templateFor(9, room, 'combat'));
    for (const t of b2) expect(['tablier', 'noeud-arc', 'verriere', 'escalators']).toContain(t);
    for (const t of b3)
      expect(['hall-historique', 'open-space', 'reunion', 'archives']).toContain(t);
  });

  it('biome 2 : la salle 8 est la Salle gardée du Fluidifieur, seule porte', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const doors = doorsFor(seed, firstRoomOf(1) + 7, {
        shopSeen: true,
        elites: 0,
        tresorSeen: true,
        previousType: 'combat',
      });
      expect(doors).toEqual([{ room: 18, type: 'gardee', reward: null }]);
    }
  });

  it('biome 3 : la Salle gardée du Discosaure est garantie entre les positions 5 et 7', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const path: RoomType[] = [];
      let history = {
        shopSeen: false,
        elites: 0,
        tresorSeen: false,
        previousType: null as RoomType | null,
        gardeeSeen: false,
      };
      for (let room = firstRoomOf(2); room <= restRoomOf(2); room += 1) {
        const doors = doorsFor(seed, room, history);
        // On évite la Salle gardée tant qu'on peut : elle doit quand même arriver avant la 8.
        const pick = doors.find((d) => d.type !== 'gardee') ?? doors[0];
        if (!pick) throw new Error('pas de porte');
        path.push(pick.type);
        history = {
          shopSeen: history.shopSeen || pick.type === 'boutique',
          elites: history.elites + (pick.type === 'elite' ? 1 : 0),
          tresorSeen: history.tresorSeen || pick.type === 'tresor',
          previousType: pick.type,
          gardeeSeen: history.gardeeSeen || pick.type === 'gardee',
        };
      }
      const at = path.indexOf('gardee') + 1;
      expect(at, `graine ${String(seed)}`).toBeGreaterThanOrEqual(SHIFT.GARDEE_FIRST);
      expect(at).toBeLessThanOrEqual(SHIFT.GARDEE_LAST);
      expect(path.at(-1)).toBe('repos');
    }
  });

  it('les portes annoncent le boss du biome', () => {
    expect(doorLabel({ room: bossRoomOf(1), type: 'boss', reward: null })).toContain('Di Rupo');
    expect(doorLabel({ room: 18, type: 'gardee', reward: null })).toContain('Fluidifieur');
  });
});

describe('progression multi-biome (RunDirector)', () => {
  it('Auditeur → Passerelle → Di Rupo → Hall & BAG → Lurcke → victoire', () => {
    const w = new World({ seed: 31 });
    w.director.godMode = true;
    const biomes: number[] = [];
    let last: SimEvent[] = [];
    const fictive: string[] = [];
    const kill = (): SimEvent[] => {
      const events: SimEvent[] = [];
      for (let t = 0; t < 6000; t += 100) {
        events.push(...play(w, 100));
        w.director.cheatKillAll();
        if (w.director.cleared || w.director.result) break;
      }
      events.push(...play(w, 200));
      return events;
    };
    for (let biome = 0; biome < 3; biome += 1) {
      const events = enter(w, { room: bossRoomOf(biome), type: 'boss', reward: null });
      for (const e of events) if (e.type === 'biomeEntered') biomes.push(e.biome);
      events.push(...play(w, 900));
      const boss = w.director.boss;
      expect(boss?.kind).toBe(['auditeur', 'dirupo', 'lurcke'][biome]);
      expect(events.some((e) => e.type === 'bossIntro')).toBe(true);
      const after = kill();
      last = after;
      for (const e of after) if (e.type === 'bossLine' && e.fictive) fictive.push(e.text);
      if (biome < 2) {
        after.push(...play(w, 3500));
        for (const e of after) if (e.type === 'bossLine' && e.fictive) fictive.push(e.text);
        expect(w.director.cleared).toBe(true);
        const door = w.director.doors.find((d) => d.choice)?.choice;
        expect(door).toEqual({ room: firstRoomOf(biome + 1), type: 'combat', reward: 'avantage' });
        if (door)
          for (const e of enter(w, door)) if (e.type === 'biomeEntered') biomes.push(e.biome);
        expect(w.director.biome).toBe(biome + 1);
        expect(w.run.shopSeen).toBe(false);
      }
    }
    const end = [...last, ...play(w, 6000)];
    expect(end.some((e) => e.type === 'shiftEnded' && e.end === 'victoire')).toBe(true);
    expect(w.director.result?.end).toBe('victoire');
    expect(w.run.bossesDefeated).toBe(3);
    expect(biomes).toEqual([0, 1, 2]);
    // Di Rupo : réplique de défaite canon, signalée fictive.
    expect(fictive).toContain('Je n’inaugure pas une vente à la découpe.');
  });

  it('scaling selon l’indice de salle : un Consultant du biome 3 a plus de PV que du biome 1', () => {
    const w = new World({ seed: 4 });
    const a = w.spawnEnemy('consultant', 300, 200, true);
    enter(w, { room: firstRoomOf(2) + 3, type: 'combat', reward: 'ps' });
    const b = w.spawnEnemy('consultant', 300, 200, true);
    expect(roomIndex(w.run.room)).toBe(22);
    expect(b?.maxHp ?? 0).toBeGreaterThan((a?.maxHp ?? 0) * 2);
  });

  it('les vagues du biome 1 tirent parfois le Furet putride en salle Élite', () => {
    let furets = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const w = new World({ seed });
      w.director.godMode = true;
      enter(w, { room: 6, type: 'elite', reward: 'ps' });
      for (let t = 0; t < 20000 && !w.director.cleared; t += 200) {
        play(w, 200);
        if (w.enemies.some((e) => e.kind === 'furet')) {
          furets += 1;
          break;
        }
        for (const e of w.livingEnemies()) if (e.materialized && !e.isHeavy) e.debugKill();
      }
    }
    expect(furets).toBeGreaterThan(2);
    expect(furets).toBeLessThan(18);
  });

  it('Salle gardée : l’ennemi majeur apparaît sur sa marque, escorte à ses seuils, puis 20 PS', () => {
    const w = new World({ seed: 8 });
    w.director.godMode = true;
    enter(w, { room: 18, type: 'gardee', reward: null });
    play(w, 700 + ENEMY_RULES.SPAWN_TELEGRAPH_MS + ENEMY_RULES.SPAWN_IDLE_MS + 100);
    const g = w.director.guardian;
    expect(g?.kind).toBe('fluidifieur');
    if (!g) return;
    hitFor(g, Math.ceil(g.maxHp * 0.4));
    play(w, 1500);
    expect(w.enemies.filter((e) => e.kind !== 'fluidifieur').length).toBeGreaterThan(0);
    const before = w.run.psEarned;
    for (let t = 0; t < 8000 && !w.director.cleared; t += 200) {
      w.director.cheatKillAll();
      play(w, 200);
    }
    expect(w.director.cleared).toBe(true);
    expect(w.run.psEarned - before).toBeGreaterThanOrEqual(20);
  });
});

describe('environnement des biomes', () => {
  it('Passerelle : tomber dans le vide coûte 10 % d’Énergie et ramène au bord', () => {
    const w = quiet('tablier');
    const b = w.hero.body;
    // Une brèche (rangées 5-6 du gabarit, plus la rangée de mur ajoutée) : on marche dedans.
    b.x = 22 * TILE;
    b.y = 4 * TILE;
    play(w, 50);
    const energy = w.run.energy;
    const events = play(w, 600, { moveY: 1 });
    expect(events.some((e) => e.type === 'fx' && e.name === 'heroFell')).toBe(true);
    expect(w.run.energy).toBe(
      energy - Math.round(maxEnergy(w.run) * ENVIRONMENT.VOID_FALL_ENERGY_PCT),
    );
    expect(w.arena.kindAt(b.x, b.y)).not.toBe('void');
  });

  it('Passerelle : un non-élite projeté dans le vide est éliminé', () => {
    const w = quiet('tablier');
    const c = w.spawnEnemy('consultant', 22 * TILE, 4 * TILE + 4, true);
    if (!c) throw new Error('apparition');
    c.takeHit({
      amount: 1,
      crit: false,
      fromX: c.body.x,
      fromY: c.body.y - 20,
      knockbackAngle: Math.PI / 2,
      knockbackPx: 40,
      knockbackMs: 200,
      stunMs: 0,
      slow: 0,
      slowMs: 0,
      vulnerable: 0,
      meltdownStun: false,
      heavy: false,
    });
    const events = play(w, 400);
    expect(events.some((e) => e.type === 'fx' && e.name === 'enemyFell')).toBe(true);
    expect(c.isDead).toBe(true);
  });

  it('Passerelle : les rafales de vent sont annoncées 1 s avant et poussent le héros', () => {
    const w = new World({ seed: 12 });
    w.director.godMode = true;
    enter(w, { room: 13, type: 'combat', reward: 'ps' });
    const events = play(w, 9000);
    const warn = events.findIndex((e) => e.type === 'fx' && e.name === 'gustWarn');
    const gust = events.findIndex((e) => e.type === 'fx' && e.name === 'gust');
    expect(warn).toBeGreaterThanOrEqual(0);
    expect(gust).toBeGreaterThan(warn);
  });
});

describe('Furet putride (élite majeur du biome 1)', () => {
  it('ses attaques qui blessent sont télégraphiées au moins 700 ms', () => {
    const w = quiet();
    const f = enemyAt(w, 'furet', 0, -40) as FuretSim;
    expect(windupOf(w, f, 'bite')).toBeGreaterThanOrEqual(700);
    play(w, 1200);
    expect(windupOf(w, f, 'pounce')).toBeGreaterThanOrEqual(700);
  });

  it('nuage de puanteur : vert, sans dégâts, mais il fait monter le Burnout', () => {
    const w = quiet();
    const f = enemyAt(w, 'furet', 0, -20) as FuretSim;
    f.debugAttack('stink');
    play(w, FURET.STINK_TELEGRAPH_MS + 100);
    const cloud = w.hazards.find((h) => h.spec.kind === 'cloud');
    expect(cloud).toBeDefined();
    if (!cloud) return;
    const b = w.hero.body;
    b.x = cloud.x;
    b.y = cloud.y + 6;
    f.debugKill();
    const energy = w.run.energy;
    const burnout = w.run.burnout.value;
    // Le Furet mort dissipe les nuages : on en recrée un sous le héros.
    if (cloud.spec.kind === 'cloud')
      w.spawnHazard({ ...cloud.spec, x: b.x, y: b.y - 6, telegraphMs: 0 });
    play(w, 1000);
    expect(w.run.energy).toBe(energy);
    expect(w.run.burnout.value).toBeGreaterThan(burnout + FURET.STINK_BURNOUT_PER_S * 0.8 - 10);
  });

  it('passe sous le quai (intouchable), ressort sous le héros après un cercle magenta de 700 ms', () => {
    const w = quiet();
    const f = enemyAt(w, 'furet', 80, -60) as FuretSim;
    f.debugAttack('burrow');
    play(w, FURET.BURROW_TELEGRAPH_MS + 100);
    expect(f.burrowed).toBe(true);
    expect(f.isHittable()).toBe(false);
    let emerge = null as null | { telegraphMs: number };
    for (let t = 0; t < 3500 && !emerge; t += 50) {
      play(w, 50);
      const h = w.hazards.find((z) => z.spec.kind === 'circle' && z.spec.skin === 'emerge');
      if (h) emerge = { telegraphMs: h.spec.telegraphMs };
    }
    expect(emerge?.telegraphMs).toBe(FURET.EMERGE_TELEGRAPH_MS);
    play(w, FURET.EMERGE_TELEGRAPH_MS + 100);
    expect(f.burrowed).toBe(false);
  });

  it('le Sifflet le débusque et l’étourdit, et disperse les nuages', () => {
    const w = quiet();
    const f = enemyAt(w, 'furet', 60, -60) as FuretSim;
    f.debugAttack('burrow');
    play(w, FURET.BURROW_TELEGRAPH_MS + 200);
    expect(f.burrowed).toBe(true);
    w.spawnHazard({
      kind: 'cloud',
      x: w.hero.body.x + 20,
      y: w.hero.body.y,
      radius: 40,
      telegraphMs: 0,
      lifeMs: 6000,
      driftAngle: 0,
      drift: 0,
      burnoutPerS: 6,
      owner: 'test',
    });
    w.run.mobilisation.add(100);
    const events = play(w, 600, { special: true });
    expect(events.some((e) => e.type === 'special')).toBe(true);
    expect(f.burrowed).toBe(false);
    expect(f.state).toBe('stagger');
    expect(w.hazards.some((h) => h.spec.kind === 'cloud')).toBe(false);
  });
});

describe('Fluidifieur (élite majeur du biome 2)', () => {
  it('changement de roulement : dalles télégraphiées 1,5 s, puis trou qui fait tomber', () => {
    const w = quiet('arene-fluidifieur');
    const f = enemyAt(w, 'fluidifieur', 0, -100) as FluidifieurSim;
    f.debugAttack('slabs');
    play(w, 50);
    const slab = w.hazards.find((h) => h.spec.kind === 'square');
    expect(slab?.spec.telegraphMs).toBe(FLUIDIFIEUR.SLABS_TELEGRAPH_MS);
    if (!slab) return;
    const b = w.hero.body;
    b.x = slab.x;
    b.y = slab.y + 4;
    const events = play(w, FLUIDIFIEUR.SLABS_TELEGRAPH_MS + 200);
    expect(events.some((e) => e.type === 'fx' && e.name === 'heroFell')).toBe(true);
  });

  it('« Le Règlement » : 3 pages attrapées, le Sifflet l’étourdit 4 s', () => {
    const w = quiet('arene-fluidifieur');
    const f = enemyAt(w, 'fluidifieur', 0, -50) as FluidifieurSim;
    expect(f.pages).toHaveLength(FLUIDIFIEUR.PAGES);
    for (const p of f.pages) {
      w.hero.body.x = p.x;
      w.hero.body.y = p.y;
      play(w, 50);
    }
    expect(f.reglementReady).toBe(true);
    w.hero.body.x = f.body.x;
    w.hero.body.y = f.body.y + 40;
    w.run.mobilisation.add(100);
    play(w, 400, { special: true });
    expect(f.state).toBe('stagger');
    play(w, 3000);
    expect(f.state).toBe('stagger');
  });
});

describe('Discosaure (mini-boss du biome 3)', () => {
  it('Piste de danse : taches en orbite (contour), figées, puis explosion qui blesse', () => {
    const w = quiet('afterwork');
    const d = enemyAt(w, 'discosaure', 0, -110) as DiscosaureSim;
    d.debugAttack('spots');
    play(w, 800);
    const spots = w.hazards.filter((h) => h.spec.kind === 'circle' && h.spec.skin === 'spot');
    expect(spots).toHaveLength(DISCOSAURE.SPOTS_COUNT);
    const s = spots[0];
    if (!s) return;
    const x0 = s.x;
    play(w, 300);
    expect(s.x).not.toBe(x0); // elles tournent encore
    expect(s.progress).toBe(0); // contour seul
    play(w, DISCOSAURE.SPOTS_ORBIT_MS);
    const xf = s.x;
    expect(s.progress).toBeGreaterThan(0); // figée, elle se remplit
    play(w, 100);
    expect(s.x).toBe(xf);
    expect(s.spec.telegraphMs).toBeGreaterThanOrEqual(700);
  });

  it('charge contre un mur : étourdi 1,2 s', () => {
    const w = quiet('afterwork');
    const b = w.hero.body;
    b.x = 3 * TILE;
    b.y = 12 * TILE;
    const d = w.spawnEnemy('discosaure', 14 * TILE, 12 * TILE, true) as DiscosaureSim;
    d.debugAttack('charge');
    play(w, DISCOSAURE.CHARGE_TELEGRAPH_MS + 50);
    b.x = 9 * TILE;
    b.y = 6 * TILE;
    play(w, DISCOSAURE.CHARGE_DURATION_MS + 200);
    expect(d.dizzyLeft).toBeGreaterThan(0);
    expect(d.state).toBe('stagger');
  });

  it('lasers en phase 2, coupés en Réduction des mouvements', () => {
    for (const rm of [false, true]) {
      const w = new World({ seed: 3, waves: false, room: 'afterwork', reducedMotion: rm });
      const d = enemyAt(w, 'discosaure', 0, -120) as DiscosaureSim;
      hitFor(d, Math.ceil(d.maxHp * 0.55));
      expect(d.phase).toBe(2);
      let lasers = false;
      for (let t = 0; t < 30000 && !lasers; t += 100) {
        play(w, 100);
        lasers = w.hazards.some((h) => h.spec.kind === 'beams');
        w.run.energy = maxEnergy(w.run);
      }
      expect(lasers).toBe(!rm);
    }
  });

  it('le Sifflet fige ses taches 3 s', () => {
    const w = quiet('afterwork');
    const d = enemyAt(w, 'discosaure', 0, -110) as DiscosaureSim;
    d.debugAttack('spots');
    play(w, 800);
    w.run.mobilisation.add(100);
    play(w, 300, { special: true });
    const s = w.hazards.find((h) => h.spec.kind === 'circle' && h.spec.skin === 'spot');
    expect(s?.frozen).toBe(true);
  });

  it('meurt dans une pluie de paillettes', () => {
    const w = quiet('afterwork');
    const d = enemyAt(w, 'discosaure', 0, -110) as DiscosaureSim;
    d.debugKill();
    const events = w.drainEvents();
    expect(events.some((e) => e.type === 'fx' && e.name === 'sequins')).toBe(true);
  });
});

describe('Elio Di Rupo (boss du biome 2)', () => {
  function stage(): { w: World; boss: DiRupoSim } {
    const w = quiet('belvedere');
    const boss = enemyAt(w, 'dirupo', 0, -120) as DiRupoSim;
    return { w, boss };
  }

  it('PV fixes (pas de r) et télégraphes ≥ 800 ms, même en phase 3', () => {
    const { w, boss } = stage();
    expect(boss.maxHp).toBe(DIRUPO.hp);
    for (const a of ['bowtie', 'speech', 'ballots', 'motions', 'scissors']) {
      expect(windupOf(w, boss, a), a).toBeGreaterThanOrEqual(800);
      play(w, 4500);
    }
    hitFor(boss, Math.ceil(boss.maxHp * 0.8));
    expect(boss.phase).toBe(3);
    play(w, DIRUPO.PHASE_TRANSITION_MS + 100);
    expect(windupOf(w, boss, 'scissors')).toBeGreaterThanOrEqual(DIRUPO.MIN_TELEGRAPH_MS);
  });

  it('nœud papillon boomerang : il part et revient', () => {
    const { w, boss } = stage();
    boss.debugAttack('bowtie');
    play(w, DIRUPO.BOWTIE_TELEGRAPH_MS + 300);
    expect(boss.bowtie).not.toBeNull();
    let back = false;
    const returning = (): boolean => boss.bowtie?.back ?? false;
    for (let t = 0; t < 3000 && boss.bowtie; t += 50) {
      play(w, 50);
      back ||= returning();
    }
    expect(back).toBe(true);
    expect(boss.bowtie).toBeNull();
  });

  it('une promesse crevée par un coup ne blesse pas : « promesse tenue »', () => {
    const { w, boss } = stage();
    boss.debugAttack('promises');
    play(w, 600);
    const bubble = w.hazards.find((h) => h.spec.kind === 'circle' && h.spec.skin === 'promise');
    expect(bubble).toBeDefined();
    if (!bubble) return;
    const b = w.hero.body;
    b.x = bubble.x;
    b.y = bubble.y + 30;
    const mob = w.run.mobilisation.value;
    const events = play(w, 300, { attack: true, aim: -Math.PI / 2 });
    expect(events.some((e) => e.type === 'fx' && e.name === 'promiseKept')).toBe(true);
    expect(bubble.popped).toBe(true);
    expect(w.run.mobilisation.value).toBeGreaterThan(mob);
  });

  it('grand discours : anneaux à brèche ; le Sifflet l’interrompt (étourdi 2 s)', () => {
    const { w, boss } = stage();
    boss.debugAttack('speech');
    play(w, DIRUPO.SPEECH_TELEGRAPH_MS + 1200);
    expect(boss.speaking).toBe(true);
    const ring = w.hazards.find((h) => h.spec.kind === 'ring');
    expect(ring?.spec.kind === 'ring' && ring.spec.gapDeg).toBe(DIRUPO.SPEECH_GAP_DEG);
    w.run.mobilisation.add(100);
    play(w, 400, { special: true });
    expect(boss.speaking).toBe(false);
    expect(boss.state).toBe('stagger');
  });

  it('phase 3 : le ruban se tend ; un dash parfait le coupe et l’étourdit 3 s', () => {
    const { w, boss } = stage();
    hitFor(boss, Math.ceil(boss.maxHp * 0.8));
    expect(boss.phase).toBe(3);
    play(w, DIRUPO.RIBBON_TELEGRAPH_MS + 200);
    const r = boss.ribbon;
    expect(r).not.toBeNull();
    if (!r) return;
    // Le héros près du ruban, puis dash vers l'extérieur.
    const b = w.hero.body;
    b.x = r.cx;
    b.y = r.cy - (r.radius - 26);
    b.prevX = b.x;
    b.prevY = b.y;
    const events = play(w, 300, { dash: true, moveY: -1 });
    expect(events.some((e) => e.type === 'perfectDash')).toBe(true);
    expect(events.some((e) => e.type === 'fx' && e.name === 'ribbonCut')).toBe(true);
    expect(boss.state).toBe('stagger');
    play(w, DIRUPO.RIBBON_CUT_STUN_MS - 500);
    expect(boss.state).toBe('stagger');
  });

  it('un coup final sur le ruban le coupe aussi', () => {
    const { w, boss } = stage();
    hitFor(boss, Math.ceil(boss.maxHp * 0.8));
    play(w, DIRUPO.RIBBON_TELEGRAPH_MS + 200);
    const r = boss.ribbon;
    if (!r) throw new Error('ruban');
    const events: SimEvent[] = [];
    w.emit({
      type: 'swing',
      combo: 2,
      finisher: true,
      dashAttack: false,
      x: r.cx + r.radius - 20,
      y: r.cy,
      angle: 0,
      reach: 40,
      arcDeg: 0,
    });
    events.push(...w.drainEvents());
    expect(events.some((e) => e.type === 'fx' && e.name === 'ribbonCut')).toBe(true);
  });

  it('Préavis : « Concertation sociale », aucune attaque pendant 4 s', () => {
    const { w, boss } = stage();
    w.run.mobilisation.add(100);
    const events = play(w, 1400, { special: true, specialHeld: true });
    expect(events.some((e) => e.type === 'special' && e.kind === 'preavis')).toBe(true);
    expect(boss.talksLeft).toBeGreaterThan(0);
    const line = events.find((e) => e.type === 'bossLine');
    expect(line?.type === 'bossLine' && line.fictive).toBe(true);
    const later = play(w, DIRUPO.PREAVIS_TALKS_MS - 1200);
    expect(later.some((e) => e.type === 'enemyStrike')).toBe(false);
  });

  it('vaincu, ses promesses encore armées disparaissent (rien ne blesse après)', () => {
    const { w, boss } = stage();
    boss.debugAttack('promises');
    play(w, 600);
    expect(w.hazards.some((h) => h.spec.kind === 'circle' && h.spec.skin === 'promise')).toBe(true);
    boss.debugKill();
    play(w, 50);
    expect(w.hazards.some((h) => h.spec.kind === 'circle' && h.spec.skin === 'promise')).toBe(
      false,
    );
  });

  it('défaite : temps de parole épuisé, confettis (jamais d’explosion)', () => {
    const { w, boss } = stage();
    boss.debugKill();
    const events = w.drainEvents();
    expect(events.some((e) => e.type === 'fx' && e.name === 'confetti')).toBe(true);
    expect(events.some((e) => e.type === 'explosion')).toBe(false);
  });
});

describe('Jean-Cul Lurcke (boss du biome 3, version de travail)', () => {
  it('bullet points à trou, puis coup final sous 5 %', () => {
    const w = quiet('salle-conseil');
    const v = enemyAt(w, 'lurcke', 0, -150) as LurckeSim;
    expect(windupOf(w, v, 'bullets')).toBeGreaterThanOrEqual(800);
    const lines = w.hazards.filter((h) => h.spec.kind === 'line' && h.spec.skin === 'bullet');
    expect(lines.length).toBeGreaterThan(0);
    const l = lines[0];
    const spec = l?.spec;
    if (l && spec?.kind === 'line') {
      const s = spec;
      const t = ((s.gapFrom ?? 0) + (s.gapTo ?? 0)) / 2;
      expect(l.contains(s.x0 + (s.x1 - s.x0) * t, s.y0 + 6)).toBe(false);
      expect(l.contains(s.x0 + 4, s.y0 + 6)).toBe(true);
    }
    hitFor(v, Math.ceil(v.maxHp * (1 - LURCKE.FINAL_AT) + 2));
    expect(v.finalBlow).toBe(true);
    expect(v.state).toBe('stagger');
  });
});
