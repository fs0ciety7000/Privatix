import type { LegendaryPowerId } from '@/config/loot';
import { LEGENDARIES_BY_ID } from '@/config/loot';
import type { EquipmentModifiers } from '@/systems/loot/stats';

/**
 * Pouvoirs légendaires « Patrimoine » : hooks nommés appelés par la sim (proposition § 7.2). Le
 * `switch` est exhaustif : ajouter un `LegendaryPowerId` sans le traiter casse la compilation.
 */
export type LegendaryHook =
  | 'onComboLoop'
  | 'onComboStart'
  | 'onFinisher'
  | 'onQuickHit'
  | 'onDashStart'
  | 'onPerfectDash'
  | 'onCupHold'
  | 'onCupDrink'
  | 'onRoomEnter'
  | 'onRoomCleared'
  | 'onBurnoutReach'
  | 'onHitTaken'
  | 'onMeltdown'
  | 'onMobilisation'
  | 'passive';

function assertNever(x: never): never {
  throw new Error(`Pouvoir légendaire non géré : ${String(x)}`);
}

/** Hooks à brancher pour un pouvoir. */
export function legendaryHooks(power: LegendaryPowerId): readonly LegendaryHook[] {
  switch (power) {
    case 'cliquet-perpetuel':
      return ['onComboLoop', 'onHitTaken'];
    case 'parade-wagon-bar':
      return ['onComboStart'];
    case 'derniere-traverse':
      return ['onFinisher'];
    case 'demonte-tout':
      return ['onFinisher', 'onQuickHit'];
    case 'feu-rouge':
      return ['onFinisher', 'passive'];
    case 'cocotte-minute':
      return ['onBurnoutReach', 'passive'];
    case 'comite-de-greve':
      return ['onMobilisation', 'passive'];
    case 'dernier-train':
      return ['onDashStart', 'onPerfectDash', 'passive'];
    case 'thermos-inepuisable':
      return ['onCupHold', 'onHitTaken'];
    case 'carnet-revendications':
      return ['onRoomCleared', 'onCupDrink', 'onMeltdown'];
    case 'haute-visibilite':
      return ['onPerfectDash', 'passive'];
    case 'boule-a-facettes':
      return ['onPerfectDash'];
    case 'ruban-inaugural':
      return ['onRoomEnter', 'onHitTaken', 'onRoomCleared'];
    default:
      return assertNever(power);
  }
}

/** Le pouvoir est-il porté ? */
export function hasPower(mods: EquipmentModifiers, power: LegendaryPowerId): boolean {
  return mods.legendaries.some((l) => l.power === power);
}

/** Paramètre chiffré d'un pouvoir porté (sinon `fallback`). */
export function powerParam(
  mods: EquipmentModifiers,
  power: LegendaryPowerId,
  key: string,
  fallback = 0,
): number {
  return mods.legendaries.find((l) => l.power === power)?.params[key] ?? fallback;
}

/**
 * Casque Cocotte-minute : le Burnout est bloqué à 99 et le Pétage de plombs ne se déclenche plus.
 * Renvoie la valeur de Burnout à appliquer (inchangée sans le casque).
 */
export function clampBurnoutForGear(mods: EquipmentModifiers, burnout: number): number {
  if (!hasPower(mods, 'cocotte-minute')) return burnout;
  return Math.min(burnout, powerParam(mods, 'cocotte-minute', 'burnoutCap', 99));
}

/** Vrai si l'équipement empêche le Pétage de plombs (Cocotte-minute). */
export function meltdownBlocked(mods: EquipmentModifiers): boolean {
  return hasPower(mods, 'cocotte-minute');
}

/** Nom affiché d'un légendaire (codex des Plans, annonces de Rudy). */
export function legendaryName(id: string): string {
  return LEGENDARIES_BY_ID.get(id)?.name ?? 'Plan inconnu';
}
