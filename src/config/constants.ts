/**
 * Constantes techniques du jeu (résolution, tuiles, clés de scènes et du registry, profondeurs).
 * Les valeurs d'équilibrage vivent dans `balance.ts`, les fichiers d'assets dans `assets.ts`.
 */

/** Résolution logique (CANON) : 640×360, mise à l'échelle entière ×2 / ×3 / ×4. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

/** Taille d'une tuile en pixels. */
export const TILE = 16;

export const SceneKeys = {
  Boot: 'Boot',
  Preloader: 'Preloader',
  MainMenu: 'MainMenu',
  Hub: 'Hub',
  Run: 'Run',
  UI: 'UI',
  Pause: 'Pause',
  Results: 'Results',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

/**
 * Clés partagées du registry Phaser. Toutes sont initialisées par BootScene : la première écriture
 * d'une clé émet `setdata` et non `changedata`, les écouteurs rateraient sinon la première valeur.
 */
export const RegistryKeys = {
  /** MetaState (progression permanente). */
  Meta: 'meta',
  /** Instantané du HUD publié par RunScene (HudSnapshot | null hors run). */
  Hud: 'hud',
  /** Bandeau d'information { seq, text }. */
  Notice: 'notice',
  /** Résultat du dernier Shift (ShiftResult | null). */
  LastResult: 'lastResult',
  /** Commandes tactiles : état publié par l'UIScene, lu par le joueur (TouchState). */
  Touch: 'touch',
} as const;

/** Profondeurs de rendu. Les acteurs utilisent leur `y` (tri par les pieds) entre Floor et Overlay. */
export const Depth = {
  Floor: -100,
  Decal: -50,
  Shadow: -10,
  /** Base des acteurs : depth = y. */
  Actors: 0,
  Above: 5_000,
  Vfx: 6_000,
  Text: 8_000,
  Overlay: 9_000,
} as const;

/** Couleurs de lisibilité (CANON) : héros orange, ennemis turquoise, ce qui blesse le joueur magenta. */
export const Colors = {
  hero: 0xff7a1a,
  enemy: 0x19c3b1,
  danger: 0xff3ea5,
  outline: 0x14101a,
  night: 0x0b1f3a,
  quaiYellow: 0xffd200,
  white: 0xf4f6f8,
  ballast: 0x9fb0c6,
  coffee: 0x6b3e26,
} as const;

/** Version CSS des couleurs (textes Phaser). */
export const Css = {
  hero: '#ff7a1a',
  enemy: '#19c3b1',
  danger: '#ff3ea5',
  outline: '#14101a',
  night: '#0b1f3a',
  quaiYellow: '#ffd200',
  white: '#f4f6f8',
  ballast: '#9fb0c6',
} as const;

/** Police des textes (pixel, petite taille ; résolution ×2 pour rester nette). */
export const FONT = 'monospace';
