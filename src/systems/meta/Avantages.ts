import type { Rng } from '@/utils/rng';
import { pick } from '@/utils/rng';

/**
 * Avantages acquis : les « bénédictions » des collègues reçues par radio pendant un Shift
 * (une famille par collègue, à la Hades). Chaque Avantage modifie `HeroMods`, lu par le Player et la Weapon.
 */

export type FamilyId = 'josiane' | 'rudy' | 'bene' | 'yasmina' | 'kevin' | 'fatou' | 'marcel';

export interface Family {
  readonly id: FamilyId;
  readonly colleague: string;
  readonly name: string;
  readonly color: number;
}

export const FAMILIES: Readonly<Record<FamilyId, Family>> = {
  josiane: { id: 'josiane', colleague: 'Josiane', name: 'Contrôle des titres', color: 0x5b8def },
  rudy: { id: 'rudy', colleague: 'Rudy', name: 'Coup de sifflet', color: 0xffd200 },
  bene: { id: 'bene', colleague: 'Béné', name: 'Guichet', color: 0xb48cff },
  yasmina: { id: 'yasmina', colleague: 'Yasmina', name: 'Régulation', color: 0x3fd8e8 },
  kevin: { id: 'kevin', colleague: 'Kevin', name: 'Caténaire', color: 0x7cf2ff },
  fatou: { id: 'fatou', colleague: 'Fatou', name: 'Prévention', color: 0x5bd17a },
  marcel: { id: 'marcel', colleague: 'Marcel', name: "D'antan", color: 0xe8505b },
};

export type Rarity = 'standard' | 'anciennete' | 'statutaire';

export const RARITIES: Readonly<
  Record<Rarity, { readonly label: string; readonly mult: number; readonly color: string }>
> = {
  standard: { label: 'Standard', mult: 1, color: '#f4f6f8' },
  anciennete: { label: 'Ancienneté', mult: 1.5, color: '#3fb8e8' },
  statutaire: { label: 'Statutaire', mult: 2, color: '#b48cff' },
};

/** Modificateurs du héros. Valeurs additives sauf mention. */
export interface HeroMods {
  damageBonus: number;
  critChance: number;
  critMult: number;
  /** Multiplicateur du knockback infligé. */
  knockbackMult: number;
  dashCharges: number;
  dashDistanceBonus: number;
  maxEnergy: number;
  speedBonus: number;
  finisherDamage: number;
  /** Les coups du combo détruisent les projectiles qu'ils touchent. */
  comboBreaksProjectiles: boolean;
  /** Fin de dash : onde qui étourdit les ennemis proches (ms, 0 = aucune). */
  dashShockStunMs: number;
  whistleRadiusBonus: number;
  whistleDamageBonus: number;
  /** Coups du combo : ralentissement des ennemis (fraction de vitesse retirée) pendant `slowMs`. */
  slowOnHit: number;
  slowMs: number;
  /** Coup 3 : rend la cible vulnérable (+X % de dégâts subis) pendant 3 s. */
  vulnerableOnFinisher: number;
  perfectDashWindowBonusMs: number;
  /** Coup 3 : arc électrique vers N cibles proches. */
  chainTargets: number;
  chainDamage: number;
  /** Dash : traînée électrique (dégâts toutes les 0,5 s, 0 = aucune). */
  dashTrailDamage: number;
  /** Bouclier qui absorbe un coup, rechargé toutes les N ms (0 = aucun). */
  shieldEveryMs: number;
  coffeeHealBonus: number;
  killHeal: number;
  lowEnergyCritMult: number;
  lowEnergyDamageBonus: number;
  /** +X de critique par tranche de 10 Burnout au-dessus de 30. */
  critPerBurnout: number;
}

export function baseMods(): HeroMods {
  return {
    damageBonus: 0,
    critChance: 0,
    critMult: 0,
    knockbackMult: 1,
    dashCharges: 0,
    dashDistanceBonus: 0,
    maxEnergy: 0,
    speedBonus: 0,
    finisherDamage: 0,
    comboBreaksProjectiles: false,
    dashShockStunMs: 0,
    whistleRadiusBonus: 0,
    whistleDamageBonus: 0,
    slowOnHit: 0,
    slowMs: 0,
    vulnerableOnFinisher: 0,
    perfectDashWindowBonusMs: 0,
    chainTargets: 0,
    chainDamage: 0,
    dashTrailDamage: 0,
    shieldEveryMs: 0,
    coffeeHealBonus: 0,
    killHeal: 0,
    lowEnergyCritMult: 0,
    lowEnergyDamageBonus: 0,
    critPerBurnout: 0,
  };
}

export interface AvantageDef {
  readonly id: string;
  readonly family: FamilyId;
  readonly name: string;
  readonly describe: (mult: number) => string;
  readonly apply: (mods: HeroMods, mult: number) => void;
}

const pct = (v: number): string => `${String(Math.round(v * 100))} %`;
const r1 = (v: number): string => String(Math.round(v * 10) / 10).replace('.', ',');

export const AVANTAGES: readonly AvantageDef[] = [
  // Josiane : défense, renvoi.
  {
    id: 'titre-non-valable',
    family: 'josiane',
    name: 'Titre non valable',
    describe: (m) => `La Frappe détruit les tickets ennemis et repousse ${pct(0.3 * m)} plus loin.`,
    apply: (x, m) => {
      x.comboBreaksProjectiles = true;
      x.knockbackMult += 0.3 * m;
    },
  },
  {
    id: 'verification-approfondie',
    family: 'josiane',
    name: 'Vérification approfondie',
    describe: (m) => `+${pct(0.12 * m)} de dégâts.`,
    apply: (x, m) => {
      x.damageBonus += 0.12 * m;
    },
  },
  {
    id: 'carte-de-service',
    family: 'josiane',
    name: 'Carte de service',
    describe: (m) => `+${String(Math.round(15 * m))} Énergie max.`,
    apply: (x, m) => {
      x.maxEnergy += Math.round(15 * m);
    },
  },
  // Rudy : étourdissement, onde de choc.
  {
    id: 'fermeture-des-portes',
    family: 'rudy',
    name: 'Fermeture des portes',
    describe: (m) => `La fin du dash étourdit les ennemis proches ${r1(0.6 * m)} s.`,
    apply: (x, m) => {
      x.dashShockStunMs = Math.max(x.dashShockStunMs, 600 * m);
    },
  },
  {
    id: 'sifflet-a-roulette',
    family: 'rudy',
    name: 'Sifflet à roulette',
    describe: (m) =>
      `Coup de sifflet : rayon +${String(Math.round(20 * m))} px, dégâts +${pct(0.4 * m)}.`,
    apply: (x, m) => {
      x.whistleRadiusBonus += 20 * m;
      x.whistleDamageBonus += 0.4 * m;
    },
  },
  // Béné : malus aux ennemis.
  {
    id: 'file-d-attente',
    family: 'bene',
    name: "File d'attente",
    describe: (m) =>
      `La Frappe ralentit les ennemis de ${pct(Math.min(0.6, 0.3 * m))} pendant 1,5 s.`,
    apply: (x, m) => {
      x.slowOnHit = Math.max(x.slowOnHit, Math.min(0.6, 0.3 * m));
      x.slowMs = 1500;
    },
  },
  {
    id: 'guichet-ferme',
    family: 'bene',
    name: 'Guichet fermé',
    describe: (m) => `Le coup 3 rend la cible Vulnérable (+${pct(0.25 * m)} de dégâts subis, 3 s).`,
    apply: (x, m) => {
      x.vulnerableOnFinisher = Math.max(x.vulnerableOnFinisher, 0.25 * m);
    },
  },
  // Yasmina : mobilité.
  {
    id: 'voie-libre',
    family: 'yasmina',
    name: 'Voie libre',
    describe: (m) =>
      `Dash +${String(Math.round(16 * m))} px et fenêtre de dash parfait +${String(Math.round(40 * m))} ms.`,
    apply: (x, m) => {
      x.dashDistanceBonus += 16 * m;
      x.perfectDashWindowBonusMs += 40 * m;
    },
  },
  {
    id: 'rattrapage-horaire',
    family: 'yasmina',
    name: 'Rattrapage horaire',
    describe: () => '+1 charge de dash.',
    apply: (x) => {
      x.dashCharges += 1;
    },
  },
  {
    id: 'cadencement',
    family: 'yasmina',
    name: 'Cadencement',
    describe: (m) => `+${pct(0.08 * m)} de vitesse de déplacement.`,
    apply: (x, m) => {
      x.speedBonus += 0.08 * m;
    },
  },
  // Kevin : électricité.
  {
    id: 'coupure-de-catenaire',
    family: 'kevin',
    name: 'Coupure de caténaire',
    describe: (m) =>
      `Le coup 3 déclenche un arc électrique sur 3 cibles (${String(Math.round(10 * m))} dégâts).`,
    apply: (x, m) => {
      x.chainTargets = Math.max(x.chainTargets, 3);
      x.chainDamage += 10 * m;
    },
  },
  {
    id: 'catenaire-3kv',
    family: 'kevin',
    name: 'Caténaire 3 kV',
    describe: (m) =>
      `Le dash laisse une traînée électrique (${String(Math.round(6 * m))} dégâts toutes les 0,5 s).`,
    apply: (x, m) => {
      x.dashTrailDamage += 6 * m;
    },
  },
  // Fatou : soin, bouclier.
  {
    id: 'pause-legale',
    family: 'fatou',
    name: 'Pause légale',
    describe: (m) =>
      `Un bouclier absorbe un coup, rechargé toutes les ${String(Math.round(30 / m))} s.`,
    apply: (x, m) => {
      const every = 30_000 / m;
      x.shieldEveryMs = x.shieldEveryMs === 0 ? every : Math.min(x.shieldEveryMs, every);
    },
  },
  {
    id: 'cafe-filtre',
    family: 'fatou',
    name: 'Café filtre',
    describe: (m) =>
      `Les Gobelets soignent +${pct(0.15 * m)} et chaque élimination rend ${String(Math.round(1 * m))} Énergie.`,
    apply: (x, m) => {
      x.coffeeHealBonus += 0.15 * m;
      x.killHeal += Math.round(1 * m);
    },
  },
  // Marcel : critiques, second souffle.
  {
    id: 'de-mon-temps',
    family: 'marcel',
    name: 'De mon temps',
    describe: (m) =>
      `+${pct(0.4 * m)} de dégâts critiques sous 30 % d'Énergie, +${pct(0.04 * m)} de critique.`,
    apply: (x, m) => {
      x.lowEnergyCritMult += 0.4 * m;
      x.critChance += 0.04 * m;
    },
  },
  {
    id: 'heures-sup',
    family: 'marcel',
    name: 'Heures sup',
    describe: (m) => `+${pct(0.04 * m)} de critique par tranche de 10 Burnout au-dessus de 30.`,
    apply: (x, m) => {
      x.critPerBurnout += 0.04 * m;
    },
  },
  {
    id: 'cle-dynamometrique',
    family: 'marcel',
    name: 'Clé dynamométrique',
    describe: (m) => `Coup 3 : +${String(Math.round(12 * m))} dégâts.`,
    apply: (x, m) => {
      x.finisherDamage += 12 * m;
    },
  },
];

export const AVANTAGES_BY_ID: ReadonlyMap<string, AvantageDef> = new Map(
  AVANTAGES.map((a) => [a.id, a]),
);

export interface OwnedAvantage {
  readonly id: string;
  readonly rarity: Rarity;
}

/** Applique les Avantages détenus à une base de modificateurs (copie). */
export function computeMods(base: HeroMods, owned: readonly OwnedAvantage[]): HeroMods {
  const mods = { ...base };
  for (const o of owned) {
    const def = AVANTAGES_BY_ID.get(o.id);
    def?.apply(mods, RARITIES[o.rarity].mult);
  }
  return mods;
}

/** Tirage de rareté : Standard 70 / Ancienneté 23 / Statutaire 7, décalé de `rareShift` points. */
export function rollRarity(rng: Rng, rareShift = 0): Rarity {
  const roll = rng() * 100;
  const statutaire = 7 + rareShift * 0.3;
  const anciennete = 23 + rareShift * 0.7;
  if (roll < statutaire) return 'statutaire';
  if (roll < statutaire + anciennete) return 'anciennete';
  return 'standard';
}

export interface AvantageOffer {
  readonly family: Family;
  readonly options: readonly OwnedAvantage[];
}

/**
 * Propose `count` Avantages d'une même famille (complétés par d'autres familles si elle est trop petite).
 * Les Avantages déjà possédés sont exclus.
 */
export function offerAvantages(
  rng: Rng,
  owned: readonly OwnedAvantage[],
  count = 3,
  rareShift = 0,
): AvantageOffer {
  const ownedIds = new Set(owned.map((o) => o.id));
  const free = AVANTAGES.filter((a) => !ownedIds.has(a.id));
  const families = [...new Set(free.map((a) => a.family))];
  const familyId = pick(rng, families) ?? 'marcel';
  const fromFamily = free.filter((a) => a.family === familyId);
  const others = free.filter((a) => a.family !== familyId);
  const chosen: AvantageDef[] = [];
  const draw = (list: AvantageDef[]): void => {
    while (chosen.length < count && list.length > 0) {
      const i = Math.floor(rng() * list.length);
      const [a] = list.splice(i, 1);
      if (a) chosen.push(a);
    }
  };
  draw([...fromFamily]);
  draw([...others]);
  return {
    family: FAMILIES[familyId],
    options: chosen.map((a) => ({ id: a.id, rarity: rollRarity(rng, rareShift) })),
  };
}
