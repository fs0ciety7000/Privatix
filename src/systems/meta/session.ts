import { RegistryKeys } from '@/config/constants';
import type { MetaState } from '@/systems/meta/MetaState';
import { isMetaState } from '@/systems/meta/MetaState';

/** Sous-ensemble du DataManager Phaser (le registry s'y conforme ; testable sans Phaser). */
export interface DataStore {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

export function getMeta(registry: DataStore): MetaState {
  const value = registry.get(RegistryKeys.Meta);
  if (!isMetaState(value))
    throw new Error('MetaState absent du registry (BootScene non exécutée ?)');
  return value;
}

export function setMeta(registry: DataStore, meta: MetaState): void {
  registry.set(RegistryKeys.Meta, meta);
}

/** Bandeau d'information. `seq` distingue deux textes identiques consécutifs. */
export interface Notice {
  readonly seq: number;
  readonly text: string;
  readonly color?: string;
}

export function isNotice(value: unknown): value is Notice {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<Notice>).seq === 'number' &&
    typeof (value as Partial<Notice>).text === 'string'
  );
}

export function pushNotice(registry: DataStore, text: string, color?: string): void {
  const previous = registry.get(RegistryKeys.Notice);
  const seq = isNotice(previous) ? previous.seq + 1 : 1;
  registry.set(RegistryKeys.Notice, color === undefined ? { seq, text } : { seq, text, color });
}

/** Instantané publié par RunScene à chaque frame utile, lu par le HUD. */
export interface HudSnapshot {
  readonly energy: number;
  readonly maxEnergy: number;
  readonly burnout: number;
  readonly burnoutFloor: number;
  readonly burnoutTier: string;
  readonly meltdownMs: number;
  readonly mobilisation: number;
  readonly dashCharges: number;
  readonly dashMax: number;
  readonly dashProgress: number;
  readonly gobelets: number;
  readonly tickets: number;
  readonly ps: number;
  readonly clock: string;
  readonly delay: number;
  readonly room: number;
  readonly roomLabel: string;
  readonly enemiesLeft: number;
  readonly boss: { readonly name: string; readonly hp: number; readonly maxHp: number } | null;
  readonly shield: boolean;
}

/** Commandes tactiles publiées par l'UIScene. */
export interface TouchState {
  /** Direction du joystick (norme ≤ 1). */
  readonly moveX: number;
  readonly moveY: number;
  /** Compteurs d'appuis : un changement = un nouvel appui. */
  readonly attack: number;
  readonly dash: number;
  readonly special: number;
  readonly coffee: number;
  readonly interact: number;
  /** Bouton spécial maintenu (Préavis de grève). */
  readonly specialHeld: boolean;
}

export const NO_TOUCH: TouchState = {
  moveX: 0,
  moveY: 0,
  attack: 0,
  dash: 0,
  special: 0,
  coffee: 0,
  interact: 0,
  specialHeld: false,
};
