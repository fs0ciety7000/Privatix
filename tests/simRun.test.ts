import { describe, expect, it } from 'vitest';
import type { EnemyKind } from '@/config/balance';
import { AUDITEUR, BORNE, DRONE, ENEMY_RULES, MANAGER, WHISTLE } from '@/config/balance';
import { TILE } from '@/config/constants';
import { SIM_DT_MS } from '@/sim/clock/FixedClock';
import { AuditeurSim } from '@/sim/enemies/AuditeurSim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimEvent } from '@/sim/events';
import type { HazardSim } from '@/sim/Hazards';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import { assignDoors, DOOR_FADE_MS } from '@/sim/RunDirector';
import { World } from '@/sim/World';
import { maxEnergy } from '@/systems/meta/RunState';
import { BOSS_ROOM } from '@/systems/procedural/ShiftPlan';

/** Joue `ms` de simulation ; les appuis de `intent` ne sont transmis qu'au premier pas. */
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

function quiet(seed = 11): World {
  return new World({ seed, waves: false, room: 'quai-1' });
}

function enemyAt(world: World, kind: EnemyKind, dx: number, dy: number): EnemySim {
  const h = world.hero.body;
  const e = world.spawnEnemy(kind, h.x + dx, h.y + dy, true);
  if (!e) throw new Error('apparition refusée');
  return e;
}

/** Premier instant (ms) où l'ennemi passe en windup, et durée de ce windup. */
function windupLength(world: World, e: EnemySim, maxMs: number): number {
  let start = -1;
  for (let t = 0; t < maxMs; t += SIM_DT_MS) {
    play(world, SIM_DT_MS);
    if (start < 0 && e.state === 'windup') start = world.now();
    if (start >= 0 && e.state !== 'windup') return world.now() - start;
  }
  return -1;
}

describe('Borne Automatique', () => {
  it('se déplie, télégraphie 500 ms puis tire une salve de 3 tickets', () => {
    const w = quiet();
    const b = enemyAt(w, 'borne', 0, -90);
    const events = play(w, BORNE.DEPLOY_MS + BORNE.SALVE_TELEGRAPH_MS + 200);
    expect(events.filter((e) => e.type === 'projectileFired')).toHaveLength(BORNE.SALVE_COUNT);
    expect(w.projectiles.active()).toHaveLength(BORNE.SALVE_COUNT);
    expect(b.state).not.toBe('windup');
  });

  it('le télégraphe de salve dure au moins 300 ms (lisibilité)', () => {
    const w = quiet();
    const b = enemyAt(w, 'borne', 0, -90);
    expect(windupLength(w, b, 3000)).toBeGreaterThanOrEqual(300);
  });

  it('blindage frontal −50 %, panneau arrière ×2', () => {
    const w = quiet();
    const b = enemyAt(w, 'borne', 60, 0);
    b.facing = Math.PI; // regarde le héros, à sa gauche
    const hit = (fromX: number) =>
      b.takeHit({
        amount: 10,
        crit: false,
        fromX,
        fromY: b.body.y,
        knockbackAngle: 0,
        knockbackPx: 0,
        knockbackMs: 0,
        stunMs: 0,
        slow: 0,
        slowMs: 0,
        vulnerable: 0,
        meltdownStun: false,
        heavy: false,
      }).dealt;
    expect(hit(b.body.x - 20)).toBe(5);
    expect(hit(b.body.x + 20)).toBe(20);
  });

  it('un ticket blesse le héros, le sifflet casse les tickets en vol', () => {
    const w = quiet();
    const h = w.hero.body;
    const before = w.run.energy;
    w.spawnProjectile({
      x: h.x + 30,
      y: h.y,
      angle: Math.PI,
      speed: BORNE.PROJECTILE_SPEED,
      damage: 7,
      lifeMs: 2000,
      radius: 3,
      owner: 'Borne Automatique',
    });
    play(w, 400);
    expect(w.run.energy).toBeLessThan(before);
    expect(w.run.lastHitBy).toBe('Borne Automatique');

    const w2 = quiet();
    const h2 = w2.hero.body;
    w2.run.mobilisation.add(WHISTLE.cost);
    w2.spawnProjectile({
      x: h2.x + 40,
      y: h2.y,
      angle: 0,
      speed: 10,
      damage: 7,
      lifeMs: 3000,
      radius: 3,
      owner: 'Borne Automatique',
    });
    const events = play(w2, 800, { special: true });
    expect(events.some((e) => e.type === 'projectileBroken' && e.by === 'weapon')).toBe(true);
    expect(w2.projectiles.active()).toHaveLength(0);
  });

  it('les projectiles meurent contre les murs', () => {
    const w = quiet();
    const h = w.hero.body;
    w.spawnProjectile({
      x: h.x,
      y: h.y + 10,
      angle: Math.PI / 2,
      speed: 200,
      damage: 7,
      lifeMs: 3000,
      radius: 3,
      owner: 'x',
    });
    const events = play(w, 600);
    expect(events.some((e) => e.type === 'projectileBroken' && e.by === 'wall')).toBe(true);
  });
});

describe('Drone Optimètre', () => {
  it('marque le héros au scan (+25 % de dégâts subis)', () => {
    const w = quiet(3);
    const d = enemyAt(w, 'drone', 90, 0);
    for (let t = 0; t < 12000 && !w.hero.isMarked; t += 100) {
      play(w, 100);
      // Le héros reste dans le cône : pas de dash, pas de fuite.
      if (d.isDead) break;
    }
    expect(w.hero.isMarked).toBe(true);
  });

  it('pique sur le héros puis reste cloué au sol', () => {
    const w = quiet(9);
    const d = enemyAt(w, 'drone', 100, 0);
    let grounded = false;
    for (let t = 0; t < 9000 && !grounded; t += SIM_DT_MS) {
      play(w, SIM_DT_MS);
      grounded = d.grounded;
    }
    expect(grounded).toBe(true);
    play(w, DRONE.GROUNDED_MS + 50);
    expect(d.grounded).toBe(false);
  });
});

describe('Manager KPI (élite)', () => {
  it('posture : les coups ne l’interrompent pas avant 50 dégâts en 3 s, puis il casse', () => {
    const w = quiet();
    const m = enemyAt(w, 'manager', 20, 0);
    const hit = (amount: number) =>
      m.takeHit({
        amount,
        crit: false,
        fromX: w.hero.body.x,
        fromY: w.hero.body.y,
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
    hit(20);
    expect(m.state).not.toBe('stagger');
    expect(m.broken).toBe(false);
    hit(35);
    expect(m.broken).toBe(true);
    expect(m.state).toBe('stagger');
    play(w, MANAGER.BREAK_MS + 50);
    expect(m.broken).toBe(false);
  });

  it('pose un Chronomètre sous le héros (zone télégraphiée qui ralentit)', () => {
    const w = quiet();
    enemyAt(w, 'manager', 150, 0);
    let chrono: HazardSim | undefined;
    for (let t = 0; t < 6000 && !chrono; t += 100) {
      play(w, 100);
      chrono = w.hazards.find((h) => h.spec.kind === 'circle');
    }
    expect(chrono).toBeDefined();
    expect(chrono?.spec.telegraphMs).toBe(MANAGER.CHRONO_TELEGRAPH_MS);
  });
});

describe('zones de danger', () => {
  it('un cercle ne blesse qu’après son télégraphe (≥ 300 ms)', () => {
    const w = quiet();
    const h = w.hero.body;
    w.spawnHazard({
      kind: 'circle',
      x: h.x,
      y: h.y,
      radius: 32,
      telegraphMs: 800,
      damage: 10,
      owner: 'Test',
    });
    const e0 = w.run.energy;
    play(w, 780);
    expect(w.run.energy).toBe(e0);
    play(w, 60);
    expect(w.run.energy).toBeLessThan(e0);
  });

  it('l’anneau du Reporting touche en passant sur le héros', () => {
    const w = quiet();
    const h = w.hero.body;
    w.spawnHazard({
      kind: 'ring',
      x: h.x + 80,
      y: h.y,
      maxRadius: 160,
      thickness: 12,
      telegraphMs: 300,
      expandMs: 800,
      damage: 14,
      owner: 'Manager',
    });
    const e0 = w.run.energy;
    play(w, 1200);
    expect(w.run.energy).toBe(e0 - 14);
    expect(w.hazards).toHaveLength(0);
  });

  it('la rame traverse la voie et percute le héros resté dessus', () => {
    const w = new World({ seed: 4, waves: false, room: 'arene-auditeur' });
    const band = w.arena.railBands[0];
    expect(band).toBeDefined();
    if (!band) return;
    const h = w.hero.body;
    h.x = 200;
    h.y = band.y + band.height / 2;
    h.prevX = h.x;
    h.prevY = h.y;
    w.spawnHazard({
      kind: 'band',
      x0: band.x0,
      x1: band.x1,
      y: band.y,
      height: band.height,
      telegraphMs: AUDITEUR.TRAIN_TELEGRAPH_MS,
      damage: 40,
      owner: 'Une rame',
      speed: AUDITEUR.TRAIN_SPEED,
    });
    const e0 = w.run.energy;
    play(w, AUDITEUR.TRAIN_TELEGRAPH_MS - 50);
    expect(w.run.energy).toBe(e0);
    play(w, 1000);
    expect(w.run.energy).toBeLessThan(e0);
    expect(w.run.lastHitBy).toBe('Une rame');
  });
});

describe('Auditeur des Quais (boss)', () => {
  it('ses télégraphes durent au moins 500 ms et il change de phase à 60 %', () => {
    const w = new World({ seed: 8, waves: false, room: 'arene-auditeur' });
    const at = w.arena.bossSpawn;
    const boss = w.spawnEnemy('auditeur', at.x, at.y, true);
    expect(boss).toBeInstanceOf(AuditeurSim);
    if (!(boss instanceof AuditeurSim)) return;
    // Héros invincible et loin : on mesure chaque télégraphe pendant 20 s.
    w.director.godMode = true;
    const windups = new Map<string, number>();
    let start = -1;
    let attack = '';
    const hazardTelegraphs: number[] = [];
    for (let t = 0; t < 20000; t += SIM_DT_MS) {
      play(w, SIM_DT_MS);
      if (start < 0 && boss.state === 'windup') {
        start = w.now();
        attack = boss.currentAttack;
      } else if (start >= 0 && boss.state !== 'windup') {
        windups.set(attack, Math.min(windups.get(attack) ?? Infinity, w.now() - start));
        start = -1;
      }
      for (const h of w.hazards) hazardTelegraphs.push(h.spec.telegraphMs);
    }
    expect(windups.size).toBeGreaterThan(1);
    for (const [name, ms] of windups) {
      // Les chronomètres ne blessent pas eux-mêmes : ce sont leurs zones (800 ms) qui télégraphient.
      if (name !== 'chrono') expect(ms, name).toBeGreaterThanOrEqual(500);
    }
    // Zones posées à froid (télégraphe > 0) : ≥ 300 ms. L'onde du « Contrôle ! » suit son impact.
    expect(hazardTelegraphs.filter((ms) => ms > 0).every((ms) => ms >= 300)).toBe(true);
    for (let t = 0; t < 3000 && !boss.isHittable(); t += SIM_DT_MS) play(w, SIM_DT_MS);
    boss.takeHit({
      amount: Math.ceil(boss.maxHp * 0.45),
      crit: false,
      fromX: w.hero.body.x,
      fromY: w.hero.body.y,
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
    expect(boss.phase).toBe(2);
    expect(boss.isHittable()).toBe(false);
  });
});

describe('boucle du Shift (RunDirector)', () => {
  it('commence en salle 1 (combat → Avantage), avec des portes vers la salle 2', () => {
    const w = new World({ seed: 21 });
    expect(w.run.room).toBe(1);
    expect(w.director.door).toEqual({ room: 1, type: 'combat', reward: 'avantage' });
    const offered = w.director.doors.filter((d) => d.choice);
    expect(offered.length).toBeGreaterThanOrEqual(2);
    expect(offered.every((d) => d.choice?.room === 2)).toBe(true);
  });

  it('vagues → salle nettoyée → récompense → porte → salle suivante', () => {
    const w = new World({ seed: 21 });
    w.director.godMode = true;
    let cleared = false;
    for (let t = 0; t < 30000 && !cleared; t += 200) {
      play(w, 200);
      for (const e of w.livingEnemies()) if (e.materialized) e.debugKill();
      cleared = w.director.cleared;
    }
    expect(cleared).toBe(true);
    expect(w.run.kills).toBeGreaterThan(0);
    expect(w.run.psEarned).toBeGreaterThan(0);
    play(w, 600);
    const reward = w.pickups.find((p) => p.kind === 'avantage');
    expect(reward).toBeDefined();
    // Ramasser l'Avantage ouvre la radio d'un collègue.
    if (reward) {
      w.hero.body.x = reward.x;
      w.hero.body.y = reward.y;
    }
    play(w, 50);
    expect(w.director.choice).not.toBeNull();
    expect(w.director.choice?.options.length).toBe(3);
    w.director.choose(0);
    expect(w.run.avantages).toHaveLength(1);
    // Marcher dans une porte ouverte : fondu puis nouvelle salle.
    const door = w.director.doors.find((d) => d.choice);
    expect(door).toBeDefined();
    if (!door) return;
    w.hero.body.x = door.x + door.width / 2;
    w.hero.body.y = door.y + TILE + 8;
    const events = play(w, DOOR_FADE_MS + 100);
    expect(events.some((e) => e.type === 'doorTaken')).toBe(true);
    expect(events.some((e) => e.type === 'roomEntered' && e.room === 2)).toBe(true);
    expect(w.run.room).toBe(2);
    expect(w.director.cleared).toBe(w.director.door.type === 'boutique');
    expect(w.enemies).toHaveLength(0);
  });

  it('affecte une porte au centre, deux aux extrémités', () => {
    const slots = [
      { tx: 8, ty: 1, width: 2 },
      { tx: 20, ty: 1, width: 2 },
      { tx: 32, ty: 1, width: 2 },
    ];
    const one = assignDoors(slots, [{ room: 9, type: 'repos', reward: null }]);
    expect(one.map((d) => d.choice !== null)).toEqual([false, true, false]);
    const two = assignDoors(slots, [
      { room: 3, type: 'combat', reward: 'ps' },
      { room: 3, type: 'tresor', reward: null },
    ]);
    expect(two.map((d) => d.choice?.type ?? null)).toEqual(['combat', null, 'tresor']);
  });

  it('la mort du héros termine le Shift et produit l’écran des départs', () => {
    const w = new World({ seed: 5 });
    w.run.energy = 1;
    w.hero.receiveHit(50, { x: 0, y: 0, name: 'Consultant Junior' });
    const events = play(w, 1700);
    expect(events.some((e) => e.type === 'heroDied')).toBe(true);
    expect(events.some((e) => e.type === 'shiftEnded' && e.end === 'mort')).toBe(true);
    expect(w.director.result?.end).toBe('mort');
    expect(w.director.result?.cause).toBe('Consultant Junior');
    expect(w.director.result?.psEarned).toBeGreaterThan(0);
  });

  it('salle du boss : il apparaît, sa mort donne la victoire', () => {
    const w = new World({ seed: 6 });
    w.director.godMode = true;
    w.director.cheatBoss();
    play(w, DOOR_FADE_MS + ENEMY_RULES.SPAWN_TELEGRAPH_MS + 200);
    expect(w.run.room).toBe(BOSS_ROOM);
    expect(w.director.boss).not.toBeNull();
    w.director.cheatKillAll();
    const events = play(w, 3000);
    expect(events.some((e) => e.type === 'shiftEnded' && e.end === 'victoire')).toBe(true);
    expect(w.director.result?.end).toBe('victoire');
    expect(w.run.energy).toBe(maxEnergy(w.run));
  });

  it('même graine + mêmes intentions = même Shift (rejeu)', () => {
    const run = (): number[] => {
      const w = new World({ seed: 77 });
      play(w, 5000, { moveX: 0.4, moveY: -0.6, attack: true });
      return [w.run.kills, w.enemies.length, ...w.enemies.map((e) => e.body.x)];
    };
    expect(run()).toEqual(run());
  });
});
