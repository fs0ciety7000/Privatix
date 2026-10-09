import type {
  AffixDef,
  AffixTiers,
  GearStat,
  ImplicitDef,
  ItemDef,
  StatFormat,
} from '@/config/loot';
import {
  AFFIXES_BY_ID,
  GEAR_STATS,
  ITEMS_BY_ID,
  LEGENDARIES_BY_ID,
  LOOT_RULES,
  SETS_BY_ID,
  SLOT_LABELS,
  SOLIDARITE_LABELS,
  ITEM_RARITIES,
} from '@/config/loot';
import { effectiveIlvl, tierOf } from '@/systems/loot/ilvl';
import type { AffixRoll, ItemInstance } from '@/systems/loot/types';

/** Arrondi au pas, sans bruit flottant (0,07 et non 0,07000000000000001). */
export function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(6));
}

/** Qualité normalisée : bornée dans [0, 1] et quantifiée au centième. */
export function quantizeQ(q: number): number {
  if (!Number.isFinite(q)) return 0;
  return Math.round(Math.max(0, Math.min(1, q)) * 100) / 100;
}

/** `arrondi_au_pas(lerp(min, max, q))` au palier de l'ilvl donné. */
export function tierValue(tiers: AffixTiers, step: number, q: number, ilvl: number): number {
  const tier = tiers[tierOf(ilvl)];
  return roundToStep(tier.min + (tier.max - tier.min) * quantizeQ(q), step);
}

/** Valeur d'un affixe (stat principale) pour un objet d'ilvl donné. */
export function affixValue(def: AffixDef, q: number, ilvl: number): number {
  return tierValue(def.tiers, def.step, q, ilvl);
}

/** Valeur de la seconde stat d'un affixe double (Percutant, Serré, de Nuit), sinon 0. */
export function affixSecondaryValue(def: AffixDef, q: number, ilvl: number): number {
  return def.secondary ? tierValue(def.secondary.tiers, def.secondary.step, q, ilvl) : 0;
}

/** Implicite Calibre des Outils : ×(1 + 0,012 × (ilvl − 1)). */
export function calibreOf(ilvl: number): number {
  return Number((1 + LOOT_RULES.CALIBRE_PER_ILVL * (ilvl - 1)).toFixed(4));
}

/** Valeur de l'implicite d'une base (Calibre : multiplicateur ; sinon : valeur de la stat). */
export function implicitValue(implicit: ImplicitDef, q: number, ilvl: number): number {
  if (implicit.kind === 'calibre') return calibreOf(ilvl);
  return tierValue(implicit.tiers, 0.001, q, ilvl);
}

export function itemDef(item: ItemInstance): ItemDef | undefined {
  return ITEMS_BY_ID.get(item.defId);
}

/** Nom affiché : `[Base] [préfixe] [suffixe]`, ou le nom propre d'un Patrimoine. */
export function itemName(item: ItemInstance): string {
  const legendary = item.legendaryId ? LEGENDARIES_BY_ID.get(item.legendaryId) : undefined;
  if (legendary) return legendary.name;
  const base = itemDef(item)?.name ?? 'Objet inconnu';
  const affixLabel = (roll: AffixRoll | undefined): string | undefined => {
    if (!roll) return undefined;
    const def = AFFIXES_BY_ID.get(roll.affixId);
    if (!def) return undefined;
    return def.stat === 'familyMult' && roll.family ? SOLIDARITE_LABELS[roll.family] : def.label;
  };
  const prefix = affixLabel(
    item.affixes.find((a) => AFFIXES_BY_ID.get(a.affixId)?.kind === 'prefix'),
  );
  const suffix = affixLabel(
    item.affixes.find((a) => AFFIXES_BY_ID.get(a.affixId)?.kind === 'suffix'),
  );
  return [base, prefix, suffix].filter((s): s is string => s !== undefined).join(' ');
}

const fr = (v: number, digits = 1): string =>
  String(Math.round(v * 10 ** digits) / 10 ** digits).replace('.', ',');

/** Valeur formatée avec son signe (« +5 % », « −7 % », « +12 px », « +1,5 s »). */
export function formatStat(statId: GearStat, value: number): string {
  const format: StatFormat = GEAR_STATS[statId].format;
  // Les réductions sont stockées en positif et affichées en négatif (« Dégâts subis −7 % »).
  const lowerIsShown = statId.endsWith('Reduction') || statId === 'slowResist';
  const signed = lowerIsShown ? -value : value;
  const sign = signed < 0 ? '−' : '+';
  const abs = Math.abs(signed);
  switch (format) {
    case 'pct':
      return `${sign}${fr(abs * 100)} %`;
    case 'pts':
      return `${sign}${fr(abs * 100)} pts`;
    case 'flat':
      return `${sign}${fr(abs)}`;
    case 'px':
      return `${sign}${fr(abs)} px`;
    case 'ms':
      // Sous la seconde (fenêtre du dash parfait) : en ms, sinon « +0 s » ne dirait rien.
      return abs < 1000 ? `${sign}${fr(abs, 0)} ms` : `${sign}${fr(abs / 1000)} s`;
    case 'perS':
      return `${sign}${fr(abs)}/s`;
  }
}

/** Ligne affichée d'un affixe (« Dégâts de Frappe +7 % »), au palier de l'ilvl effectif. */
export function describeAffix(roll: AffixRoll, ilvl: number): string {
  const def = AFFIXES_BY_ID.get(roll.affixId);
  if (!def) return 'Affixe inconnu';
  const value = affixValue(def, roll.q, ilvl);
  if (def.stat === 'familyMult') {
    const who = roll.family ? SOLIDARITE_LABELS[roll.family].replace(/^de /, '') : '?';
    return `Avantages de ${who} +${fr(value * 100)} %`;
  }
  const main = `${GEAR_STATS[def.stat].label} ${formatStat(def.stat, value)}`;
  if (!def.secondary) return main;
  const second = affixSecondaryValue(def, roll.q, ilvl);
  return `${main} · ${GEAR_STATS[def.secondary.stat].label} ${formatStat(def.secondary.stat, second)}`;
}

/**
 * Lignes de la fiche d'un objet (carte de comparaison, Vestiaire) : en-tête, implicite, affixes,
 * pouvoir légendaire, Attelage, saveur. Les valeurs sont celles de l'ilvl effectif en salle `r`.
 */
export function describeItem(item: ItemInstance, r = Number.POSITIVE_INFINITY): string[] {
  const def = itemDef(item);
  const ilvl = effectiveIlvl(item.ilvl, r);
  const lines: string[] = [
    `${itemName(item)} — ${ITEM_RARITIES[item.rarity].label}, ilvl ${ilvl} (palier ${String(tierOf(ilvl) + 1)})`,
  ];
  if (def) {
    lines.push(SLOT_LABELS[def.slot]);
    if (def.implicit.kind === 'calibre') {
      lines.push(`Calibre ×${fr(calibreOf(ilvl), 2)}`);
    } else {
      const v = implicitValue(def.implicit, item.implicitQ, ilvl);
      lines.push(`${GEAR_STATS[def.implicit.stat].label} ${formatStat(def.implicit.stat, v)}`);
    }
  }
  for (const roll of item.affixes) lines.push(describeAffix(roll, ilvl));
  const legendary = item.legendaryId ? LEGENDARIES_BY_ID.get(item.legendaryId) : undefined;
  if (legendary) {
    lines.push(legendary.powerText, `Contrepartie : ${legendary.drawbackText}`);
  }
  const set = item.setId ? SETS_BY_ID.get(item.setId) : undefined;
  if (set) lines.push(`Attelage : ${set.name}`);
  const flavor = legendary?.flavor ?? def?.flavor;
  if (flavor) lines.push(`« ${flavor} »`);
  return lines;
}
