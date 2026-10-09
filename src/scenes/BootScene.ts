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
    this.registry.set(RegistryKeys.GameState, createInitialGameState());
    this.scene.start(SceneKeys.Preloader);
  }
}
