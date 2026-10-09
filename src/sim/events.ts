/**
 * Événements publiés par la simulation pour la vue (effets, sons, HUD). La simulation ne connaît jamais
 * la vue : elle remplit une file que la vue vide à chaque frame. Coordonnées en unités logiques.
 */

export type TextTone = 'info' | 'danger' | 'gold' | 'hero';

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
  | { readonly type: 'enemyKilled'; readonly id: number; readonly x: number; readonly y: number; readonly angle: number; readonly last: boolean }
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
  | { readonly type: 'heroHurt'; readonly x: number; readonly y: number; readonly amount: number; readonly angle: number }
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
  | { readonly type: 'roomCleared'; readonly room: number };

export type SimEventType = SimEvent['type'];
