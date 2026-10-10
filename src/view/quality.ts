/**
 * Presets de qualité du rendu 3D (bas, moyen, haut) et option « Réduction des mouvements ».
 * Les valeurs sont un premier jet : l'ingénieur perf les affine (budget de docs/proposals, § 4.8).
 * Choix : `?q=bas|moyen|haut` dans l'URL, sinon détection grossière (écran tactile ⇒ moyen).
 */

export type QualityId = 'bas' | 'moyen' | 'haut';

export interface QualityPreset {
  readonly id: QualityId;
  /** Plafond du devicePixelRatio. */
  readonly pixelRatioCap: number;
  /** Taille de la carte d'ombre de la lumière clé (0 : pas d'ombres temps réel). */
  readonly shadowMapSize: number;
  /** Échantillons MSAA de la cible HDR (0 : aucun). */
  readonly msaa: number;
  /** Bloom (coupé en bas). */
  readonly bloom: boolean;
  /** Résolution du bloom relative à l'écran (0,5 = demi-résolution). */
  readonly bloomScale: number;
  /** Contours en coque inversée sur les acteurs et le décor. */
  readonly outlines: boolean;
  /** Lumières ponctuelles de salle (nombre fixe par salle : pas de recompilation des shaders). */
  readonly roomLights: number;
  /** Capacité des systèmes de particules (multiplicateur). */
  readonly particles: number;
  /** Poussières en suspension. */
  readonly dust: boolean;
  /** Résolution dynamique : on baisse le pixel ratio si l'on reste sous 50 fps. */
  readonly dynamicResolution: boolean;
  /** Anticrénelage FXAA en fin de chaîne (mode capture sans MSAA, `?fxaa`). */
  readonly fxaa?: boolean;
}

export const QUALITY: Readonly<Record<QualityId, QualityPreset>> = {
  bas: {
    id: 'bas',
    pixelRatioCap: 1,
    shadowMapSize: 0,
    msaa: 0,
    bloom: false,
    bloomScale: 0.5,
    outlines: true,
    roomLights: 2,
    particles: 0.5,
    dust: false,
    dynamicResolution: true,
  },
  moyen: {
    id: 'moyen',
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    msaa: 2,
    bloom: true,
    bloomScale: 0.5,
    outlines: true,
    roomLights: 4,
    particles: 0.75,
    dust: true,
    dynamicResolution: true,
  },
  haut: {
    id: 'haut',
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    msaa: 4,
    bloom: true,
    bloomScale: 1,
    outlines: true,
    roomLights: 6,
    particles: 1,
    dust: true,
    dynamicResolution: false,
  },
};

export function isQualityId(v: string | null): v is QualityId {
  return v === 'bas' || v === 'moyen' || v === 'haut';
}

/** Réglages d'affichage transmis à la vue. */
export interface ViewSettings {
  readonly quality: QualityPreset;
  /**
   * Réduction des mouvements (accessibilité, décision du porteur) : aucun clignotement ni
   * stroboscope. Concrètement : pas de clignotement d'invulnérabilité (teinte pâle fixe), néons
   * stables, flashs de coup et éclairs d'impact atténués, vignette de coup reçu atténuée, ni zoom
   * punch ni tremblement de télégraphe, secousses de caméra réduites de moitié.
   */
  readonly reducedMotion: boolean;
  /** Mode capture (`?trailer`) : tampon de dessin conservé et cadrage de la caméra par format. */
  readonly capture?: CaptureFraming;
}

/**
 * Cadrage de la caméra pour le mode capture du trailer (`?trailer&aspect=16x9|3x2|1x1|9x16`) :
 * champ vertical (degrés) et décalage du point visé derrière le héros (m, 2,5 en jeu).
 */
export interface CaptureFraming {
  readonly fov: number;
  readonly lookBack: number;
}

/** Cadrages par format : en 1:1 et 9:16 on resserre et on recentre le héros. */
export const CAPTURE_FRAMING = {
  '16x9': { fov: 25, lookBack: 2.2 },
  '3x2': { fov: 32, lookBack: 2.3 },
  '1x1': { fov: 36, lookBack: 1.8 },
  '9x16': { fov: 40, lookBack: 1.6 },
} as const satisfies Record<string, CaptureFraming>;

/** Cadrage du mode capture pour `?aspect=` (16:9 par défaut). */
export function captureFraming(aspect: string | null): CaptureFraming {
  return aspect !== null && aspect in CAPTURE_FRAMING
    ? CAPTURE_FRAMING[aspect as keyof typeof CAPTURE_FRAMING]
    : CAPTURE_FRAMING['16x9'];
}
