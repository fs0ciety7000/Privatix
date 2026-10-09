/**
 * Constantes globales du jeu.
 * Toute valeur "magique" doit vivre ici, jamais en dur dans une scène.
 */

/** Résolution logique du canvas (16:9). Le pixel-art est mis à l'échelle en entier par Phaser.Scale. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Taille d'une tuile de tilemap et d'une case de déplacement. */
export const TILE_SIZE = 16;

/** Vitesse de déplacement du joueur en exploration (px/s). */
export const PLAYER_SPEED = 96;

/** Clés des scènes. Toujours passer par cet enum, jamais par une chaîne littérale. */
export const SceneKeys = {
  Boot: 'Boot',
  Preloader: 'Preloader',
  MainMenu: 'MainMenu',
  Game: 'Game',
  UI: 'UI',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/** Clés du registry Phaser (données partagées entre scènes). */
export const RegistryKeys = {
  GameState: 'gameState',
} as const;

/** Clés d'assets. Convention : kebab-case, préfixe par type. */
export const AssetKeys = {
  AssetPack: 'asset-pack',
  Logo: 'img-logo',
} as const;

/** Les trois pauses du roulement 3x8. */
export const Shift = {
  Morning: 'morning', // 06:00 - 14:00
  Afternoon: 'afternoon', // 14:00 - 22:00
  Night: 'night', // 22:00 - 06:00
} as const;
export type Shift = (typeof Shift)[keyof typeof Shift];
