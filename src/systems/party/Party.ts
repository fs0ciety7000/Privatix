import { BALANCE } from '@/config/balance';
import { CHARACTERS } from '@/data/characters';
import { SKILLS } from '@/data/combat';
import type { ItemId, SkillDef, SkillId } from '@/data/combat';
import { ALLY_ORDER } from '@/data/types';
import type { AllyId, EncounterId, StoryFlag } from '@/data/types';
import type {
  BattleOutcome,
  BattleRewards,
  BattleSetup,
  BattleState,
  PartyMemberSetup,
} from '@/systems/combat/types';
import type { GameState } from '@/systems/GameState';
import { activeTimeModifiers } from '@/systems/GameState';
import { gainXp, statsAt } from '@/systems/party/Leveling';
import type { PartyMemberId } from '@/systems/party/Leveling';
import { applyLayoff } from '@/systems/story/Layoff';
import { addFatigue, finishCombat, shiftAt } from '@/systems/time/FatigueClock';
import { clamp } from '@/utils/math';

/**
 * Pont entre le jeu et le combat (pur) : composition de l'équipe, préparation d'un combat depuis le GameState,
 * et application du résultat (XP, niveaux, Tickets, PV, Fatigue, Mise à pied).
 */

const RECRUITED_FLAG: Readonly<Record<AllyId, StoryFlag>> = {
  josiane: 'josiane-recrutee',
  rudy: 'rudy-recrute',
  bene: 'bene-recrutee',
};

/** Collègues au plus dans l'équipe de terrain (GDD § 7.1). */
export const MAX_ALLIES = 2;

/** Héros + les deux premiers collègues recrutés (ordre : Josiane, Rudy, Béné). */
export function partyMembers(state: GameState): readonly PartyMemberId[] {
  const allies = ALLY_ORDER.filter((id) => state.flags[RECRUITED_FLAG[id]] === true).slice(
    0,
    MAX_ALLIES,
  );
  return ['heros', ...allies];
}

/** Compétences connues d'un membre à ce niveau (héros : par niveau ; collègues : d'office). */
export function skillsFor(member: PartyMemberId, level: number): readonly SkillId[] {
  return (Object.entries(SKILLS) as [SkillId, SkillDef][])
    .filter(([, def]) => def.owner === member && (def.learnLevel ?? 1) <= level)
    .map(([id]) => id);
}

function memberSetup(state: GameState, id: PartyMemberId): PartyMemberSetup {
  const level = state.player.level;
  const stats = statsAt(id, level);
  const vitals =
    id === 'heros'
      ? { hp: state.player.hp, pe: state.player.energy }
      : (state.allies[id] ?? { hp: stats.maxHp, pe: stats.maxPe });
  return {
    id,
    name: id === 'heros' ? state.player.name : CHARACTERS[id].name,
    sprite: id,
    level,
    hp: clamp(vitals.hp, 1, stats.maxHp),
    maxHp: stats.maxHp,
    pe: clamp(vitals.pe, 0, stats.maxPe),
    maxPe: stats.maxPe,
    // Outil du héros : la clé de tirefond (rang 0 « rouillée » en Acte I, GDD § 8.4). Les collègues ont un outil fixe.
    force: stats.force + (id === 'heros' ? BALANCE.economy.TIREFOND[0].force : 0),
    defense: stats.defense,
    speed: stats.speed,
    skills: skillsFor(id, level),
  };
}

export function buildBattleSetup(state: GameState, encounterId: EncounterId): BattleSetup {
  return {
    encounterId,
    party: partyMembers(state).map((id) => memberSetup(state, id)),
    fatigue: state.time.fatigue,
    moral: state.moral,
    shift: shiftAt(state.time.totalMinutes),
    inventory: state.inventory,
    gobelets: state.gobelets,
  };
}

/** Ce que le jeu retient d'un combat terminé (indépendant des détails internes du moteur). */
export interface BattleReport {
  readonly outcome: BattleOutcome;
  readonly rounds: number;
  /** Fatigue d'équipe à la fin du combat (Caféiné, Gobelets, objets inclus). */
  readonly fatigue: number;
  readonly members: readonly {
    readonly id: PartyMemberId;
    readonly hp: number;
    readonly pe: number;
    readonly ko: boolean;
    readonly demotivated: boolean;
  }[];
  readonly inventory: Readonly<Partial<Record<ItemId, number>>>;
  readonly gobelets: number;
  /** Récompenses (victoire seulement). */
  readonly rewards: BattleRewards | null;
}

const PARTY_IDS: readonly string[] = ['heros', ...ALLY_ORDER];

export function reportFromBattle(battle: BattleState, rewards: BattleRewards | null): BattleReport {
  if (battle.outcome === null) throw new Error('Combat non terminé');
  return {
    outcome: battle.outcome,
    rounds: battle.round,
    fatigue: battle.fatigue,
    members: battle.combatants
      .filter((c) => c.side === 'party' && PARTY_IDS.includes(c.id))
      .map((c) => ({
        id: c.id as PartyMemberId,
        hp: c.hp,
        pe: c.pe,
        ko: c.ko,
        demotivated: c.statuses.some((s) => s.id === 'demotive'),
      })),
    inventory: battle.inventory,
    gobelets: battle.gobelets,
    rewards,
  };
}

export interface BattleApplication {
  readonly state: GameState;
  readonly notices: readonly string[];
  /** Vrai si le combat est perdu : l'appelant joue le dialogue de Mise à pied et interrompt le sien. */
  readonly defeat: boolean;
}

/** Applique XP et montées de niveau ; les PV/PE max augmentent et les PV actuels avec eux. */
function applyXp(state: GameState, xp: number, notices: string[]): GameState {
  const before = state.player.level;
  const gained = gainXp(before, state.player.xp, xp);
  if (gained.levelsGained === 0) return { ...state, player: { ...state.player, xp: gained.xp } };

  const oldStats = statsAt('heros', before);
  const newStats = statsAt('heros', gained.level);
  notices.push(`Niveau ${String(gained.level)} !`);
  const learned = skillsFor('heros', gained.level).filter(
    (id) => !skillsFor('heros', before).includes(id),
  );
  for (const id of learned) notices.push(`Nouvelle compétence : ${SKILLS[id].name}`);

  const allies: Partial<Record<AllyId, { hp: number; pe: number }>> = {};
  for (const id of ALLY_ORDER) {
    const vitals = state.allies[id];
    if (!vitals) continue;
    const o = statsAt(id, before);
    const n = statsAt(id, gained.level);
    allies[id] = { hp: vitals.hp + n.maxHp - o.maxHp, pe: vitals.pe + n.maxPe - o.maxPe };
  }
  return {
    ...state,
    allies,
    player: {
      ...state.player,
      level: gained.level,
      xp: gained.xp,
      maxHp: newStats.maxHp,
      maxEnergy: newStats.maxPe,
      hp: state.player.hp + newStats.maxHp - oldStats.maxHp,
      energy: state.player.energy + newStats.maxPe - oldStats.maxPe,
    },
  };
}

/**
 * Applique un combat terminé au GameState.
 * - Victoire : récompenses, PV conservés (K.O. → 1 PV), Fatigue du combat puis coûts (+2, +1/3 manches, +10 min),
 *   Moral −1 si le héros finit Démotivé, groupe visible marqué vaincu (`encounterKey`).
 * - Fuite : pas de récompense, +5 Fatigue, +10 min.
 * - Défaite : Mise à pied (GDD § 5.8) ; l'équipe rentre soignée.
 */
export function applyBattleReport(
  state: GameState,
  report: BattleReport,
  encounterKey?: string,
): BattleApplication {
  const notices: string[] = [];
  const withFatigue: GameState = {
    ...state,
    time: addFatigue(state.time, report.fatigue - state.time.fatigue).state,
    inventory: report.inventory,
    gobelets: report.gobelets,
  };

  if (report.outcome === 'defeat') {
    const laidOff = applyLayoff(withFatigue);
    return {
      state: {
        ...laidOff,
        player: { ...laidOff.player, hp: laidOff.player.maxHp, energy: laidOff.player.maxEnergy },
        allies: {},
      },
      notices: ['Défaite : Mise à pied'],
      defeat: true,
    };
  }

  // PV et PE conservés ; un K.O. revient avec 1 PV (GDD § 5.5).
  let next: GameState = withFatigue;
  const allies: Partial<Record<AllyId, { hp: number; pe: number }>> = { ...next.allies };
  for (const m of report.members) {
    const hp = m.ko ? 1 : Math.max(1, m.hp);
    if (m.id === 'heros') next = { ...next, player: { ...next.player, hp, energy: m.pe } };
    else allies[m.id] = { hp, pe: m.pe };
  }
  next = { ...next, allies };

  const fled = report.outcome === 'fled';
  next = {
    ...next,
    time: finishCombat(next.time, { rounds: report.rounds, fled }, activeTimeModifiers(next)).state,
  };

  if (report.outcome === 'victory' && report.rewards) {
    const { xp, tickets, coffeeBeans } = report.rewards;
    notices.push(
      `Victoire : +${String(xp)} XP · +${String(tickets)} T${coffeeBeans > 0 ? ` · +${String(coffeeBeans)} Grains` : ''}`,
    );
    next = applyXp(next, xp, notices);
    next = {
      ...next,
      tickets: next.tickets + tickets,
      coffeeBeans: next.coffeeBeans + coffeeBeans,
    };
    if (encounterKey) {
      next = {
        ...next,
        defeatedEncounters: { ...next.defeatedEncounters, [encounterKey]: next.time.totalMinutes },
      };
    }
  }
  if (fled) notices.push('Fuite réussie');

  if (report.members.some((m) => m.id === 'heros' && m.demotivated)) {
    next = {
      ...next,
      moral: clamp(next.moral + BALANCE.moral.gains.endDemotivated, 0, BALANCE.moral.MAX),
    };
  }
  return { state: next, notices, defeat: false };
}
