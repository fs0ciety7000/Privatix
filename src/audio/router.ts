/**
 * Routeur événements de la sim → sons. Fonctions pures (ni Web Audio, ni DOM) : testées en Vitest.
 *
 * - `routeEvent` traduit un `SimEvent` en zéro, une ou plusieurs demandes de son ;
 * - `diffProbe` compare deux instantanés du monde (`AudioProbe`) pour ce que la sim n'émet pas comme
 *   événement : début d'un télégraphe ennemi ou d'une zone, palier de Burnout, pétage de plombs,
 *   gobelet de café, fenêtre de choix, ouverture d'un menu.
 */
import type { EnemyKind } from '@/config/balance';
import type { SimEvent } from '@/sim/events';
import type { SfxId } from './sfx';

export interface SfxCue {
  readonly id: SfxId;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly amount?: number | undefined;
  readonly gain?: number | undefined;
}

/** Résout le type d'un ennemi à partir de son identifiant (pour la matière de l'impact). */
export type KindOf = (id: number) => EnemyKind | undefined;

const PICKUP_SFX: Readonly<Record<string, SfxId>> = {
  tickets: 'pickupTickets',
  ps: 'pickupPs',
  grains: 'pickupGrains',
  gobelet: 'pickupGobelet',
  cornet: 'pickupCornet',
  avantage: 'pickupAvantage',
};

const STRIKE_SFX: Readonly<Record<string, SfxId>> = {
  slam: 'slam',
  diaporama: 'enemyMelee',
  quickwin: 'rush',
  tablet: 'tablet',
  chrono: 'chrono',
  report: 'report',
  shot: 'droneShot',
  dive: 'droneDive',
  scan: 'droneScan',
  sweep: 'bossSweep',
  barrage: 'bossBarrier',
  stamp: 'bossStamp',
  land: 'bossLand',
  kpi: 'kpi',
  // Furet putride
  bite: 'enemyMelee',
  pounce: 'rush',
  // Fluidifieur
  glide: 'rush',
  slabs: 'chrono',
  binder: 'tablet',
  swap: 'kpi',
  org: 'report',
  // Discosaure
  spots: 'droneScan',
  stomp: 'bossStamp',
  charge: 'rush',
  tail: 'bossSweep',
  lasers: 'kpiZap',
  // Elio Di Rupo
  bowtie: 'swingDash',
  speech: 'report',
  promises: 'chime',
  ballots: 'ticketFire',
  motions: 'bossBarrier',
  scissors: 'ribbonSnip',
  // Gontran Vanderslide
  bullets: 'kpi',
  charts: 'chrono',
  copy: 'report',
};

/** Effets ponctuels (`fx`) des biomes 2 et 3. */
const FX_SFX: Readonly<Partial<Record<string, SfxId>>> = {
  promiseKept: 'pickupPs',
  ribbonCut: 'ribbonSnip',
  confetti: 'fanfare',
  stink: 'stinkPuff',
  burrow: 'hazardThud',
  emerge: 'bossLand',
  facets: 'discoShimmer',
  sequins: 'discoShimmer',
  discoFreeze: 'whistle',
  gust: 'ringPulse',
  heroFell: 'hurt',
  enemyFell: 'kill',
  pageTaken: 'pickupGrains',
  reglement: 'bossPhase',
  swap: 'kpi',
};

/** Matière touchée selon l'ennemi : papier, portable, tôle, plastique, costume. */
export function materialFor(kind: EnemyKind | undefined, heavy: boolean): SfxId {
  switch (kind) {
    case 'borne':
      return 'hitMetal';
    case 'drone':
      return 'hitDrone';
    case 'manager':
      return 'hitLaptop';
    case 'auditeur':
    case 'dirupo':
    case 'vanderslide':
    case 'fluidifieur':
      return 'hitBoss';
    case 'discosaure':
      return 'hitMetal';
    default:
      return heavy ? 'hitLaptop' : 'hitPaper';
  }
}

export function routeEvent(e: SimEvent, kindOf: KindOf): SfxCue[] {
  switch (e.type) {
    case 'swing': {
      const at = { x: e.x, y: e.y };
      if (e.dashAttack) return [{ id: 'swingDash', ...at }];
      if (e.finisher || e.combo >= 3) return [{ id: 'swing3', ...at }];
      return [{ id: e.combo === 2 ? 'swing2' : 'swing1', ...at }];
    }
    case 'enemyHit': {
      const at = { x: e.x, y: e.y };
      const cues: SfxCue[] = [
        { id: 'impact', amount: e.heavy || e.crit ? 1 : 0, ...at },
        { id: materialFor(kindOf(e.id), e.heavy), ...at },
      ];
      if (e.crit) cues.push({ id: 'crit', ...at });
      return cues;
    }
    case 'enemyKilled':
      return e.last
        ? [{ id: 'kill', x: e.x, y: e.y }, { id: 'lastKill' }]
        : [{ id: 'kill', x: e.x, y: e.y }];
    case 'enemySpawn':
      return [{ id: 'spawn', x: e.x, y: e.y }];
    case 'enemyStrike': {
      const id = STRIKE_SFX[e.attack];
      return id ? [{ id, x: e.x, y: e.y }] : [];
    }
    case 'wallSlam':
      return [{ id: 'wallSlam', x: e.x, y: e.y }];
    case 'heroHurt':
      return [{ id: 'hurt' }];
    case 'heroDied':
      return [{ id: 'death' }];
    case 'dash':
      return [{ id: 'dash', x: e.x, y: e.y }];
    case 'perfectDash':
      return [{ id: 'perfectDash' }];
    case 'special':
      return [{ id: e.kind === 'preavis' ? 'preavis' : 'whistle' }];
    case 'projectileFired':
      return [{ id: 'ticketFire', x: e.x, y: e.y }];
    case 'projectileBroken':
      if (e.by === 'weapon') return [{ id: 'ticketTear', x: e.x, y: e.y }];
      if (e.by === 'wall') return [{ id: 'ticketThud', x: e.x, y: e.y, gain: 0.6 }];
      return [];
    case 'hazardImpact': {
      const at = { x: e.x, y: e.y };
      if (e.kind === 'band') return [{ id: 'train', ...at }];
      if (e.kind === 'ring') return [{ id: 'ringPulse', ...at }];
      if (e.kind === 'line') return [{ id: 'kpiZap', ...at }];
      return [{ id: 'hazardThud', ...at }];
    }
    case 'explosion':
      return [{ id: 'explosion', x: e.x, y: e.y, amount: e.scale / 2 }];
    case 'bossPhase':
    case 'bossIntro':
      return [{ id: 'bossPhase' }];
    case 'fx': {
      const id = FX_SFX[e.name];
      return id ? [{ id, x: e.x, y: e.y }] : [];
    }
    case 'pickup': {
      const id = PICKUP_SFX[e.kind];
      return id ? [{ id, x: e.x, y: e.y }] : [];
    }
    case 'roomEntered':
      return [{ id: 'chime' }];
    case 'roomCleared':
      return [{ id: 'doorUnlock' }];
    case 'doorTaken':
      return [{ id: 'doorTaken' }];
    case 'shiftEnded':
      return e.end === 'victoire' ? [{ id: 'victory' }] : [];
    default:
      return [];
  }
}

// ─── Instantanés du monde ─────────────────────────────────────────────────────

export interface ProbeEnemy {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
  /** En préparation d'une attaque (télégraphe visible). */
  readonly windup: boolean;
}

export interface ProbeHazard {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly telegraphing: boolean;
}

export type AudioPhase = 'title' | 'run' | 'results' | 'hub';

/** Ce que l'audio lit du monde à chaque frame (rempli par `probeWorld`, ou à la main en test). */
export interface AudioProbe {
  readonly phase: AudioPhase;
  /** Écran de menu courant (`none` : aucun). */
  readonly menu: string;
  /** Le temps de jeu est arrêté (menu, choix, onglet caché). */
  readonly paused: boolean;
  readonly heroX: number;
  readonly heroY: number;
  readonly heroState: string;
  readonly gobelets: number;
  /** Rang du palier de Burnout (0 = frais … 4 = pétage de plombs). */
  readonly burnoutTier: number;
  /** Burnout 0..100. */
  readonly burnout: number;
  readonly meltdown: boolean;
  readonly roomType: string;
  readonly bossPhase: number;
  readonly enemies: readonly ProbeEnemy[];
  readonly hazards: readonly ProbeHazard[];
}

export const EMPTY_PROBE: AudioProbe = {
  phase: 'title',
  menu: 'none',
  paused: false,
  heroX: 0,
  heroY: 0,
  heroState: 'idle',
  gobelets: 0,
  burnoutTier: 0,
  burnout: 0,
  meltdown: false,
  roomType: 'combat',
  bossPhase: 1,
  enemies: [],
  hazards: [],
};

/** Sons déduits du passage d'un instantané au suivant. */
export function diffProbe(prev: AudioProbe, next: AudioProbe): SfxCue[] {
  const cues: SfxCue[] = [];
  if (next.menu !== prev.menu && next.menu !== 'none') {
    cues.push({ id: next.menu === 'choice' ? 'choice' : 'uiOpen' });
  }
  if (next.phase !== 'run') return cues;
  const wasWinding = new Set(prev.enemies.filter((e) => e.windup).map((e) => e.id));
  for (const e of next.enemies) {
    if (e.windup && !wasWinding.has(e.id))
      cues.push({ id: 'telegraph', x: e.x, y: e.y, amount: e.kind === 'auditeur' ? 1 : 0 });
  }
  const knownHazards = new Set(prev.hazards.map((h) => h.id));
  for (const h of next.hazards) {
    if (h.telegraphing && !knownHazards.has(h.id))
      cues.push({ id: 'telegraph', x: h.x, y: h.y, amount: 1, gain: 0.8 });
  }
  if (next.meltdown && !prev.meltdown) cues.push({ id: 'meltdown' });
  else if (next.burnoutTier > prev.burnoutTier && !next.meltdown) cues.push({ id: 'burnoutUp' });
  if (next.heroState === 'drink' && prev.heroState !== 'drink') cues.push({ id: 'coffeeCup' });
  if (next.gobelets < prev.gobelets) cues.push({ id: 'coffeeSip' });
  return cues;
}

/**
 * Intensité musicale (0..1) : ennemis en vie (6 et plus = plein) pour 70 %, Burnout pour 30 % ; le
 * boss garde la musique haute.
 */
export function combatIntensity(p: AudioProbe): number {
  if (p.phase !== 'run') return 0;
  const crowd = Math.min(1, p.enemies.length / 6);
  const stress = p.meltdown ? 1 : Math.min(1, p.burnout / 100);
  const base = p.enemies.length > 0 ? 0.1 : 0;
  return Math.min(1, base + crowd * 0.65 + stress * 0.3);
}
