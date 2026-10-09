// Correspondance entre les états de la simulation et les clips des GLB (public/models/manifest.json),
// et tenue de départ du héros. Données pures, sans three : testées dans tests/glbModels.test.ts
// (chaque clip et chaque pièce cités doivent exister dans le manifeste).
import type { EnemyKind } from '@/config/balance';
import type { EquipSlot } from '@/view/models/manifest';

/** Clips du héros utilisés par `GlbHeroView` (les attaques du combo sont `attack1..3`). */
export const HERO_CLIPS = [
  'idle',
  'run',
  'attack1',
  'attack2',
  'attack3',
  'dash',
  'hurt',
  'death',
] as const;

/** Tenue de départ du héros GLB (identique au héros procédural). */
export const DEFAULT_GEAR: Readonly<Record<EquipSlot, string>> = {
  casque: 'casque_chantier',
  gilet: 'gilet_hv',
  outil: 'cle_tire_fond',
};

/** Attaque « ruée » : le windup arme le clip d'attaque, l'attaque joue un clip de course accéléré. */
export interface Rush {
  readonly windup: string;
  /** Part de l'armé atteinte à la fin du télégraphe (0..1 de l'événement `active`). */
  readonly reach: number;
  readonly clip: string;
  readonly timeScale: number;
}

/** Correspondance états de la sim → clips du manifeste, par type d'ennemi. */
export interface EnemyClipMap {
  /** Nom du modèle dans le manifeste. */
  readonly model: string;
  readonly idle: string;
  readonly move: string;
  /** Vitesse (m/s) à laquelle le clip de marche est joué à vitesse nominale. */
  readonly moveRef: number;
  readonly spawn: string | null;
  readonly hurt: string | null;
  readonly stagger: string | null;
  readonly death: string;
  /** Attaque de la sim → clip d'attaque (posé sur le windup puis joué depuis `active`). */
  readonly attacks: Readonly<Record<string, string>>;
  readonly rushes?: Readonly<Record<string, Rush>>;
  /** Largeur de la barre de vie (m). */
  readonly barW: number;
  /** Échelle du modèle (placeholder : un modèle existant grandi pour un boss sans GLB propre). */
  readonly scale?: number;
  /** Sortie digne au lieu de la dissolution (Elio Di Rupo : vaincu, jamais tué). */
  readonly exit?: 'walk';
}

export const ENEMY_CLIPS: Readonly<Record<EnemyKind, EnemyClipMap>> = {
  consultant: {
    model: 'consultant',
    idle: 'idle',
    move: 'walk',
    moveRef: 1.6,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'hurt',
    death: 'death',
    attacks: { diaporama: 'attack' },
    rushes: { quickwin: { windup: 'attack', reach: 0.55, clip: 'walk', timeScale: 2.6 } },
    barW: 0.9,
  },
  borne: {
    model: 'borne',
    idle: 'idle',
    move: 'idle',
    moveRef: 1,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'hurt',
    death: 'death',
    attacks: { salve: 'attack' },
    barW: 0.9,
  },
  drone: {
    model: 'drone',
    idle: 'fly',
    move: 'fly',
    moveRef: 2.2,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'hurt',
    death: 'death',
    attacks: { shot: 'attack', dive: 'attack' },
    barW: 0.7,
  },
  manager: {
    model: 'manager',
    idle: 'idle',
    move: 'walk',
    moveRef: 1.5,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'hurt',
    death: 'death',
    attacks: { tablet: 'attack-report', report: 'attack-report', chrono: 'attack-chrono' },
    barW: 1.2,
  },
  auditeur: {
    model: 'auditeur',
    idle: 'idle',
    move: 'walk',
    moveRef: 1.4,
    spawn: 'intro',
    hurt: 'hurt',
    stagger: 'stagger',
    death: 'defeat',
    attacks: {
      sweep: 'attack-sweep',
      stamp: 'attack-stamp',
      barrage: 'attack-tickets',
      chrono: 'attack-tickets',
    },
    rushes: { kpi: { windup: 'attack-stamp', reach: 0.4, clip: 'walk', timeScale: 2.4 } },
    barW: 2.2,
  },
  furet: {
    model: 'furet',
    idle: 'idle',
    move: 'run',
    moveRef: 3.2,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'war-dance',
    death: 'death',
    attacks: { bite: 'attack-bite', stink: 'attack-spray' },
    rushes: { pounce: { windup: 'attack-bite', reach: 0.6, clip: 'run', timeScale: 2.6 } },
    barW: 1.2,
  },
  fluidifieur: {
    model: 'fluidifieur',
    idle: 'idle',
    move: 'glide',
    moveRef: 2.2,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'hurt',
    death: 'defeat',
    attacks: {
      binder: 'attack-binder',
      slabs: 'attack-binder',
      swap: 'attack-spin',
      org: 'attack-spin',
    },
    rushes: { glide: { windup: 'attack-spin', reach: 0.5, clip: 'glide', timeScale: 2.4 } },
    barW: 1.4,
  },
  discosaure: {
    model: 'discosaure',
    idle: 'idle',
    move: 'walk',
    moveRef: 2.0,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'stagger',
    death: 'death',
    attacks: { stomp: 'attack-stomp' },
    rushes: { charge: { windup: 'charge-windup', reach: 1, clip: 'charge', timeScale: 1 } },
    barW: 2.6,
  },
  dirupo: {
    model: 'dirupo',
    idle: 'idle',
    move: 'walk',
    moveRef: 1.7,
    spawn: 'intro',
    hurt: 'hurt',
    stagger: 'stagger',
    death: 'defeat',
    attacks: {
      bowtie: 'attack-bowtie',
      speech: 'smile-flash',
      promises: 'smile-flash',
      ballots: 'hair-swipe',
      motions: 'hair-swipe',
      scissors: 'attack-inauguration',
    },
    barW: 1.8,
    exit: 'walk',
  },
  vanderslide: {
    // Version de travail : pas encore de GLB propre, le costume du Manager KPI grandi.
    model: 'manager',
    idle: 'idle',
    move: 'walk',
    moveRef: 1.5,
    spawn: 'spawn',
    hurt: 'hurt',
    stagger: 'hurt',
    death: 'death',
    attacks: {
      bullets: 'attack-report',
      report: 'attack-report',
      charts: 'attack-chrono',
      copy: 'attack-chrono',
    },
    barW: 1.8,
    scale: 1.4,
  },
};
