import Phaser from 'phaser';
import type { TilesetDef, TilesetKey } from '@/config/assets';
import { tileset } from '@/config/assets';
import { Colors, Css, Depth, FONT, TILE } from '@/config/constants';
import type { MarkKind, RoomLayout, TileKind } from '@/systems/procedural/RoomLayout';
import { isSolid, tileAt } from '@/systems/procedural/RoomLayout';
import type { DoorChoice } from '@/systems/procedural/ShiftPlan';

export interface RailBand {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly height: number;
}

interface DoorView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  choice: DoorChoice | null;
  label: string;
  readonly objects: Phaser.GameObjects.GameObject[];
  light: Phaser.GameObjects.Arc | null;
}

const REWARD_LABEL: Readonly<Record<string, string>> = {
  avantage: 'AVANTAGE',
  gobelet: 'GOBELET',
  tickets: 'TICKETS',
  ps: 'PS',
  grains: 'GRAINS',
};

export function doorLabel(choice: DoorChoice): string {
  switch (choice.type) {
    case 'boutique':
      return 'FRITERIE';
    case 'tresor':
      return 'CAFÉ';
    case 'repos':
      return 'PAUSE';
    case 'boss':
      return 'SIGNATURE';
    case 'elite':
      return `ÉLITE · ${REWARD_LABEL[choice.reward ?? ''] ?? '?'}`;
    default:
      return REWARD_LABEL[choice.reward ?? ''] ?? 'COMBAT';
  }
}

/** Petit hachage déterministe pour varier les tuiles de sol. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return h;
}

/**
 * Une salle construite à partir d'un gabarit : tilemap (sol, murs, rails), collisions, portes de sortie
 * surmontées d'un mini-écran des départs, voies (bandes de rails) pour les rames du boss.
 */
export class Room {
  public readonly widthPx: number;
  public readonly heightPx: number;
  public readonly layer: Phaser.Tilemaps.TilemapLayer;
  public readonly railBands: readonly RailBand[];
  private readonly map: Phaser.Tilemaps.Tilemap;
  private readonly doorViews: DoorView[] = [];
  public doorsOpen = false;

  private readonly props: Phaser.GameObjects.GameObject[] = [];
  private readonly ts: TilesetDef;
  private readonly occ: boolean;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly layout: RoomLayout,
    tilesetKey: TilesetKey = 'tiles_quais',
  ) {
    this.widthPx = layout.width * TILE;
    this.heightPx = layout.height * TILE;
    this.ts = tileset(tilesetKey);
    this.occ = tilesetKey === 'tiles_occ';
    const data = layout.tiles.map((row, ty) => row.map((kind, tx) => this.indexFor(kind, tx, ty)));
    this.map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ts = this.map.addTilesetImage(
      tilesetKey,
      tilesetKey,
      TILE,
      TILE,
      this.ts.margin,
      this.ts.spacing,
    );
    if (!ts) throw new Error(`Tileset ${tilesetKey} introuvable (PreloaderScene non exécutée ?)`);
    const layer = this.map.createLayer(0, ts, 0, 0);
    // Phaser 4 : createLayer renvoie une union, on vérifie le type.
    if (!(layer instanceof Phaser.Tilemaps.TilemapLayer))
      throw new Error('Calque de tuiles invalide');
    this.layer = layer.setDepth(Depth.Floor);
    // Collisions : d'après le gabarit (et non l'index), pour rester juste quel que soit le tileset.
    layout.tiles.forEach((row, ty) => {
      row.forEach((kind, tx) => {
        if (isSolid(kind))
          this.layer.getTileAt(tx, ty)?.setCollision(true, true, true, true, false);
      });
    });
    this.layer.calculateFacesWithin(0, 0, layout.width, layout.height);
    this.placeProps();
    this.railBands = this.findRailBands();
    for (const slot of layout.doors) {
      this.doorViews.push({
        x: slot.tx * TILE,
        y: slot.ty * TILE,
        width: slot.width * TILE,
        choice: null,
        label: '',
        objects: [],
        light: null,
      });
    }
  }

  private named(name: string, fallback = 0): number {
    return this.ts.names[name] ?? fallback;
  }

  private isWallish(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.layout.width || ty >= this.layout.height) return true;
    const k = tileAt(this.layout, tx, ty);
    return k === 'wall' || k === 'door';
  }

  /** Mur dont la tuile du dessous est praticable : bas de façade. */
  private isFaceBottom(tx: number, ty: number): boolean {
    return this.isWallish(tx, ty) && ty + 1 < this.layout.height && !this.isWallish(tx, ty + 1);
  }

  /** Variante de façade d'une colonne (même dessin pour le haut et le bas). */
  private faceVariant(tx: number, ty: number): string {
    const h = hash(tx, ty) % 23;
    const facades = this.occ
      ? ['photo', 'commandements', 'lanternes', 'palettes', 'liege', 'casiers', 'horloge-712']
      : ['privatix', 'greve', 'vitrine', 'horaires', 'extincteur', 'affiche-7h12', 'plan'];
    if (h < facades.length && tx % 3 === 1) return `facade-${facades[h] ?? 'plan'}`;
    return ['wall-midA', 'wall-midB', 'wall-midC'][h % 3] ?? 'wall-midA';
  }

  private indexFor(kind: TileKind, tx: number, ty: number): number {
    const h = hash(tx, ty);
    const occ = this.occ;
    switch (kind) {
      case 'door': {
        const left = tileAt(this.layout, tx - 1, ty) !== 'door';
        return this.named(left ? 'wall-doorL-bot' : 'wall-doorR-bot');
      }
      case 'wall': {
        if (this.isFaceBottom(tx, ty))
          return this.named(`${this.faceVariant(tx, ty)}-bot`, this.named('wall-midA-bot'));
        // Haut de façade : la tuile du dessous est un bas de façade (ou une porte).
        if (ty + 1 < this.layout.height && this.isFaceBottom(tx, ty + 1)) {
          if (tileAt(this.layout, tx, ty + 1) === 'door') {
            const left = tileAt(this.layout, tx - 1, ty + 1) !== 'door';
            return this.named(left ? 'wall-doorL-top' : 'wall-doorR-top');
          }
          return this.named(`${this.faceVariant(tx, ty + 1)}-top`, this.named('wall-midA-top'));
        }
        // Dessus de mur : autotile « blob » (N NE E SE S SW W NW ; coins seulement si les deux côtés touchent).
        const w = (dx: number, dy: number): number => (this.isWallish(tx + dx, ty + dy) ? 1 : 0);
        const n = w(0, -1);
        const e = w(1, 0);
        const s = w(0, 1);
        const wst = w(-1, 0);
        const ne = n & e & w(1, -1);
        const se = s & e & w(1, 1);
        const sw = s & wst & w(-1, 1);
        const nw = n & wst & w(-1, -1);
        return this.named(
          `walltop-${[n, ne, e, se, s, sw, wst, nw].join('')}`,
          this.named('walltop-11111111'),
        );
      }
      case 'line':
        return this.named(occ ? `occ-tapis-${String(h % 2)}` : 'quai-podo-line');
      case 'rail': {
        if (occ) return this.named(`occ-rail-${String(h % 4)}`);
        const below = tileAt(this.layout, tx, ty + 1);
        return this.named(below === 'ballast' ? 'track-H-top' : 'track-H-bot');
      }
      case 'ballast':
        return this.named(`ballast-${String(h % 4)}`);
      default: {
        // Sol (et dessous des piliers et bancs).
        if (occ) {
          const detail = h % 29;
          if (detail === 0) return this.named('occ-detail-stain');
          if (detail === 1) return this.named('occ-detail-crack');
          return this.named(`occ-beton-${String(h % 4)}`);
        }
        const detail = h % 31;
        if (detail === 0) return this.named('quai-crack');
        if (detail === 1) return this.named('quai-stain');
        if (detail === 2) return this.named('quai-gum');
        if (detail === 3) return this.named('quai-drain');
        return this.named(`quai-${String(h % 7 < 4 ? 0 : h % 4)}`);
      }
    }
  }

  /** Piliers et bancs : props posés par-dessus le sol, triés par leurs pieds. */
  private placeProps(): void {
    const add = (key: string, x: number, y: number): void => {
      if (!this.scene.textures.exists(key)) return;
      this.props.push(this.scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y));
    };
    this.layout.tiles.forEach((row, ty) => {
      let run = 0;
      row.forEach((kind, tx) => {
        // Un seul pilier par bloc (2×2 dans les gabarits) : posé sur sa tuile en bas à gauche.
        if (
          kind === 'pillar' &&
          row[tx - 1] !== 'pillar' &&
          tileAt(this.layout, tx, ty + 1) !== 'pillar'
        ) {
          const wide = row[tx + 1] === 'pillar';
          add('prop_pilier', tx * TILE + (wide ? 16 : 8), ty * TILE + 16);
        }
        if (kind !== 'bench') return;
        run += 1;
        if (row[tx + 1] === 'bench') return;
        const startX = (tx - run + 1) * TILE;
        const key = this.occ ? 'prop_canape' : 'prop_banc-h';
        const w = this.occ ? 48 : 32;
        const count = Math.max(1, Math.floor((run * TILE) / w));
        const offset = (run * TILE - count * w) / 2;
        for (let i = 0; i < count; i += 1)
          add(key, startX + offset + w * i + w / 2, ty * TILE + 16);
        run = 0;
      });
    });
  }

  private findRailBands(): RailBand[] {
    const bands: RailBand[] = [];
    let start = -1;
    let x0 = 0;
    let x1 = 0;
    const isTrackRow = (ty: number): boolean => {
      const row = this.layout.tiles[ty] ?? [];
      const track = row.filter((k) => k === 'rail' || k === 'ballast').length;
      return track >= row.length / 2;
    };
    for (let ty = 0; ty <= this.layout.height; ty += 1) {
      if (ty < this.layout.height && isTrackRow(ty)) {
        if (start < 0) {
          start = ty;
          const row = this.layout.tiles[ty] ?? [];
          x0 = row.findIndex((k) => k === 'rail' || k === 'ballast') * TILE;
          x1 =
            (row.length - [...row].reverse().findIndex((k) => k === 'rail' || k === 'ballast')) *
            TILE;
        }
      } else if (start >= 0) {
        bands.push({ x0, x1, y: start * TILE, height: (ty - start) * TILE });
        start = -1;
      }
    }
    return bands;
  }

  /** Cadre la caméra : suivi avec zone morte, salle centrée si elle est plus petite que l'écran. */
  public fitCamera(
    cam: Phaser.Cameras.Scene2D.Camera,
    target: Phaser.GameObjects.GameObject,
  ): void {
    // Marge en haut : les écrans des portes ne passent jamais sous le HUD.
    const top = 56;
    const w = this.widthPx;
    const h = this.heightPx + top;
    const vw = cam.width;
    const vh = cam.height;
    cam.stopFollow();
    cam.setBounds(
      w < vw ? (w - vw) / 2 : 0,
      h < vh ? -top - (vh - h) / 2 : -top,
      Math.max(w, vw),
      Math.max(h, vh),
    );
    cam.startFollow(target, true, 0.12, 0.12, 0, 10);
    cam.setDeadzone(32, 24);
  }

  public tileKindAt(x: number, y: number): TileKind {
    return tileAt(this.layout, Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** Ballast : −15 % de vitesse. */
  public isSlowGround(x: number, y: number): boolean {
    return this.tileKindAt(x, y) === 'ballast';
  }

  public isWalkable(x: number, y: number): boolean {
    return !isSolid(this.tileKindAt(x, y));
  }

  public get playerSpawn(): { x: number; y: number } {
    const s = this.layout.playerSpawn;
    return { x: s.tx * TILE + TILE / 2, y: s.ty * TILE + TILE / 2 };
  }

  public get bossSpawn(): { x: number; y: number } {
    const s = this.layout.bossSpawn ?? this.layout.playerSpawn;
    return { x: s.tx * TILE + TILE / 2, y: s.ty * TILE + TILE };
  }

  public markPositions(kind: MarkKind): { x: number; y: number; char: string }[] {
    return this.layout.marks
      .filter((m) => m.kind === kind)
      .map((m) => ({ x: m.at.tx * TILE + TILE / 2, y: m.at.ty * TILE + TILE / 2, char: m.char }));
  }

  /** Affecte les portes proposées aux emplacements (réparties sur la largeur), les autres restent murées. */
  public setDoors(choices: readonly DoorChoice[], labels: readonly string[] = []): void {
    const slots = this.doorViews;
    const used: number[] =
      choices.length === 1
        ? [Math.floor((slots.length - 1) / 2)]
        : choices.length === 2 && slots.length >= 3
          ? [0, slots.length - 1]
          : choices.map((_, i) => i);
    used.forEach((slotIndex, i) => {
      const view = slots[slotIndex];
      const choice = choices[i];
      if (view && choice) {
        view.choice = choice;
        view.label = labels[i] ?? doorLabel(choice);
      }
    });
    for (const view of slots) this.drawDoor(view);
  }

  private drawDoor(view: DoorView): void {
    for (const o of view.objects) o.destroy();
    view.objects.length = 0;
    const cx = view.x + view.width / 2;
    if (!view.choice) {
      const plank = this.scene.add
        .rectangle(cx, view.y + TILE / 2, view.width, TILE, 0x2a3442)
        .setDepth(Depth.Floor + 1);
      view.objects.push(plank);
      return;
    }
    const opening = this.scene.add
      .rectangle(cx, view.y + TILE / 2, view.width - 2, TILE, 0x05080d)
      .setStrokeStyle(1, Colors.quaiYellow)
      .setDepth(Depth.Floor + 1);
    const board = this.scene.add
      .rectangle(cx, view.y - 10, Math.max(view.width + 28, 64), 12, 0x0b1f3a)
      .setStrokeStyle(1, Colors.outline)
      .setDepth(Depth.Above);
    const label = this.scene.add
      .text(cx - 4, view.y - 10, view.label, {
        fontFamily: FONT,
        fontSize: '8px',
        color: Css.quaiYellow,
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(Depth.Above + 1);
    view.light = this.scene.add
      .circle(cx + board.width / 2 - 6, view.y - 10, 3, this.doorsOpen ? 0x5bd17a : 0xe8505b)
      .setDepth(Depth.Above + 1);
    view.objects.push(opening, board, label, view.light);
  }

  /** Salle nettoyée : feux au vert. */
  public openDoors(): void {
    this.doorsOpen = true;
    for (const view of this.doorViews) {
      view.light?.setFillStyle(0x5bd17a);
      if (view.choice) {
        const glow = this.scene.add
          .rectangle(
            view.x + view.width / 2,
            view.y + TILE / 2,
            view.width - 2,
            TILE,
            Colors.quaiYellow,
            0.35,
          )
          .setDepth(Depth.Floor + 2);
        this.scene.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 500 });
        view.objects.push(glow);
      }
    }
  }

  /** Porte franchie si le héros (pieds) touche le seuil d'une porte ouverte. */
  public doorAt(x: number, y: number): DoorChoice | null {
    if (!this.doorsOpen) return null;
    for (const view of this.doorViews) {
      if (!view.choice) continue;
      if (x >= view.x && x <= view.x + view.width && y <= view.y + TILE + 10 && y >= view.y)
        return view.choice;
    }
    return null;
  }

  /** Porte la plus proche (info-bulle). */
  public nearestDoor(
    x: number,
    y: number,
    range: number,
  ): { choice: DoorChoice; x: number; y: number } | null {
    let best: { choice: DoorChoice; x: number; y: number } | null = null;
    let bestD = range;
    for (const view of this.doorViews) {
      if (!view.choice) continue;
      const dx = view.x + view.width / 2;
      const dy = view.y + TILE;
      const d = Math.hypot(dx - x, dy - y);
      if (d < bestD) {
        bestD = d;
        best = { choice: view.choice, x: dx, y: dy };
      }
    }
    return best;
  }

  public destroy(): void {
    for (const view of this.doorViews) for (const o of view.objects) o.destroy();
    for (const p of this.props) p.destroy();
    this.layer.destroy();
    this.map.destroy();
  }
}
