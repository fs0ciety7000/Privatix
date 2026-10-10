import type { EnemyKind } from '@/config/balance';
import { REWARDS } from '@/config/balance';
import type { BiomeIndex } from '@/systems/procedural/roomTemplates';

/**
 * Données narratives des biomes du Shift (LORE § 5 et § 7, GDD § 3.1) : noms, boss, ennemi majeur,
 * répliques d'entrée en scène et de défaite. Les répliques d'Elio Di Rupo sont **inventées pour le
 * jeu** (`fictive`) : l'UI l'indique à côté de chaque réplique (LORE § 1.4, exception 3).
 */

/** Une réplique affichée en sous-titre. */
export interface Line {
  readonly speaker: string;
  readonly text: string;
  /** Réplique inventée prêtée à une personne réelle : l'UI affiche « réplique fictive ». */
  readonly fictive: boolean;
}

export interface BossDef {
  readonly kind: EnemyKind;
  readonly name: string;
  readonly title: string;
  readonly intro: Line;
  /** Répliques de défaite, espacées par le directeur. */
  readonly defeat: readonly Line[];
  readonly ps: number;
  readonly grains: number;
}

export interface BiomeDef {
  readonly index: BiomeIndex;
  readonly name: string;
  readonly tagline: string;
  /** Libellé des salles de combat (bandeau, portes). */
  readonly combatLabel: string;
  /** Annonce d'entrée dans le biome. */
  readonly announce: string;
  readonly boss: BossDef;
  /** Ennemi majeur de la Salle gardée (biomes 2 et 3). */
  readonly gardee: {
    readonly kind: EnemyKind;
    readonly label: string;
    readonly intro: Line;
  } | null;
  readonly restNotice: string;
}

const DI_RUPO = 'Elio Di Rupo';

export const BIOMES: Readonly<Record<BiomeIndex, BiomeDef>> = {
  0: {
    index: 0,
    name: 'Quais & Voies',
    tagline: "Le 7h12 n'est pas venu",
    combatLabel: 'Quais & Voies',
    announce: 'QUAI 3 · PRISE DE SERVICE',
    boss: {
      kind: 'auditeur',
      name: "L'Auditeur des Quais",
      title: 'aux commandes de la Borne Totale 3000',
      intro: {
        speaker: "L'Auditeur des Quais",
        text: 'Vous avez mis 4 minutes 12 pour arriver jusqu’ici. Je le note.',
        fictive: false,
      },
      defeat: [
        {
          speaker: "L'Auditeur des Quais",
          text: '… Le train de 7h12, il existe encore ?',
          fictive: false,
        },
      ],
      ps: REWARDS.PS_BOSS1,
      grains: REWARDS.GRAINS_BOSS1,
    },
    gardee: null,
    restNotice: 'Salle des pauses — « La pause n’est pas du temps de travail effectif. »',
  },
  1: {
    index: 1,
    name: 'La Passerelle « Calatrava »',
    tagline: 'Le vent tourne',
    combatLabel: 'La Passerelle',
    announce: 'LA PASSERELLE · FERMÉE POUR CÉRÉMONIE',
    boss: {
      kind: 'dirupo',
      name: DI_RUPO,
      title: "l'Invité d'honneur",
      intro: {
        speaker: "L'Invité d'honneur",
        text: 'Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange.',
        fictive: true,
      },
      defeat: [
        {
          speaker: 'Plaque d’inauguration',
          text: 'Mons 2032 — Lot n° 1. Privatix Rail Solutions — Phase 3 : Libéralisation',
          fictive: false,
        },
        {
          speaker: "L'Invité d'honneur",
          text: '… On m’avait parlé d’une inauguration.',
          fictive: true,
        },
        {
          speaker: "L'Invité d'honneur",
          text: 'Je n’inaugure pas une vente à la découpe.',
          fictive: true,
        },
        {
          speaker: 'Marcel (radio)',
          text: 'De mon temps, on inaugurait les gares. Pas leur vente.',
          fictive: false,
        },
      ],
      ps: REWARDS.PS_BOSS2,
      grains: REWARDS.GRAINS_BOSS2,
    },
    gardee: {
      kind: 'fluidifieur',
      label: 'Salle gardée · Le Fluidifieur',
      intro: {
        speaker: 'Le Fluidifieur',
        text: 'Ah ! Vous êtes en C ? Non non, vous êtes en S. Depuis ce matin.',
        fictive: false,
      },
    },
    restNotice: 'Banc face au vide — un gobelet abandonné, encore tiède.',
  },
  2: {
    index: 2,
    name: 'Hall & BAG',
    tagline: 'Terminus BAG',
    combatLabel: 'Hall & BAG',
    announce: 'HALL & BAG · PORTIQUE À BADGE',
    boss: {
      kind: 'lurcke',
      name: 'Jean-Cul Lurcke',
      title: 'Directeur de la Transformation',
      intro: {
        speaker: 'Jean-Cul Lurcke',
        text: 'Ah. L’équipe terrain. Entrez. Je lance la présentation. Quatre cent douze slides.',
        fictive: false,
      },
      defeat: [
        {
          speaker: 'Jean-Cul Lurcke',
          text: '… Concrètement ? Je n’ai pas de slide pour ça.',
          fictive: false,
        },
        {
          speaker: 'Jean-Cul Lurcke',
          text: 'Bon. Soyons adultes. Une phase pilote. Une seule ligne.',
          fictive: false,
        },
      ],
      ps: REWARDS.PS_BOSS3,
      grains: REWARDS.GRAINS_BOSS3,
    },
    gardee: {
      kind: 'discosaure',
      label: 'Salle gardée · Le Discosaure',
      intro: {
        speaker: 'Le Discosaure',
        text: 'On a toujours fait comme ça. Et ça a toujours marché. Pour nous.',
        fictive: false,
      },
    },
    restNotice: 'Palier du 3e — machine à café « premium », détartrage nécessaire.',
  },
};

/** Le biome d'un ennemi majeur ou d'un boss, s'il en est un. */
export function bossDefOf(kind: EnemyKind): BossDef | null {
  for (const b of [BIOMES[0], BIOMES[1], BIOMES[2]]) if (b.boss.kind === kind) return b.boss;
  return null;
}

/** Répliques de phase des boss et ennemis majeurs (bandeau en sous-titre). */
export const PHASE_LINES: Readonly<Partial<Record<EnemyKind, readonly Line[]>>> = {
  dirupo: [
    { speaker: "L'Invité d'honneur", text: 'Je serai bref.', fictive: true },
    {
      speaker: "L'Invité d'honneur",
      text: 'Permettez-moi une parenthèse. Elle durera le temps qu’il faudra.',
      fictive: true,
    },
  ],
  fluidifieur: [
    {
      speaker: 'Le Fluidifieur',
      text: 'Mutation d’office ! C’est pour votre carrière !',
      fictive: false,
    },
  ],
  discosaure: [
    {
      speaker: 'Le Discosaure',
      text: 'Restructurez avec moi ! Un, deux, un, deux !',
      fictive: false,
    },
  ],
  lurcke: [
    {
      speaker: 'Jean-Cul Lurcke',
      text: 'Mesdames et messieurs du Conseil, vous m’entendez ? … Vous êtes en mute.',
      fictive: false,
    },
  ],
};
