import Phaser from 'phaser';
import { Colors, GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { BootScene } from '@/scenes/BootScene';
import { PreloaderScene } from '@/scenes/PreloaderScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { HubScene } from '@/scenes/HubScene';
import { RunScene } from '@/scenes/RunScene';
import { UIScene } from '@/scenes/UIScene';
import { PauseScene } from '@/scenes/PauseScene';
import { ResultsScene } from '@/scenes/ResultsScene';

/**
 * Point d'entrée de Privatix (Phaser 4, Arcade Physics, pixel art 640×360).
 * Seul endroit où le jeu est instancié ; toute logique vit dans les scènes, entités et systèmes.
 */
const config: Phaser.Types.Core.GameConfig = {
  // Phaser 4 : le rendu Canvas est déprécié, WebGL obligatoire.
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: Colors.outline,
  // Pixel art net : filtrage au plus proche. roundPixels vaut false par défaut en Phaser 4.
  pixelArt: true,
  roundPixels: true,
  // Éclairage dynamique : lampes de la salle, lampe frontale du héros et éclairs des impacts.
  maxLights: 32,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      // Vue de dessus : aucune gravité.
      gravity: { x: 0, y: 0 },
      fps: 60,
      fixedStep: true,
      debug: import.meta.env.DEV && new URLSearchParams(location.search).has('debug'),
    },
  },
  input: {
    activePointers: 3,
    gamepad: true,
  },
  // Ordre = ordre d'affichage des scènes parallèles : l'UI au-dessus du Run, la pause au-dessus de tout.
  scene: [
    BootScene,
    PreloaderScene,
    MainMenuScene,
    HubScene,
    RunScene,
    UIScene,
    ResultsScene,
    PauseScene,
  ],
};

new Phaser.Game(config);
