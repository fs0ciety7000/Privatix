import Phaser from 'phaser';
import { RegistryKeys, SceneKeys } from '@/config/constants';
import { createInitialGameState } from '@/systems/GameState';

/**
 * Boot : configuration minimale et initialisation du registry.
 * Ne charge AUCUN asset lourd (c'est le rôle du Preloader).
 */
export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Boot);
  }

  public create(): void {
    // Toutes les clés partagées sont créées ici. Phaser émet `setdata` à la création d'une clé et
    // `changedata` ensuite seulement : les scènes n'écoutent que `changedata`, donc une clé créée plus tard
    // perdrait sa première valeur (premier bandeau, premier appui sur le bouton A tactile).
    this.registry.set(RegistryKeys.GameState, createInitialGameState());
    this.registry.set(RegistryKeys.InteractionHint, null);
    this.registry.set(RegistryKeys.Notice, null);
    this.registry.set(RegistryKeys.VirtualDir, null);
    this.registry.set(RegistryKeys.VirtualAction, 0);
    this.scene.start(SceneKeys.Preloader);
  }
}
