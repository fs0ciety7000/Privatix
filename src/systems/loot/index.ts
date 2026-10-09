/**
 * Système de loot et d'équipement (pur, seedé, sans Phaser ni three). Point d'entrée unique pour
 * la sim 3D et l'UI. Données : `src/config/loot.ts`. Design : docs/GDD.md § 9 bis.
 *
 * Parcours type d'un Shift :
 * 1. `startLootRun(meta)` → `{ loadout, run, pity }` (Paquetage équipé, Outil de départ) ;
 * 2. en salle : `dropsForKill`, `dropsForSource`, `announceDotation` + `dotationOffer`
 *    (chaque appel renvoie les objets et le nouveau curseur `{ run, pity }`) ;
 * 3. ramassage : `compareInLoadout` (carte ▲▼), `equip`, `stash`, `scrapValue` ;
 * 4. héros : `equipmentModifiers(loadout.equipped, { r })` à chaque changement d'équipement ;
 * 5. fin de Shift : `consignLimit` puis `settleLootRun(meta, { outcome, loadout, run, pity, keep })`.
 */
export * from '@/systems/loot/types';
export * from '@/systems/loot/ilvl';
export * from '@/systems/loot/values';
export * from '@/systems/loot/rarity';
export * from '@/systems/loot/roll';
export * from '@/systems/loot/drops';
export * from '@/systems/loot/stats';
export * from '@/systems/loot/power';
export * from '@/systems/loot/compare';
export * from '@/systems/loot/equip';
export * from '@/systems/loot/legendary';
export * from '@/systems/loot/serialize';
export * from '@/systems/loot/vestiaire';
