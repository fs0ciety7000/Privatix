import { COFFEE, HERO } from '@/config/balance';
import type {
  GearStat,
  ItemFlag,
  LegendaryDef,
  LegendaryPowerId,
  SetBonusDef,
  SetDef,
  SetSpecialId,
  SlotId,
  ToolDef,
} from '@/config/loot';
import {
  AFFIXES_BY_ID,
  DEFAULT_TOOL_ID,
  GEAR_CAPS,
  GEAR_POWER_CAP,
  GEAR_STATS,
  ITEMS_BY_ID,
  LEGENDARIES_BY_ID,
  SETS,
  SLOTS,
  TOOLS,
} from '@/config/loot';
import type { FamilyId } from '@/systems/meta/Avantages';
import { effectiveIlvl } from '@/systems/loot/ilvl';
import { dpsEstimate, nakedDps } from '@/systems/loot/power';
import type { EquippedItems, GearStats, ItemInstance } from '@/systems/loot/types';
import { affixSecondaryValue, affixValue, calibreOf, implicitValue } from '@/systems/loot/values';

export const GEAR_STAT_IDS = Object.keys(GEAR_STATS) as GearStat[];

function defaultTool(): ToolDef {
  const tool = TOOLS[DEFAULT_TOOL_ID];
  if (!tool) throw new Error('Outil par défaut absent du catalogue');
  return tool;
}

/** Agrégat vide (toutes les stats à 0). */
export function emptyStats(): Record<GearStat, number> {
  const out = {} as Record<GearStat, number>;
  for (const k of GEAR_STAT_IDS) out[k] = 0;
  return out;
}

export interface GearOptions {
  /** Indice de salle `r` : plafonne l'ilvl effectif (`min(ilvl, r + 3)`). Absent : aucun plafond. */
  readonly r?: number;
}

export interface ActiveSet {
  readonly set: SetDef;
  readonly count: number;
  /** Paliers atteints (2, 3, 4 pièces). */
  readonly bonuses: readonly SetBonusDef[];
}

/** Objets portés, sans les cases vides (accepte l'équipement ou une liste). */
export function wornItems(
  equipped: EquippedItems | readonly (ItemInstance | null)[],
): ItemInstance[] {
  const list: readonly (ItemInstance | null)[] = Array.isArray(equipped)
    ? (equipped as readonly (ItemInstance | null)[])
    : SLOTS.map((s) => (equipped as EquippedItems)[s]);
  return list.filter((i): i is ItemInstance => i !== null);
}

/** Attelages portés : seules les pièces d'Attelage (`setId`) comptent, une par base. */
export function activeSets(items: readonly ItemInstance[]): ActiveSet[] {
  const out: ActiveSet[] = [];
  for (const set of SETS) {
    const bases = new Set(items.filter((i) => i.setId === set.id).map((i) => i.defId));
    const count = set.pieces.filter((p) => bases.has(p)).length;
    if (count === 0) continue;
    out.push({ set, count, bonuses: set.bonuses.filter((b) => b.count <= count) });
  }
  return out;
}

/** Plafonds par stat (§ 3.6), appliqués en dernier. */
export function applyCaps(stats: Readonly<Record<GearStat, number>>): GearStats {
  const out = { ...stats };
  for (const [k, cap] of Object.entries(GEAR_CAPS) as [GearStat, number][]) {
    out[k] = Math.min(out[k], cap);
  }
  return out;
}

export interface GearAggregate {
  /** Somme brute (implicites, affixes, contreparties, Attelages), avant plafonds. */
  readonly raw: GearStats;
  /** Après plafonds : c'est ce que le jeu applique. */
  readonly stats: GearStats;
  /** Multiplicateur de valeur des Avantages par famille (S15) : 1,15 = +15 %. */
  readonly familyMult: Readonly<Partial<Record<FamilyId, number>>>;
  /** Implicite de l'Outil : dégâts de base ×Calibre. */
  readonly calibre: number;
  readonly toolId: string;
  readonly tool: ToolDef;
  readonly legendaries: readonly LegendaryDef[];
  readonly sets: readonly ActiveSet[];
  readonly flags: readonly ItemFlag[];
}

/**
 * Agrège l'équipement porté : implicites et affixes à l'ilvl effectif, contreparties des
 * légendaires, bonus d'Attelage, puis plafonds.
 */
export function gearStats(
  equipped: EquippedItems | readonly (ItemInstance | null)[],
  opts: GearOptions = {},
): GearAggregate {
  const items = wornItems(equipped);
  const raw = emptyStats();
  const familyMult: Partial<Record<FamilyId, number>> = {};
  const flags = new Set<ItemFlag>();
  const legendaries: LegendaryDef[] = [];
  let calibre = 1;
  let toolId = DEFAULT_TOOL_ID;

  for (const item of items) {
    const def = ITEMS_BY_ID.get(item.defId);
    if (!def) continue;
    const ilvl = effectiveIlvl(item.ilvl, opts.r);
    if (def.implicit.kind === 'calibre') {
      calibre = calibreOf(ilvl);
      if (def.tool) toolId = def.tool;
    } else {
      raw[def.implicit.stat] += implicitValue(def.implicit, item.implicitQ, ilvl);
    }
    for (const f of def.flags ?? []) flags.add(f);
    for (const roll of item.affixes) {
      const affix = AFFIXES_BY_ID.get(roll.affixId);
      if (!affix) continue;
      const value = affixValue(affix, roll.q, ilvl);
      if (affix.stat === 'familyMult') {
        if (roll.family) familyMult[roll.family] = (familyMult[roll.family] ?? 1) + value;
      } else {
        raw[affix.stat] += value;
      }
      if (affix.secondary) raw[affix.secondary.stat] += affixSecondaryValue(affix, roll.q, ilvl);
    }
    const legendary = item.legendaryId ? LEGENDARIES_BY_ID.get(item.legendaryId) : undefined;
    if (legendary) {
      legendaries.push(legendary);
      for (const [k, v] of Object.entries(legendary.drawback) as [GearStat, number][]) raw[k] += v;
    }
  }

  const sets = activeSets(items);
  for (const s of sets) {
    for (const b of s.bonuses) {
      for (const [k, v] of Object.entries(b.stats) as [GearStat, number][]) raw[k] += v;
    }
  }

  for (const k of GEAR_STAT_IDS) raw[k] = Number(raw[k].toFixed(6));
  const tool = TOOLS[toolId] ?? defaultTool();
  return {
    raw,
    stats: applyCaps(raw),
    familyMult,
    calibre,
    toolId,
    tool,
    legendaries,
    sets,
    flags: [...flags],
  };
}

/** Pouvoir légendaire actif, avec ses chiffres (lus par la sim). */
export interface ActiveLegendary {
  readonly id: string;
  readonly power: LegendaryPowerId;
  readonly params: Readonly<Record<string, number>>;
}

export interface ActiveSetSpecial {
  readonly setId: string;
  readonly special: SetSpecialId;
  readonly params: Readonly<Record<string, number>>;
}

/**
 * Modificateurs du héros prêts à appliquer, indépendants de la sim. Conventions :
 * - `*Mult` : multiplicateur (1 = neutre) ; `*Bonus` : additif (0 = neutre) ;
 * - `damage.bonus` va dans le **seau additif** des dégâts (avec les Avantages et la méta) ;
 * - le critique de l'Outil remplace `HERO.CRIT_CHANCE` (`critChanceBase`) ; la sim plafonne le
 *   total de critique à `GEAR_CAPS.critChance`.
 */
export interface EquipmentModifiers {
  readonly toolId: string;
  readonly tool: ToolDef;
  readonly damage: {
    /** Dégâts de base ×Calibre (implicite de l'Outil), × `powerCapScale`. */
    readonly baseMult: number;
    /** < 1 quand le garde-fou `GEAR_POWER_CAP` rabote la tenue (sinon 1). */
    readonly powerCapScale: number;
    /** Bonus additif (seau `damageBonus`). */
    readonly bonus: number;
    readonly finisherMult: number;
    readonly dashAttackMult: number;
    readonly critChanceBase: number;
    readonly critChanceBonus: number;
    readonly critMultBonus: number;
    /** +X par tranche de 10 de Burnout (ajouté au seau additif par la sim). */
    readonly perBurnout10: number;
    readonly electricMult: number;
    readonly nightBonus: number;
    readonly afterPerfectDashBonus: number;
    readonly arcDamage: number;
    readonly fineChance: number;
    readonly knockbackMult: number;
    readonly wallSlamBonus: number;
  };
  /** Startup, active et recovery ×1/attackSpeedMult. */
  readonly attackSpeedMult: number;
  readonly defense: {
    readonly maxEnergyBonus: number;
    /** Dégâts subis ×damageTakenMult (réduction plafonnée à 30 %, puis malus). */
    readonly damageTakenMult: number;
    readonly energyOnRoomClear: number;
    /** Durée des ralentis et étourdissements subis ×slowTakenMult. */
    readonly slowTakenMult: number;
    readonly maxGobeletsBonus: number;
  };
  readonly burnout: {
    /** Burnout gagné en encaissant ×onHitMult. */
    readonly onHitMult: number;
    readonly decayBonusPerS: number;
    /** Plancher « Fatigue de fond » ×floorMult. */
    readonly floorMult: number;
    readonly meltdownMsBonus: number;
    readonly meltdownPenaltyReduction: number;
  };
  readonly movement: {
    readonly speedMult: number;
    readonly ballastImmune: boolean;
    readonly lightRadiusBonus: number;
  };
  readonly dash: {
    readonly rechargeMult: number;
    readonly distanceBonus: number;
    readonly perfectWindowBonusMs: number;
    readonly chargesBonus: number;
    readonly trailDamage: number;
  };
  readonly whistle: { readonly radiusBonus: number; readonly damageMult: number };
  readonly mobilisation: {
    readonly gainMult: number;
    readonly onRoomEnter: number;
    readonly onHitTaken: number;
  };
  readonly coffee: {
    /** Points de soin ajoutés (0,03 = 30 % → 33 %). */
    readonly healBonus: number;
    /** Burnout d'un Gobelet : `BURNOUT.PER_COFFEE + burnoutDelta` (jamais sous +15). */
    readonly burnoutDelta: number;
    readonly caffeineMsBonus: number;
    readonly caffeineAttackSpeedBonus: number;
  };
  readonly economy: { readonly ticketsMult: number };
  /** Valeur des Avantages par famille (S15) : multiplie le `mult` de rareté. */
  readonly familyMult: Readonly<Partial<Record<FamilyId, number>>>;
  readonly legendaries: readonly ActiveLegendary[];
  readonly setSpecials: readonly ActiveSetSpecial[];
  readonly sets: readonly { readonly setId: string; readonly count: number }[];
  /** Stats plafonnées (carte de comparaison, écran « Tenue »). */
  readonly stats: GearStats;
}

/**
 * Modificateurs de l'équipement porté, prêts à appliquer au héros (dégâts, vitesse, Burnout,
 * dash, Sifflet, café…). Pur et sans dépendance à la sim : `opts.r` plafonne l'ilvl effectif.
 */
export function equipmentModifiers(
  equipped: EquippedItems | readonly (ItemInstance | null)[],
  opts: GearOptions = {},
): EquipmentModifiers {
  const g = gearStats(equipped, opts);
  const s = g.stats;
  const attackSpeedMult = 1 + s.attackSpeed;
  const uncapped = {
    baseMult: g.calibre,
    bonus: s.damage,
    finisherMult: 1 + s.finisherDamage,
    critChanceBase: g.tool.baseCrit ?? HERO.CRIT_CHANCE,
    critChanceBonus: s.critChance,
    critMultBonus: s.critMult,
    perBurnout10: s.burnoutDamage,
  };
  // Garde-fou : la Frappe estimée de l'équipement reste ≤ GEAR_POWER_CAP (sans Avantages).
  const ratio = dpsEstimate({ tool: g.tool, attackSpeedMult, damage: uncapped }) / nakedDps(g.tool);
  const powerCapScale = ratio > GEAR_POWER_CAP ? GEAR_POWER_CAP / ratio : 1;
  return {
    toolId: g.toolId,
    tool: g.tool,
    damage: {
      ...uncapped,
      baseMult: g.calibre * powerCapScale,
      powerCapScale,
      dashAttackMult: 1 + s.dashAttackDamage,
      electricMult: 1 + s.electricDamage + (g.tool.traitParams?.electricDamageBonus ?? 0),
      nightBonus: s.nightDamage,
      afterPerfectDashBonus: s.perfectDashNextHit,
      arcDamage: s.arcDamage,
      fineChance: s.fineChance,
      knockbackMult: (1 + s.knockback) * (g.tool.traitParams?.knockbackMult ?? 1),
      wallSlamBonus: s.wallSlamDamage,
    },
    attackSpeedMult,
    defense: {
      maxEnergyBonus: s.maxEnergy,
      damageTakenMult: Number(
        ((1 - s.damageTakenReduction) * (1 + s.damageTakenIncrease)).toFixed(6),
      ),
      energyOnRoomClear: s.energyOnRoomClear,
      slowTakenMult: 1 - s.slowResist,
      maxGobeletsBonus: s.maxGobelets,
    },
    burnout: {
      onHitMult: 1 - s.burnoutOnHitReduction,
      decayBonusPerS: s.burnoutDecay,
      floorMult: 1 - s.burnoutFloorReduction,
      meltdownMsBonus: s.meltdownMs,
      meltdownPenaltyReduction: s.meltdownPenaltyReduction,
    },
    movement: {
      speedMult: 1 + s.speed,
      ballastImmune: g.flags.includes('ballast-immune'),
      lightRadiusBonus: s.lightRadius + (g.tool.traitParams?.lightRadius ?? 0),
    },
    dash: {
      rechargeMult: 1 - s.dashRechargeReduction,
      distanceBonus: s.dashDistance,
      perfectWindowBonusMs: s.perfectDashWindowMs,
      chargesBonus: s.dashCharges,
      trailDamage: s.dashTrailDamage,
    },
    whistle: { radiusBonus: s.whistleRadius, damageMult: 1 + s.whistleDamage },
    mobilisation: {
      gainMult: 1 + s.mobilisationGain,
      onRoomEnter: s.mobilisationOnRoomEnter,
      onHitTaken: s.mobilisationOnHitTaken,
    },
    coffee: {
      healBonus: s.coffeeHeal,
      burnoutDelta: -s.coffeeBurnoutReduction,
      caffeineMsBonus: s.caffeineMs,
      caffeineAttackSpeedBonus: s.caffeineAttackSpeed,
    },
    economy: { ticketsMult: 1 + s.tickets },
    familyMult: g.familyMult,
    legendaries: g.legendaries.map((l) => ({ id: l.id, power: l.power, params: l.params })),
    setSpecials: g.sets.flatMap((a) =>
      a.bonuses.flatMap((b) =>
        b.special ? [{ setId: a.set.id, special: b.special, params: b.params ?? {} }] : [],
      ),
    ),
    sets: g.sets.map((a) => ({ setId: a.set.id, count: a.count })),
    stats: s,
  };
}

/** Emplacement d'un objet (d'après sa base), ou `undefined` si la base est inconnue. */
export function slotOf(item: ItemInstance): SlotId | undefined {
  return ITEMS_BY_ID.get(item.defId)?.slot;
}

/** Durée de Caféine résultante (pratique pour le HUD). */
export function caffeineMs(mods: EquipmentModifiers): number {
  return COFFEE.CAFFEINE_MS + mods.coffee.caffeineMsBonus;
}
