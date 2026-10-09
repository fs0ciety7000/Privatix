/**
 * Collisions de la simulation (remplacent Arcade) : cercle contre grille de tuiles et cercle contre
 * cercle, dans le plan du sol, en unités logiques. Pur.
 */

/** Grille de collision : une tuile est pleine ou vide. Hors de la grille, tout est plein. */
export interface TileGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  solidAt(tx: number, ty: number): boolean;
}

/** Corps mobile : cercle aux pieds. */
export interface CircleBody {
  x: number;
  y: number;
  readonly r: number;
}

/** Résultat d'un déplacement : la grille a-t-elle bloqué le corps ? */
export interface MoveResult {
  readonly blocked: boolean;
  /** Normale moyenne du contact (nulle si pas de contact). */
  readonly nx: number;
  readonly ny: number;
}

const EPS = 1e-6;
const MAX_ITER = 4;

/**
 * Sort le cercle des tuiles pleines qu'il chevauche. Renvoie la normale cumulée des poussées
 * (0, 0 si aucun contact).
 */
export function resolveCircleGrid(grid: TileGrid, body: CircleBody): { nx: number; ny: number } {
  let nx = 0;
  let ny = 0;
  const s = grid.tileSize;
  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    let moved = false;
    const tx0 = Math.floor((body.x - body.r) / s);
    const tx1 = Math.floor((body.x + body.r) / s);
    const ty0 = Math.floor((body.y - body.r) / s);
    const ty1 = Math.floor((body.y + body.r) / s);
    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        if (!grid.solidAt(tx, ty)) continue;
        const left = tx * s;
        const top = ty * s;
        const cx = Math.max(left, Math.min(left + s, body.x));
        const cy = Math.max(top, Math.min(top + s, body.y));
        const dx = body.x - cx;
        const dy = body.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= body.r * body.r - EPS) continue;
        let px: number;
        let py: number;
        if (d2 > EPS) {
          const d = Math.sqrt(d2);
          px = dx / d;
          py = dy / d;
          body.x = cx + px * body.r;
          body.y = cy + py * body.r;
        } else {
          // Centre dans la tuile : on sort par le côté le plus proche.
          const outL = body.x - left;
          const outR = left + s - body.x;
          const outT = body.y - top;
          const outB = top + s - body.y;
          const m = Math.min(outL, outR, outT, outB);
          px = m === outL ? -1 : m === outR ? 1 : 0;
          py = px !== 0 ? 0 : m === outT ? -1 : 1;
          if (px < 0) body.x = left - body.r;
          else if (px > 0) body.x = left + s + body.r;
          else if (py < 0) body.y = top - body.r;
          else body.y = top + s + body.r;
        }
        nx += px;
        ny += py;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { nx, ny };
}

/**
 * Déplace le cercle de (dx, dy) en sous-pas plus courts que son rayon (pas d'effet tunnel, même au
 * dash), en le faisant glisser le long des murs.
 */
export function moveCircle(grid: TileGrid, body: CircleBody, dx: number, dy: number): MoveResult {
  const dist = Math.hypot(dx, dy);
  const maxStep = Math.max(1, body.r * 0.8);
  const n = Math.max(1, Math.ceil(dist / maxStep));
  let nx = 0;
  let ny = 0;
  for (let i = 0; i < n; i += 1) {
    body.x += dx / n;
    body.y += dy / n;
    const push = resolveCircleGrid(grid, body);
    nx += push.nx;
    ny += push.ny;
  }
  const len = Math.hypot(nx, ny);
  return len > EPS
    ? { blocked: true, nx: nx / len, ny: ny / len }
    : { blocked: false, nx: 0, ny: 0 };
}

/** Les deux cercles se chevauchent-ils ? */
export function circlesTouch(a: CircleBody, b: CircleBody): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * Sépare deux cercles qui se chevauchent. `share` est la part de la correction prise par `a`
 * (0,5 : moitié chacun ; 1 : seul `a` bouge, `b` est immobile). Renvoie la profondeur corrigée.
 */
export function separateCircles(a: CircleBody, b: CircleBody, share = 0.5): number {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let d = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (d >= min) return 0;
  if (d < EPS) {
    dx = 1;
    dy = 0;
    d = 1;
  } else {
    dx /= d;
    dy /= d;
  }
  const depth = min - Math.min(d, min);
  a.x += dx * depth * share;
  a.y += dy * depth * share;
  b.x -= dx * depth * (1 - share);
  b.y -= dy * depth * (1 - share);
  return depth;
}
