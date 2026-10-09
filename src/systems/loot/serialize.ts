import type { DropSource, ItemRarity } from '@/config/loot';
import {
  AFFIXES_BY_ID,
  DEFAULT_TOOL_ID,
  ILVL_SOURCE_BONUS,
  ITEM_RARITIES,
  ITEMS_BY_ID,
  LEGENDARIES_BY_ID,
  LOOT_RULES,
  SETS_BY_ID,
} from '@/config/loot';
import type { FamilyId } from '@/systems/meta/Avantages';
import { FAMILIES } from '@/systems/meta/Avantages';
import type { MetaLoot } from '@/systems/meta/MetaState';
import { scrapValue } from '@/systems/loot/equip';
import { clampIlvl } from '@/systems/loot/ilvl';
import type { AffixRoll, ItemInstance } from '@/systems/loot/types';
import { quantizeQ } from '@/systems/loot/values';

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isRarity = (v: unknown): v is ItemRarity => typeof v === 'string' && v in ITEM_RARITIES;
const isSource = (v: unknown): v is DropSource => typeof v === 'string' && v in ILVL_SOURCE_BONUS;
const isFamily = (v: unknown): v is FamilyId => typeof v === 'string' && v in FAMILIES;
const isQ = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;

/** Loot méta par défaut (nouvelle partie, migration v1 → v2). */
export function defaultMetaLoot(): MetaLoot {
  return {
    ferraille: 0,
    vestiaire: [],
    paquetage: [],
    startTool: DEFAULT_TOOL_ID,
    unlockedTools: [DEFAULT_TOOL_ID],
    codex: [],
    pityPatrimoine: 0,
    welcomePatrimoineDone: false,
    nextUid: 1,
    lastPieceConversion: -1,
    scrappedOnLoad: 0,
  };
}

function isAffixRoll(v: unknown): v is AffixRoll {
  if (!isRecord(v) || typeof v.affixId !== 'string' || !isQ(v.q)) return false;
  const def = AFFIXES_BY_ID.get(v.affixId);
  if (!def) return false;
  if (def.stat === 'familyMult') return isFamily(v.family);
  return v.family === undefined;
}

/** Validation stricte d'un objet (après `sanitizeItem`, tout objet sauvegardé la passe). */
export function isItemInstance(v: unknown): v is ItemInstance {
  if (!isRecord(v)) return false;
  if (typeof v.uid !== 'string' || typeof v.defId !== 'string' || !isRarity(v.rarity)) return false;
  const def = ITEMS_BY_ID.get(v.defId);
  if (!def) return false;
  if (typeof v.ilvl !== 'number' || v.ilvl !== clampIlvl(v.ilvl) || !isQ(v.implicitQ)) return false;
  if (!Array.isArray(v.affixes) || !v.affixes.every(isAffixRoll)) return false;
  if (v.legendaryId !== undefined) {
    const l = typeof v.legendaryId === 'string' ? LEGENDARIES_BY_ID.get(v.legendaryId) : undefined;
    if (l?.baseId !== v.defId) return false;
  }
  if (v.setId !== undefined) {
    const s = typeof v.setId === 'string' ? SETS_BY_ID.get(v.setId) : undefined;
    if (!s?.pieces.includes(v.defId)) return false;
  }
  const o = v.origin;
  if (!isRecord(o) || !isSource(o.source) || typeof o.shift !== 'number') return false;
  if (typeof o.room !== 'number') return false;
  return typeof v.rerolls === 'number' && typeof v.locked === 'boolean';
}

/** Résultat du nettoyage d'un objet : conservé (réparé) ou réformé en Ferraille. */
export type SanitizedItem =
  | { readonly ok: true; readonly item: ItemInstance }
  | { readonly ok: false; readonly scrap: number };

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Nettoie un objet lu dans une sauvegarde : `q` ramené dans [0, 1], ilvl borné à [1, 30], champs
 * secondaires réparés. Une base, un affixe, un légendaire ou un Attelage inconnus (contenu retiré
 * par un patch) convertissent l'objet en Ferraille au lieu de corrompre la méta.
 */
export function sanitizeItem(v: unknown): SanitizedItem {
  if (!isRecord(v)) return { ok: false, scrap: 0 };
  const rarity: ItemRarity = isRarity(v.rarity) ? v.rarity : 'reforme';
  const ilvl = clampIlvl(num(v.ilvl, 1));
  const scrap = { ok: false as const, scrap: scrapValue({ rarity, ilvl }) };
  if (typeof v.uid !== 'string' || typeof v.defId !== 'string' || !isRarity(v.rarity)) return scrap;
  if (!ITEMS_BY_ID.has(v.defId) || !Array.isArray(v.affixes)) return scrap;
  const affixes: AffixRoll[] = [];
  for (const a of v.affixes as unknown[]) {
    if (!isRecord(a) || typeof a.affixId !== 'string') return scrap;
    const def = AFFIXES_BY_ID.get(a.affixId);
    if (!def) return scrap;
    const q = quantizeQ(num(a.q, 0));
    if (def.stat === 'familyMult') {
      if (!isFamily(a.family)) return scrap;
      affixes.push({ affixId: a.affixId, q, family: a.family });
    } else {
      affixes.push({ affixId: a.affixId, q });
    }
  }
  let legendaryId: string | undefined;
  if (v.legendaryId !== undefined) {
    const l = typeof v.legendaryId === 'string' ? LEGENDARIES_BY_ID.get(v.legendaryId) : undefined;
    if (!l) return scrap;
    if (l.baseId !== v.defId) return scrap;
    legendaryId = l.id;
  }
  let setId: string | undefined;
  if (v.setId !== undefined) {
    const s = typeof v.setId === 'string' ? SETS_BY_ID.get(v.setId) : undefined;
    if (!s?.pieces.includes(v.defId)) return scrap;
    setId = s.id;
  }
  const o = isRecord(v.origin) ? v.origin : {};
  const item: ItemInstance = {
    uid: v.uid,
    defId: v.defId,
    rarity: v.rarity,
    ilvl,
    implicitQ: quantizeQ(num(v.implicitQ, 0)),
    affixes,
    ...(legendaryId ? { legendaryId } : {}),
    ...(setId ? { setId } : {}),
    origin: {
      source: isSource(o.source) ? o.source : 'ennemi',
      shift: Math.max(0, Math.trunc(num(o.shift, 0))),
      room: Math.max(0, Math.trunc(num(o.room, 0))),
    },
    rerolls: Math.max(0, Math.trunc(num(v.rerolls, 0))),
    locked: v.locked === true,
  };
  return { ok: true, item };
}

/** Validation stricte du loot méta. */
export function isMetaLoot(v: unknown): v is MetaLoot {
  if (!isRecord(v)) return false;
  const strings = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((s) => typeof s === 'string');
  return (
    typeof v.ferraille === 'number' &&
    Array.isArray(v.vestiaire) &&
    v.vestiaire.every(isItemInstance) &&
    strings(v.paquetage) &&
    typeof v.startTool === 'string' &&
    strings(v.unlockedTools) &&
    strings(v.codex) &&
    typeof v.pityPatrimoine === 'number' &&
    typeof v.welcomePatrimoineDone === 'boolean' &&
    typeof v.nextUid === 'number' &&
    typeof v.lastPieceConversion === 'number' &&
    typeof v.scrappedOnLoad === 'number'
  );
}

/**
 * Nettoie le loot d'une sauvegarde. Objets inconnus → Ferraille (`scrapped` pour la notice du
 * hub : « 2 objets réformés par le service technique »), uids dupliqués écartés, Paquetage et
 * Outils filtrés, pitié bornée.
 */
export function sanitizeLoot(raw: unknown): { loot: MetaLoot; scrapped: number } {
  const d = defaultMetaLoot();
  if (!isRecord(raw)) return { loot: d, scrapped: 0 };
  let ferraille = Math.max(0, Math.trunc(num(raw.ferraille, 0)));
  let scrapped = 0;
  const vestiaire: ItemInstance[] = [];
  const seen = new Set<string>();
  let maxUid = 0;
  for (const v of Array.isArray(raw.vestiaire) ? (raw.vestiaire as unknown[]) : []) {
    const res = sanitizeItem(v);
    if (!res.ok || seen.has(res.item.uid)) {
      ferraille += res.ok ? 0 : res.scrap;
      scrapped += 1;
      continue;
    }
    seen.add(res.item.uid);
    vestiaire.push(res.item);
    const n = Number(/^it-(\d+)$/.exec(res.item.uid)?.[1] ?? 0);
    maxUid = Math.max(maxUid, n);
  }
  const strings = (x: unknown): string[] =>
    Array.isArray(x) ? (x as unknown[]).filter((s): s is string => typeof s === 'string') : [];
  const tools = strings(raw.unlockedTools).filter((id) => ITEMS_BY_ID.get(id)?.slot === 'outil');
  const unlockedTools = [...new Set([DEFAULT_TOOL_ID, ...tools])];
  const startTool =
    typeof raw.startTool === 'string' && unlockedTools.includes(raw.startTool)
      ? raw.startTool
      : DEFAULT_TOOL_ID;
  return {
    loot: {
      ferraille,
      vestiaire,
      paquetage: [...new Set(strings(raw.paquetage).filter((uid) => seen.has(uid)))],
      startTool,
      unlockedTools,
      codex: [...new Set(strings(raw.codex).filter((id) => LEGENDARIES_BY_ID.has(id)))],
      pityPatrimoine: Math.max(0, Math.min(LOOT_RULES.PITY_CAP, num(raw.pityPatrimoine, 0))),
      welcomePatrimoineDone: raw.welcomePatrimoineDone === true,
      nextUid: Math.max(1, Math.trunc(num(raw.nextUid, 1)), maxUid + 1),
      lastPieceConversion: Math.trunc(num(raw.lastPieceConversion, d.lastPieceConversion)),
      scrappedOnLoad: Math.max(0, Math.trunc(num(raw.scrappedOnLoad, 0))) + scrapped,
    },
    scrapped,
  };
}

/** Nettoyage de l'état méta brut (hook `sanitize` du `SaveManager`), après migration. */
export function sanitizeMetaRaw(state: Raw): Raw {
  return {
    ...state,
    pieces: Math.max(0, Math.trunc(num(state.pieces, 0))),
    loot: sanitizeLoot(state.loot).loot,
  };
}

/** Sérialise un objet (JSON compact : seule la qualité `q` des affixes est gardée). */
export function serializeItem(item: ItemInstance): string {
  return JSON.stringify(item);
}

/** Relit un objet sérialisé ; `null` s'il est illisible ou à réformer. */
export function deserializeItem(json: string): ItemInstance | null {
  try {
    const res = sanitizeItem(JSON.parse(json) as unknown);
    return res.ok ? res.item : null;
  } catch {
    return null;
  }
}
