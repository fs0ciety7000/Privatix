import Phaser from 'phaser';
import { RegistryKeys, SceneKeys } from '@/config/constants';
import { loadMeta } from '@/platform/save';
import { NO_TOUCH } from '@/systems/meta/session';

/**
 * Première scène : initialise TOUTES les clés partagées du registry (la création d'une clé émet `setdata`,
 * pas `changedata` : un écouteur raterait sinon la première valeur), charge la progression, puis passe au Preloader.
 */
export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Boot);
  }

  public create(): void {
    const reg = this.registry;
    reg.set(RegistryKeys.Meta, loadMeta());
    reg.set(RegistryKeys.Hud, null);
    reg.set(RegistryKeys.Notice, { seq: 0, text: '' });
    reg.set(RegistryKeys.LastResult, null);
    reg.set(RegistryKeys.Touch, NO_TOUCH);
    this.input.mouse?.disableContextMenu();
    this.scene.start(SceneKeys.Preloader);
  }
}
