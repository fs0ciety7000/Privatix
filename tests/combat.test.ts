import { describe, expect, it } from 'vitest';
import { BURNOUT, COMBO, DASH, SCALING, SHIFTS } from '@/config/balance';
import {
  canChain,
  canDashCancel,
  hitstopFor,
  phaseAt,
  timingOf,
} from '@/systems/combat/attackTiming';
import { BurnoutMeter } from '@/systems/combat/Burnout';
import { DashCharges } from '@/systems/combat/DashCharges';
import { enemyScale, incoming, rollOutgoing } from '@/systems/combat/damage';
import { circleInArc, circleInOrientedRect, shapeHits } from '@/systems/combat/geometry';
import { Mobilisation } from '@/systems/combat/Mobilisation';
import { AttackTokens } from '@/systems/combat/AttackTokens';

const [C1, C2, C3] = COMBO;

describe('hitboxes géométriques', () => {
  it('l’arc du coup 1 (r38, 100°) touche devant et rate derrière', () => {
    const o = { x: 0, y: 0 };
    expect(circleInArc(o, 0, 38, 100, { x: 30, y: 0, r: 8 })).toBe(true);
    expect(circleInArc(o, 0, 38, 100, { x: 30, y: 30, r: 4 })).toBe(false);
    expect(circleInArc(o, 0, 38, 100, { x: -20, y: 0, r: 8 })).toBe(false);
    expect(circleInArc(o, 0, 38, 100, { x: 50, y: 0, r: 8 })).toBe(false);
  });

  it('le rectangle du coup 3 commence à 8 px devant le héros', () => {
    const o = { x: 0, y: 0 };
    expect(circleInOrientedRect(o, Math.PI / 2, 8, 56, 28, { x: 0, y: 40, r: 6 })).toBe(true);
    expect(circleInOrientedRect(o, Math.PI / 2, 8, 56, 28, { x: 0, y: -10, r: 4 })).toBe(false);
    expect(circleInOrientedRect(o, Math.PI / 2, 8, 56, 28, { x: 30, y: 40, r: 4 })).toBe(false);
  });

  it('le coup 3 a aussi un cercle d’impact au bout (r20 à 56 px)', () => {
    expect(shapeHits(C3.shape, { x: 0, y: 0 }, 0, { x: 56, y: 22, r: 4 })).toBe(true);
    expect(shapeHits(C1.shape, { x: 0, y: 0 }, 0, { x: 56, y: 22, r: 4 })).toBe(false);
  });
});

describe('timings du combo', () => {
  it('suit startup / active / recovery du GDD', () => {
    const t = timingOf(C1);
    expect(t.totalMs).toBe(310);
    expect(phaseAt(t, 89)).toBe('startup');
    expect(phaseAt(t, 90)).toBe('active');
    expect(phaseAt(t, 150)).toBe('recovery');
    expect(phaseAt(t, 310)).toBe('done');
  });

  it('la vitesse d’attaque raccourcit toutes les phases', () => {
    expect(timingOf(C2, 0.25).totalMs).toBeCloseTo((80 + 60 + 170) / 1.25);
  });

  it('enchaînement possible 80 ms après le début de la recovery', () => {
    const t = timingOf(C1);
    expect(canChain(t, 150 + 79)).toBe(false);
    expect(canChain(t, 150 + 80)).toBe(true);
  });

  it('le dash annule tout sauf l’active, et le startup du coup 3 seulement au début', () => {
    const t1 = timingOf(C1);
    expect(canDashCancel(t1, 0, 30)).toBe(true);
    expect(canDashCancel(t1, 0, 100)).toBe(false);
    expect(canDashCancel(t1, 0, 200)).toBe(true);
    const t3 = timingOf(C3);
    expect(canDashCancel(t3, 2, 100)).toBe(true);
    expect(canDashCancel(t3, 2, 150)).toBe(false);
  });

  it('hitstop : +10 ms par cible supplémentaire (plafond +30), +30 sur critique', () => {
    expect(hitstopFor(C1, 1, false)).toBe(50);
    expect(hitstopFor(C1, 3, false)).toBe(70);
    expect(hitstopFor(C1, 9, false)).toBe(80);
    expect(hitstopFor(C3, 1, true)).toBe(140);
    expect(hitstopFor(C3, 0, true)).toBe(0);
  });
});

describe('Burnout', () => {
  it('monte avec les coups reçus et les dashs, puis redescend après 3 s de calme', () => {
    const b = new BurnoutMeter(0);
    b.onDamageTaken(10);
    expect(b.value).toBeCloseTo(6);
    b.onDash();
    expect(b.value).toBeCloseTo(8);
    b.tick(2999);
    expect(b.value).toBeCloseTo(8);
    b.tick(1001);
    expect(b.value).toBeCloseTo(8 - BURNOUT.CALM_DECAY_PER_S * 1.001, 1);
  });

  it('ne descend jamais sous le plancher (3 par heure, ×1,5 la nuit)', () => {
    const b = new BurnoutMeter(0);
    b.setFloor(4, 1);
    expect(b.value).toBe(12);
    b.add(-50);
    expect(b.value).toBe(12);
    b.setFloor(4, 1.5);
    expect(b.floor).toBe(18);
  });

  it('change de palier aux seuils 30 / 60 / 90', () => {
    const b = new BurnoutMeter(0);
    const events = b.add(35);
    expect(b.tier.id).toBe('pression');
    expect(events).toContainEqual({ kind: 'tier', tier: b.tier });
    b.add(30);
    expect(b.tier.id).toBe('bord');
    b.add(25);
    expect(b.tier.id).toBe('rouleau');
  });

  it('pète un plomb à 100 pendant 8 s, puis Arrêt maladie : 30 minimum et −8 Énergie max', () => {
    const b = new BurnoutMeter(95);
    const start = b.add(10);
    expect(start).toContainEqual({ kind: 'meltdown-start' });
    expect(b.inMeltdown).toBe(true);
    expect(b.tier.id).toBe('meltdown');
    b.add(-50);
    expect(b.inMeltdown).toBe(true);
    const end = b.tick(BURNOUT.MELTDOWN_MS);
    expect(end).toContainEqual({ kind: 'meltdown-end', maxEnergyPenalty: 8 });
    expect(b.inMeltdown).toBe(false);
    expect(b.value).toBe(30);
  });
});

describe('dash et Mobilisation', () => {
  it('2 charges, 200 ms entre deux dashs, 750 ms par charge', () => {
    const d = new DashCharges();
    expect(d.consume()).toBe(true);
    expect(d.consume()).toBe(false);
    d.tick(DASH.MIN_INTERVAL_MS);
    expect(d.consume()).toBe(true);
    expect(d.available).toBe(0);
    // La recharge a commencé dès le premier dash (200 ms déjà écoulées).
    d.tick(DASH.RECHARGE_MS - DASH.MIN_INTERVAL_MS - 1);
    expect(d.available).toBe(0);
    d.tick(1);
    expect(d.available).toBe(1);
  });

  it('le dash parfait rend une demi-charge', () => {
    const d = new DashCharges();
    d.consume();
    d.refund(0.5);
    d.tick(DASH.RECHARGE_MS / 2);
    expect(d.available).toBe(2);
  });

  it('la Mobilisation gagne 1 point par tranche de 4 dégâts et plafonne à 100', () => {
    const m = new Mobilisation();
    m.onDamageDealt(10);
    expect(m.value).toBe(2);
    m.onDamageDealt(2);
    expect(m.value).toBe(3);
    m.add(500);
    expect(m.value).toBe(100);
    expect(m.spend(50)).toBe(true);
    expect(m.spend(60)).toBe(false);
  });

  it('les jetons limitent les attaquants simultanés', () => {
    const tokens = new AttackTokens({ melee: 2, ranged: 1 });
    expect(tokens.tryTake('melee', 1)).toBe(true);
    expect(tokens.tryTake('melee', 2)).toBe(true);
    expect(tokens.tryTake('melee', 3)).toBe(false);
    tokens.release(1);
    expect(tokens.tryTake('melee', 3)).toBe(true);
  });
});

describe('dégâts et scaling', () => {
  it('applique bonus et critique', () => {
    expect(
      rollOutgoing(12, { damageBonus: 0.25, critChance: 0, critMult: 1.75 }, () => 0.5),
    ).toEqual({ amount: 15, crit: false });
    expect(rollOutgoing(12, { damageBonus: 0, critChance: 1, critMult: 1.75 }, () => 0.5)).toEqual({
      amount: 21,
      crit: true,
    });
    expect(incoming(8, 0.25)).toBe(10);
  });

  it('suit les formules du canon (salle 8 : un Junior a ≈ 47 PV)', () => {
    const s = enemyScale(8, SHIFTS.matin, SCALING);
    expect(Math.round(30 * s.hp)).toBe(47);
    expect(s.damage).toBeCloseTo(1.35);
    expect(enemyScale(40, SHIFTS.matin, SCALING).speed).toBe(SCALING.SPEED_CAP);
  });
});
