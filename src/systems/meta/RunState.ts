import type { ShiftDef, ShiftId } from '@/config/balance';
import { COFFEE, HERO, REWARDS, SHIFT, SHIFTS } from '@/config/balance';
import { BurnoutMeter } from '@/systems/combat/Burnout';
import { DashCharges } from '@/systems/combat/DashCharges';
import { Mobilisation } from '@/systems/combat/Mobilisation';
import type { HeroMods, OwnedAvantage } from '@/systems/meta/Avantages';
import { baseMods, computeMods } from '@/systems/meta/Avantages';
import type { Loadout, MetaState } from '@/systems/meta/MetaState';
import { loadoutOf } from '@/systems/meta/MetaState';
import type { RoomType } from '@/systems/procedural/ShiftPlan';
import { BOSS_ROOM, roomIndex } from '@/systems/procedural/ShiftPlan';

/**
 * État d'un Shift en cours (perdu à la mort, sauf les PS et Grains gagnés qui sont « acquis »).
 * Mutable et pur : RunScene le fait évoluer, le HUD le lit via un instantané.
 */
export interface RunState {
  readonly seed: number;
  readonly shift: ShiftDef;
  readonly loadout: Loadout;
  room: number;
  roomType: RoomType;
  /** Minutes écoulées depuis le début du Shift (30 par salle franchie). */
  minutes: number;
  /** Minutes de « retard » cumulées par les dashs (gag de la LED, sans effet). */
  delayMinutes: number;
  energy: number;
  /** Séquelles cumulées des Pétages de plombs. */
  maxEnergyPenalty: number;
  gobelets: number;
  tickets: number;
  psEarned: number;
  grainsEarned: number;
  kills: number;
  avantages: OwnedAvantage[];
  mods: HeroMods;
  reviveUsed: boolean;
  shopSeen: boolean;
  tresorSeen: boolean;
  elites: number;
  /** Salle gardée traversée dans le biome en cours (3D, biomes 2 et 3). */
  gardeeSeen: boolean;
  /** Boss vaincus pendant ce Shift (3D : un par biome). */
  bossesDefeated: number;
  previousType: RoomType | null;
  /** Ennemi qui a porté le dernier coup (écran des départs : « cause : Consultant Junior »). */
  lastHitBy: string | null;
  readonly burnout: BurnoutMeter;
  readonly mobilisation: Mobilisation;
  readonly dash: DashCharges;
  /**
   * Contributions extérieures aux Avantages (équipement du loot, entrée 3D) : ajoutées au socle des
   * modificateurs à chaque `refreshMods`, dans le même seau additif que la méta. `null` sans loot.
   */
  modsHook: ((base: HeroMods) => void) | null;
}

export function createRun(meta: MetaState, shiftId: ShiftId, seed: number): RunState {
  const loadout = loadoutOf(meta);
  const shift = SHIFTS[shiftId];
  const burnout = new BurnoutMeter(0);
  burnout.extraDecayPerS = loadout.burnoutDecayBonus;
  const run: RunState = {
    seed,
    shift,
    loadout,
    room: 1,
    roomType: 'combat',
    minutes: 0,
    delayMinutes: 0,
    energy: 0,
    maxEnergyPenalty: 0,
    gobelets: Math.min(COFFEE.MAX, COFFEE.START + loadout.gobeletsBonus),
    tickets: loadout.tickets,
    psEarned: 0,
    grainsEarned: 0,
    kills: 0,
    avantages: [],
    mods: baseMods(),
    reviveUsed: false,
    shopSeen: false,
    tresorSeen: false,
    elites: 0,
    gardeeSeen: false,
    bossesDefeated: 0,
    previousType: null,
    lastHitBy: null,
    burnout,
    mobilisation: new Mobilisation(loadout.mobilisation),
    dash: new DashCharges(),
    modsHook: null,
  };
  refreshMods(run);
  run.energy = maxEnergy(run);
  return run;
}

/** Recalcule les modificateurs (méta + Avantages) et les charges de dash. */
export function refreshMods(run: RunState): void {
  const base = baseMods();
  base.damageBonus += run.loadout.damageBonus;
  base.dashCharges += run.loadout.dashCharges;
  run.modsHook?.(base);
  run.mods = computeMods(base, run.avantages);
  run.dash.max = Math.max(1, 2 + run.mods.dashCharges);
}

export function maxEnergy(run: RunState): number {
  const raw =
    HERO.MAX_ENERGY + run.loadout.maxEnergyBonus + run.mods.maxEnergy - run.maxEnergyPenalty;
  return Math.max(HERO.MIN_MAX_ENERGY, raw);
}

export function hoursElapsed(run: RunState): number {
  return run.minutes / 60;
}

/** Ajoute des PS avec le multiplicateur du Shift. */
export function earnPs(run: RunState, base: number): number {
  const gained = Math.round(base * run.shift.psMult);
  run.psEarned += gained;
  return gained;
}

export function heal(run: RunState, amount: number): number {
  const before = run.energy;
  run.energy = Math.min(maxEnergy(run), run.energy + amount);
  return run.energy - before;
}

/**
 * Entrée dans une salle : l'horloge avance de 30 min par salle comptée (la Salle des pauses ne compte pas :
 * « la pause n'est pas du temps de travail effectif ») et le plancher de Burnout remonte.
 */
export function enterRoom(run: RunState, room: number, type: RoomType): void {
  run.minutes = SHIFT.MINUTES_PER_ROOM * (roomIndex(room) - 1);
  run.previousType = room === run.room ? run.previousType : run.roomType;
  run.room = room;
  run.roomType = type;
  if (type === 'boutique') run.shopSeen = true;
  if (type === 'tresor') run.tresorSeen = true;
  if (type === 'elite') run.elites += 1;
  if (type === 'gardee') run.gardeeSeen = true;
  run.burnout.setFloor(hoursElapsed(run), run.shift.floorMult);
}

/**
 * Changement de biome (3D) : les garanties de génération (Friterie, Élite, café, Salle gardée) valent
 * par biome (GDD § 3.4) ; le reste du Shift (Avantages, Gobelets, Tickets, Burnout) continue.
 */
export function enterBiome(run: RunState): void {
  run.shopSeen = false;
  run.tresorSeen = false;
  run.elites = 0;
  run.gardeeSeen = false;
  run.previousType = null;
}

export type ShiftEnd = 'victoire' | 'mort';

export interface ShiftResult {
  readonly end: ShiftEnd;
  readonly shift: ShiftId;
  readonly room: number;
  readonly clock: number;
  readonly psEarned: number;
  readonly grainsEarned: number;
  readonly kills: number;
  readonly avantages: number;
  readonly cause: string | null;
  /** Boss vaincus pendant le Shift (absent : version Phaser, déduit de l'issue). */
  readonly bosses?: number;
}

/** Bilan de fin de Shift : prime d'ancienneté à la mort, prime de fin de service en cas de victoire. */
export function finishRun(run: RunState, end: ShiftEnd): ShiftResult {
  if (end === 'mort') {
    earnPs(run, REWARDS.PS_PER_ROOM_REACHED_ON_DEATH * roomIndex(run.room));
  } else {
    earnPs(run, REWARDS.PS_SHIFT_COMPLETE);
    run.grainsEarned *= REWARDS.GRAINS_VICTORY_MULT;
  }
  return {
    end,
    shift: run.shift.id,
    room: run.room,
    clock: run.minutes,
    psEarned: run.psEarned,
    grainsEarned: run.grainsEarned,
    kills: run.kills,
    avantages: run.avantages.length,
    cause: end === 'mort' ? run.lastHitBy : null,
    ...(run.bossesDefeated > 0 ? { bosses: run.bossesDefeated } : {}),
  };
}

/** Applique un bilan à la méta (les PS et Grains sont gardés à 100 %, mort comprise). */
export function applyResult(meta: MetaState, result: ShiftResult): MetaState {
  const s = meta.stats;
  return {
    ...meta,
    ps: meta.ps + result.psEarned,
    grains: meta.grains + result.grainsEarned,
    stats: {
      shifts: s.shifts + 1,
      deaths: s.deaths + (result.end === 'mort' ? 1 : 0),
      bossKills:
        s.bossKills +
        (result.bosses ?? (result.end === 'victoire' && result.room >= BOSS_ROOM ? 1 : 0)),
      bestRoom: Math.max(s.bestRoom, result.room),
      totalKills: s.totalKills + result.kills,
    },
  };
}
