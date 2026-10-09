import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';
import { Shift } from '@/config/constants';
import { ENCOUNTERS, enemyDef, STARTING_INVENTORY } from '@/data/combat';
import type { SkillId } from '@/data/combat';
import type { EncounterId } from '@/data/types';
import {
  act,
  availableActions,
  currentActor,
  knownSkills,
  legalTargets,
  startBattle,
} from '@/systems/combat/CombatEngine';
import type {
  BattleAction,
  BattleOutcome,
  BattleState,
  Combatant,
  PartyMemberId,
  PartyMemberSetup,
} from '@/systems/combat/types';
import { enemyXp } from '@/systems/combat/formulas';
import { gainXp, statsAt } from '@/systems/party/Leveling';
import { createRng, randInt } from '@/utils/rng';

/**
 * Équilibrage de l'Acte I : auto-combat sur 300 graines avec une politique simple et raisonnable.
 * Hypothèses : pause Matin, Moral tiré entre 10 et 30, inventaire de départ, 1 Gobelet (machine niv. 1),
 * stats = statsAt(membre, niveau du héros) ; le héros porte la clé de tirefond rouillée (Force +4, GDD § 8.4).
 */

const SEEDS = 300;
const LOW_HP = 0.35;
const MAX_ACTIONS = 400;
const NAMES: Readonly<Record<PartyMemberId, string>> = {
  heros: 'Léa',
  josiane: 'Josiane',
  rudy: 'Rudy',
  bene: 'Béné',
};

function member(id: PartyMemberId, level: number): PartyMemberSetup {
  const s = statsAt(id, level);
  const key = id === 'heros' ? BALANCE.economy.TIREFOND[0].force : 0;
  return {
    id,
    name: NAMES[id],
    sprite: id,
    level,
    hp: s.maxHp,
    maxHp: s.maxHp,
    pe: s.maxPe,
    maxPe: s.maxPe,
    force: s.force + key,
    defense: s.defense,
    speed: s.speed,
    skills: knownSkills(id, level),
  };
}

const has = (c: Combatant, status: string): boolean => c.statuses.some((s) => s.id === status);
const ratio = (c: Combatant): number => c.hp / c.maxHp;
const isManager = (c: Combatant): boolean =>
  c.enemyId === 'manager-kpi' || c.enemyId === 'auditeur-quais';

/** Politique d'auto-combat (le « joueur moyen » de l'Acte I). */
export function autoPolicy(state: BattleState): BattleAction {
  const actor = currentActor(state);
  if (!actor) throw new Error('Aucun acteur');
  const avail = availableActions(state);
  const usable = (id: SkillId): boolean => avail.skills.some((s) => s.id === id && s.usable);
  const itemCount = (id: string): number =>
    avail.items.find((i) => i.id === id && i.usable)?.count ?? 0;
  const byId = (id: string): Combatant | undefined => state.combatants.find((c) => c.id === id);
  const foes = legalTargets(state, 'enemy')
    .map(byId)
    .filter((c): c is Combatant => c !== undefined);
  const allies = legalTargets(state, 'ally')
    .map(byId)
    .filter((c): c is Combatant => c !== undefined);
  const weakest = [...foes].sort((a, b) => a.hp - b.hp)[0];
  if (!weakest) throw new Error('Aucune cible');

  // Café préventif : le Manager n'a pas encore ouvert sa Réunion d'alignement.
  const manager = state.combatants.find((c) => !c.ko && isManager(c));
  if (manager?.fx.turnsTaken === 0 && avail.cafe && !has(actor, 'cafeine')) {
    return { kind: 'cafe' };
  }

  // Soins sous 35 % PV.
  const low = [...allies].sort((a, b) => ratio(a) - ratio(b))[0];
  if (low && ratio(low) < LOW_HP) {
    if (usable('pause-syndicale')) {
      return { kind: 'skill', skillId: 'pause-syndicale', targetId: low.id };
    }
    if (itemCount('gaufre') > 0) return { kind: 'item', itemId: 'gaufre', targetId: low.id };
  }

  // Josiane provoque contre un ennemi fort.
  const strongFoe = foes.some((f) => f.tier !== 'normal' || isManager(f)) || foes.length >= 2;
  if (usable('controle-des-titres') && actor.fx.tauntTurns === 0 && strongFoe) {
    return { kind: 'skill', skillId: 'controle-des-titres' };
  }

  // Compétence de faiblesse disponible.
  for (const skill of actor.skills) {
    const target = [...foes]
      .sort((a, b) => a.hp - b.hp)
      .find((f) => f.enemyId !== null && (enemyDef(f.enemyId).weakTo ?? []).includes(skill));
    if (target && usable(skill)) return { kind: 'skill', skillId: skill, targetId: target.id };
    if (target && skill === 'question-concrete' && itemCount('expresso') > 0 && actor.pe < 5) {
      return { kind: 'item', itemId: 'expresso', targetId: actor.id };
    }
  }

  // Rudy ferme les portes au nez de l'ennemi le plus solide.
  if (usable('fermeture-des-portes')) {
    const toughest = [...foes].sort((a, b) => b.hp - a.hp)[0];
    if (toughest && !has(toughest, 'bloque') && toughest.fx.blockImmunity === 0) {
      return { kind: 'skill', skillId: 'fermeture-des-portes', targetId: toughest.id };
    }
  }

  return { kind: 'attack', targetId: weakest.id };
}

export interface SimOptions {
  readonly encounter: EncounterId;
  readonly party: readonly PartyMemberId[];
  readonly level: number;
  readonly fatigue?: number;
}

export function simulate(opts: SimOptions, seed: number): BattleOutcome {
  const rng = createRng(seed);
  let state = startBattle(
    {
      encounterId: opts.encounter,
      party: opts.party.map((id) => member(id, opts.level)),
      fatigue: opts.fatigue ?? 30,
      moral: randInt(rng, 10, 30),
      shift: Shift.Morning,
      inventory: STARTING_INVENTORY,
      gobelets: BALANCE.economy.GOBELETS_PER_PAUSE[0],
    },
    rng,
  ).state;
  for (let i = 0; i < MAX_ACTIONS && state.outcome === null; i += 1) {
    state = act(state, autoPolicy(state), rng).state;
  }
  return state.outcome ?? 'defeat';
}

export function winRate(opts: SimOptions): number {
  let wins = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    if (simulate(opts, seed) === 'victory') wins += 1;
  }
  return wins / SEEDS;
}

describe('équilibrage des combats de l’Acte I (300 graines)', () => {
  const cases: readonly (SimOptions & { min: number; max?: number })[] = [
    { encounter: 'borne-rebelle', party: ['heros'], level: 1, min: 0.97 },
    { encounter: 'consultant-junior', party: ['heros'], level: 2, min: 0.9 },
    { encounter: 'post-it-vivant', party: ['heros'], level: 2, min: 0.9 },
    { encounter: 'patrouille-bornes', party: ['heros', 'josiane'], level: 3, min: 0.85 },
    { encounter: 'post-its-couloir', party: ['heros', 'josiane'], level: 3, min: 0.85 },
    { encounter: 'consultants-hall', party: ['heros', 'josiane'], level: 4, min: 0.85 },
    { encounter: 'manager-kpi-quai', party: ['heros', 'josiane'], level: 5, min: 0.75 },
    {
      encounter: 'audit-manager-kpi',
      party: ['heros', 'josiane', 'rudy'],
      level: 5,
      fatigue: 50,
      min: 0.45,
      max: 0.85,
    },
    {
      encounter: 'audit-manager-kpi',
      party: ['heros', 'josiane', 'rudy'],
      level: 6,
      fatigue: 50,
      min: 0.75,
    },
  ];

  it.each(cases)(
    '$encounter, niv. $level ($party) : taux de victoire dans la cible',
    ({ min, max, ...opts }) => {
      const rate = winRate(opts);
      expect(rate).toBeGreaterThanOrEqual(min);
      if (max !== undefined) expect(rate).toBeLessThanOrEqual(max);
    },
  );
});

describe('progression attendue de l’Acte I', () => {
  /** XP d'une rencontre gagnée le matin (somme des ennemis de départ, sans invocation). */
  const encounterXp = (id: EncounterId): number =>
    ENCOUNTERS[id].enemies.reduce((sum, e) => {
      const tier = e.enemy === 'auditeur-quais' ? 'elite' : 'normal';
      return sum + enemyXp(e.level, tier, BALANCE.pause.morning.xpMult);
    }, 0);

  it('atteint le niveau 5 après une dizaine de combats, puis 6 avec l’Auditeur et les quêtes', () => {
    // 3 combats scénarisés : Borne (16) + Consultant (27) + 2 Post-it (54) = 97 XP → niveau 2.
    const scripted: readonly EncounterId[] = [
      'borne-rebelle',
      'consultant-junior',
      'post-it-vivant',
    ];
    // 7 groupes visibles (54 / 123 / 82 / 99 XP) : un peu moins de deux tours des 4 groupes.
    const groups: readonly EncounterId[] = [
      'patrouille-bornes',
      'post-its-couloir',
      'consultants-hall',
      'manager-kpi-quai',
      'patrouille-bornes',
      'post-its-couloir',
      'consultants-hall',
    ];
    let progress = { level: 1, xp: 0 };
    let total = 0;
    const levels: number[] = [];
    for (const id of [...scripted, ...groups]) {
      total += encounterXp(id);
      progress = gainXp(progress.level, progress.xp, encounterXp(id));
      levels.push(progress.level);
    }
    expect(encounterXp('borne-rebelle')).toBe(16);
    // Niveaux après chaque combat : 1, 2, 2, 2, 3, 3, 4, 4, 4, 5 (714 XP cumulés).
    expect(levels).toEqual([1, 2, 2, 2, 3, 3, 4, 4, 4, 5]);
    expect(total).toBe(714);
    // L'Auditeur des quais (élite niv. 7 : 303 XP) et 3 quêtes de l'Acte I (50 XP) → niveau 6 ;
    // le niveau 7 du GDD (§ 8.1) demande quelques groupes ou quêtes de plus.
    expect(encounterXp('audit-manager-kpi')).toBe(303);
    const quests = 3 * BALANCE.progression.QUEST_XP[1];
    const end = gainXp(progress.level, progress.xp, encounterXp('audit-manager-kpi') + quests);
    expect(end.level).toBe(6);
  });
});
