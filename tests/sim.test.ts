import { describe, expect, it } from 'vitest';
import { COMBO, CONSULTANT, DASH, ENEMY_RULES, HERO } from '@/config/balance';
import { TILE } from '@/config/constants';
import { FixedClock, SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { Steppable } from '@/sim/clock/FixedClock';
import { TimeControl } from '@/sim/clock/TimeControl';
import { DEATH_REMOVE_MS } from '@/sim/enemies/EnemySim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimEvent } from '@/sim/events';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import type { TileGrid } from '@/sim/physics/collision';
import { moveCircle, resolveCircleGrid, separateCircles } from '@/sim/physics/collision';
import { pxToM, toWorld, yawFromAngle } from '@/sim/units';
import { World } from '@/sim/World';

/** Grille de test : une rangée de murs en y = 0, un pilier en (5, 5), le reste vide. */
function grid(solids: readonly [number, number][]): TileGrid {
  const set = new Set(solids.map(([x, y]) => `${String(x)},${String(y)}`));
  return {
    cols: 20,
    rows: 20,
    tileSize: TILE,
    solidAt: (tx, ty) =>
      tx < 0 || ty < 0 || tx >= 20 || ty >= 20 || set.has(`${String(tx)},${String(ty)}`),
  };
}

function quietWorld(seed = 7): World {
  return new World({ seed, waves: false });
}

/** Joue `ms` de simulation avec la même intention (appuis transmis au premier pas). */
function play(world: World, ms: number, intent: Partial<PlayerIntent> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  world.queueIntent({ ...NO_INTENT, ...intent });
  const steps = Math.round(ms / SIM_DT_MS);
  for (let i = 0; i < steps; i += 1) {
    world.snapshot();
    world.step(SIM_DT_MS);
    events.push(...world.drainEvents());
    world.queueIntent({ ...NO_INTENT, ...intent, attack: false, dash: false });
  }
  return events;
}

/** Ennemi immobile devant le héros (immédiat, sans apparition). */
function consultantAt(world: World, dx: number, dy: number): EnemySim {
  const h = world.hero.body;
  const e = world.spawnEnemy('consultant', h.x + dx, h.y + dy, true);
  if (!e) throw new Error('apparition refusée');
  return e;
}

describe('unités monde', () => {
  it('convertit (x, y) u en (x/30, 0, y/30) m', () => {
    expect(toWorld(60, 90)).toEqual({ x: 2, y: 0, z: 3 });
    expect(pxToM(HERO.SPEED)).toBe(5);
  });

  it('un modèle qui regarde +Z se tourne vers l’angle logique', () => {
    // angle 0 (vers +x) : le +Z du modèle doit pointer vers +X, soit une rotation de +90°.
    expect(yawFromAngle(0)).toBeCloseTo(Math.PI / 2);
    expect(yawFromAngle(Math.PI / 2)).toBeCloseTo(0);
  });
});

describe('collisions cercle / grille', () => {
  it('sort un cercle d’un mur qu’il chevauche', () => {
    const g = grid([[5, 5]]);
    const b = { x: 5 * TILE + 8, y: 5 * TILE - 3, r: 6 };
    resolveCircleGrid(g, b);
    expect(b.y).toBeCloseTo(5 * TILE - 6);
    expect(b.x).toBeCloseTo(5 * TILE + 8);
  });

  it('bloque un déplacement contre un mur et signale le contact', () => {
    const g = grid([]);
    const b = { x: 50, y: 40, r: 6 };
    const res = moveCircle(g, b, -100, 0);
    // Hors grille = plein : le bord gauche (x = 0) arrête le cercle.
    expect(b.x).toBeCloseTo(6);
    expect(res.blocked).toBe(true);
    expect(res.nx).toBeCloseTo(1);
  });

  it('glisse le long d’un mur au lieu de s’y coller', () => {
    const g = grid([]);
    const b = { x: 6, y: 40, r: 6 };
    moveCircle(g, b, -10, 20);
    expect(b.x).toBeCloseTo(6);
    expect(b.y).toBeCloseTo(60);
  });

  it('pas d’effet tunnel au travers d’un pilier, même à la vitesse du dash', () => {
    const g = grid([[5, 5]]);
    const b = { x: 4 * TILE, y: 5 * TILE + 8, r: HERO.FEET_RADIUS };
    const perStep = ((DASH.DISTANCE_PX * 1000) / DASH.DURATION_MS) * (SIM_DT_MS / 1000);
    for (let i = 0; i < 10; i += 1) moveCircle(g, b, perStep, 0);
    expect(b.x).toBeLessThanOrEqual(5 * TILE - HERO.FEET_RADIUS + 1e-6);
  });

  it('sépare deux cercles, en partage ou contre un obstacle immobile', () => {
    const a = { x: 0, y: 0, r: 6 };
    const c = { x: 4, y: 0, r: 6 };
    expect(separateCircles(a, c)).toBeCloseTo(8);
    expect(c.x - a.x).toBeCloseTo(12);
    const d = { x: 0, y: 0, r: 6 };
    const wall = { x: 10, y: 0, r: 6 };
    separateCircles(d, wall, 1);
    expect(wall.x).toBe(10);
    expect(d.x).toBeCloseTo(-2);
  });
});

describe('boucle à pas fixe', () => {
  const counter = (): Steppable & { steps: number; snaps: number } => ({
    steps: 0,
    snaps: 0,
    snapshot() {
      this.snaps += 1;
    },
    step() {
      this.steps += 1;
    },
  });

  it('joue 60 pas par seconde quelle que soit la fréquence d’affichage', () => {
    const clock = new FixedClock(new TimeControl());
    const t = counter();
    for (let i = 0; i < 120; i += 1) clock.frame(1000 / 120, t);
    expect(t.steps).toBeGreaterThanOrEqual(59);
    expect(t.steps).toBeLessThanOrEqual(60);
  });

  it('interpole entre deux pas (alpha)', () => {
    const clock = new FixedClock(new TimeControl());
    const t = counter();
    clock.frame(SIM_DT_MS * 1.5, t);
    expect(t.steps).toBe(1);
    expect(clock.alpha).toBeCloseTo(0.5);
  });

  it('le hitstop donne un pas nul, puis le temps repart', () => {
    const time = new TimeControl();
    const clock = new FixedClock(time);
    const t = counter();
    time.hitstop(50);
    clock.frame(16, t);
    clock.frame(16, t);
    clock.frame(16, t);
    expect(t.steps).toBe(0);
    for (let i = 0; i < 10; i += 1) clock.frame(SIM_DT_MS, t);
    expect(t.steps).toBeGreaterThan(5);
  });

  it('un hitstop déclenché pendant un pas abandonne le reste de la frame', () => {
    const time = new TimeControl();
    const clock = new FixedClock(time);
    let steps = 0;
    clock.frame(SIM_DT_MS * 4, {
      snapshot: () => undefined,
      step: () => {
        steps += 1;
        time.hitstop(80);
      },
    });
    expect(steps).toBe(1);
    expect(clock.alpha).toBe(0);
  });

  it('le ralenti à 0,25 joue quatre fois moins de pas', () => {
    const time = new TimeControl();
    const clock = new FixedClock(time);
    const t = counter();
    time.slowmo(0.25, 10_000);
    for (let i = 0; i < 60; i += 1) clock.frame(SIM_DT_MS, t);
    expect(t.steps).toBeGreaterThanOrEqual(14);
    expect(t.steps).toBeLessThanOrEqual(16);
  });

  it('pas de spirale de la mort après un onglet en arrière-plan', () => {
    const clock = new FixedClock(new TimeControl());
    const t = counter();
    expect(clock.frame(5000, t)).toBeLessThanOrEqual(5);
  });
});

describe('salle de quai réelle (quai-1)', () => {
  it('charge le gabarit du jeu actuel : héros sur son arrivée, murs pleins', () => {
    const w = quietWorld();
    expect(w.arena.cols).toBe(40);
    // 22 lignes de gabarit + la rangée de façade ajoutée au-dessus.
    expect(w.arena.rows).toBe(23);
    expect(w.hero.body.x).toBe(19 * TILE + TILE / 2);
    expect(w.arena.solidAt(0, 5)).toBe(true);
    expect(w.arena.kindAt(w.hero.body.x, w.hero.body.y)).toBe('floor');
  });

  it('le héros ne traverse ni le mur du bas ni un pilier', () => {
    const w = quietWorld();
    play(w, 1500, { moveX: 0, moveY: 1 });
    expect(w.hero.body.y).toBeLessThanOrEqual(22 * TILE - HERO.FEET_RADIUS + 1e-6);
    // Pilier « o » en (25, 20) : on fonce vers la droite sur sa rangée.
    play(w, 400, { moveX: 0, moveY: -1 });
    w.hero.body.y = 20 * TILE + TILE / 2;
    play(w, 2000, { moveX: 1, moveY: 0 });
    expect(w.hero.body.x).toBeLessThanOrEqual(25 * TILE - HERO.FEET_RADIUS + 1e-6);
  });

  it('le ballast ralentit de 15 %', () => {
    const w = quietWorld();
    const y = 16 * TILE + TILE / 2;
    expect(w.arena.isSlowGround(100, y)).toBe(true);
    w.hero.body.x = 40;
    w.hero.body.y = y;
    play(w, 1000, { moveX: 1 });
    const slow = w.hero.body.vx;
    expect(slow).toBeCloseTo(HERO.SPEED * (1 - HERO.BALLAST_SLOW), 0);
  });
});

describe('héros : combo de la clé à tire-fond', () => {
  it('enchaîne les trois coups (timings de balance.ts) puis revient au repos', () => {
    const w = quietWorld();
    const seen: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const events = play(w, 260, { attack: true, aim: 0 });
      for (const e of events) if (e.type === 'swing') seen.push(e.combo);
    }
    expect(seen).toEqual([0, 1, 2]);
    play(w, COMBO[2].startupMs + COMBO[2].activeMs + COMBO[2].recoveryMs + 50);
    expect(w.hero.state).toBe('idle');
  });

  it('les frames actives tombent après le startup', () => {
    const w = quietWorld();
    const early = play(w, COMBO[0].startupMs - 20, { attack: true, aim: 0 });
    expect(early.some((e) => e.type === 'swing')).toBe(false);
    const later = play(w, 60, { aim: 0 });
    expect(later.some((e) => e.type === 'swing')).toBe(true);
  });

  it('le combo repart du coup 1 après la fenêtre d’enchaînement', () => {
    const w = quietWorld();
    play(w, 400, { attack: true, aim: 0 });
    play(w, 400);
    const events = play(w, 200, { attack: true, aim: 0 });
    const swing = events.find((e) => e.type === 'swing');
    expect(swing?.type === 'swing' ? swing.combo : -1).toBe(0);
  });
});

describe('héros : dash « Retard SNCB »', () => {
  it('parcourt la distance du GDD en 140 ms, avec i-frames', () => {
    const w = quietWorld();
    const x0 = w.hero.body.x;
    w.hero.body.y -= 2 * TILE;
    play(w, SIM_DT_MS, { dash: true, moveX: 1 });
    expect(w.hero.state).toBe('dash');
    expect(w.hero.isInvulnerable()).toBe(true);
    play(w, DASH.DURATION_MS + 20, { moveX: 1 });
    const travelled = w.hero.body.x - x0;
    expect(travelled).toBeGreaterThan(DASH.DISTANCE_PX * 0.9);
    expect(travelled).toBeLessThan(DASH.DISTANCE_PX * 1.25);
  });

  it('deux charges, la troisième attend la recharge (750 ms)', () => {
    const w = quietWorld();
    w.hero.body.y -= 2 * TILE;
    play(w, SIM_DT_MS, { dash: true, moveX: 1 });
    play(w, DASH.MIN_INTERVAL_MS + 20);
    play(w, SIM_DT_MS, { dash: true, moveX: -1 });
    expect(w.run.dash.available).toBe(0);
    play(w, DASH.MIN_INTERVAL_MS + 20);
    play(w, SIM_DT_MS, { dash: true, moveX: 1 });
    expect(w.hero.state).not.toBe('dash');
    play(w, DASH.RECHARGE_MS);
    expect(w.run.dash.available).toBeGreaterThanOrEqual(1);
  });

  it('esquive un coup pendant les i-frames (dash parfait)', () => {
    const w = quietWorld();
    play(w, SIM_DT_MS, { dash: true, moveX: 1 });
    const before = w.run.energy;
    expect(w.damageHero(10, { x: 0, y: 0, name: 'test' })).toBe(false);
    expect(w.run.energy).toBe(before);
    expect(w.drainEvents().some((e) => e.type === 'perfectDash')).toBe(true);
  });
});

describe('dégâts', () => {
  it('le coup 1 inflige 12 (ou un critique) à un consultant devant le héros', () => {
    const w = quietWorld(3);
    const e = consultantAt(w, 24, -HERO.ATTACK_ORIGIN_Y + CONSULTANT.hurtOffsetY);
    const events = play(w, 200, { attack: true, aim: 0 });
    const hit = events.find((ev) => ev.type === 'enemyHit');
    expect(hit?.type === 'enemyHit' ? [12, 21].includes(hit.amount) : false).toBe(true);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('un seul impact par cible et par coup', () => {
    const w = quietWorld(3);
    consultantAt(w, 24, 0);
    const events = play(w, 300, { attack: true, aim: 0 });
    expect(events.filter((ev) => ev.type === 'enemyHit')).toHaveLength(1);
  });

  it('le combo complet tue un consultant (30 PV) et le retire après le fondu', () => {
    const w = quietWorld(3);
    const e = consultantAt(w, 26, 0);
    for (let i = 0; i < 3; i += 1) play(w, 300, { attack: true, aim: 0 });
    play(w, 400);
    expect(e.isDead).toBe(true);
    expect(w.run.kills).toBe(1);
    play(w, DEATH_REMOVE_MS + 50);
    expect(w.enemies).toHaveLength(0);
  });

  it('le hitstop est demandé à l’impact', () => {
    const w = quietWorld(3);
    consultantAt(w, 24, 0);
    play(w, 200, { attack: true, aim: 0 });
    expect(w.time.frozen).toBe(true);
  });

  it('le « Coup de diaporama » du consultant blesse le héros après son télégraphe', () => {
    const w = quietWorld(5);
    const e = consultantAt(w, 20, 0);
    const before = w.run.energy;
    // Ennemi au contact : il télégraphie (≥ 300 ms) puis frappe.
    play(w, 200);
    expect(e.state).toBe('windup');
    expect(e.telegraph?.kind).toBe('arc');
    expect(w.run.energy).toBe(before);
    play(w, CONSULTANT.MELEE_TELEGRAPH_MS);
    expect(w.run.energy).toBe(before - CONSULTANT.MELEE_DAMAGE);
    expect(w.hero.state).toBe('hurt');
  });

  it('au plus deux consultants attaquent en même temps (jetons)', () => {
    const w = quietWorld(5);
    consultantAt(w, 20, 0);
    consultantAt(w, -20, 0);
    consultantAt(w, 0, 20);
    play(w, 120);
    const winding = w.enemies.filter((e) => e.state === 'windup').length;
    expect(winding).toBe(ENEMY_RULES.MAX_MELEE_TOKENS);
  });

  it('les vagues partent seules et la même graine rejoue la même partie', () => {
    const a = new World({ seed: 42 });
    const b = new World({ seed: 42 });
    play(a, 3000, { moveX: 0.3, moveY: -1 });
    play(b, 3000, { moveX: 0.3, moveY: -1 });
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(a.enemies.map((e) => [e.body.x, e.body.y])).toEqual(
      b.enemies.map((e) => [e.body.x, e.body.y]),
    );
  });
});
