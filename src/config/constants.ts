/**
 * Constantes globales du jeu.
 * Toute valeur "magique" doit vivre ici (ou dans balance.ts pour l'équilibrage), jamais en dur dans une scène.
 */

/** Résolution logique du canvas (16:9). Le pixel-art est mis à l'échelle par Phaser.Scale. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Taille d'une tuile de carte et d'une case de déplacement. */
export const TILE_SIZE = 16;

/** Zoom de la caméra d'exploration (~30×17 tuiles visibles). Les overlays restent en zoom 1. */
export const WORLD_ZOOM = 2;

/** Durée d'un pas d'une case, en marchant et en courant (Maj). */
export const STEP_DURATION_MS = 150;
export const RUN_STEP_DURATION_MS = 90;

/** Délai pendant lequel une scène ignore la touche de validation qui vient de l'ouvrir ou de la refermer. */
export const INPUT_GRACE_MS = 150;

/** Clés des scènes. Toujours passer par cet objet, jamais par une chaîne littérale. */
export const SceneKeys = {
  Boot: 'Boot',
  Preloader: 'Preloader',
  MainMenu: 'MainMenu',
  Game: 'Game',
  UI: 'UI',
  Dialogue: 'Dialogue',
  Battle: 'Battle',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/** Clés du registry Phaser (données partagées entre scènes). */
export const RegistryKeys = {
  /** Le GameState (persistant, sauvegardé). */
  GameState: 'gameState',
  /** Libellé de l'interaction possible devant le héros (« Parler à Rudy »), ou null. */
  InteractionHint: 'interactionHint',
  /** Dernier bandeau à afficher : { seq, text }. */
  Notice: 'notice',
  /** Direction tenue sur le D-pad tactile, ou null. */
  VirtualDir: 'virtualDir',
  /** Compteur incrémenté à chaque appui sur le bouton A tactile. */
  VirtualAction: 'virtualAction',
} as const;

/** Clés d'assets. Convention : kebab-case, préfixe par type (docs/ASSETS_GUIDE.md § 4). */
export const AssetKeys = {
  AssetPack: 'asset-pack',
  Logo: 'img-logo',
  /** Textures générées au démarrage tant que les vrais assets n'existent pas. */
  PlaceholderTiles: 'tiles-placeholder',
  PlaceholderProp: 'img-placeholder-prop',
  PlaceholderPortal: 'img-placeholder-portal',
} as const;

/** Les trois pauses du roulement 3x8. */
export const Shift = {
  Morning: 'morning', // 06:00 - 14:00
  Afternoon: 'afternoon', // 14:00 - 22:00
  Night: 'night', // 22:00 - 06:00
} as const;
export type Shift = (typeof Shift)[keyof typeof Shift];
