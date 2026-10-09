import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';
import { Shift } from '@/config/constants';
import {
  ENCOUNTERS,
  ENEMIES,
  enemyDef,
  isEnemyId,
  isSkillId,
  SKILLS,
  STARTING_INVENTORY,
} from '@/data/combat';
import type { ItemId } from '@/data/combat';
import type { EncounterId } from '@/data/types';
import { createEnemy } from '@/systems/combat/actions';
import type { Ctx } from '@/systems/combat/context';
import { applyStatus } from '@/systems/combat/context';
import {
  act,
  availableActions,
  computeRewards,
  currentActor,
  knownSkills,
  legalTargets,
  startBattle,
  targetMode,
} from '@/systems/combat/CombatEngine';
import {
  computeDamage,
  enemyStats,
  enemyXp,
  fleeChance,
  heroCritChance,
  hitChance,
  initiative,
  partyResistance,
  statusChance,
  variance,
} from '@/systems/combat/formulas';
import type {
  BattleEvent,
  BattleSetup,
  BattleState,
  Combatant,
  PartyMemberId,
  PartyMemberSetup,
  Rng,
  StatusInstance,
} from '@/systems/combat/types';
import { statsAt } from '@/systems/party/Leveling';
import { fatigueTier } from '@/systems/time/FatigueClock';
import { createRng } from '@/utils/rng';

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

const constRng =
  (value: number): Rng =>
  () =>
    value;

/** Rejoue `values` dans l'ordre, puis `fallback` indéfiniment. */
function seqRng(values: readonly number[], fallback = 0.5): Rng {
  let i = 0;
  return () => {
    const v = values[i];
    i += 1;
    return v ?? fallback;
  };
}

function member(id: PartyMemberId, level: number, over: Partial<PartyMemberSetup> = {}) {
  const s = statsAt(id, level);
  const base: PartyMemberSetup = {
    id,
    name: id === 'heros' ? 'Léa' : id,
    sprite: id,
    level,
    hp: s.maxHp,
    maxHp: s.maxHp,
    pe: s.maxPe,
    maxPe: s.maxPe,
    force: s.force,
    defense: s.defense,
    speed: s.speed,
    skills: knownSkills(id, level),
  };
  return { ...base, ...over };
}

function setup(
  encounterId: EncounterId,
  party: readonly PartyMemberSetup[],
  over: Partial<BattleSetup> = {},
): BattleSetup {
  return {
    encounterId,
    party,
    fatigue: 30,
    moral: 10,
    shift: Shift.Morning,
    inventory: STARTING_INVENTORY,
    gobelets: 1,
    ...over,
  };
}

function get(state: BattleState, id: string): Combatant {
  const c = state.combatants.find((x) => x.id === id);
  if (!c) throw new Error(`absent : ${id}`);
  return c;
}

function patch(state: BattleState, id: string, p: Partial<Combatant>): BattleState {
  return { ...state, combatants: state.combatants.map((c) => (c.id === id ? { ...c, ...p } : c)) };
}

function withStatus(state: BattleState, id: string, ...statuses: StatusInstance[]): BattleState {
  return patch(state, id, { statuses });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((v: unknown) => {
      deepFreeze(v);
    });
    Object.freeze(value);
  }
  return value;
}

const ofKind = <K extends BattleEvent['kind']>(events: readonly BattleEvent[], kind: K) =>
  events.filter((e): e is Extract<BattleEvent, { kind: K }> => e.kind === kind);

/** Héros très rapide : il joue en premier à chaque manche. */
const fastHero = (level: number, over: Partial<PartyMemberSetup> = {}) =>
  member('heros', level, { speed: 99, ...over });

// ---------------------------------------------------------------------------
// Exemples chiffrés du GDD § 5.4
// ---------------------------------------------------------------------------

describe('formules : exemples chiffrés du GDD § 5.4', () => {
  const consultant4 = enemyStats(enemyDef('consultant'), 4, 1);
  const heroForce4 = statsAt('heros', 4).force + BALANCE.economy.TIREFOND[0].force;

  it('stats de référence (GDD § 6.2) : Consultant niv. 4, Manager KPI niv. 4, Auditeur niv. 7', () => {
    expect(consultant4).toEqual({ maxHp: 54, force: 14, defense: 7, speed: 15 });
    expect(enemyStats(enemyDef('manager-kpi'), 4, 1)).toEqual({
      maxHp: 95,
      force: 12,
      defense: 12,
      speed: 9,
    });
    expect(enemyStats(enemyDef('auditeur-quais'), 7, 1)).toEqual({
      maxHp: 291,
      force: 19,
      defense: 18,
      speed: 12,
    });
  });

  it('1. attaque de Léa niv. 4 (Force 20) sur un Consultant (Déf 7), Fatigué → 31', () => {
    expect(heroForce4).toBe(20);
    const dmg = computeDamage({
      force: heroForce4,
      power: 100,
      defense: consultant4.defense,
      variance: 1,
      tierMult: fatigueTier(45).dmg,
    });
    expect(dmg).toBe(31);
    expect(Math.ceil(consultant4.maxHp / dmg)).toBe(2);
  });

  it('2. Question concrète (puissance 110, faiblesse ×2) → 70, K.O.', () => {
    const dmg = computeDamage({
      force: heroForce4,
      power: SKILLS['question-concrete'].power,
      defense: consultant4.defense,
      variance: 1,
      tierMult: fatigueTier(45).dmg,
      weaknessMult: BALANCE.combat.WEAKNESS_MULT,
    });
    expect(dmg).toBe(70);
    expect(dmg).toBeGreaterThanOrEqual(consultant4.maxHp);
  });

  it('3. puissance 200, ignore 50 % Déf, Manager KPI niv. 17 de nuit, Épuisé, critique → 278', () => {
    // Équipement absent du jalon : la Force 60 (42 + clé Mk2) est passée telle quelle à la formule.
    const manager = enemyStats(enemyDef('manager-kpi'), 17, BALANCE.pause.night.enemyStatMult);
    expect(manager.defense).toBe(43);
    const dmg = computeDamage({
      force: 60,
      power: 200,
      ignoreDef: 0.5,
      defense: manager.defense,
      variance: 1,
      critical: true,
      tierMult: fatigueTier(75).dmg,
    });
    expect(dmg).toBe(278);
  });

  it('4. critique : Moral 55, nuit, Épuisé → 25 %', () => {
    expect(
      heroCritChance({
        moral: 55,
        tierCrit: fatigueTier(75).crit,
        pauseCrit: BALANCE.pause.night.critBonus,
      }),
    ).toBe(25);
    // Démotivé : MoralEffectif −30 ; plafond 50.
    expect(heroCritChance({ moral: 55, demotivated: true })).toBe(7);
    expect(heroCritChance({ moral: 100, tierCrit: 10, pauseCrit: 10, equipCrit: 30 })).toBe(50);
  });

  it('5. toucher : Vit 32 contre 24, Épuisé → 88 % (bornes 30–99)', () => {
    expect(hitChance({ attackerSpeed: 32, defenderSpeed: 24, tierAcc: fatigueTier(75).acc })).toBe(
      88,
    );
    expect(hitChance({ attackerSpeed: 1, defenderSpeed: 99 })).toBe(30);
    expect(hitChance({ attackerSpeed: 50, defenderSpeed: 1 })).toBe(99);
    expect(hitChance({ attackerSpeed: 10, defenderSpeed: 10, dodge: 15 })).toBe(75);
  });

  it('6. Consultant niv. 10 (Force 26) sur un héros qui défend (Déf 35) → 8', () => {
    // Veste d'hiver absente du jalon : la Déf 35 (21 + 14) est passée telle quelle.
    expect(enemyStats(enemyDef('consultant'), 10, 1).force).toBe(26);
    expect(
      computeDamage({ force: 26, power: 100, defense: 35, variance: 1, defending: true }),
    ).toBe(8);
  });

  it('7. défense écrasante : Force 5 contre Déf 30 → 1', () => {
    expect(computeDamage({ force: 5, power: 100, defense: 30, variance: 1 })).toBe(1);
    expect(
      computeDamage({ force: 5, power: 100, defense: 30, variance: 0.9, defending: true }),
    ).toBe(1);
  });

  it('8. fuite : Vit moyenne 10 contre 20 → 20 % (bornes 10–90)', () => {
    expect(fleeChance([10], [20])).toBe(20);
    expect(fleeChance([8, 12], [20])).toBe(20);
    expect(fleeChance([1], [50])).toBe(10);
    expect(fleeChance([50], [1])).toBe(90);
  });

  it('9. Sommeil (base 80) sur un héros, Moral 40 → 60 % ; 0 % s’il est Caféiné', () => {
    expect(statusChance(80, partyResistance(40, false, 0))).toBe(60);
    expect(partyResistance(200, false, 0)).toBe(BALANCE.combat.HERO_RES_CAP);
    expect(partyResistance(40, false, fatigueTier(95).statusRes)).toBe(0);
    expect(statusChance(10, 50)).toBe(5);
    expect(statusChance(200, 0)).toBe(95);
  });

  it('variance, Démotivé, bouclier, provocation se multiplient', () => {
    const base = { force: 20, power: 100, defense: 0 };
    expect(computeDamage({ ...base, variance: 0.9 })).toBe(36);
    expect(computeDamage({ ...base, variance: 1.1 })).toBe(44);
    expect(computeDamage({ ...base, variance: 1, demotivated: true })).toBe(30);
    expect(computeDamage({ ...base, variance: 1, shielded: true })).toBe(20);
    expect(computeDamage({ ...base, variance: 1, extraMult: 0.8 })).toBe(32);
  });

  it('les exemples 1 et 2 tombent aussi via le moteur, avec un rng contrôlé', () => {
    const hero = fastHero(4, { force: 20 });
    let state = startBattle(
      setup('consultant-junior', [hero], { fatigue: 45 }),
      constRng(0.5),
    ).state;
    state = {
      ...state,
      combatants: state.combatants.map((c) =>
        c.side === 'enemy' ? createEnemy('consultant', 4, 'morning', 1, '') : c,
      ),
    };
    expect(currentActor(state)?.id).toBe('heros');
    // Jets : précision (0 = touche), critique (0,99 = non), variance (0,5 = ×1,0).
    const hit = act(state, { kind: 'attack', targetId: 'consultant#1' }, seqRng([0, 0.99, 0.5]));
    expect(ofKind(hit.events, 'damage')[0]).toMatchObject({ targetId: 'consultant#1', amount: 31 });

    const qc = act(
      state,
      { kind: 'skill', skillId: 'question-concrete', targetId: 'consultant#1' },
      seqRng([0, 0.99, 0.5]),
    );
    expect(ofKind(qc.events, 'damage')[0]).toMatchObject({ amount: 70, weakness: true });
    expect(ofKind(qc.events, 'ko')).toEqual([{ kind: 'ko', targetId: 'consultant#1' }]);
    expect(qc.state.outcome).toBe('victory');
  });
});

// ---------------------------------------------------------------------------
// Initiative
// ---------------------------------------------------------------------------

describe('initiative', () => {
  it('formule : floor(Vit × palier × 1,25 si Caféiné) + jet', () => {
    expect(initiative(10, 1, false, 3)).toBe(13);
    expect(initiative(10, 0.85, false, 0)).toBe(8);
    expect(initiative(10, 1, true, 0)).toBe(12);
  });

  it('trie par initiative décroissante ; égalité : camp du joueur d’abord', () => {
    const borneSpeed = get(
      startBattle(setup('borne-rebelle', [member('heros', 1)]), constRng(0.5)).state,
      'borne#1',
    ).speed;
    const tie = startBattle(
      setup('borne-rebelle', [member('heros', 1, { speed: borneSpeed })]),
      constRng(0.5),
    );
    expect(tie.state.order).toEqual(['heros', 'borne#1']);
    expect(ofKind(tie.events, 'action')).toHaveLength(0);

    const slow = startBattle(
      setup('borne-rebelle', [member('heros', 1, { speed: borneSpeed - 1 })]),
      constRng(0.5),
    );
    expect(ofKind(slow.events, 'roundStart')[0]?.order).toEqual(['borne#1', 'heros']);
    // La Borne a joué avant que le héros ait la main.
    expect(ofKind(slow.events, 'action')[0]?.actorId).toBe('borne#1');
    expect(currentActor(slow.state)?.id).toBe('heros');
  });

  it('est recalculée à chaque manche (Caféiné accélère)', () => {
    const borneSpeed = get(
      startBattle(setup('borne-rebelle', [member('heros', 1)]), constRng(0.5)).state,
      'borne#1',
    ).speed;
    const hero = member('heros', 1, { speed: borneSpeed, hp: 500, maxHp: 500 });
    let state = startBattle(setup('borne-rebelle', [hero], { fatigue: 50 }), constRng(0.5)).state;
    // Fatigué : initiative ×0,95, la Borne passe devant.
    expect(state.order).toEqual(['borne#1', 'heros']);
    const step = act(state, { kind: 'cafe' }, constRng(0.5));
    state = step.state;
    // Café : Fatigue 30 (Frais) et Caféiné ×1,25 → le héros repasse devant.
    expect(ofKind(step.events, 'roundStart')[0]?.order).toEqual(['heros', 'borne#1']);
    expect(state.round).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------

describe('statuts et tours sautés', () => {
  const formSetup = () => setup('borne-rebelle', [fastHero(1)], { inventory: { formulaire: 3 } });

  it('Bloqué fait sauter un tour, puis 1 tour d’immunité', () => {
    const rng = constRng(0);
    let state = startBattle(formSetup(), rng).state;
    let step = act(state, { kind: 'item', itemId: 'formulaire', targetId: 'borne#1' }, rng);
    expect(ofKind(step.events, 'status')[0]).toMatchObject({ status: 'bloque', applied: true });
    expect(ofKind(step.events, 'skipTurn')).toEqual([
      { kind: 'skipTurn', actorId: 'borne#1', reason: 'bloque' },
    ]);
    expect(ofKind(step.events, 'statusEnd')[0]).toMatchObject({ status: 'bloque' });
    state = step.state;
    expect(get(state, 'borne#1').fx.blockImmunity).toBe(1);

    step = act(state, { kind: 'item', itemId: 'formulaire', targetId: 'borne#1' }, rng);
    expect(ofKind(step.events, 'status')[0]).toMatchObject({ status: 'bloque', applied: false });
    expect(ofKind(step.events, 'skipTurn')).toHaveLength(0);
    expect(ofKind(step.events, 'action').some((e) => e.actorId === 'borne#1')).toBe(true);
    state = step.state;
    expect(get(state, 'borne#1').fx.blockImmunity).toBe(0);

    step = act(state, { kind: 'item', itemId: 'formulaire', targetId: 'borne#1' }, rng);
    expect(ofKind(step.events, 'status')[0]).toMatchObject({ applied: true });
    expect(step.state.inventory.formulaire).toBe(0);
  });

  it('Sommeil fait sauter les tours, et un coup réveille', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const asleep = withStatus(start, 'borne#1', { id: 'sommeil', turns: 2 });

    const skipped = act(asleep, { kind: 'defend' }, constRng(0.5));
    expect(ofKind(skipped.events, 'skipTurn')).toEqual([
      { kind: 'skipTurn', actorId: 'borne#1', reason: 'sommeil' },
    ]);

    const woken = act(asleep, { kind: 'attack', targetId: 'borne#1' }, constRng(0.5));
    const kinds = woken.events.map((e) => e.kind);
    expect(kinds.indexOf('statusEnd')).toBeGreaterThan(kinds.indexOf('damage'));
    expect(ofKind(woken.events, 'statusEnd')[0]).toMatchObject({ status: 'sommeil' });
    expect(ofKind(woken.events, 'skipTurn')).toHaveLength(0);
  });

  it('le Sommeil dure au plus 2 tours', () => {
    const start = startBattle(
      setup('borne-rebelle', [fastHero(1)], { inventory: {} }),
      constRng(0.5),
    ).state;
    let state = patch(withStatus(start, 'borne#1', { id: 'sommeil', turns: 2 }), 'borne#1', {
      hp: 999,
      maxHp: 999,
    });
    const skips: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const step = act(state, { kind: 'defend' }, constRng(0.5));
      skips.push(...ofKind(step.events, 'skipTurn').map((e) => e.reason));
      state = step.state;
    }
    expect(skips).toEqual(['sommeil', 'sommeil']);
  });

  it('Caféiné immunise contre la Réunion d’alignement (Sommeil), pas les autres', () => {
    const party = [fastHero(5), member('josiane', 5, { speed: 1 })];
    const rng = constRng(0);
    const start = startBattle(setup('manager-kpi-quai', party), rng).state;
    const step = act(start, { kind: 'cafe' }, rng);
    const sleep = ofKind(step.events, 'status').filter((e) => e.status === 'sommeil');
    expect(sleep).toEqual([
      { kind: 'status', targetId: 'heros', status: 'sommeil', applied: false },
      { kind: 'status', targetId: 'josiane', status: 'sommeil', applied: true },
    ]);
    expect(step.state.gobelets).toBe(0);
  });

  it('Caféiné retire le Sommeil', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const slept = withStatus(start, 'heros', { id: 'sommeil', turns: 2 });
    const step = act(slept, { kind: 'cafe' }, constRng(0.5));
    expect(ofKind(step.events, 'statusEnd')[0]).toMatchObject({
      targetId: 'heros',
      status: 'sommeil',
    });
  });

  it('Syndiqué retire Bloqué et Confusion et immunise contre Démotivé', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const ctx: Ctx = {
      state: withStatus(start, 'heros', { id: 'bloque', turns: 1 }, { id: 'confusion', turns: 2 }),
      events: [],
      rng: constRng(0),
    };
    expect(applyStatus(ctx, 'heros', 'syndique', null, 'party')).toBe(true);
    expect(get(ctx.state, 'heros').statuses).toEqual([{ id: 'syndique', turns: 3 }]);
    expect(applyStatus(ctx, 'heros', 'demotive', 100, 'enemy')).toBe(false);
    expect(ofKind(ctx.events, 'statusEnd').map((e) => e.status)).toEqual(['bloque', 'confusion']);
  });

  it('Burn-out dure 1 tour de plus au palier Épuisé ; Bloqué +15 le matin', () => {
    const start = startBattle(
      setup('borne-rebelle', [fastHero(1)], { fatigue: 75, moral: 0 }),
      constRng(0.5),
    ).state;
    const ctx: Ctx = { state: start, events: [], rng: constRng(0.5) };
    applyStatus(ctx, 'heros', 'burnout', null, 'enemy');
    expect(get(ctx.state, 'heros').statuses).toEqual([{ id: 'burnout', turns: 4 }]);
    // Base 40 − résistance 0 : un jet de 0,5 rate… sauf avec le bonus du matin (55 %).
    expect(applyStatus(ctx, 'heros', 'bloque', 40, 'enemy')).toBe(true);
    const night: Ctx = {
      state: { ...start, engine: { ...start.engine, shift: Shift.Night } },
      events: [],
      rng: constRng(0.5),
    };
    expect(applyStatus(night, 'heros', 'bloque', 40, 'enemy')).toBe(false);
  });

  it('Caféiné : à la fin, +5 Fatigue', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const ending = patch(withStatus(start, 'heros', { id: 'cafeine', turns: 0 }), 'borne#1', {
      hp: 999,
      maxHp: 999,
    });
    const step = act(ending, { kind: 'defend' }, constRng(0.5));
    expect(ofKind(step.events, 'statusEnd')[0]).toMatchObject({ status: 'cafeine' });
    expect(ofKind(step.events, 'fatigue')[0]).toEqual({ kind: 'fatigue', delta: 5, value: 35 });
    expect(step.state.fatigue).toBe(35);
  });

  it('Effondré (Fatigue 100) : chacun saute sa prochaine action, puis Fatigue 90', () => {
    const start = startBattle(
      setup('borne-rebelle', [fastHero(1, { hp: 500, maxHp: 500 })], { fatigue: 97 }),
      constRng(0.5),
    ).state;
    const ending = patch(withStatus(start, 'heros', { id: 'cafeine', turns: 0 }), 'borne#1', {
      hp: 999,
      maxHp: 999,
    });
    const step = act(ending, { kind: 'defend' }, constRng(0.5));
    expect(step.state.fatigue).toBe(BALANCE.fatigue.COLLAPSE_RESET);
    const texts = ofKind(step.events, 'message').map((e) => e.text);
    expect(texts.some((t) => t.includes('micro-sieste'))).toBe(true);
    // Le héros a sauté un tour : la Borne a joué deux fois avant la décision suivante.
    expect(ofKind(step.events, 'action').filter((e) => e.actorId === 'borne#1')).toHaveLength(2);
    expect(currentActor(step.state)?.id).toBe('heros');
  });

  it('Burn-out : −6 % PV max au début du tour', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const burning = patch(withStatus(start, 'heros', { id: 'burnout', turns: 3 }), 'borne#1', {
      hp: 999,
      maxHp: 999,
    });
    const step = act(burning, { kind: 'defend' }, constRng(0.99));
    const hero = get(step.state, 'heros');
    const loss = Math.floor(hero.maxHp * BALANCE.status.BURNOUT.hpLossPct);
    const self = ofKind(step.events, 'damage').filter((e) => e.targetId === 'heros');
    expect(self.at(-1)?.amount).toBe(loss);
    expect(hero.statuses).toEqual([{ id: 'burnout', turns: 2 }]);
  });

  it('Confusion : 40 % de chance de viser n’importe qui (même soi)', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const confused = withStatus(start, 'heros', { id: 'confusion', turns: 2 });
    // Jets : détournement (0 < 0,4), cible au hasard (0 → premier combattant debout : le héros).
    const step = act(confused, { kind: 'attack', targetId: 'borne#1' }, seqRng([0, 0]));
    expect(ofKind(step.events, 'damage')[0]?.targetId).toBe('heros');
    const kept = act(confused, { kind: 'attack', targetId: 'borne#1' }, seqRng([0.9]));
    expect(ofKind(kept.events, 'damage')[0]?.targetId).toBe('borne#1');
  });

  it('Post-it Vivant : à sa mort, Confusion sur un membre de l’équipe', () => {
    const start = startBattle(setup('post-it-vivant', [fastHero(5)]), constRng(0)).state;
    const step = act(start, { kind: 'attack', targetId: 'post-it#1' }, constRng(0));
    expect(ofKind(step.events, 'ko')[0]?.targetId).toBe('post-it#1');
    expect(ofKind(step.events, 'status')[0]).toMatchObject({
      targetId: 'heros',
      status: 'confusion',
      applied: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Capacités des ennemis
// ---------------------------------------------------------------------------

describe('capacités des ennemis', () => {
  it('bouclier de la Réunion d’alignement, brisé par Ponctualité réelle (×1,5)', () => {
    // Moral 100 : résistance 50, le Sommeil de la Réunion (75 % − 45) rate avec un jet de 0,5.
    const party = [member('heros', 5, { speed: 1 })];
    const moral = { moral: 100 };
    let state = startBattle(setup('manager-kpi-quai', party, moral), constRng(0.5)).state;
    const manager = get(state, 'manager-kpi#1');
    expect(manager.fx.shieldTurns).toBe(2);
    expect(get(state, 'consultant#2').fx.shieldTurns).toBe(2);

    const attack = act(state, { kind: 'attack', targetId: 'manager-kpi#1' }, constRng(0.5));
    const tier = fatigueTier(30);
    const halved = computeDamage({
      force: get(state, 'heros').force,
      power: 100,
      defense: manager.defense,
      variance: 1,
      tierMult: tier.dmg,
      shielded: true,
    });
    expect(ofKind(attack.events, 'damage')[0]).toMatchObject({ amount: halved, weakness: false });

    state = act(
      state,
      { kind: 'skill', skillId: 'ponctualite-reelle', targetId: 'manager-kpi#1' },
      constRng(0.5),
    ).state;
    expect(get(state, 'manager-kpi#1').fx.shieldTurns).toBe(0);
    expect(get(state, 'consultant#2').fx.shieldTurns).toBeGreaterThan(0);
    const broken = act(
      startBattle(setup('manager-kpi-quai', party, moral), constRng(0.5)).state,
      { kind: 'skill', skillId: 'ponctualite-reelle', targetId: 'manager-kpi#1' },
      constRng(0.5),
    );
    expect(ofKind(broken.events, 'message')[0]?.text).toContain('vole en éclats');
    expect(ofKind(broken.events, 'damage')[0]).toMatchObject({
      amount: computeDamage({
        force: get(state, 'heros').force,
        power: 100,
        defense: manager.defense,
        variance: 1,
        tierMult: tier.dmg,
        weaknessMult: 1.5,
      }),
      weakness: true,
    });
  });

  it('Manager KPI : Reporting hebdo à la manche 3, Force +5 %/manche plafonnée', () => {
    const hero = fastHero(5, { hp: 999, maxHp: 999 });
    let state = startBattle(setup('manager-kpi-quai', [hero], { moral: 100 }), constRng(0.5)).state;
    state = patch(state, 'manager-kpi#1', { hp: 9999, maxHp: 9999 });
    state = patch(state, 'consultant#2', { hp: 9999, maxHp: 9999 });
    const labels: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const step = act(state, { kind: 'defend' }, constRng(0.5));
      labels.push(
        ...ofKind(step.events, 'action')
          .filter((e) => e.actorId === 'manager-kpi#1')
          .map((e) => e.label),
      );
      state = step.state;
    }
    expect(labels[0]).toBe("Réunion d'alignement");
    expect(labels[2]).toBe('Reporting hebdo');
    expect(get(state, 'manager-kpi#1').fx.forceBonus).toBeCloseTo(0.15);
    for (let i = 0; i < 15; i += 1) state = act(state, { kind: 'defend' }, constRng(0.5)).state;
    expect(get(state, 'manager-kpi#1').fx.forceBonus).toBe(BALANCE.enemies.MANAGER_FORCE_CAP);
  });

  it('Consultant : invocation après 3 manches (1×) ; Question concrète l’annule', () => {
    const hero = fastHero(2, { hp: 999, maxHp: 999, pe: 99, maxPe: 99 });
    const base = patch(
      startBattle(setup('consultant-junior', [hero]), constRng(0.99)).state,
      'consultant#1',
      { hp: 9999, maxHp: 9999 },
    );
    const run = (first: 'defend' | 'question') => {
      let state =
        first === 'question'
          ? act(
              base,
              { kind: 'skill', skillId: 'question-concrete', targetId: 'consultant#1' },
              constRng(0.5),
            ).state
          : base;
      const events: BattleEvent[] = [];
      for (let i = 0; i < 6; i += 1) {
        const step = act(state, { kind: 'defend' }, constRng(0.99));
        events.push(...step.events);
        state = step.state;
      }
      return { state, events };
    };
    const normal = run('defend');
    expect(ofKind(normal.events, 'summon')).toEqual([
      { kind: 'summon', combatantId: 'consultant#2' },
    ]);
    expect(get(normal.state, 'consultant#2').ko).toBe(false);

    const cancelled = run('question');
    expect(get(cancelled.state, 'consultant#1').fx.summonSpent).toBe(true);
    expect(ofKind(cancelled.events, 'summon')).toHaveLength(0);
  });

  it('Stagiaire en Stratégie : peut passer son tour à chercher le Wi-Fi', () => {
    const step = startBattle(
      setup('consultants-hall', [member('heros', 4, { speed: 1 })]),
      constRng(0),
    );
    expect(ofKind(step.events, 'action').find((e) => e.actorId === 'stagiaire#2')?.label).toBe(
      'cherche le Wi-Fi',
    );
  });

  it('provocation de Josiane : les attaques à cible unique la visent, dégâts ×0,8', () => {
    const party = [fastHero(3), member('josiane', 3, { speed: 98 })];
    let state = startBattle(setup('patrouille-bornes', party), constRng(0.5)).state;
    state = act(state, { kind: 'defend' }, constRng(0.5)).state;
    expect(currentActor(state)?.id).toBe('josiane');
    // Jet 0,2 : l'IA attaque (< 0,6) et touche malgré la vitesse de Josiane (toucher plancher 30 %).
    const step = act(state, { kind: 'skill', skillId: 'controle-des-titres' }, constRng(0.2));
    expect(get(step.state, 'josiane').fx.tauntTurns).toBe(2);
    const hits = ofKind(step.events, 'damage');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.targetId === 'josiane')).toBe(true);
    const borne = get(state, 'borne#1');
    const josiane = get(state, 'josiane');
    expect(hits[0]?.amount).toBe(
      computeDamage({
        force: borne.force,
        power: 100,
        defense: josiane.defense,
        variance: variance(0.2),
        extraMult: 0.8,
      }),
    );
    // Côté joueur, aucun ennemi ne provoque : toutes les cibles restent légales.
    expect(legalTargets(step.state, 'enemy')).toEqual(['borne#1', 'borne#2']);
  });
});

// ---------------------------------------------------------------------------
// K.O., fin de combat, fuite
// ---------------------------------------------------------------------------

describe('K.O., fin de combat et fuite', () => {
  it('victoire : K.O. du dernier ennemi, plus d’acteur, toute action lève une erreur', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(5)]), constRng(0.5)).state;
    const step = act(start, { kind: 'attack', targetId: 'borne#1' }, constRng(0.5));
    expect(step.state.outcome).toBe('victory');
    expect(step.events.at(-1)).toEqual({ kind: 'end', outcome: 'victory' });
    expect(get(step.state, 'borne#1')).toMatchObject({ hp: 0, ko: true });
    expect(currentActor(step.state)).toBeNull();
    expect(() => act(step.state, { kind: 'defend' }, constRng(0.5))).toThrow();
  });

  it('défaite : tous les membres « en arrêt maladie »', () => {
    const hero = member('heros', 1, { speed: 1, hp: 1 });
    const step = startBattle(setup('patrouille-bornes', [hero]), constRng(0.5));
    expect(step.state.outcome).toBe('defeat');
    expect(ofKind(step.events, 'ko')).toEqual([{ kind: 'ko', targetId: 'heros' }]);
    expect(ofKind(step.events, 'message').some((e) => e.text.includes('arrêt maladie'))).toBe(true);
    expect(step.events.at(-1)).toEqual({ kind: 'end', outcome: 'defeat' });
  });

  it('un membre K.O. ne joue plus et n’est plus une cible', () => {
    const party = [fastHero(3), member('josiane', 3, { speed: 98 })];
    let state = startBattle(setup('patrouille-bornes', party), constRng(0.5)).state;
    state = patch(state, 'josiane', { hp: 0, ko: true });
    expect(legalTargets(state, 'ally')).toEqual(['heros']);
    const step = act(state, { kind: 'defend' }, constRng(0.5));
    expect(ofKind(step.events, 'turnStart').some((e) => e.actorId === 'josiane')).toBe(false);
  });

  it('fuite réussie : ni XP ni Tickets', () => {
    const start = startBattle(setup('patrouille-bornes', [fastHero(3)]), constRng(0.5)).state;
    expect(availableActions(start).flee).toBe(true);
    const step = act(start, { kind: 'flee' }, constRng(0));
    expect(ofKind(step.events, 'flee')).toEqual([{ kind: 'flee', success: true }]);
    expect(step.state.outcome).toBe('fled');
    expect(computeRewards(step.state, constRng(0))).toEqual({ xp: 0, tickets: 0, coffeeBeans: 0 });
  });

  it('fuite ratée : l’équipe perd le reste de la manche ; une seule tentative par manche', () => {
    const party = [fastHero(3), member('josiane', 3, { speed: 98 })];
    const start = startBattle(setup('patrouille-bornes', party), constRng(0.5)).state;
    const step = act(start, { kind: 'flee' }, constRng(0.99));
    expect(ofKind(step.events, 'flee')).toEqual([{ kind: 'flee', success: false }]);
    const round1 = step.events.slice(
      0,
      step.events.findIndex((e) => e.kind === 'roundStart'),
    );
    expect(ofKind(round1, 'turnStart').some((e) => e.actorId === 'josiane')).toBe(false);
    expect(step.state.round).toBe(2);
    expect(availableActions(step.state).flee).toBe(true);

    const attempted = { ...start, engine: { ...start.engine, fleeAttempted: true } };
    expect(availableActions(attempted).flee).toBe(false);
    expect(() => act(attempted, { kind: 'flee' }, constRng(0))).toThrow();
  });

  it('fuite interdite dans les combats scénarisés et contre une élite', () => {
    const tuto = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    expect(availableActions(tuto).flee).toBe(false);
    expect(() => act(tuto, { kind: 'flee' }, constRng(0))).toThrow();
    const audit = startBattle(setup('audit-manager-kpi', [fastHero(6)]), constRng(0.5)).state;
    expect(availableActions(audit).flee).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PE, Café, objets
// ---------------------------------------------------------------------------

describe('PE, Café et objets', () => {
  const regenAfterTurn = (fatigue: number, action: 'attack' | 'defend'): number => {
    const hero = fastHero(1, { pe: 0 });
    const start = startBattle(setup('borne-rebelle', [hero], { fatigue }), constRng(0.5)).state;
    const tough = patch(start, 'borne#1', { hp: 999, maxHp: 999 });
    const before = get(tough, 'heros').pe;
    const next = act(
      tough,
      action === 'attack' ? { kind: 'attack', targetId: 'borne#1' } : { kind: 'defend' },
      constRng(0.5),
    ).state;
    return get(next, 'heros').pe - before;
  };

  it('régénération de PE selon le palier (+3 / +2 / +1 / 0)', () => {
    expect(regenAfterTurn(30, 'attack')).toBe(3);
    expect(regenAfterTurn(50, 'attack')).toBe(2);
    expect(regenAfterTurn(75, 'attack')).toBe(1);
    expect(regenAfterTurn(95, 'attack')).toBe(0);
  });

  it('régénération doublée au tour qui suit « Défendre »', () => {
    expect(regenAfterTurn(30, 'defend')).toBe(6);
    expect(regenAfterTurn(50, 'defend')).toBe(4);
  });

  it('Défendre : dégâts reçus ×0,5 jusqu’au prochain tour', () => {
    const start = startBattle(setup('borne-rebelle', [fastHero(1)]), constRng(0.5)).state;
    const tough = patch(start, 'borne#1', { force: 30, hp: 999, maxHp: 999 });
    // Jet 0,2 : la Borne attaque et touche le héros très rapide (toucher plancher 30 %).
    const hitOn = (events: readonly BattleEvent[]) =>
      ofKind(events, 'damage').find((e) => e.targetId === 'heros')?.amount;
    const hero = get(tough, 'heros');
    const expected = (defending: boolean) =>
      computeDamage({
        force: 30,
        power: 100,
        defense: hero.defense,
        variance: variance(0.2),
        defending,
      });
    expect(hitOn(act(tough, { kind: 'attack', targetId: 'borne#1' }, constRng(0.2)).events)).toBe(
      expected(false),
    );
    expect(hitOn(act(tough, { kind: 'defend' }, constRng(0.2)).events)).toBe(expected(true));
    expect(expected(true)).toBe(Math.floor(expected(false) / 2));
  });

  it('Café : Gobelet −1, Fatigue −20, Caféiné ; grisé sans Gobelet', () => {
    const start = startBattle(
      setup('borne-rebelle', [fastHero(1)], { fatigue: 50 }),
      constRng(0.5),
    ).state;
    expect(availableActions(start).cafe).toBe(true);
    const step = act(start, { kind: 'cafe' }, constRng(0.5));
    expect(step.state.gobelets).toBe(0);
    expect(ofKind(step.events, 'fatigue')[0]).toEqual({ kind: 'fatigue', delta: -20, value: 30 });
    expect(get(step.state, 'heros').statuses.map((s) => s.id)).toContain('cafeine');
    expect(availableActions(step.state).cafe).toBe(false);
    expect(() => act(step.state, { kind: 'cafe' }, constRng(0.5))).toThrow();
  });

  it('objets : Gaufre, Expresso, Double lungo ; stock décompté, stock vide refusé', () => {
    const start = startBattle(
      setup('borne-rebelle', [fastHero(1, { hp: 10, pe: 0 })], {
        fatigue: 60,
        inventory: { gaufre: 1, expresso: 1, 'double-lungo': 1 },
      }),
      constRng(0.99),
    ).state;
    const items = (ids: readonly { id: ItemId }[]) => ids.map((i) => i.id);
    expect(items(availableActions(start).items)).toEqual(['expresso', 'gaufre', 'double-lungo']);

    const waffle = act(
      start,
      { kind: 'item', itemId: 'gaufre', targetId: 'heros' },
      constRng(0.99),
    );
    expect(ofKind(waffle.events, 'heal')[0]).toEqual({
      kind: 'heal',
      targetId: 'heros',
      amount: 40,
    });
    expect(waffle.state.inventory.gaufre).toBe(0);
    expect(() =>
      act(waffle.state, { kind: 'item', itemId: 'gaufre', targetId: 'heros' }, constRng(0.5)),
    ).toThrow();

    const coffee = act(
      start,
      { kind: 'item', itemId: 'expresso', targetId: 'heros' },
      constRng(0.99),
    );
    expect(ofKind(coffee.events, 'fatigue')[0]).toMatchObject({ delta: -15, value: 45 });
    expect(ofKind(coffee.events, 'pe')[0]).toEqual({ kind: 'pe', targetId: 'heros', amount: 5 });

    const lungo = act(
      start,
      { kind: 'item', itemId: 'double-lungo', targetId: 'heros' },
      constRng(0.99),
    );
    expect(lungo.state.fatigue).toBe(30);
    expect(ofKind(lungo.events, 'status')[0]).toMatchObject({ status: 'cafeine', applied: true });
  });

  it('actions illégales : cible invalide, PE insuffisants, compétence inconnue', () => {
    const start = startBattle(
      setup('consultant-junior', [fastHero(2, { pe: 0 })]),
      constRng(0.5),
    ).state;
    expect(() => act(start, { kind: 'attack', targetId: 'heros' }, constRng(0.5))).toThrow();
    expect(() => act(start, { kind: 'attack', targetId: 'nobody' }, constRng(0.5))).toThrow();
    // PE : 0 + 3 de régénération < 5.
    expect(availableActions(start).skills).toEqual([
      { id: 'question-concrete', usable: false, reason: 'PE insuffisants' },
    ]);
    expect(() =>
      act(
        start,
        { kind: 'skill', skillId: 'question-concrete', targetId: 'consultant#1' },
        constRng(0.5),
      ),
    ).toThrow();
    expect(() =>
      act(start, { kind: 'skill', skillId: 'pause-syndicale', targetId: 'heros' }, constRng(0.5)),
    ).toThrow();
  });

  it('targetMode et legalTargets', () => {
    const start = startBattle(setup('patrouille-bornes', [fastHero(6)]), constRng(0.5)).state;
    expect(targetMode(start, 'attack')).toBe('enemy');
    expect(targetMode(start, 'skill', 'pause-syndicale')).toBe('ally');
    expect(targetMode(start, 'skill', 'controle-des-titres')).toBe('self');
    expect(targetMode(start, 'item', 'formulaire')).toBe('enemy');
    expect(targetMode(start, 'cafe')).toBe('none');
    expect(legalTargets(start, 'all-enemies')).toEqual(['borne#1', 'borne#2']);
    expect(legalTargets(start, 'self')).toEqual(['heros']);
  });
});

// ---------------------------------------------------------------------------
// Récompenses (GDD § 5.7)
// ---------------------------------------------------------------------------

describe('récompenses', () => {
  const won = (encounter: EncounterId, shift: Shift = Shift.Morning): BattleState => ({
    ...startBattle(
      setup(encounter, [member('heros', 1, { speed: 1, hp: 999, maxHp: 999 })], { shift }),
      constRng(0.99),
    ).state,
    outcome: 'victory',
  });

  it('XP = round(6 × niv^1,5 + 10) × type × pause', () => {
    expect(enemyXp(1, 'normal', 1)).toBe(16);
    expect(enemyXp(4, 'normal', 1)).toBe(58);
    expect(enemyXp(7, 'elite', 1)).toBe(303);
    expect(enemyXp(1, 'normal', BALANCE.pause.night.xpMult)).toBe(20);
  });

  it('Borne niv. 1 le matin : 16 XP, 3–4 Tickets, Grains 20 %', () => {
    expect(computeRewards(won('borne-rebelle'), constRng(0))).toEqual({
      xp: 16,
      tickets: 3,
      coffeeBeans: 1,
    });
    expect(computeRewards(won('borne-rebelle'), constRng(0.99))).toEqual({
      xp: 16,
      tickets: 4,
      coffeeBeans: 0,
    });
  });

  it('multiplicateurs de pause (nuit : XP ×1,25, Tickets ×1,5)', () => {
    const r = computeRewards(won('borne-rebelle', Shift.Night), constRng(0));
    expect(r.xp).toBe(20);
    expect(r.tickets).toBe(Math.round(3 * BALANCE.pause.night.ticketMult));
  });

  it('élite : XP ×2,5, Tickets ×3, 3 à 5 Grains garantis', () => {
    expect(computeRewards(won('audit-manager-kpi'), constRng(0))).toEqual({
      xp: 303,
      tickets: 63,
      coffeeBeans: 3,
    });
    expect(computeRewards(won('audit-manager-kpi'), constRng(0.99)).coffeeBeans).toBe(5);
  });

  it('rien après une défaite', () => {
    const lost: BattleState = { ...won('borne-rebelle'), outcome: 'defeat' };
    expect(computeRewards(lost, constRng(0))).toEqual({ xp: 0, tickets: 0, coffeeBeans: 0 });
  });
});

// ---------------------------------------------------------------------------
// Immutabilité, déterminisme, données
// ---------------------------------------------------------------------------

describe('immutabilité et déterminisme', () => {
  it('ne modifie jamais l’état ni la mise en place reçus (Object.freeze)', () => {
    const party = [fastHero(5), member('josiane', 5), member('rudy', 5)];
    const frozenSetup = deepFreeze(setup('manager-kpi-quai', party));
    let state = deepFreeze(startBattle(frozenSetup, createRng(1)).state);
    const rng = createRng(2);
    for (let i = 0; i < 30 && state.outcome === null; i += 1) {
      const snapshot = JSON.stringify(state);
      const actor = currentActor(state);
      const target = legalTargets(state, 'enemy')[0];
      if (!actor || target === undefined) break;
      const next = act(state, { kind: 'attack', targetId: target }, rng).state;
      expect(JSON.stringify(state)).toBe(snapshot);
      state = deepFreeze(next);
    }
    expect(state.round).toBeGreaterThan(1);
  });

  it('même graine, même combat', () => {
    const run = () => {
      const rng = createRng(42);
      let state = startBattle(setup('consultants-hall', [member('heros', 4)]), rng).state;
      while (state.outcome === null) {
        const target = legalTargets(state, 'enemy')[0];
        if (target === undefined) break;
        state = act(state, { kind: 'attack', targetId: target }, rng).state;
      }
      return state;
    };
    expect(run()).toEqual(run());
  });

  it('createRng est reproductible et dans [0, 1[', () => {
    const a = createRng(7);
    const b = createRng(7);
    const values = Array.from({ length: 1000 }, () => a());
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('données de combat de l’Acte I', () => {
  it('knownSkills : compétences du héros par niveau, collègues d’office', () => {
    expect(knownSkills('heros', 1)).toEqual([]);
    expect(knownSkills('heros', 2)).toEqual(['question-concrete']);
    expect(knownSkills('heros', 4)).toEqual(['question-concrete', 'ponctualite-reelle']);
    expect(knownSkills('heros', 6)).toEqual([
      'question-concrete',
      'ponctualite-reelle',
      'pause-syndicale',
    ]);
    expect(knownSkills('josiane', 1)).toEqual(['controle-des-titres']);
    expect(knownSkills('rudy', 1)).toEqual(['fermeture-des-portes']);
    expect(knownSkills('bene', 1)).toEqual(['file-d-attente']);
  });

  it('références cohérentes entre rencontres, ennemis et compétences', () => {
    expect(Object.keys(ENCOUNTERS)).toHaveLength(8);
    for (const enc of Object.values(ENCOUNTERS)) {
      expect(enc.enemies.length).toBeGreaterThanOrEqual(1);
      expect(enc.enemies.length).toBeLessThanOrEqual(4);
      enc.enemies.forEach((e) => {
        expect(isEnemyId(e.enemy)).toBe(true);
      });
    }
    for (const id of Object.keys(ENEMIES)) {
      if (!isEnemyId(id)) throw new Error(id);
      const def = enemyDef(id);
      const refs = [
        ...def.skills,
        ...(def.weakTo ?? []),
        ...(def.openingSkill === undefined ? [] : [def.openingSkill]),
        ...(def.scheduledSkill === undefined ? [] : [def.scheduledSkill.skill]),
        ...(def.summon === undefined ? [] : [def.summon.skill]),
      ];
      refs.forEach((ref) => {
        expect(isSkillId(ref)).toBe(true);
      });
      if (def.summon) expect(isEnemyId(def.summon.enemy)).toBe(true);
      expect(def.resistance).toBe(BALANCE.combat.ENEMY_RES[def.tier]);
    }
  });

  it('fuite : interdite dans les 4 combats scénarisés, permise pour les groupes visibles', () => {
    const scripted: readonly EncounterId[] = [
      'borne-rebelle',
      'consultant-junior',
      'post-it-vivant',
      'audit-manager-kpi',
    ];
    for (const [id, enc] of Object.entries(ENCOUNTERS)) {
      expect(enc.canFlee).toBe(!scripted.some((s) => s === id));
    }
  });

  it('inventaire de départ : 3 Gaufres de Liège, 2 Expresso', () => {
    expect(STARTING_INVENTORY).toEqual({ gaufre: 3, expresso: 2 });
  });
});
