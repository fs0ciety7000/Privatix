import type { HubZoneId } from '@/sim/hub/layout';
import { tileCenter } from '@/sim/hub/layout';
import type { Vec2 } from '@/utils/math';

/**
 * PNJ, stations et portes du hub (docs/LORE.md § 3-4, GDD § 11). Données pures : la vue place les
 * modèles et les flaques de lumière d'après elles, la sim s'en sert pour les invites.
 */

export type HubNpcId = 'marcel' | 'fatou' | 'yasmina' | 'kevin' | 'bene' | 'josiane' | 'rudy';

export interface HubNpcDef {
  readonly id: HubNpcId;
  readonly name: string;
  /** Pupitre ou poste (LORE § 3.1). */
  readonly post: string;
  /** Lettre du gabarit (`NPC_CHARS`). */
  readonly char: string;
  readonly zone: HubZoneId;
}

export const HUB_NPCS: readonly HubNpcDef[] = [
  { id: 'marcel', name: 'Marcel', post: 'Permanence conduite', char: 'M', zone: 'co' },
  { id: 'fatou', name: 'Fatou', post: 'RCCA', char: 'F', zone: 'co' },
  { id: 'yasmina', name: 'Yasmina', post: 'RTS · régulation', char: 'Y', zone: 'co' },
  { id: 'kevin', name: 'Kevin', post: 'RTS · matériel roulant', char: 'K', zone: 'co' },
  { id: 'bene', name: 'Béné', post: 'PACO', char: 'N', zone: 'co' },
  { id: 'josiane', name: 'Josiane', post: 'DPD', char: 'J', zone: 'cour' },
  { id: 'rudy', name: 'Rudy', post: 'TLI & AIT', char: 'U', zone: 'co' },
];

export const HUB_NPCS_BY_ID: ReadonlyMap<HubNpcId, HubNpcDef> = new Map(
  HUB_NPCS.map((n) => [n.id, n]),
);

/**
 * Ce que fait une station quand on interagit :
 * - `talk` : une réplique courte ;
 * - `tableau` : Tableau des revendications (achats en PS) ;
 * - `roulement` : tableau des roulements (Matin, Après-midi, Nuit) ;
 * - `dpd` : Vestiaire et casiers de Josiane (point d'entrée du loot) ;
 * - `paco` : relances du PACO de Béné (point d'entrée du loot) ;
 * - `read` : un texte à lire (mur synoptique, affichette).
 */
export type HubStationKind = 'talk' | 'tableau' | 'roulement' | 'dpd' | 'paco' | 'read';

export type HubStationId =
  HubNpcId | 'tableau' | 'vieille-dame' | 'synoptique' | 'casiers' | 'poubelles';

export interface HubStationDef {
  readonly id: HubStationId;
  readonly zone: HubZoneId;
  readonly kind: HubStationKind;
  /** Point d'interaction (u), devant le pupitre ou l'objet. */
  readonly at: Vec2;
  /** Position du PNJ ou de l'objet (u), pour l'invite et la vue. */
  readonly anchor: Vec2;
  /** Verbe de l'invite. */
  readonly verb: string;
  readonly npc?: HubNpcId;
}

/** Rayon d'interaction (u) autour du point d'une station. */
export const STATION_RADIUS = 30;

function station(
  id: HubStationId,
  zone: HubZoneId,
  kind: HubStationKind,
  verb: string,
  anchorTile: readonly [number, number],
  standTile: readonly [number, number],
  npc?: HubNpcId,
): HubStationDef {
  const def = {
    id,
    zone,
    kind,
    verb,
    at: tileCenter(standTile[0], standTile[1]),
    anchor: tileCenter(anchorTile[0], anchorTile[1]),
  };
  return npc ? { ...def, npc } : def;
}

/** Stations : les PNJ se parlent depuis l'avant de leur pupitre. */
export const HUB_STATIONS: readonly HubStationDef[] = [
  station('bene', 'co', 'paco', 'PACO · Recours', [14, 3], [14, 5.6], 'bene'),
  station('yasmina', 'co', 'roulement', 'Choisir le roulement', [21, 3], [21, 5.6], 'yasmina'),
  station('kevin', 'co', 'talk', 'Parler', [26, 3], [26, 5.6], 'kevin'),
  station('rudy', 'co', 'talk', 'Parler', [32, 3], [32, 5.6], 'rudy'),
  station('fatou', 'co', 'talk', 'Parler', [31, 10], [31, 12.6], 'fatou'),
  station('marcel', 'co', 'tableau', 'Tableau des revendications', [14, 15], [14, 17.6], 'marcel'),
  station('tableau', 'co', 'tableau', 'Tableau des revendications', [5, 0], [5, 2]),
  station('vieille-dame', 'co', 'talk', 'La Vieille Dame', [22, 12], [22.5, 14.8]),
  station('synoptique', 'co', 'read', 'Lire le mur synoptique', [19, 0], [17, 1.6]),
  station('josiane', 'cour', 'dpd', 'DPD · Vestiaire', [4, 13], [6, 13], 'josiane'),
  station('casiers', 'cour', 'dpd', 'Casiers de la DPD', [2, 16], [3.6, 16.5]),
  station('poubelles', 'cour', 'read', 'Lire l’affichette', [5, 2], [5.5, 4]),
];

export const HUB_STATIONS_BY_ID: ReadonlyMap<HubStationId, HubStationDef> = new Map(
  HUB_STATIONS.map((s) => [s.id, s]),
);

export type HubDoorId = 'vers-cour' | 'vers-co' | 'depart';

export interface HubDoorDef {
  readonly id: HubDoorId;
  readonly zone: HubZoneId;
  /** Centre de la porte dans son mur (u). */
  readonly at: Vec2;
  /** Demi-largeur de la zone de passage (u). */
  readonly halfWidth: number;
  /** `-1` : porte dans le mur du haut ; `+1` : dans le mur du bas (côté caméra). */
  readonly side: -1 | 1;
  readonly label: string;
  /** Zone d'arrivée (`null` : départ en Shift). */
  readonly to: HubZoneId | null;
}

export const HUB_DOORS: readonly HubDoorDef[] = [
  {
    id: 'vers-cour',
    zone: 'co',
    at: tileCenter(28, 0),
    halfWidth: 24,
    side: -1,
    label: 'Cour intérieure',
    to: 'cour',
  },
  {
    id: 'vers-co',
    zone: 'cour',
    at: tileCenter(19, 25),
    halfWidth: 24,
    side: 1,
    label: 'Salle des opérations',
    to: 'co',
  },
  {
    id: 'depart',
    zone: 'cour',
    at: tileCenter(32.5, 0),
    halfWidth: 32,
    side: -1,
    label: 'Prendre son poste',
    to: null,
  },
];

/** Arrivée dans une zone par une porte (juste devant elle) ou au début (sas, `P`). */
export function arrivalFor(door: HubDoorDef): Vec2 {
  return { x: door.at.x, y: door.at.y - door.side * 30 };
}

/** Lignes de dialogue (docs/LORE.md § 4) : générique, après une mort, après une victoire. */
export interface NpcLines {
  readonly generic: readonly string[];
  readonly death: string;
  readonly victory: string;
}

export const NPC_LINES: Readonly<Record<HubNpcId | 'vieille-dame', NpcLines>> = {
  marcel: {
    generic: [
      'De mon temps, le retard, on l’appelait l’aventure. Maintenant, ils l’appellent un KPI.',
      'Le Tableau des revendications, fieu. Chaque PS, c’est un acquis.',
    ],
    death: 'Ça va, fieu ? T’as eu une aventure courte. Allez, une tasse et on y retourne.',
    victory: 'Ils ont reprogrammé ? Bien. Tant qu’ils reprogramment, on existe.',
  },
  fatou: {
    generic: [
      'Hydrate-toi. Au café, de préférence.',
      'Ton Burnout de fin de Shift était à 87. Je l’ai noté. En rouge. Avec un cœur, pour adoucir.',
    ],
    death: 'Arrêt de travail de zéro jour. Bienvenue. Tu avais deux Gobelets pleins, je précise.',
    victory: 'Quatorze heures de service sans pause réglementaire. Bravo. Je fais un signalement.',
  },
  yasmina: {
    generic: [
      'Roulement de Nuit. Moins de monde, plus de cadres. Je te mets le biome 1 en orange.',
    ],
    death:
      'Incident voyageur sur ta ligne. Toi. Je te mets en voie d’attente, le temps de te recoller.',
    victory: 'L’Auditeur est en voie d’attente. Définitive, j’espère.',
  },
  kevin: {
    generic: [
      'Ta clé, je la touche pas : c’est la DPD. Mais elle grince. Comme moi.',
      'C’est pas nous, c’est l’autre boîte.',
    ],
    death:
      'Tombé sur les voies ? C’est pas nous, c’est l’autre boîte. Enfin… là, c’est un peu toi.',
    victory: 'Tu lui as coupé le courant ? Proprement ? Je note ça dans un rapport.',
  },
  bene: {
    generic: [
      'Le Règlement, page 312 : un consultant n’a pas de titre de transport. Je dis ça, je dis rien.',
      'Numéro suivant !',
    ],
    death: 'Elle t’a imprimé, la borne ? On ne négocie pas avec ces machines-là. Numéro suivant !',
    victory: 'J’ai archivé ta victoire. Classement : « Rare ». Sous-classement : « À renouveler ».',
  },
  josiane: {
    generic: [
      'Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement.',
      'Le mannequin, là. Tape dedans, il ne porte pas plainte.',
    ],
    death:
      'Tu ne m’appelles jamais, à la radio. Ça, c’est pas dans le règlement, mais c’est dans le cœur.',
    victory: 'Mon sanglier de 2009 était plus coriace. Mais bravo, hein.',
  },
  rudy: {
    generic: [
      'Attention, attention… le Sondage propose jeudi. Le traiteur ne peut pas jeudi. On est tranquilles.',
      'Un coup de sifflet bien placé, ça vaut tous les diaporamas.',
    ],
    death:
      'Attention, attention… on ne traverse pas les voies. Même pour frapper un consultant. Surtout pour frapper un consultant.',
    victory:
      'Shift tenu, à l’heure, voie 1. Je l’ai affiché. En vert. J’ai pleuré un peu. En vert aussi.',
  },
  'vieille-dame': {
    generic: [
      'La Vieille Dame siffle doucement. Jamais détartrée depuis 1987 : c’est ce qui lui donne son goût.',
      'Commandement n° 1 : tu ne laisseras jamais la cafetière vide.',
    ],
    death: 'La Vieille Dame a gardé une tasse au chaud. « Rien à signaler, sauf tout. »',
    victory: 'La Vieille Dame siffle trois fois. Quelqu’un a dû gagner quelque chose.',
  },
};

/** Affichettes et textes à lire. */
export const READ_TEXTS: Readonly<Record<'poubelles' | 'synoptique', string>> = {
  poubelles: '« Collecte externalisée. Passage selon un roulement communiqué la veille. »',
  synoptique: 'Mur synoptique : voies, cantons et trains du réseau, en temps réel.',
};
