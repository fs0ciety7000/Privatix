import { COMBO_RULES, HERO } from '@/config/balance';
import type { ToolDef } from '@/config/loot';
import { GEAR_CAPS } from '@/config/loot';

/** Durée d'un combo enchaîné (ms) : chaque coup sauf le dernier s'enchaîne au chain point. */
export function comboDurationMs(tool: ToolDef): number {
  return tool.combo.reduce(
    (sum, s, i) =>
      sum +
      s.startupMs +
      s.activeMs +
      (i < tool.combo.length - 1 ? COMBO_RULES.CHAIN_FROM_RECOVERY_MS : s.recoveryMs),
    0,
  );
}

/**
 * DPS mono-cible de base d'un Outil (sans équipement) : dégâts du combo / durée enchaînée,
 * critique de l'Outil compté au-delà du critique de base du héros (proposition § 4.2).
 */
export function toolBaseDps(tool: ToolDef): number {
  const damage = tool.combo.reduce((s, step) => s + step.damage, 0);
  const crit = (tool.baseCrit ?? HERO.CRIT_CHANCE) - HERO.CRIT_CHANCE;
  return (damage / (comboDurationMs(tool) / 1000)) * (1 + crit * (HERO.CRIT_MULT - 1));
}

/** Entrées offensives du DPS estimé (sous-ensemble de `EquipmentModifiers`). */
export interface DpsInputs {
  readonly tool: ToolDef;
  readonly attackSpeedMult: number;
  readonly damage: {
    readonly baseMult: number;
    readonly bonus: number;
    readonly finisherMult: number;
    readonly critChanceBase: number;
    readonly critChanceBonus: number;
    readonly critMultBonus: number;
    readonly perBurnout10: number;
  };
}

export interface DpsContext {
  /** Bonus additif déjà apporté par les Avantages et la méta (même seau que l'équipement). */
  readonly damageBucket?: number;
  /** Burnout supposé (Sous tension). */
  readonly burnout?: number;
}

/**
 * DPS mono-cible estimé sur le moveset de l'Outil (résumé « Frappe ») : Calibre × seau additif ×
 * coup final × vitesse d'attaque × espérance du critique (critique plafonné à 50 %).
 */
export function dpsEstimate(mods: DpsInputs, ctx: DpsContext = {}): number {
  const tool = mods.tool;
  const d = mods.damage;
  const bucket =
    1 + (ctx.damageBucket ?? 0) + d.bonus + d.perBurnout10 * Math.floor((ctx.burnout ?? 0) / 10);
  const comboDamage = tool.combo.reduce(
    (s, step, i) => s + step.damage * (i === tool.finisherIndex ? d.finisherMult : 1),
    0,
  );
  const seconds = comboDurationMs(tool) / 1000 / mods.attackSpeedMult;
  const crit = Math.min(GEAR_CAPS.critChance ?? 1, d.critChanceBase + d.critChanceBonus);
  const critFactor = 1 + crit * (HERO.CRIT_MULT + d.critMultBonus - 1);
  return ((comboDamage * d.baseMult * bucket) / seconds) * critFactor;
}

/** DPS de référence : héros sans équipement avec cet Outil (critique de base de l'Outil compris). */
export function nakedDps(tool: ToolDef, ctx: DpsContext = {}): number {
  return dpsEstimate(
    {
      tool,
      attackSpeedMult: 1,
      damage: {
        baseMult: 1,
        bonus: 0,
        finisherMult: 1,
        critChanceBase: tool.baseCrit ?? HERO.CRIT_CHANCE,
        critChanceBonus: 0,
        critMultBonus: 0,
        perBurnout10: 0,
      },
    },
    ctx,
  );
}
