import type { RewardKind } from '@/config/balance';
import { REWARD_WEIGHTS, SHIFT } from '@/config/balance';
import type { BiomeIndex, RoomTemplateId } from '@/systems/procedural/roomTemplates';
import { BIOME_ARENAS, BIOME_COMBAT_TEMPLATES } from '@/systems/procedural/roomTemplates';
import type { Rng } from '@/utils/rng';
import { createRng, randInt } from '@/utils/rng';

/**
 * Déroulé d'un Shift (GDD § 3) : trois biomes à la suite, « Quais & Voies » (8 salles), « La
 * Passerelle » (8 salles, Salle gardée du Fluidifieur en salle 8) et « Hall & BAG » (9 salles, Salle
 * gardée du Discosaure entre 5 et 7). Chaque biome finit par la Salle des pauses puis son boss
 * (Auditeur des Quais, Elio Di Rupo, Jean-Cul Lurcke). Chaque porte annonce le type de salle et sa
 * récompense. Tirage déterministe par graine et par salle.
 *
 * Numérotation : `room` est la position dans le Shift, tous biomes confondus. Biome 1 : 1 à 8, pauses
 * 9, boss 10 (inchangé : la version Phaser s'arrête là) ; biome 2 : 11 à 18, pauses 19, boss 20 ;
 * biome 3 : 21 à 29, pauses 30, boss 31. L'indice de scaling `r` suit le GDD § 3.2 (`roomIndex`).
 */

export type RoomType = 'combat' | 'elite' | 'gardee' | 'tresor' | 'boutique' | 'repos' | 'boss';

/**
 * Récompense annoncée par une porte : celles de `REWARD_WEIGHTS`, plus la porte « Dotation » du loot
 * (GDD § 3.8), posée par la simulation 3D (`sim/loot`) sur les tirages de `doorsFor`.
 */
export type DoorReward = RewardKind | 'dotation';

export interface DoorChoice {
  /** Position dans le Shift (voir la numérotation ci-dessus). */
  readonly room: number;
  readonly type: RoomType;
  readonly reward: DoorReward | null;
}

/** Nombre de biomes d'un Shift complet. */
export const BIOME_COUNT = SHIFT.BIOME_ROOMS.length;

function roomsIn(biome: number): number {
  return SHIFT.BIOME_ROOMS[biome] ?? SHIFT.BIOME1_ROOMS;
}

/** Première salle (position dans le Shift) d'un biome. */
export function firstRoomOf(biome: number): number {
  let room = 1;
  for (let b = 0; b < biome; b += 1) room += roomsIn(b) + 2;
  return room;
}

/** Salle des pauses d'un biome. */
export function restRoomOf(biome: number): number {
  return firstRoomOf(biome) + roomsIn(biome);
}

/** Arène du boss d'un biome. */
export function bossRoomOf(biome: number): number {
  return restRoomOf(biome) + 1;
}

/** Salle des pauses et boss du biome 1 (la version Phaser s'arrête au boss 1). */
export const REST_ROOM = restRoomOf(0);
export const BOSS_ROOM = bossRoomOf(0);
/** Dernier boss du Shift : sa défaite donne la victoire. */
export const FINAL_BOSS_ROOM = bossRoomOf(BIOME_COUNT - 1);

/** Biome d'une salle (0, 1 ou 2). */
export function biomeOf(room: number): BiomeIndex {
  for (let b = BIOME_COUNT - 1; b > 0; b -= 1) {
    if (room >= firstRoomOf(b)) return b as BiomeIndex;
  }
  return 0;
}

/** Position de la salle dans son biome (1 = première salle, N + 1 = pauses, N + 2 = boss). */
export function localRoom(room: number): number {
  return room - firstRoomOf(biomeOf(room)) + 1;
}

/** Nombre de salles générées dans le biome de `room`. */
export function biomeRoomCount(room: number): number {
  return roomsIn(biomeOf(room));
}

/**
 * Indice `r` de la salle (GDD § 3.2 : scaling, horloge) : 1 à 8 puis boss 9 ; 10 à 17 puis boss 18 ;
 * 19 à 27 puis boss 28. La Salle des pauses garde celui de la salle précédente.
 */
export function roomIndex(room: number): number {
  const biome = biomeOf(Math.max(1, room));
  let base = 0;
  for (let b = 0; b < biome; b += 1) base += roomsIn(b) + 1;
  const n = roomsIn(biome);
  const local = Math.max(1, room - firstRoomOf(biome) + 1);
  if (local <= n) return base + local;
  if (local === n + 1) return base + n;
  return base + n + 1;
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

/** Ce que le biome en cours a déjà proposé ou traversé (règles de garantie, remises à zéro par biome). */
export interface PlanHistory {
  readonly shopSeen: boolean;
  readonly elites: number;
  readonly tresorSeen: boolean;
  readonly previousType: RoomType | null;
  /** Salle gardée déjà traversée dans ce biome. */
  readonly gardeeSeen?: boolean;
}

/** Portes proposées pour entrer dans la salle `room`. */
export function doorsFor(seed: number, room: number, history: PlanHistory): DoorChoice[] {
  const biome = biomeOf(room);
  const n = roomsIn(biome);
  const local = localRoom(room);
  if (local === n + 1) return [{ room, type: 'repos', reward: null }];
  if (local >= n + 2) return [{ room, type: 'boss', reward: null }];
  // Première salle d'un biome : combat facile qui donne un Avantage (ancrer le build tôt).
  if (local <= 1) return [{ room, type: 'combat', reward: 'avantage' }];
  // Biome 2 : la dernière salle est la Salle gardée du Fluidifieur, seule porte (GDD § 3.4 règle 4).
  if (biome === 1 && local === n) return [{ room, type: 'gardee', reward: null }];
  const rng = roomRng(seed, room);
  const gardeeHere = biome === 2 && !history.gardeeSeen;
  // Dernière salle avant le repos, ou dernière chance de la Salle gardée garantie : une seule porte.
  const lastChance = gardeeHere && local === SHIFT.GARDEE_LAST && history.previousType !== 'gardee';
  const count = local === n || lastChance ? 1 : randInt(rng, SHIFT.DOORS[0], SHIFT.DOORS[1]);
  const doors: DoorChoice[] = [];

  const forced: RoomType[] = [];
  if (!history.shopSeen && local === SHIFT.SHOP_LAST) forced.push('boutique');
  if (gardeeHere && local === SHIFT.GARDEE_LAST && history.previousType !== 'gardee')
    forced.push('gardee');
  // Biome 1 : élite garantie en 5 à 7 ; biome 3 : la Salle gardée la remplace.
  if (
    biome === 0 &&
    history.elites === 0 &&
    local === SHIFT.ELITE_LAST &&
    history.previousType !== 'elite'
  )
    forced.push('elite');
  if (!history.tresorSeen && local === n - 1) forced.push('tresor');
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
      local >= SHIFT.ELITE_FROM_ROOM &&
      history.elites < 2 &&
      history.previousType !== 'elite' &&
      // Biome 2 : une Élite facultative reste possible en 5 à 6 seulement.
      (biome !== 1 || local <= SHIFT.ELITE_LAST - 1) &&
      !has('elite');
    const gardeeOk =
      gardeeHere &&
      local >= SHIFT.GARDEE_FIRST &&
      local <= SHIFT.GARDEE_LAST &&
      history.previousType !== 'gardee' &&
      !has('gardee');
    const shopOk =
      !history.shopSeen &&
      local >= SHIFT.SHOP_FIRST &&
      local <= SHIFT.SHOP_LAST &&
      !has('boutique');
    if (gardeeOk && roll < SHIFT.GARDEE_CHANCE) type = 'gardee';
    else if (eliteOk && roll < SHIFT.ELITE_CHANCE) type = 'elite';
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
  const biome = biomeOf(room);
  switch (type) {
    case 'repos':
      return 'repos';
    case 'boss':
      return BIOME_ARENAS[biome].boss;
    case 'gardee':
      return BIOME_ARENAS[biome].gardee ?? BIOME_ARENAS[biome].boss;
    case 'boutique':
      return 'friterie';
    case 'tresor':
      return 'tresor';
    default: {
      // Sac mélangé une fois par Shift et par biome : deux salles consécutives n'ont jamais le même
      // gabarit (le biome 1 garde le tirage d'origine).
      const pool = BIOME_COMBAT_TEMPLATES[biome];
      const rng = createRng((seed ^ 0x5bd1e995) + biome * 0x9e3779b1);
      const bag = [...pool];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = bag[i];
        bag[i] = bag[j] ?? pool[0] ?? 'quai-1';
        bag[j] = tmp ?? pool[0] ?? 'quai-1';
      }
      return bag[room % bag.length] ?? pool[0] ?? 'quai-1';
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
