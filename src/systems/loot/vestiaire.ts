import type { SlotId } from '@/config/loot';
import {
  AFFIXES_BY_ID,
  ITEMS_BY_ID,
  LEGENDARIES_BY_ID,
  LOOT_RULES,
  SCRAP,
  TOOL_UNLOCKS,
  VESTIAIRE,
} from '@/config/loot';
import type { MetaLoot, MetaState } from '@/systems/meta/MetaState';
import { rankOf } from '@/systems/meta/MetaState';
import { emptyLoadout, equip, loadoutItems, scrapValue } from '@/systems/loot/equip';
import type { LootCursor } from '@/systems/loot/roll';
import { affixPool, formatUid, newLootRun, rollAffixes } from '@/systems/loot/roll';
import { slotOf } from '@/systems/loot/stats';
import type {
  AffixRoll,
  GearLoadout,
  ItemInstance,
  LootPity,
  LootRunState,
} from '@/systems/loot/types';
import { quantizeQ } from '@/systems/loot/values';
import type { Rng } from '@/utils/rng';

/**
 * Vestiaire de la DPD (Josiane, casiers de la Cour intérieure), relances de PACO (Béné) et
 * règles de fin de Shift. Toutes les opérations sont immuables et renvoient
 * `{ ok: true, meta } | { ok: false, reason }`, comme `buyUpgrade`.
 */

export type VestiaireError =
  | 'unknown-item'
  | 'locked'
  | 'ferraille'
  | 'pieces'
  | 'max'
  | 'full'
  | 'too-many'
  | 'slot-taken'
  | 'already-done'
  | 'requirement'
  | 'invalid';

export type VestiaireResult<T = object> =
  | ({ readonly ok: true; readonly meta: MetaState } & T)
  | { readonly ok: false; readonly reason: VestiaireError };

const fail = (reason: VestiaireError): { ok: false; reason: VestiaireError } => ({
  ok: false,
  reason,
});

function withLoot(meta: MetaState, loot: Partial<MetaLoot>): MetaState {
  return { ...meta, loot: { ...meta.loot, ...loot } };
}

function findItem(meta: MetaState, uid: string): ItemInstance | undefined {
  return meta.loot.vestiaire.find((i) => i.uid === uid);
}

function replaceItem(meta: MetaState, item: ItemInstance): MetaState {
  return withLoot(meta, {
    vestiaire: meta.loot.vestiaire.map((i) => (i.uid === item.uid ? item : i)),
  });
}

/** Casiers : 24, +12 par rang de « Casier personnel ». */
export function vestiaireCapacity(meta: MetaState): number {
  return VESTIAIRE.CAPACITY + VESTIAIRE.CAPACITY_PER_RANK * rankOf(meta, 'casier');
}

/** Pièces de Paquetage : 1, +1 par rang de « Paquetage » (3 au plus). */
export function paquetageSize(meta: MetaState): number {
  return VESTIAIRE.PAQUETAGE + VESTIAIRE.PAQUETAGE_PER_RANK * rankOf(meta, 'paquetage');
}

export type ShiftOutcome = 'mort' | 'victoire';

/** Objets ramenés en fin de Shift : 1 à la mort, 2 en victoire, +1 avec « Consigne élargie ». */
export function consignLimit(meta: MetaState, outcome: ShiftOutcome): number {
  const base = outcome === 'victoire' ? VESTIAIRE.CONSIGN_VICTORY : VESTIAIRE.CONSIGN_DEATH;
  return base + VESTIAIRE.CONSIGN_PER_RANK * rankOf(meta, 'consigne');
}

/** Objets du Paquetage (dans l'ordre choisi), sans les uids disparus. */
export function buildPaquetage(meta: MetaState): ItemInstance[] {
  return meta.loot.paquetage
    .map((uid) => findItem(meta, uid))
    .filter((i): i is ItemInstance => i !== undefined);
}

/** Choisit le Paquetage : au plus `paquetageSize`, un objet par emplacement. */
export function setPaquetage(meta: MetaState, uids: readonly string[]): VestiaireResult {
  if (uids.length > paquetageSize(meta)) return fail('too-many');
  const slots = new Set<SlotId>();
  for (const uid of uids) {
    const item = findItem(meta, uid);
    const slot = item ? slotOf(item) : undefined;
    if (!item || !slot) return fail('unknown-item');
    if (slots.has(slot)) return fail('slot-taken');
    slots.add(slot);
  }
  return { ok: true, meta: withLoot(meta, { paquetage: [...uids] }) };
}

/** Outil de départ (doit être débloqué). */
export function setStartTool(meta: MetaState, toolId: string): VestiaireResult {
  if (!meta.loot.unlockedTools.includes(toolId)) return fail('requirement');
  return { ok: true, meta: withLoot(meta, { startTool: toolId }) };
}

/** Progression hors MetaStats (Boss 2, quêtes) pour les Dotations d'outil. */
export interface ToolUnlockProgress {
  readonly boss2Kills?: number;
  readonly quests?: readonly string[];
}

/** Dotation d'outil à la DPD (GDD § 10.4) : débloque une base d'Outil contre des Pièces. */
export function unlockTool(
  meta: MetaState,
  toolId: string,
  progress: ToolUnlockProgress = {},
): VestiaireResult {
  const def = TOOL_UNLOCKS.find((u) => u.toolId === toolId);
  if (!def) return fail('invalid');
  if (meta.loot.unlockedTools.includes(toolId)) return fail('max');
  if (meta.stats.bossKills < (def.boss1Kills ?? 0)) return fail('requirement');
  if ((progress.boss2Kills ?? 0) < (def.boss2Kills ?? 0)) return fail('requirement');
  if (def.quest && !(progress.quests ?? []).includes(def.quest)) return fail('requirement');
  if (meta.pieces < def.pieces) return fail('pieces');
  return {
    ok: true,
    meta: {
      ...withLoot(meta, { unlockedTools: [...meta.loot.unlockedTools, toolId] }),
      pieces: meta.pieces - def.pieces,
    },
  };
}

/** Outil de départ : Réforme, sans affixe, ilvl 1. */
export function starterTool(toolId: string, uid: string): ItemInstance {
  return {
    uid,
    defId: ITEMS_BY_ID.get(toolId)?.slot === 'outil' ? toolId : 'cle-tire-fond',
    rarity: 'reforme',
    ilvl: 1,
    implicitQ: 0,
    affixes: [],
    origin: { source: 'dotation', shift: 0, room: 0 },
    rerolls: 0,
    locked: false,
  };
}

export interface RunStart extends LootCursor {
  readonly loadout: GearLoadout;
}

/**
 * Début de Shift : le Paquetage est équipé ; sans Outil dans le Paquetage, l'Outil de départ
 * choisi au Vestiaire (Réforme sans affixe). Shift imposé (graine saisie) : pitié gelée.
 */
export function startLootRun(
  meta: MetaState,
  opts: { readonly fixedSeed?: boolean } = {},
): RunStart {
  // Garde : jamais d'uid déjà pris au Vestiaire, même si le compteur méta a été altéré.
  const maxUid = Math.max(
    0,
    ...meta.loot.vestiaire.map((i) => Number(/^it-(\d+)$/.exec(i.uid)?.[1] ?? 0)),
  );
  let run: LootRunState = newLootRun(Math.max(meta.loot.nextUid, maxUid + 1));
  let loadout = emptyLoadout();
  for (const item of buildPaquetage(meta)) loadout = equip(loadout, item).loadout;
  if (!loadout.equipped.outil) {
    loadout = equip(loadout, starterTool(meta.loot.startTool, formatUid(run.nextUid))).loadout;
    run = { ...run, nextUid: run.nextUid + 1 };
  }
  const pity: LootPity = {
    patrimoine: meta.loot.pityPatrimoine,
    welcomeDone: meta.loot.welcomePatrimoineDone,
    frozen: opts.fixedSeed === true,
  };
  return { loadout, run, pity };
}

export interface RunEnd {
  readonly outcome: ShiftOutcome;
  readonly loadout: GearLoadout;
  readonly run: LootRunState;
  readonly pity: LootPity;
  /** Uids choisis à l'écran « Consigne » (hors Paquetage). */
  readonly keep: readonly string[];
  /** Ferraille déjà gagnée pendant le Shift (démontages, objets laissés au sol). */
  readonly ferrailleEarned?: number;
}

/**
 * Fin de Shift (écran « Consigne ») : les objets choisis rejoignent le Vestiaire (1 à la mort,
 * 2 en victoire, +1 avec la revendication), les objets du Paquetage y reviennent intacts, tout le
 * reste part en Ferraille (100 %). Plans découverts archivés ; pitié et compteur d'uid rendus à
 * la méta (pitié inchangée en Shift imposé). La puissance des objets ramenés reste plafonnée par
 * la salle à l'usage (`effectiveIlvl`).
 */
export function settleLootRun(
  meta: MetaState,
  end: RunEnd,
): VestiaireResult<{ readonly kept: readonly ItemInstance[]; readonly ferraille: number }> {
  const paquetage = new Set(meta.loot.paquetage);
  const owned = new Set(meta.loot.vestiaire.map((i) => i.uid));
  const items = loadoutItems(end.loadout).filter((i) => !paquetage.has(i.uid) && !owned.has(i.uid));
  const keep = [...new Set(end.keep)].filter((uid) => !paquetage.has(uid));
  if (keep.length > consignLimit(meta, end.outcome)) return fail('too-many');
  const kept = keep.map((uid) => items.find((i) => i.uid === uid));
  if (kept.some((i) => i === undefined)) return fail('unknown-item');
  const keptItems = kept.filter((i): i is ItemInstance => i !== undefined);
  if (meta.loot.vestiaire.length + keptItems.length > vestiaireCapacity(meta)) return fail('full');
  const scrapped = items.filter((i) => !keep.includes(i.uid));
  const ferraille =
    scrapped.reduce((s, i) => s + scrapValue(i), 0) + Math.max(0, end.ferrailleEarned ?? 0);
  const codex = [...new Set([...meta.loot.codex, ...end.run.newPlans])];
  const next = withLoot(meta, {
    ferraille: meta.loot.ferraille + ferraille,
    vestiaire: [...meta.loot.vestiaire, ...keptItems.map((i) => ({ ...i, locked: false }))],
    codex,
    nextUid: Math.max(meta.loot.nextUid, end.run.nextUid),
    ...(end.pity.frozen
      ? {}
      : { pityPatrimoine: end.pity.patrimoine, welcomePatrimoineDone: end.pity.welcomeDone }),
  });
  return { ok: true, meta: next, kept: keptItems, ferraille };
}

/** Démonte un objet du Vestiaire (DPD, « réforme ») ; refusé s'il est cadenassé. */
export function scrapFromVestiaire(
  meta: MetaState,
  uid: string,
): VestiaireResult<{ readonly ferraille: number }> {
  const item = findItem(meta, uid);
  if (!item) return fail('unknown-item');
  if (item.locked) return fail('locked');
  const value = scrapValue(item);
  return {
    ok: true,
    meta: withLoot(meta, {
      ferraille: meta.loot.ferraille + value,
      vestiaire: meta.loot.vestiaire.filter((i) => i.uid !== uid),
      paquetage: meta.loot.paquetage.filter((u) => u !== uid),
    }),
    ferraille: value,
  };
}

/** Pose ou retire le cadenas d'un casier. */
export function toggleLock(meta: MetaState, uid: string): VestiaireResult {
  const item = findItem(meta, uid);
  if (!item) return fail('unknown-item');
  return { ok: true, meta: replaceItem(meta, { ...item, locked: !item.locked }) };
}

/** Polissage (DPD) : `q` d'un affixe +0,10 (1,0 au plus), 8 Ferraille. */
export function polish(meta: MetaState, uid: string, affixIndex: number): VestiaireResult {
  const item = findItem(meta, uid);
  const roll = item?.affixes[affixIndex];
  if (!item || !roll) return fail('unknown-item');
  if (roll.q >= 1) return fail('max');
  if (meta.loot.ferraille < SCRAP.POLISH_COST) return fail('ferraille');
  const affixes = item.affixes.map((a, i) =>
    i === affixIndex ? { ...a, q: quantizeQ(a.q + SCRAP.POLISH_STEP) } : a,
  );
  const next = replaceItem(meta, { ...item, affixes });
  return { ok: true, meta: withLoot(next, { ferraille: meta.loot.ferraille - SCRAP.POLISH_COST }) };
}

/** Coût d'une remise à niveau vers l'ilvl visé : 15 + 1 par niveau visé. */
export function raiseCapCost(item: ItemInstance): number {
  return SCRAP.RAISE_BASE + Math.min(LOOT_RULES.ILVL_MAX, item.ilvl + SCRAP.RAISE_STEP);
}

/** Remise à niveau (DPD) : plafond d'ilvl +3 (30 au plus). */
export function raiseCap(meta: MetaState, uid: string): VestiaireResult {
  const item = findItem(meta, uid);
  if (!item) return fail('unknown-item');
  if (item.ilvl >= LOOT_RULES.ILVL_MAX) return fail('max');
  const cost = raiseCapCost(item);
  if (meta.loot.ferraille < cost) return fail('ferraille');
  const ilvl = Math.min(LOOT_RULES.ILVL_MAX, item.ilvl + SCRAP.RAISE_STEP);
  const next = replaceItem(meta, { ...item, ilvl });
  return { ok: true, meta: withLoot(next, { ferraille: meta.loot.ferraille - cost }) };
}

/** Coût d'un réaffûtage chez Béné : 12, +6 par relance déjà faite sur l'objet. */
export function reforgeCost(item: ItemInstance): number {
  return SCRAP.REFORGE_BASE + SCRAP.REFORGE_STEP * item.rerolls;
}

/**
 * Trois remplaçants possibles pour l'affixe `affixIndex` (même type : préfixe ou suffixe), sans
 * reprendre un groupe déjà présent ni l'affixe retiré. Gratuit : le coût est payé par `reforge`.
 */
export function reforgeOptions(item: ItemInstance, affixIndex: number, rng: Rng): AffixRoll[] {
  const slot = slotOf(item);
  const removed = item.affixes[affixIndex];
  const removedDef = removed ? AFFIXES_BY_ID.get(removed.affixId) : undefined;
  if (!slot || !removed || !removedDef) return [];
  const others = item.affixes.filter((_, i) => i !== affixIndex);
  return rollAffixes(rng, slot, SCRAP.REFORGE_OPTIONS, {
    kind: removedDef.kind,
    existing: others,
    excludes: [removed.affixId, ...legendaryExcludesOf(item)],
  });
}

function legendaryExcludesOf(item: ItemInstance): readonly string[] {
  return item.legendaryId ? (LEGENDARIES_BY_ID.get(item.legendaryId)?.excludes ?? []) : [];
}

/** Réaffûtage (PACO, Béné) : remplace l'affixe par l'option choisie, paie le coût croissant. */
export function reforge(
  meta: MetaState,
  uid: string,
  affixIndex: number,
  option: AffixRoll,
): VestiaireResult {
  const item = findItem(meta, uid);
  const slot = item ? slotOf(item) : undefined;
  const removed = item?.affixes[affixIndex];
  if (!item || !slot || !removed) return fail('unknown-item');
  const oldDef = AFFIXES_BY_ID.get(removed.affixId);
  const newDef = AFFIXES_BY_ID.get(option.affixId);
  if (!oldDef || !newDef) return fail('invalid');
  if (newDef.kind !== oldDef.kind) return fail('invalid');
  const others = item.affixes.filter((_, i) => i !== affixIndex);
  const groups = new Set(others.map((a) => AFFIXES_BY_ID.get(a.affixId)?.group));
  const legal = affixPool(slot, { excludes: legendaryExcludesOf(item) });
  if (groups.has(newDef.group) || !legal.some((a) => a.id === newDef.id)) return fail('invalid');
  const cost = reforgeCost(item);
  if (meta.loot.ferraille < cost) return fail('ferraille');
  const affixes = item.affixes.map((a, i) =>
    i === affixIndex ? { ...option, q: quantizeQ(option.q) } : a,
  );
  const next = replaceItem(meta, { ...item, affixes, rerolls: item.rerolls + 1 });
  return { ok: true, meta: withLoot(next, { ferraille: meta.loot.ferraille - cost }) };
}

/** Conversion sur bon de réforme (DPD) : 25 Ferraille → 1 Pièce, une fois par Shift. */
export function convertToPieces(meta: MetaState): VestiaireResult {
  if (meta.loot.lastPieceConversion === meta.stats.shifts) return fail('already-done');
  if (meta.loot.ferraille < SCRAP.PIECE_RATE) return fail('ferraille');
  return {
    ok: true,
    meta: {
      ...withLoot(meta, {
        ferraille: meta.loot.ferraille - SCRAP.PIECE_RATE,
        lastPieceConversion: meta.stats.shifts,
      }),
      pieces: meta.pieces + 1,
    },
  };
}

/** Efface la notice « objets réformés par le service technique » une fois affichée. */
export function ackScrappedNotice(meta: MetaState): MetaState {
  return meta.loot.scrappedOnLoad === 0 ? meta : withLoot(meta, { scrappedOnLoad: 0 });
}
