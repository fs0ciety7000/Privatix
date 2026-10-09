import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { COLORS } from '@/config/colors';
import { BootScene } from '@/scenes/BootScene';
import { PreloaderScene } from '@/scenes/PreloaderScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { GameScene } from '@/scenes/GameScene';
import { UIScene } from '@/scenes/UIScene';
import { DialogueScene } from '@/scenes/DialogueScene';
import { BattleScene } from '@/scenes/BattleScene';

/**
 * Point d'entrée de Privatix.
 * La configuration Phaser est le seul endroit où l'on instancie le jeu ;
 * toute logique vit dans les scènes et les systèmes.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.sncb.bgDeep,
  // Phaser 4 : pixel-art net (antialias coupé + roundPixels). roundPixels vaut false par défaut en v4.
  render: {
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Ordre = ordre d'affichage des scènes lancées en parallèle : Combat au-dessus du dialogue, au-dessus de l'UI, au-dessus du jeu.
  scene: [BootScene, PreloaderScene, MainMenuScene, GameScene, UIScene, DialogueScene, BattleScene],
};

// Une seule instance de Game ; elle n'est jamais exposée globalement.
new Phaser.Game(config);
