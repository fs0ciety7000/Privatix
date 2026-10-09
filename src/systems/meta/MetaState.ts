/**
 * Progression permanente, gardée d'un Shift à l'autre (sauvegardée) : Points de Syndicalisme (PS),
 * Grains de café, rangs du Tableau des revendications (chez Marcel, à l'OCC) et statistiques.
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
  | 'tableau';

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
  { id: 'chaussures', name: 'Chaussures de sécurité', effect: '+1 charge de dash', costs: [200] },
  {
    id: 'tableau',
    name: 'Tableau de service',
    effect: 'Débloque le Shift Après-midi, puis Nuit',
    costs: [100, 200],
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

export interface MetaState {
  readonly version: 1;
  readonly ps: number;
  readonly grains: number;
  readonly upgrades: Readonly<Partial<Record<UpgradeId, number>>>;
  readonly stats: MetaStats;
}

export function newMeta(): MetaState {
  return {
    version: 1,
    ps: 0,
    grains: 0,
    upgrades: {},
    stats: { shifts: 0, deaths: 0, bossKills: 0, bestRoom: 0, totalKills: 0 },
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

/** Validation à la lecture d'une sauvegarde. */
export function isMetaState(v: unknown): v is MetaState {
  if (!isRecord(v)) return false;
  if (v.version !== 1 || typeof v.ps !== 'number' || typeof v.grains !== 'number') return false;
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
