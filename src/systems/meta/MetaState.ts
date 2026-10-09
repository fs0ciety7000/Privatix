import type { ItemInstance } from '@/systems/loot/types';
import { defaultMetaLoot, isMetaLoot, sanitizeMetaRaw } from '@/systems/loot/serialize';
import type { SaveSchema } from '@/systems/save/SaveManager';

/**
 * Progression permanente, gardée d'un Shift à l'autre (sauvegardée) : Points de Syndicalisme (PS),
 * Grains de café, Pièces, rangs du Tableau des revendications (chez Marcel, à l'OCC), statistiques
 * et, depuis la v2, le loot (Vestiaire de la DPD, Ferraille, Plans, protection contre la malchance).
 */

export type UpgradeId =
  | 'anciennete'
  | 'thermos'
  | 'delegue'
  | 'chaussures'
  | 'mutuelle'
  | 'local'
  | 'caisse'
  | 'cle-chromee'
  | 'sifflet'
  | 'tableau'
  | 'casier'
  | 'paquetage'
  | 'consigne';

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly effect: string;
  /** Coût en PS de chaque rang (la longueur donne le nombre de rangs). */
  readonly costs: readonly number[];
}

/** Tableau des revendications (GDD § Méta-progression, MVP). */
export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'anciennete', name: 'Ancienneté', effect: '+10 Énergie max', costs: [30, 60, 120] },
  { id: 'cle-chromee', name: 'Clé chromée', effect: '+5 % de dégâts', costs: [50, 100, 150, 250] },
  { id: 'thermos', name: 'Thermos personnel', effect: '+1 Gobelet au départ', costs: [50, 150] },
  {
    id: 'sifflet',
    name: 'Sifflet réglementaire',
    effect: '+25 Mobilisation au départ',
    costs: [60, 140],
  },
  {
    id: 'local',
    name: 'Local syndical',
    effect: 'Burnout : récupération +0,5/s',
    costs: [70, 160],
  },
  { id: 'caisse', name: 'Caisse de grève', effect: '+40 Tickets au départ', costs: [40, 80, 160] },
  {
    id: 'delegue',
    name: 'Délégué de terrain',
    effect: 'Avantages plus rares (+5 points)',
    costs: [60, 120, 240],
  },
  {
    id: 'mutuelle',
    name: 'Mutuelle',
    effect: 'Se relever à 40 % (puis 60 %), 1 fois par Shift',
    costs: [150, 400],
  },
  {
    id: 'chaussures',
    name: "Formation au déplacement d'urgence",
    effect: '+1 charge de dash',
    costs: [200],
  },
  {
    id: 'tableau',
    name: 'Tableau de service',
    effect: 'Débloque le Shift Après-midi, puis Nuit',
    costs: [100, 200],
  },
  // Branche Vestiaire (loot, GDD § 10.2) : services de la DPD.
  { id: 'casier', name: 'Casier personnel', effect: '+12 casiers au Vestiaire', costs: [100, 200] },
  {
    id: 'paquetage',
    name: 'Paquetage',
    effect: '+1 pièce de Paquetage (1 → 3)',
    costs: [150, 350],
  },
  {
    id: 'consigne',
    name: 'Consigne élargie',
    effect: '+1 objet ramené en fin de Shift',
    costs: [250],
  },
];

export const UPGRADES_BY_ID: ReadonlyMap<UpgradeId, UpgradeDef> = new Map(
  UPGRADES.map((u) => [u.id, u]),
);

export interface MetaStats {
  readonly shifts: number;
  readonly deaths: number;
  readonly bossKills: number;
  readonly bestRoom: number;
  readonly totalKills: number;
}

/** Loot gardé d'un Shift à l'autre (MetaState v2, proposition § 7.1). */
export interface MetaLoot {
  /** Monnaie de démontage (DPD, PACO) ; ne se convertit qu'en Pièces, une fois par Shift. */
  readonly ferraille: number;
  /** Casiers du Vestiaire (24, +12 par rang de « Casier personnel »). */
  readonly vestiaire: readonly ItemInstance[];
  /** Uids du Vestiaire emportés au départ (1 pièce, +1 par rang de « Paquetage »). */
  readonly paquetage: readonly string[];
  /** Outil de départ (base d'Outil débloquée), Réforme sans affixe. */
  readonly startTool: string;
  /** Dotations d'outil obtenues à la DPD (ids de bases d'Outil). */
  readonly unlockedTools: readonly string[];
  /** Plans de Patrimoine archivés chez Béné (ids de légendaires). */
  readonly codex: readonly string[];
  /** Ancienneté du butin : points de Patrimoine (0 à 8). */
  readonly pityPatrimoine: number;
  readonly welcomePatrimoineDone: boolean;
  /** Prochain uid d'objet (`it-000123`). */
  readonly nextUid: number;
  /** Shift (`stats.shifts`) de la dernière conversion Ferraille → Pièce, −1 si jamais. */
  readonly lastPieceConversion: number;
  /** Objets réformés au chargement (contenu retiré par un patch) : notice du hub, puis remise à 0. */
  readonly scrappedOnLoad: number;
}

export interface MetaState {
  readonly version: 2;
  readonly ps: number;
  readonly grains: number;
  /** Pièces détachées (monnaie rare des boss, Dotations d'outil). */
  readonly pieces: number;
  readonly upgrades: Readonly<Partial<Record<UpgradeId, number>>>;
  readonly stats: MetaStats;
  readonly loot: MetaLoot;
}

/** Version courante du schéma de sauvegarde. */
export const META_VERSION = 2;

export function newMeta(): MetaState {
  return {
    version: 2,
    ps: 0,
    grains: 0,
    pieces: 0,
    upgrades: {},
    stats: { shifts: 0, deaths: 0, bossKills: 0, bestRoom: 0, totalKills: 0 },
    loot: defaultMetaLoot(),
  };
}

export function rankOf(meta: MetaState, id: UpgradeId): number {
  return meta.upgrades[id] ?? 0;
}

/** Coût du prochain rang, ou `null` si le maximum est atteint. */
export function nextCost(meta: MetaState, id: UpgradeId): number | null {
  const def = UPGRADES_BY_ID.get(id);
  if (!def) return null;
  return def.costs[rankOf(meta, id)] ?? null;
}

export type BuyResult =
  | { readonly ok: true; readonly meta: MetaState }
  | { readonly ok: false; readonly reason: 'max' | 'ps' };

export function buyUpgrade(meta: MetaState, id: UpgradeId): BuyResult {
  const cost = nextCost(meta, id);
  if (cost === null) return { ok: false, reason: 'max' };
  if (meta.ps < cost) return { ok: false, reason: 'ps' };
  return {
    ok: true,
    meta: {
      ...meta,
      ps: meta.ps - cost,
      upgrades: { ...meta.upgrades, [id]: rankOf(meta, id) + 1 },
    },
  };
}

/** Bonus de départ d'un Shift d'après les revendications obtenues. */
export interface Loadout {
  readonly maxEnergyBonus: number;
  readonly damageBonus: number;
  readonly gobeletsBonus: number;
  readonly mobilisation: number;
  readonly burnoutDecayBonus: number;
  readonly tickets: number;
  readonly rareShift: number;
  readonly reviveFraction: number;
  readonly dashCharges: number;
  readonly shiftsUnlocked: number;
}

export function loadoutOf(meta: MetaState): Loadout {
  const r = (id: UpgradeId): number => rankOf(meta, id);
  const mutuelle = r('mutuelle');
  return {
    maxEnergyBonus: 10 * r('anciennete'),
    damageBonus: 0.05 * r('cle-chromee'),
    gobeletsBonus: r('thermos'),
    mobilisation: 25 * r('sifflet'),
    burnoutDecayBonus: 0.5 * r('local'),
    tickets: 40 * r('caisse'),
    rareShift: 5 * r('delegue'),
    reviveFraction: mutuelle === 0 ? 0 : mutuelle === 1 ? 0.4 : 0.6,
    dashCharges: r('chaussures'),
    shiftsUnlocked: 1 + r('tableau'),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validation à la lecture d'une sauvegarde (v2 ; une v1 passe d'abord par la migration). */
export function isMetaState(v: unknown): v is MetaState {
  if (!isRecord(v)) return false;
  if (v.version !== META_VERSION || typeof v.ps !== 'number' || typeof v.grains !== 'number') {
    return false;
  }
  if (typeof v.pieces !== 'number' || !isMetaLoot(v.loot)) return false;
  if (!isRecord(v.upgrades) || !isRecord(v.stats)) return false;
  const known = new Set<string>(UPGRADES.map((u) => u.id));
  for (const [k, rank] of Object.entries(v.upgrades)) {
    if (!known.has(k) || typeof rank !== 'number') return false;
  }
  const s = v.stats;
  return ['shifts', 'deaths', 'bossKills', 'bestRoom', 'totalKills'].every(
    (k) => typeof s[k] === 'number',
  );
}

/** Pièces du 1er kill du Boss 1 (GDD § 10.1), créditées par la migration. */
const FIRST_BOSS1_PIECES = 3;

/**
 * Migration v1 → v2 (proposition § 7.3) : garde PS, Grains, rangs et statistiques ; ajoute les
 * Pièces et le loot par défaut. Rattrapage : la v1 n'a jamais compté les Pièces, donc un joueur
 * qui a déjà battu le Boss 1 reçoit la Masse de voie et les 3 Pièces de ce premier kill.
 */
export function migrateMetaV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const bossKills = typeof stats.bossKills === 'number' ? stats.bossKills : 0;
  const loot = defaultMetaLoot();
  return {
    ...raw,
    version: 2,
    pieces: bossKills >= 1 ? FIRST_BOSS1_PIECES : 0,
    loot: bossKills >= 1 ? { ...loot, unlockedTools: [...loot.unlockedTools, 'masse-voie'] } : loot,
  };
}

/**
 * Schéma de la sauvegarde méta : migrations, nettoyage du loot (objets inconnus → Ferraille,
 * qualités et ilvl bornés) avant la validation stricte.
 */
export const META_SAVE_SCHEMA: SaveSchema<MetaState> = {
  version: META_VERSION,
  migrations: { 1: migrateMetaV1toV2 },
  sanitize: sanitizeMetaRaw,
  validate: isMetaState,
};
