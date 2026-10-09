import type { RewardKind } from '@/config/balance';
import { REWARD_WEIGHTS, SHIFT } from '@/config/balance';
import type { RoomTemplateId } from '@/systems/procedural/roomTemplates';
import { COMBAT_TEMPLATES } from '@/systems/procedural/roomTemplates';
import type { Rng } from '@/utils/rng';
import { createRng, randInt } from '@/utils/rng';

/**
 * Déroulé d'un Shift du MVP (biome 1 « Quais & Voies ») : salles 1 à 8 choisies par les portes,
 * puis la Salle des pauses et l'arène de l'Auditeur des Quais (GDD § 3).
 * Chaque porte annonce le type de salle et sa récompense. Tirage déterministe par graine et par salle.
 */

export type RoomType = 'combat' | 'elite' | 'tresor' | 'boutique' | 'repos' | 'boss';

/**
 * Récompense annoncée par une porte : celles de `REWARD_WEIGHTS`, plus la porte « Dotation » du loot
 * (GDD § 3.8), posée par la simulation 3D (`sim/loot`) sur les tirages de `doorsFor`.
 */
export type DoorReward = RewardKind | 'dotation';

export interface DoorChoice {
  /** Position dans le Shift (1 à 8, puis REST_ROOM, puis BOSS_ROOM). */
  readonly room: number;
  readonly type: RoomType;
  readonly reward: DoorReward | null;
}

export const REST_ROOM = SHIFT.BIOME1_ROOMS + 1;
export const BOSS_ROOM = SHIFT.BIOME1_ROOMS + 2;

/** Indice `r` de la salle (scaling, horloge) : la Salle des pauses garde celui de la salle précédente. */
export function roomIndex(room: number): number {
  if (room >= BOSS_ROOM) return SHIFT.BIOME1_ROOMS + 1;
  return Math.min(room, SHIFT.BIOME1_ROOMS);
}

const TRESOR_CHANCE = 0.18;

/** Générateur propre à une salle : la même graine donne toujours les mêmes portes. */
export function roomRng(seed: number, room: number, salt = 0): Rng {
  return createRng((seed * 7919 + room * 104729 + salt * 15485863) >>> 0);
}

export function rollReward(rng: Rng, exclude: readonly RewardKind[] = []): RewardKind {
  const entries = (Object.entries(REWARD_WEIGHTS) as [RewardKind, number][]).filter(
    ([k]) => !exclude.includes(k),
  );
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [kind, w] of entries) {
    roll -= w;
    if (roll < 0) return kind;
  }
  return entries[0]?.[0] ?? 'avantage';
}

/** Ce que le Shift a déjà proposé ou traversé (règles de garantie). */
export interface PlanHistory {
  readonly shopSeen: boolean;
  readonly elites: number;
  readonly tresorSeen: boolean;
  readonly previousType: RoomType | null;
}

/** Portes proposées pour entrer dans la salle `room`. */
export function doorsFor(seed: number, room: number, history: PlanHistory): DoorChoice[] {
  if (room === REST_ROOM) return [{ room, type: 'repos', reward: null }];
  if (room === BOSS_ROOM) return [{ room, type: 'boss', reward: null }];
  // Salle 1 : combat facile qui donne un Avantage (ancrer le build tôt).
  if (room <= 1) return [{ room: 1, type: 'combat', reward: 'avantage' }];
  // Dernière salle avant le repos : une seule porte.
  const rng = roomRng(seed, room);
  const count = room === SHIFT.BIOME1_ROOMS ? 1 : randInt(rng, SHIFT.DOORS[0], SHIFT.DOORS[1]);
  const doors: DoorChoice[] = [];

  const forced: RoomType[] = [];
  if (!history.shopSeen && room === SHIFT.SHOP_LAST) forced.push('boutique');
  if (history.elites === 0 && room === SHIFT.ELITE_LAST && history.previousType !== 'elite')
    forced.push('elite');
  if (!history.tresorSeen && room === SHIFT.BIOME1_ROOMS - 1) forced.push('tresor');
  for (const type of forced.slice(0, count)) {
    doors.push({
      room,
      type,
      reward: type === 'elite' || type === 'combat' ? rollReward(rng) : null,
    });
  }

  for (let guard = 0; doors.length < count && guard < 32; guard += 1) {
    const has = (t: RoomType): boolean => doors.some((d) => d.type === t);
    const roll = rng();
    let type: RoomType = 'combat';
    const eliteOk =
      room >= SHIFT.ELITE_FROM_ROOM &&
      history.elites < 2 &&
      history.previousType !== 'elite' &&
      !has('elite');
    const shopOk =
      !history.shopSeen && room >= SHIFT.SHOP_FIRST && room <= SHIFT.SHOP_LAST && !has('boutique');
    if (eliteOk && roll < SHIFT.ELITE_CHANCE) type = 'elite';
    else if (shopOk && roll > 1 - 0.25) type = 'boutique';
    else if (!has('tresor') && history.previousType !== 'tresor' && roll > 1 - 0.25 - TRESOR_CHANCE)
      type = 'tresor';
    const used = doors.map((d) => d.reward).filter((r): r is RewardKind => r !== null);
    const reward = type === 'combat' || type === 'elite' ? rollReward(rng, used) : null;
    if (doors.some((d) => d.type === type && d.reward === reward)) continue;
    doors.push({ room, type, reward });
  }
  return doors;
}

/** Gabarit de la salle à construire. */
export function templateFor(seed: number, room: number, type: RoomType): RoomTemplateId {
  switch (type) {
    case 'repos':
      return 'repos';
    case 'boss':
      return 'arene-auditeur';
    case 'boutique':
      return 'friterie';
    case 'tresor':
      return 'tresor';
    default: {
      // Sac mélangé une fois par Shift : deux salles consécutives n'ont jamais le même gabarit.
      const rng = createRng(seed ^ 0x5bd1e995);
      const bag = [...COMBAT_TEMPLATES];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = bag[i];
        bag[i] = bag[j] ?? 'quai-1';
        bag[j] = tmp ?? 'quai-1';
      }
      return bag[room % bag.length] ?? 'quai-1';
    }
  }
}

/** Heure affichée sur l'horloge du Shift (« 07:30 »), d'après les minutes écoulées. */
export function clockLabel(startHour: number, minutes: number): string {
  const total = startHour * 60 + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
