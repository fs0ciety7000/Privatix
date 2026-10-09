import { TILE } from '@/config/constants';
import type { RoomLayout } from '@/systems/procedural/RoomLayout';
import { parseRoom } from '@/systems/procedural/RoomLayout';
import type { Vec2 } from '@/utils/math';

/**
 * Plan du hub 3D (jalon J6) : le Centre Opérationnel (OCC) au rez-de-chaussée arrière du BAG et la
 * Cour intérieure (docs/LORE.md § 3.2, GDD § 11, DA § 2.11-2.13). Deux zones, reliées par la porte
 * vitrée du fond de la salle des opérations ; on part en Shift par le côté ouvert de la Cour.
 *
 * Les gabarits sont construits par code (plus lisible qu'un ASCII de 40 colonnes) puis lus par
 * `parseRoom`, comme les salles du Shift : même grille de collision, mêmes marques (lettres des PNJ
 * `MFYKNJU`, `T` mannequin, `C` Vieille Dame, `P` arrivée). Coordonnées en tuiles du **gabarit**
 * (`parseRoom` ajoute une rangée de mur au-dessus : rangée de la grille = rangée du gabarit + 1).
 */

export type HubZoneId = 'co' | 'cour';

interface Grid {
  readonly w: number;
  readonly h: number;
  readonly cells: string[][];
}

function grid(w: number, h: number): Grid {
  const cells = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) =>
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.',
    ),
  );
  return { w, h, cells };
}

function fill(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const row = g.cells[y];
      if (row && x >= 0 && x < g.w) row[x] = ch;
    }
  }
}

function put(g: Grid, x: number, y: number, ch: string): void {
  fill(g, x, y, x, y, ch);
}

function rows(g: Grid): string[] {
  return g.cells.map((r) => r.join(''));
}

/** Pupitres (tuiles bloquantes `b`) du Centre Opérationnel : [x0, x1, rangée]. */
export const CO_DESKS: readonly (readonly [number, number, number])[] = [
  [13, 16, 4], // PACO (Béné)
  [20, 27, 4], // RTS : régulation (Yasmina) et matériel roulant (Kevin)
  [31, 34, 4], // TLI & AIT (Rudy)
  [13, 16, 16], // Permanence conduite (Marcel), à côté de la Salle photocopieuse
  [30, 33, 11], // RCCA (Fatou)
];

/** Cloison vitrée entre la salle des opérations et la Salle photocopieuse (colonne x = 10). */
export const CO_PARTITION_X = 10;
export const CO_PARTITION_GAP: readonly [number, number] = [12, 15];

/** Centre Opérationnel : 38 × 22 tuiles (≈ 20 × 12 m). */
function buildCo(): string[] {
  const g = grid(38, 22);
  // Porte vitrée vers la Cour intérieure, dans le mur du fond (sous le mur synoptique, à droite).
  fill(g, 27, 0, 29, 0, 'D');
  // Cloison de la Salle photocopieuse, ouverte au milieu.
  for (let y = 1; y <= 20; y += 1) {
    if (y < CO_PARTITION_GAP[0] || y > CO_PARTITION_GAP[1]) put(g, CO_PARTITION_X, y, '#');
  }
  for (const [x0, x1, y] of CO_DESKS) fill(g, x0, y, x1, y, 'b');
  // Photocopieuse de 1987 et ramettes (Salle photocopieuse).
  fill(g, 2, 6, 3, 7, 'b');
  fill(g, 7, 18, 8, 19, 'b');
  // Autel de traverses de la Vieille Dame (coin café, au centre de la salle).
  fill(g, 22, 13, 23, 13, 'b');
  put(g, 22, 12, 'C');
  // PNJ derrière leur pupitre (face à la caméra).
  put(g, 14, 3, 'N'); // Béné, PACO
  put(g, 21, 3, 'Y'); // Yasmina, RTS régulation
  put(g, 26, 3, 'K'); // Kevin, RTS matériel roulant
  put(g, 32, 3, 'U'); // Rudy, TLI & AIT
  put(g, 14, 15, 'M'); // Marcel, Permanence conduite
  put(g, 31, 10, 'F'); // Fatou, RCCA
  // Arrivée : le sas, au sud.
  put(g, 22, 19, 'P');
  return rows(g);
}

/** Voitures de service (tuiles bloquantes) : [x0, x1, y0, y1]. */
export const COUR_CARS: readonly (readonly [number, number, number, number])[] = [
  [33, 38, 6, 8],
  [33, 38, 13, 15],
];

/** Cour intérieure du BAG : 40 × 26 tuiles (≈ 21 × 14 m), en U ouvert vers les quais (nord-est). */
function buildCour(): string[] {
  const g = grid(40, 26);
  // Côté ouvert vers le couloir technique et les quais : départ du Shift.
  fill(g, 31, 0, 34, 0, 'D');
  // Porte vitrée de l'OCC (soubassement, côté caméra) : retour au Centre Opérationnel.
  fill(g, 18, 25, 20, 25, 'D');
  // Coin poubelles (angle nord-ouest) : conteneurs le long du pignon.
  fill(g, 2, 1, 9, 2, 'b');
  // Palettes au pied de la cage d'escalier vitrée.
  fill(g, 17, 1, 19, 2, 'b');
  // Deux voitures de service garées en épi (aile est).
  for (const [x0, x1, y0, y1] of COUR_CARS) fill(g, x0, y0, x1, y1, 'b');
  // Casiers de la DPD le long du soubassement ouest.
  fill(g, 1, 10, 1, 18, '#');
  // PNJ et stations.
  put(g, 4, 13, 'J'); // Josiane, DPD (casiers)
  put(g, 14, 15, 'T'); // mannequin de formation, sur les traces de peinture
  put(g, 19, 22, 'P'); // arrivée depuis l'OCC
  return rows(g);
}

/** Gabarits lus une fois (immuables). L'identifiant `occ` désigne le hub côté vue. */
export const HUB_LAYOUTS: Readonly<Record<HubZoneId, RoomLayout>> = {
  co: parseRoom('occ', buildCo()),
  cour: parseRoom('occ', buildCour()),
};

/** Zone d'un gabarit du hub, ou `null` (salle du Shift). */
export function hubZoneOf(layout: RoomLayout): HubZoneId | null {
  if (layout === HUB_LAYOUTS.co) return 'co';
  if (layout === HUB_LAYOUTS.cour) return 'cour';
  return null;
}

/** Centre (u) d'une tuile du gabarit (rangée du gabarit, sans la rangée de mur ajoutée). */
export function tileCenter(tx: number, ty: number): Vec2 {
  return { x: (tx + 0.5) * TILE, y: (ty + 1 + 0.5) * TILE };
}
