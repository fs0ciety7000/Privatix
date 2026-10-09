/**
 * Palette du jeu (définie par l'UX/UI Expert, voir docs/GDD.md et docs/ASSETS_GUIDE.md).
 * Deux thèmes : "sncb" (institutionnel, bleu/jaune quai) et "occ" (clandestin, café/ambre).
 * Les valeurs numériques (0xRRGGBB) servent aux Graphics/Rectangles/tint Phaser,
 * `toCss()` les convertit pour les styles de texte.
 */
export const COLORS = {
  sncb: {
    bgDeep: 0x0b1f3a, // Bleu Nuit Quai : fond, letterbox
    panel: 0x123c73, // Bleu Institution : fond de panneau
    border: 0x1f5aa6, // Bleu Signal : bordure, sélection
    bevelLight: 0x5fa8e8, // Bleu Ciel Caténaire : liseré clair
    text: 0xf4f6f8, // Blanc Affiche : texte principal
    textMuted: 0x9fb0c6, // Gris Ballast : texte secondaire / désactivé
    accent: 0xffd200, // Jaune Quai : curseur, focus, titres
    accentShadow: 0xc9a200, // Jaune Quai Ombre : biseau / pressé
    boardBg: 0xffd200, // Tableau des départs : fond
    boardText: 0x0b1f3a, // Tableau des départs : texte
  },
  occ: {
    bgDeep: 0x2b1a12, // Espresso : fond
    panel: 0x4a2e1f, // Café Torréfié : fond de panneau
    border: 0x7a4e33, // Moka : bordure
    bevelLight: 0xa8734a, // Noisette : liseré clair / survol
    text: 0xf2e6cf, // Crème : texte principal
    textMuted: 0xc9a882, // Latte : texte secondaire
    accent: 0xf2a541, // Ambre Lampe : curseur, focus
    rebel: 0xc8323c, // Rouge Rebelle : bannières, tampons
    rebelShadow: 0x8e1f28, // Rouge Rebelle Sombre
  },
  semantic: {
    danger: 0xe8505b,
    dangerText: 0xff8080,
    success: 0x5bd17a,
    warning: 0xf5a524,
    overlay: 0x000000, // à utiliser avec alpha 0.6
  },
  gauge: {
    hp: 0xe04848,
    hpCritical: 0xff8080,
    hpBg: 0x4a1418,
    pe: 0x3fb8e8,
    peBg: 0x0e3247,
    fatigue: 0xb48cff,
    fatigueHeavy: 0xd65db1,
    fatigueBurnout: 0xff4d6d,
    fatigueBg: 0x2a1e44,
  },
  shift: {
    morning: 0xf6c453, // 06:00-14:00
    afternoon: 0xf08a4b, // 14:00-22:00
    night: 0x6a7bd1, // 22:00-06:00
  },
} as const;

export type ThemeName = 'sncb' | 'occ';
export type ThemeKey = 'bgDeep' | 'panel' | 'border' | 'bevelLight' | 'text' | 'textMuted' | 'accent';

/** Accès générique au thème courant (mêmes clés de base dans les deux thèmes). */
export const themeColor = (theme: ThemeName, key: ThemeKey): number => COLORS[theme][key];

/** Convertit 0xRRGGBB en "#rrggbb" pour les styles de texte Phaser. */
export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
