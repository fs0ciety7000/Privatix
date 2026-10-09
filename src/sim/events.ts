/**
 * Événements publiés par la simulation pour la vue (effets, sons, HUD). La simulation ne connaît jamais
 * la vue : elle remplit une file que la vue vide à chaque frame. Coordonnées en unités logiques.
 */
import type { ItemRarity, SlotId } from '@/config/loot';

import type { EnemyKind } from '@/config/balance';

export type TextTone = 'info' | 'danger' | 'gold' | 'hero';

/**
 * Effets visuels et sonores ponctuels des nouveaux ennemis et des biomes (la vue et l'audio les
 * traduisent ; la sim n'en dépend pas).
 */
export type FxName =
  | 'promiseKept'
  | 'promiseBroken'
  | 'ribbonCut'
  | 'ribbonUp'
  | 'bowtieThrow'
  | 'burrow'
  | 'emerge'
  | 'stink'
  | 'facets'
  | 'discoBlackout'
  | 'discoFreeze'
  | 'sequins'
  | 'confetti'
  | 'gust'
  | 'gustWarn'
  | 'heroFell'
  | 'enemyFell'
  | 'pageTaken'
  | 'reglement'
  | 'swap'
  | 'concertation'
  | 'finalBlow';

export type SimEvent =
  /** Début des frames actives d'un coup du héros (traînée, poussière). */
  | {
      readonly type: 'swing';
      readonly combo: number;
      readonly finisher: boolean;
      readonly dashAttack: boolean;
      readonly x: number;
      readonly y: number;
      readonly angle: number;
      /** Portée de la forme (u) et ouverture (degrés, 0 pour un rectangle). */
      readonly reach: number;
      readonly arcDeg: number;
    }
  | {
      readonly type: 'enemyHit';
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly amount: number;
      readonly crit: boolean;
      readonly heavy: boolean;
      readonly angle: number;
    }
  | {
      readonly type: 'enemyKilled';
      readonly id: number;
      /** Type de l'ennemi (absent dans les tests anciens) : effets de mort propres (confettis, paillettes). */
      readonly kind?: EnemyKind;
      readonly x: number;
      readonly y: number;
      readonly angle: number;
      readonly last: boolean;
    }
  | { readonly type: 'enemySpawn'; readonly id: number; readonly x: number; readonly y: number }
  | {
      readonly type: 'enemyStrike';
      readonly id: number;
      readonly attack: string;
      readonly x: number;
      readonly y: number;
      readonly angle: number;
    }
  | { readonly type: 'wallSlam'; readonly x: number; readonly y: number }
  | {
      readonly type: 'heroHurt';
      readonly x: number;
      readonly y: number;
      readonly amount: number;
      readonly angle: number;
    }
  | { readonly type: 'heroDied'; readonly x: number; readonly y: number }
  | { readonly type: 'dash'; readonly x: number; readonly y: number; readonly angle: number }
  | { readonly type: 'dashEnd'; readonly x: number; readonly y: number }
  | { readonly type: 'perfectDash'; readonly x: number; readonly y: number }
  | {
      readonly type: 'special';
      readonly kind: 'whistle' | 'preavis';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  | { readonly type: 'shake'; readonly px: number; readonly ms: number }
  | { readonly type: 'zoomPunch' }
  | { readonly type: 'vignette'; readonly amount: number }
  | {
      readonly type: 'text';
      readonly x: number;
      readonly y: number;
      readonly text: string;
      readonly tone: TextTone;
    }
  | { readonly type: 'wave'; readonly index: number; readonly count: number; readonly room: number }
  | { readonly type: 'roomCleared'; readonly room: number }
  /** Projectile ennemi tiré, cassé (coup, sifflet, mur) ou arrivé sur le héros. */
  | { readonly type: 'projectileFired'; readonly x: number; readonly y: number }
  | {
      readonly type: 'projectileBroken';
      readonly x: number;
      readonly y: number;
      readonly by: 'wall' | 'hero' | 'weapon';
    }
  /** Impact d'une zone de danger (fin du télégraphe), passage d'une rame. */
  | {
      readonly type: 'hazardImpact';
      readonly kind: 'circle' | 'square' | 'ring' | 'band' | 'line' | 'beams' | 'cloud';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  /** Explosion (mort d'une Borne, du boss, récompense qui tombe). */
  | { readonly type: 'explosion'; readonly x: number; readonly y: number; readonly scale: number }
  | { readonly type: 'dust'; readonly x: number; readonly y: number; readonly count: number }
  /** Changement de phase du boss (bandeau). */
  | { readonly type: 'bossPhase'; readonly phase: number; readonly title: string }
  /** Ramassage d'une récompense au sol. */
  | {
      readonly type: 'pickup';
      readonly kind: string;
      readonly x: number;
      readonly y: number;
      readonly text: string;
    }
  /** Bandeau d'information (équivalent de `pushNotice` de la version Phaser). */
  | { readonly type: 'notice'; readonly text: string; readonly tone: TextTone }
  /** Nouvelle salle construite (la vue reconstruit le décor). */
  | { readonly type: 'roomEntered'; readonly room: number; readonly roomType: string }
  /** Le héros franchit une porte ouverte (la scène lance le fondu). */
  | { readonly type: 'doorTaken'; readonly room: number }
  /** Effet ponctuel (nouveaux ennemis, biomes). */
  | {
      readonly type: 'fx';
      readonly name: FxName;
      readonly x: number;
      readonly y: number;
      /** Direction (rafale) ou intensité, selon l'effet. */
      readonly value?: number;
    }
  /**
   * Entrée en scène d'un boss ou d'un ennemi majeur : nom, titre, réplique. `fictive` : réplique
   * inventée pour le jeu (personne réelle : l'UI l'indique, LORE § 1.4).
   */
  | {
      readonly type: 'bossIntro';
      readonly kind: EnemyKind;
      readonly name: string;
      readonly title: string;
      readonly line: string;
      readonly fictive: boolean;
    }
  /** Réplique d'un personnage (bandeau de sous-titre ; `fictive` comme ci-dessus). */
  | {
      readonly type: 'bossLine';
      readonly speaker: string;
      readonly text: string;
      readonly fictive: boolean;
    }
  /** Nouveau biome (bandeau de titre, ambiance). */
  | {
      readonly type: 'biomeEntered';
      readonly biome: number;
      readonly name: string;
      readonly tagline: string;
    }
  /** Fin du Shift (mort ou victoire) : la scène affiche l'écran des départs. */
  | { readonly type: 'shiftEnded'; readonly end: 'victoire' | 'mort' }
  /**
   * Un objet d'équipement tombe au sol (loot) : éjecté de `from` vers `(x, y)`. `rank` : 0 (Réforme)
   * à 4 (Patrimoine) ; `quiet` : aucun ennemi vivant (mise en scène complète du Patrimoine).
   */
  | {
      readonly type: 'lootDropped';
      readonly id: number;
      readonly x: number;
      readonly y: number;
      readonly fromX: number;
      readonly fromY: number;
      readonly rarity: ItemRarity;
      readonly rank: number;
      readonly slot: SlotId;
      readonly name: string;
      readonly quiet: boolean;
    }
  /** Objet ramassé (équipé, mis au sac) ou démonté en Ferraille. */
  | {
      readonly type: 'lootTaken';
      readonly action: 'equip' | 'bag' | 'scrap';
      readonly x: number;
      readonly y: number;
      readonly rarity: ItemRarity;
      readonly slot: SlotId;
      readonly name: string;
    }
  /** L'équipement porté a changé (vue du héros, HUD). */
  | { readonly type: 'gearChanged' }
  /** Effet d'un pouvoir Patrimoine (faille, soupape, taches de lumière, promesse). */
  | {
      readonly type: 'gearFx';
      readonly kind: 'rift' | 'valve' | 'spot' | 'promise' | 'promiseKept';
      readonly x: number;
      readonly y: number;
      readonly angle: number;
      /** Rayon ou longueur (px). */
      readonly size: number;
    };

export type SimEventType = SimEvent['type'];
