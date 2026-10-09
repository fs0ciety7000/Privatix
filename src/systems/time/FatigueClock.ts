import { BALANCE } from '@/config/balance';
import type { ActNumber, FatigueTier, FatigueTierId, MachineLevel } from '@/config/balance';
import { Shift } from '@/config/constants';
import { clamp } from '@/utils/math';

/**
 * FatigueClock : horloge de service 3x8 et jauge de Fatigue partagée (docs/GDD.md § 4).
 *
 * Logique pure, sans Phaser : chaque fonction prend un état et renvoie un NOUVEL état
 * (jamais de mutation) accompagné des événements produits. La scène stocke l'état dans
 * le GameState du registry et ne fait qu'afficher.
 *
 * L'horloge est figée en menu, en dialogue et en combat : ce sont les scènes qui décident
 * d'appeler (ou non) `advanceTime`. Les coûts fixes (combat, café…) passent aussi par ici.
 */

export const MINUTES_PER_DAY = 1440;
const MINUTES_PER_SHIFT = 480;
const MS_PER_GAME_MINUTE = 1000 / BALANCE.clock.CLOCK_MIN_PER_REAL_SEC;

/** Repos de l'OCC déjà consommés pendant la pause en cours (1 fois par pause chacun). */
export interface RestUsage {
  readonly coffee: boolean;
  readonly nap: boolean;
  readonly sleep: boolean;
}

export interface FatigueClockState {
  /** Minutes écoulées depuis lundi 00:00 (jour 0). */
  readonly totalMinutes: number;
  readonly act: ActNumber;
  /** Fatigue d'équipe, 0 à 100, avec décimales (l'affichage arrondit à l'entier inférieur). */
  readonly fatigue: number;
  /** Vrai quand l'horloge est bloquée à la butée de relève de l'acte (« HEURES SUP' »). */
  readonly overtime: boolean;
  /** Index de la pause pour laquelle `restUsed` est valable (voir `shiftIndexAt`). */
  readonly restShiftIndex: number;
  readonly restUsed: RestUsage;
}

/** Modificateurs actifs sur les gains de Fatigue liés au temps (Thermos ×0,8, Lungo ×0,75…). */
export interface TimeModifiers {
  readonly timeMultipliers?: readonly number[];
}

export type ClockEvent =
  | { readonly type: 'shiftChanged'; readonly from: Shift; readonly to: Shift }
  | { readonly type: 'overtimeStarted' }
  | { readonly type: 'actStarted'; readonly act: ActNumber }
  | { readonly type: 'tierChanged'; readonly from: FatigueTierId; readonly to: FatigueTierId }
  | { readonly type: 'collapsed' };

export interface ClockResult {
  readonly state: FatigueClockState;
  readonly events: readonly ClockEvent[];
}

export type RestAction = keyof RestUsage;
export type RestRefusal = 'already-used' | 'no-bed';
export type RestResult =
  ({ readonly ok: true } & ClockResult) | { readonly ok: false; readonly reason: RestRefusal };

const NO_REST_USED: RestUsage = { coffee: false, nap: false, sleep: false };

// ---------------------------------------------------------------------------
// Lecture de l'horloge
// ---------------------------------------------------------------------------

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Jour depuis lundi (0 = lundi, 1 = mardi). */
export function dayOf(totalMinutes: number): number {
  return Math.floor(totalMinutes / MINUTES_PER_DAY);
}

/** Minute du jour, de 0 à 1439. */
export function minuteOfDay(totalMinutes: number): number {
  return mod(Math.floor(totalMinutes), MINUTES_PER_DAY);
}

/** Pause 3x8 correspondant à une minute (absolue ou du jour) : 06-14 matin, 14-22 après-midi, 22-06 nuit. */
export function shiftAt(totalMinutes: number): Shift {
  const minute = minuteOfDay(totalMinutes);
  if (minute >= BALANCE.clock.PAUSE_START.morning && minute < BALANCE.clock.PAUSE_START.afternoon) {
    return Shift.Morning;
  }
  if (minute >= BALANCE.clock.PAUSE_START.afternoon && minute < BALANCE.clock.PAUSE_START.night) {
    return Shift.Afternoon;
  }
  return Shift.Night;
}

/** Numéro unique de chaque pause depuis le début de la partie (lundi 06:00 = 0, la nuit précédente = -1). */
export function shiftIndexAt(totalMinutes: number): number {
  return Math.floor((totalMinutes - BALANCE.clock.PAUSE_START.morning) / MINUTES_PER_SHIFT);
}

/** "HH:MM". */
export function formatClock(totalMinutes: number): string {
  const minute = minuteOfDay(totalMinutes);
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

const SHIFT_LABELS: Readonly<Record<Shift, string>> = {
  [Shift.Morning]: 'Matin',
  [Shift.Afternoon]: 'Après-midi',
  [Shift.Night]: 'Nuit',
};

export function shiftLabel(shift: Shift): string {
  return SHIFT_LABELS[shift];
}

/** Butée de relève de l'acte (minute absolue), ou `null` pour l'acte III. */
export function overtimeCap(act: ActNumber): number | null {
  return act === 3 ? null : BALANCE.clock.OVERTIME_CAP[act];
}

// ---------------------------------------------------------------------------
// Fatigue
// ---------------------------------------------------------------------------

/** Palier de Fatigue. Seul point d'entrée autorisé pour lire les effets de la Fatigue (GDD § 4.3). */
export function fatigueTier(fatigue: number): FatigueTier {
  const value = Math.floor(clamp(fatigue, 0, BALANCE.fatigue.MAX));
  const tier = BALANCE.fatigue.tiers.find((t) => value >= t.min && value <= t.max);
  if (!tier) {
    throw new Error(`Aucun palier de Fatigue pour ${String(value)}`);
  }
  return tier;
}

/** Produit des multiplicateurs de temps, avec le plancher du GDD (×0,5). */
export function timeMultiplier(mods: TimeModifiers = {}): number {
  const product = (mods.timeMultipliers ?? []).reduce((acc, m) => acc * m, 1);
  return Math.max(BALANCE.fatigue.TIME_MULT_FLOOR, product);
}

/** Fatigue gagnée par minute in-game pendant une pause donnée. */
export function fatiguePerMinute(
  shift: Shift,
  overtime: boolean,
  mods: TimeModifiers = {},
): number {
  const overtimeMult = overtime ? BALANCE.fatigue.OVERTIME_MULT : 1;
  return (BALANCE.fatigue.PER_HOUR[shift] / 60) * overtimeMult * timeMultiplier(mods);
}

/** Fatigue d'une fin de combat : +2, plus +1 par tranche de 3 manches ; une fuite coûte +5. */
export function combatFatigueGain(rounds: number, fled: boolean): number {
  if (fled) return BALANCE.fatigue.FLEE;
  return (
    BALANCE.fatigue.COMBAT_BASE + Math.floor(Math.max(0, rounds) / 3) * BALANCE.fatigue.PER_3_ROUNDS
  );
}

/** Précision de stockage de la Fatigue : évite que 120 × 0,05 donne 5,999… et fasse rater un palier. */
const FATIGUE_PRECISION = 1e6;

/** Borne à [0, 100] et arrondit au millionième. */
function normalizeFatigue(value: number): number {
  return Math.round(clamp(value, 0, BALANCE.fatigue.MAX) * FATIGUE_PRECISION) / FATIGUE_PRECISION;
}

function withFatigue(state: FatigueClockState, fatigue: number): FatigueClockState {
  return { ...state, fatigue: normalizeFatigue(fatigue) };
}

/** Événements de palier et d'effondrement entre deux valeurs de Fatigue. */
function fatigueEvents(before: number, after: number): ClockEvent[] {
  const events: ClockEvent[] = [];
  const from = fatigueTier(before).id;
  const to = fatigueTier(after).id;
  if (from !== to) events.push({ type: 'tierChanged', from, to });
  if (before < BALANCE.fatigue.MAX && after >= BALANCE.fatigue.MAX)
    events.push({ type: 'collapsed' });
  return events;
}

/** Ajoute (ou retire, si négatif) de la Fatigue, bornée à [0, 100]. */
export function addFatigue(state: FatigueClockState, delta: number): ClockResult {
  const next = withFatigue(state, state.fatigue + delta);
  return { state: next, events: fatigueEvents(state.fatigue, next.fatigue) };
}

// ---------------------------------------------------------------------------
// Écoulement du temps
// ---------------------------------------------------------------------------

export function createFatigueClock(act: ActNumber = 1): FatigueClockState {
  const totalMinutes = BALANCE.clock.ACT_START_MINUTE[act];
  return {
    totalMinutes,
    act,
    fatigue: BALANCE.fatigue.START,
    overtime: false,
    restShiftIndex: shiftIndexAt(totalMinutes),
    restUsed: NO_REST_USED,
  };
}

/**
 * Convertit du temps réel en minutes in-game (1 min toutes les 8 s).
 * La scène conserve le reliquat `carryMs` entre deux frames.
 */
export function realMsToGameMinutes(elapsedMs: number): { minutes: number; carryMs: number } {
  const safeMs = Math.max(0, elapsedMs);
  const minutes = Math.floor(safeMs / MS_PER_GAME_MINUTE);
  return { minutes, carryMs: safeMs - minutes * MS_PER_GAME_MINUTE };
}

export interface AdvanceOptions extends TimeModifiers {
  /** `false` pendant le sommeil (sieste) : le temps passe sans fatiguer. Vrai par défaut. */
  readonly accrueFatigue?: boolean;
}

/**
 * Fait avancer l'horloge de `minutes` minutes in-game, minute par minute.
 * - Gagne de la Fatigue au taux de la pause en cours (×1,5 en heures sup', × multiplicateurs de temps).
 * - À la butée de relève de l'acte, l'horloge s'arrête (`overtime`) mais la Fatigue continue de monter.
 * - Change de pause en passant 06:00 / 14:00 / 22:00 et remet à zéro les repos de l'OCC.
 */
export function advanceTime(
  state: FatigueClockState,
  minutes: number,
  options: AdvanceOptions = {},
): ClockResult {
  const accrue = options.accrueFatigue ?? true;
  const cap = overtimeCap(state.act);
  const events: ClockEvent[] = [];

  let { totalMinutes, overtime, fatigue } = state;
  const startShift = shiftAt(totalMinutes);

  for (let i = 0; i < Math.floor(Math.max(0, minutes)); i += 1) {
    if (cap !== null && totalMinutes >= cap) {
      if (!overtime) {
        overtime = true;
        events.push({ type: 'overtimeStarted' });
      }
    } else {
      totalMinutes += 1;
    }
    if (accrue) {
      // La minute écoulée appartient à la pause qui la contient (minute qui vient de se terminer).
      const shift = shiftAt(overtime ? totalMinutes : totalMinutes - 1);
      fatigue = clamp(fatigue + fatiguePerMinute(shift, overtime, options), 0, BALANCE.fatigue.MAX);
    }
  }

  // Arriver pile sur la butée déclenche les heures sup' sans attendre la minute suivante.
  if (cap !== null && totalMinutes >= cap && !overtime) {
    overtime = true;
    events.push({ type: 'overtimeStarted' });
  }

  const endShift = shiftAt(totalMinutes);
  if (endShift !== startShift) {
    events.unshift({ type: 'shiftChanged', from: startShift, to: endShift });
  }

  const shiftIndex = shiftIndexAt(totalMinutes);
  const restReset = shiftIndex !== state.restShiftIndex;

  fatigue = normalizeFatigue(fatigue);
  const next: FatigueClockState = {
    ...state,
    totalMinutes,
    overtime,
    fatigue,
    restShiftIndex: shiftIndex,
    restUsed: restReset ? NO_REST_USED : state.restUsed,
  };
  return { state: next, events: [...events, ...fatigueEvents(state.fatigue, fatigue)] };
}

/** Fin de combat : Fatigue du combat (ou de la fuite), puis +10 min d'horloge. */
export function finishCombat(
  state: FatigueClockState,
  outcome: { readonly rounds: number; readonly fled: boolean },
  mods: TimeModifiers = {},
): ClockResult {
  const gained = addFatigue(state, combatFatigueGain(outcome.rounds, outcome.fled));
  const advanced = advanceTime(gained.state, BALANCE.clock.COST_MIN.combat, mods);
  return mergeEvents(gained, advanced);
}

/**
 * Événement de fin d'acte : l'horloge saute à la relève suivante (14:00 ou 22:00),
 * les heures sup' s'arrêtent et la relève retire sa Fatigue (Tasse de Relève −30, veillée −50).
 * Le choix de la boisson-buff est géré ailleurs.
 */
export function startNextAct(state: FatigueClockState): ClockResult {
  if (state.act === 3) {
    throw new Error("L'acte III est le dernier acte");
  }
  const act: ActNumber = state.act === 1 ? 2 : 3;
  const totalMinutes = BALANCE.clock.ACT_START_MINUTE[act];
  const recovery =
    act === 2 ? BALANCE.fatigue.recovery.RELEVE_14H : BALANCE.fatigue.recovery.VEILLEE_22H;

  const jumped: FatigueClockState = {
    ...state,
    act,
    totalMinutes,
    overtime: false,
    restShiftIndex: shiftIndexAt(totalMinutes),
    restUsed: NO_REST_USED,
  };
  const recovered = addFatigue(jumped, -recovery);

  const events: ClockEvent[] = [];
  const from = shiftAt(state.totalMinutes);
  const to = shiftAt(totalMinutes);
  if (from !== to) events.push({ type: 'shiftChanged', from, to });
  events.push({ type: 'actStarted', act });
  return { state: recovered.state, events: [...events, ...recovered.events] };
}

// ---------------------------------------------------------------------------
// Repos à l'OCC (1 fois par pause chacun, GDD § 4.2)
// ---------------------------------------------------------------------------

function markUsed(state: FatigueClockState, action: RestAction): FatigueClockState {
  return { ...state, restUsed: { ...state.restUsed, [action]: true } };
}

function mergeEvents(first: ClockResult, second: ClockResult): ClockResult {
  return { state: second.state, events: [...first.events, ...second.events] };
}

/** Café gratuit de l'OCC : −30/−45/−60 selon la machine (−10 de plus le matin), puis +10 min. */
export function drinkOccCoffee(
  state: FatigueClockState,
  machineLevel: MachineLevel,
  mods: TimeModifiers = {},
): RestResult {
  if (state.restUsed.coffee) return { ok: false, reason: 'already-used' };
  const { OCC_COFFEE, MORNING_COFFEE_BONUS } = BALANCE.fatigue.recovery;
  const base = OCC_COFFEE[machineLevel - 1] ?? OCC_COFFEE[0];
  const bonus = shiftAt(state.totalMinutes) === Shift.Morning ? MORNING_COFFEE_BONUS : 0;
  const drunk = addFatigue(markUsed(state, 'coffee'), -(base + bonus));
  return {
    ok: true,
    ...mergeEvents(drunk, advanceTime(drunk.state, BALANCE.clock.COST_MIN.occCoffee, mods)),
  };
}

/** Sieste sur le canapé de l'OCC : −40, l'horloge avance de 2 h sans fatiguer. */
export function takeNap(state: FatigueClockState): RestResult {
  if (state.restUsed.nap) return { ok: false, reason: 'already-used' };
  const rested = addFatigue(markUsed(state, 'nap'), -BALANCE.fatigue.recovery.NAP);
  const slept = advanceTime(rested.state, BALANCE.clock.COST_MIN.nap, { accrueFatigue: false });
  return { ok: true, ...mergeEvents(rested, slept) };
}

/** Dormir sur le lit de camp : Fatigue à 0, l'horloge saute à la butée de relève (heures sup'). */
export function sleepUntilCap(state: FatigueClockState): RestResult {
  if (state.restUsed.sleep) return { ok: false, reason: 'already-used' };
  const cap = overtimeCap(state.act);
  if (cap === null) return { ok: false, reason: 'no-bed' };
  const rested = addFatigue(markUsed(state, 'sleep'), -BALANCE.fatigue.MAX);
  const remaining = Math.max(0, cap - rested.state.totalMinutes);
  const slept = advanceTime(rested.state, remaining, { accrueFatigue: false });
  return { ok: true, ...mergeEvents(rested, slept) };
}
