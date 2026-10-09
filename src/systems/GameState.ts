import { BALANCE } from '@/config/balance';
import type { MachineLevel } from '@/config/balance';
import { STARTING_INVENTORY } from '@/data/combat';
import type { ItemId } from '@/data/combat';
import { MAPS } from '@/data/maps';
import { NEW_GAME_START } from '@/data/story';
import type { AllyId, DrinkId, Facing, MapId, StoryFlag } from '@/data/types';
import type { FatigueClockState, TimeModifiers } from '@/systems/time/FatigueClock';
import { createFatigueClock, shiftIndexAt } from '@/systems/time/FatigueClock';
import { buildWorldMap, findSpawn } from '@/systems/world/WorldMap';

/**
 * État global du jeu, stocké dans le registry Phaser et sérialisé tel quel dans la sauvegarde.
 * Logique pure : aucune dépendance à Phaser, donc testable avec Vitest.
 * Toujours remplacer l'objet (jamais le muter) pour que le registry émette `changedata`.
 */
export interface PlayerState {
  readonly name: string;
  /** Niveau du héros, partagé par les collègues (GDD § 7.1). */
  readonly level: number;
  /** XP accumulée vers le niveau suivant. */
  readonly xp: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly energy: number;
  readonly maxEnergy: number;
}

export interface PositionState {
  readonly mapId: MapId;
  readonly tileX: number;
  readonly tileY: number;
  readonly facing: Facing;
}

/** Boisson de la Tasse de Relève, valable pour la pause où elle a été choisie (GDD § 4.5). */
export interface DrinkState {
  readonly id: DrinkId;
  readonly shiftIndex: number;
}

/** PV et PE conservés d'un combat à l'autre pour un collègue (absent = au maximum). */
export interface AllyVitals {
  readonly hp: number;
  readonly pe: number;
}

export interface GameState {
  /** Version du schéma de sauvegarde, à incrémenter à chaque changement incompatible (voir SaveManager). */
  readonly version: 2;
  /** Horloge 3x8 et Fatigue d'équipe (partagée par tous les personnages). */
  readonly time: FatigueClockState;
  readonly player: PlayerState;
  readonly position: PositionState;
  readonly flags: Readonly<Partial<Record<StoryFlag, boolean>>>;
  /** Moral collectif de l'OCC, 0 à 100. */
  readonly moral: number;
  /** Monnaie (T). */
  readonly tickets: number;
  readonly drink: DrinkState | null;
  readonly occMachineLevel: MachineLevel;
  readonly allies: Readonly<Partial<Record<AllyId, AllyVitals>>>;
  /** Inventaire commun (consommables), max 9 par objet. */
  readonly inventory: Readonly<Partial<Record<ItemId, number>>>;
  /** Gobelets de l'OCC (action « Café » en combat), remplis à la Vieille Dame une fois par pause. */
  readonly gobelets: number;
  /** Pause du dernier remplissage des Gobelets (index de `shiftIndexAt`), ou null. */
  readonly gobeletsShiftIndex: number | null;
  /** Grains de café (amélioration de la machine de l'OCC). */
  readonly coffeeBeans: number;
  /** Groupes d'ennemis visibles vaincus : clé de marqueur → minute in-game de la victoire. */
  readonly defeatedEncounters: Readonly<Record<string, number>>;
}

/** Position d'un point d'arrivée nommé ; lève une erreur si la carte ne le contient pas. */
export function spawnPosition(mapId: MapId, spawn: string): PositionState {
  const found = findSpawn(buildWorldMap(MAPS[mapId]), spawn);
  if (!found) throw new Error(`Point d'arrivée « ${spawn} » introuvable sur ${mapId}`);
  return { mapId, ...found };
}

export function createInitialGameState(heroName = 'Léon'): GameState {
  return {
    version: 2,
    time: createFatigueClock(1),
    player: {
      name: heroName,
      level: 1,
      xp: 0,
      hp: BALANCE.progression.HERO.hp[0],
      maxHp: BALANCE.progression.HERO.hp[0],
      energy: BALANCE.progression.HERO.pe[0],
      maxEnergy: BALANCE.progression.HERO.pe[0],
    },
    position: spawnPosition(NEW_GAME_START.map, NEW_GAME_START.spawn),
    flags: {},
    moral: BALANCE.moral.START,
    tickets: 0,
    drink: null,
    occMachineLevel: 1,
    allies: {},
    inventory: { ...STARTING_INVENTORY },
    gobelets: 0,
    gobeletsShiftIndex: null,
    coffeeBeans: 0,
    defeatedEncounters: {},
  };
}

/** Boisson active si elle a été choisie pendant la pause en cours. */
export function activeDrink(state: GameState): DrinkId | null {
  return state.drink?.shiftIndex === shiftIndexAt(state.time.totalMinutes) ? state.drink.id : null;
}

/** Multiplicateurs de Fatigue liée au temps actifs (Lungo ×0,75 ; Thermos à venir avec l'inventaire). */
export function activeTimeModifiers(state: GameState): TimeModifiers {
  return activeDrink(state) === 'lungo'
    ? { timeMultipliers: [BALANCE.fatigue.timeMult.lungo] }
    : {};
}

// ---------------------------------------------------------------------------
// Validation (registry et sauvegardes)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

function isTime(v: unknown): boolean {
  if (!isRecord(v) || !isRecord(v.restUsed)) return false;
  const rest = v.restUsed;
  return (
    isNumber(v.totalMinutes) &&
    (v.act === 1 || v.act === 2 || v.act === 3) &&
    isNumber(v.fatigue) &&
    isBool(v.overtime) &&
    isNumber(v.restShiftIndex) &&
    isBool(rest.coffee) &&
    isBool(rest.nap) &&
    isBool(rest.sleep)
  );
}

function isPlayer(v: unknown): boolean {
  return (
    isRecord(v) &&
    typeof v.name === 'string' &&
    ['level', 'xp', 'hp', 'maxHp', 'energy', 'maxEnergy'].every((k) => isNumber(v[k]))
  );
}

function isPosition(v: unknown): boolean {
  return (
    isRecord(v) &&
    typeof v.mapId === 'string' &&
    Object.hasOwn(MAPS, v.mapId) &&
    isNumber(v.tileX) &&
    isNumber(v.tileY) &&
    ['up', 'down', 'left', 'right'].includes(v.facing as string)
  );
}

/** Garde de type complète : sert au registry et à la validation des sauvegardes chargées. */
export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  const drink = value.drink;
  const drinkOk =
    drink === null ||
    (isRecord(drink) && typeof drink.id === 'string' && isNumber(drink.shiftIndex));
  const numberRecord = (v: unknown): boolean => isRecord(v) && Object.values(v).every(isNumber);
  const alliesOk =
    isRecord(value.allies) &&
    Object.values(value.allies).every((a) => isRecord(a) && isNumber(a.hp) && isNumber(a.pe));
  return (
    value.version === 2 &&
    isTime(value.time) &&
    isPlayer(value.player) &&
    isPosition(value.position) &&
    isRecord(value.flags) &&
    Object.values(value.flags).every(isBool) &&
    isNumber(value.moral) &&
    isNumber(value.tickets) &&
    drinkOk &&
    [1, 2, 3].includes(value.occMachineLevel as number) &&
    alliesOk &&
    numberRecord(value.inventory) &&
    isNumber(value.gobelets) &&
    (value.gobeletsShiftIndex === null || isNumber(value.gobeletsShiftIndex)) &&
    isNumber(value.coffeeBeans) &&
    numberRecord(value.defeatedEncounters)
  );
}
