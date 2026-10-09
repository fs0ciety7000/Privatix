import type { DropSource, ItemRarity, LootEnemyKind, SlotId } from '@/config/loot';
import { DROP_COUNTS, KILL_DROP_CHANCE, LOOT_RULES, RARITY_WEIGHTS } from '@/config/loot';
import type { LootCursor, RollContext, RollOptions } from '@/systems/loot/roll';
import { drawSlot, rollItem } from '@/systems/loot/roll';
import { pickRarity } from '@/systems/loot/rarity';
import type { ItemInstance, LootPity, LootRunState } from '@/systems/loot/types';
import { roomIndex, roomRng } from '@/systems/procedural/ShiftPlan';
import type { Rng } from '@/utils/rng';

/** Contexte d'un drop en jeu : la graine du Shift et la salle donnent un flux seedé dédié. */
export interface DropContext extends Omit<RollContext, 'source' | 'r' | 'room'> {
  readonly seed: number;
  /** Numéro de la salle (porte franchie). */
  readonly room: number;
  /** Indice `r` ; par défaut `roomIndex(room)`. */
  readonly r?: number;
}

export interface DropResult extends LootCursor {
  readonly items: readonly ItemInstance[];
}

/** Base du sel des flux de loot : `roomRng(seed, room, 1000 + n)` (portes et gabarits : 0 à 999). */
export const LOOT_SALT = 1000;

/**
 * Prochain générateur du flux de loot de la salle. Le compteur par salle rend chaque tirage
 * indépendant des autres systèmes (portes, gabarits, Avantages) : ils n'en consomment jamais.
 */
export function nextLootRng(
  seed: number,
  room: number,
  run: LootRunState,
): { rng: Rng; run: LootRunState } {
  const n = run.dropIndexByRoom[room] ?? 0;
  return {
    rng: roomRng(seed, room, LOOT_SALT + n),
    run: { ...run, dropIndexByRoom: { ...run.dropIndexByRoom, [room]: n + 1 } },
  };
}

function rollCtx(ctx: DropContext, source: DropSource): RollContext {
  return { ...ctx, source, r: ctx.r ?? roomIndex(ctx.room), room: ctx.room };
}

function rollMany(
  ctx: DropContext,
  cursor: LootCursor,
  plan: readonly { readonly source: DropSource; readonly opts: RollOptions }[],
): DropResult {
  let run = cursor.run;
  let pity: LootPity = cursor.pity;
  const items: ItemInstance[] = [];
  for (const p of plan) {
    const stream = nextLootRng(ctx.seed, ctx.room, run);
    const res = rollItem(stream.rng, rollCtx(ctx, p.source), { run: stream.run, pity }, p.opts);
    run = res.run;
    pity = res.pity;
    items.push(res.item);
  }
  return { items, run, pity };
}

export interface SourceDropOptions {
  /** Boss : 1 (Auditeur), 2, 3 (final). */
  readonly bossNumber?: 1 | 2 | 3;
  /** Premier kill de ce boss : un objet Hors-série garanti (table « boss-premier »). */
  readonly firstKill?: boolean;
  /** Numéro de ce kill du Boss 1 (Prime de bienvenue au 3e). */
  readonly boss1KillNumber?: number;
  readonly slot?: SlotId;
  readonly minRarity?: ItemRarity;
}

/**
 * Butin d'une source (§ 5.2) : caisse, casier, élite (1, +25 % d'un second), Salle gardée (2, dont
 * un Homologué), boss (2 / 3 / 3, Hors-série garanti au 1er kill, Prime de bienvenue), Friterie,
 * Wagon-Bar, événement. Pour un ennemi de base, voir `dropsForKill`.
 */
export function dropsForSource(
  source: DropSource,
  ctx: DropContext,
  cursor: LootCursor,
  opts: SourceDropOptions = {},
): DropResult {
  const base: RollOptions = {
    ...(opts.slot ? { slot: opts.slot } : {}),
    ...(opts.minRarity ? { minRarity: opts.minRarity } : {}),
  };
  switch (source) {
    case 'elite': {
      const stream = nextLootRng(ctx.seed, ctx.room, cursor.run);
      const second = stream.rng() < DROP_COUNTS.ELITE_SECOND_CHANCE;
      const plan = Array.from({ length: DROP_COUNTS.ELITE + (second ? 1 : 0) }, () => ({
        source,
        opts: base,
      }));
      return rollMany(ctx, { ...cursor, run: stream.run }, plan);
    }
    case 'gardee':
      return rollMany(ctx, cursor, [
        { source, opts: { ...base, minRarity: 'homologue' } },
        ...Array.from({ length: DROP_COUNTS.GARDEE - 1 }, () => ({ source, opts: base })),
      ]);
    case 'boss':
    case 'boss-premier': {
      const n = DROP_COUNTS.BOSS[(opts.bossNumber ?? 1) - 1] ?? DROP_COUNTS.BOSS[0];
      const welcome =
        (opts.bossNumber ?? 1) === 1 &&
        opts.boss1KillNumber === LOOT_RULES.WELCOME_BOSS1_KILL &&
        !cursor.pity.welcomeDone &&
        !cursor.pity.frozen;
      const first: { source: DropSource; opts: RollOptions } = welcome
        ? { source: 'boss', opts: { ...base, rarity: 'patrimoine' } }
        : opts.firstKill || source === 'boss-premier'
          ? { source: 'boss-premier', opts: base }
          : { source: 'boss', opts: base };
      return rollMany(ctx, cursor, [
        first,
        ...Array.from({ length: n - 1 }, () => ({ source: 'boss' as const, opts: base })),
      ]);
    }
    default:
      return rollMany(ctx, cursor, [{ source, opts: base }]);
  }
}

/** Ennemi de base tué : chance de drop (Junior et Drone 3 %, Borne 5 %, Agent de sécurité 6 %). */
export function dropsForKill(
  kind: LootEnemyKind,
  ctx: DropContext,
  cursor: LootCursor,
): DropResult {
  const stream = nextLootRng(ctx.seed, ctx.room, cursor.run);
  if (stream.rng() >= KILL_DROP_CHANCE[kind])
    return { items: [], run: stream.run, pity: cursor.pity };
  const res = rollItem(stream.rng, rollCtx(ctx, 'ennemi'), { run: stream.run, pity: cursor.pity });
  return { items: [res.item], run: res.run, pity: res.pity };
}

/** Annonce d'une porte « Dotation » (écran des départs) : emplacement et rareté minimale. */
export interface DotationAnnounce {
  readonly slot: SlotId;
  readonly minRarity: ItemRarity;
}

/**
 * Tire l'annonce d'une porte Dotation sur le flux de la salle de destination (sel 999, réservé).
 * La rareté minimale annoncée est Réglementaire ou Homologué (jamais au-delà : pas de spoiler).
 */
export function announceDotation(
  seed: number,
  room: number,
  slotBag: readonly SlotId[] = [],
): DotationAnnounce {
  const rng = roomRng(seed, room, LOOT_SALT - 1);
  const { slot } = drawSlot(rng, slotBag);
  const rolled = pickRarity(rng, { ...RARITY_WEIGHTS.dotation });
  return { slot, minRarity: rolled === 'reglementaire' ? 'reglementaire' : 'homologue' };
}

/**
 * Récompense « Dotation » : 2 objets d'emplacements différents, au moins de la rareté annoncée ;
 * le premier est de l'emplacement annoncé.
 */
export function dotationOffer(
  ctx: DropContext,
  cursor: LootCursor,
  announce: DotationAnnounce,
): DropResult {
  return rollMany(ctx, cursor, [
    { source: 'dotation', opts: { slot: announce.slot, minRarity: announce.minRarity } },
    ...Array.from({ length: DROP_COUNTS.DOTATION_OPTIONS - 1 }, () => ({
      source: 'dotation' as const,
      opts: { excludeSlots: [announce.slot], minRarity: announce.minRarity },
    })),
  ]);
}
