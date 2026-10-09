import type Phaser from 'phaser';
import type { ImageDef, SheetDef, TilesetDef } from '@/config/assets';
import { TILE } from '@/config/constants';

/**
 * Placeholders dessinés au pixel près (Canvas 2D) quand un PNG n'est pas encore livré.
 * Mêmes dimensions et même découpage que les vrais fichiers : les remplacer ne change aucun code.
 */

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#14101a';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function shade(color: number, k: number): string {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((color & 0xff) * k));
  return `rgb(${String(r)},${String(g)},${String(b)})`;
}

/** Rectangle plein avec contour de 1 px. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, w + 2, h + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, fill: string, outline = true): void {
  if (outline) {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

interface FrameInfo {
  readonly i: number;
  readonly n: number;
  /** Progression 0..1 dans l'animation. */
  readonly t: number;
  readonly anim: string;
  readonly dir: 'down' | 'up' | 'side' | null;
}

function parseKey(key: string): { entity: string; anim: string; dir: FrameInfo['dir'] } {
  const parts = key.split('_');
  const entity = parts[0] ?? '';
  const anim = parts[1] ?? '';
  const third = parts[2] ?? '';
  const dir = third === 'down' || third === 'up' || third === 'side' ? third : null;
  return { entity, anim, dir };
}

/** Personnage humanoïde vu de 3/4 (héros, consultant, manager). */
function drawHumanoid(
  ctx: Ctx,
  ox: number,
  size: number,
  f: FrameInfo,
  body: number,
  opts: { helmet?: string; tie?: string; tool?: boolean; big?: boolean },
): void {
  const s = opts.big ? 1.25 : size >= 48 ? 1 : 0.75;
  const feetY = size - 4;
  const cx = ox + size / 2;
  let bob = 0;
  let lean = 0;
  let squash = 0;
  const running = f.anim === 'run' || f.anim === 'walk';
  if (f.anim === 'idle') bob = f.i % 3 === 1 ? 1 : 0;
  if (running) bob = f.i % 2 === 0 ? 0 : -1;
  if (f.anim === 'hurt') lean = -2;
  if (f.anim === 'dash') lean = 3;
  if (f.anim === 'death') squash = Math.min(1, f.t * 1.4);
  if (f.anim === 'spawn') squash = 1 - Math.min(1, f.t * 1.2);

  const h = Math.round(22 * s * (1 - squash * 0.7));
  const w = Math.round(12 * s);
  const top = feetY - h + bob;
  const flip = f.dir === 'side' ? 1 : 0;
  const bx = cx - w / 2 + lean * (flip ? 1 : 0);

  // Jambes
  const legH = Math.round(6 * s * (1 - squash * 0.7));
  const stride = running ? (f.i % 4 < 2 ? 2 : -2) : 0;
  box(ctx, bx + 1 + stride * 0.5, feetY - legH, Math.round(4 * s), legH, shade(body, 0.45));
  box(
    ctx,
    bx + w - Math.round(4 * s) - 1 - stride * 0.5,
    feetY - legH,
    Math.round(4 * s),
    legH,
    shade(body, 0.45),
  );
  // Torse
  const torsoH = Math.max(3, h - legH - Math.round(7 * s));
  box(ctx, bx, top + Math.round(7 * s), w, torsoH, hex(body));
  // Bande réfléchissante (gilet) ou cravate
  if (opts.tie && f.dir !== 'up')
    px(ctx, cx - 1, top + Math.round(8 * s), 2, Math.round(6 * s), opts.tie);
  if (!opts.tie) px(ctx, bx, top + Math.round(7 * s) + Math.round(torsoH / 2), w, 2, '#ffe066');
  // Tête
  const headR = Math.round(4 * s);
  disc(ctx, cx + (flip ? 1 : 0), top + headR + 1, headR, '#f0c8a0');
  if (opts.helmet)
    px(
      ctx,
      cx - headR,
      top,
      headR * 2 + (flip ? 1 : 0),
      Math.max(2, Math.round(headR * 0.9)),
      opts.helmet,
    );
  // Yeux (pas de dos)
  if (f.dir !== 'up' && squash < 0.5) {
    if (f.dir === 'side') px(ctx, cx + headR - 1, top + headR + 1, 1, 1, OUTLINE);
    else {
      px(ctx, cx - 2, top + headR + 1, 1, 1, OUTLINE);
      px(ctx, cx + 1, top + headR + 1, 1, 1, OUTLINE);
    }
  }
  // Outil (clé à tire-fond) : position selon l'attaque
  if (opts.tool && squash < 0.5) {
    const attack = f.anim.startsWith('attack') || f.anim === 'special';
    const swing = attack ? Math.sin(f.t * Math.PI) : 0;
    const handX = f.dir === 'side' ? bx + w + 1 : bx + w;
    const handY = top + Math.round(10 * s);
    const len = Math.round(10 * s);
    const ang = attack ? -1.8 + swing * 2.6 : 0.6;
    ctx.strokeStyle = '#8a8f98';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + Math.cos(ang) * len, handY + Math.sin(ang) * len);
    ctx.stroke();
    px(ctx, handX + Math.cos(ang) * len - 2, handY + Math.sin(ang) * len - 2, 4, 4, '#c0c6cf');
  }
  if (f.anim === 'attack' && !opts.tool && f.t > 0.4 && f.t < 0.8) {
    // Coup de diaporama : écran lumineux brandi
    px(ctx, bx + w, top + 6, 6, 5, '#ff3ea5');
  }
}

function drawBorne(ctx: Ctx, ox: number, size: number, f: FrameInfo, color: number): void {
  const cx = ox + size / 2;
  const deployed = f.anim === 'wake' ? f.t : 1;
  const h = Math.round(22 * deployed) + 2;
  const top = size - 3 - h;
  if (f.anim === 'wreck' || (f.anim === 'death' && f.t > 0.5)) {
    box(ctx, cx - 9, size - 9, 18, 6, shade(color, 0.4));
    px(ctx, cx - 6, size - 8, 4, 2, '#444');
    return;
  }
  box(ctx, cx - 8, top, 16, h, hex(color));
  const red = f.anim === 'attack' && f.t < 0.75;
  if (h > 10) {
    px(
      ctx,
      cx - 6,
      top + 3,
      12,
      7,
      red ? '#ff3ea5' : f.anim === 'idle' && f.i % 2 === 0 ? '#ffd200' : '#0b1f3a',
    );
    px(ctx, cx - 3, top + 13, 6, 2, red ? '#ff3ea5' : '#f4f6f8');
  }
  if (f.anim === 'hurt') px(ctx, cx - 8, top, 16, 2, '#ffffff');
}

function drawDrone(ctx: Ctx, ox: number, size: number, f: FrameInfo, color: number): void {
  const cx = ox + size / 2;
  const dive = f.anim === 'attack' && f.i >= 4;
  const fall = f.anim === 'death' ? f.t * 10 : 0;
  const cy = size / 2 - 3 + (dive ? 4 : 0) + fall;
  const rot = f.i % 2 === 0;
  px(ctx, cx - 11, cy - 6, rot ? 8 : 4, 1, '#c8d0dc');
  px(ctx, cx + 3 + (rot ? 0 : 4), cy - 6, rot ? 8 : 4, 1, '#c8d0dc');
  box(ctx, cx - 9, cy - 5, 2, 3, '#555c66');
  box(ctx, cx + 7, cy - 5, 2, 3, '#555c66');
  disc(ctx, cx, cy, 6, hex(color));
  const aiming = f.anim === 'attack' && f.i < 4;
  disc(ctx, cx, cy + 1, 2, aiming ? '#ff3ea5' : '#f4f6f8', false);
  px(ctx, cx, cy - 10, 1, 4, aiming && f.i % 2 === 0 ? '#ff3ea5' : '#ffd200');
}

function drawBoss(ctx: Ctx, ox: number, size: number, f: FrameInfo, color: number): void {
  const cx = ox + size / 2;
  const p2 = f.anim.endsWith('p2') || f.anim === 'phase';
  const stomp = f.anim.startsWith('move') && f.i % 4 === 0 ? 2 : 0;
  const lift = f.anim === 'attack-stamp' ? Math.sin(Math.min(1, f.t * 1.4) * Math.PI) * 18 : 0;
  const dead = f.anim === 'death' ? f.t : 0;
  const top = 22 - lift + stomp + dead * 30;
  const h = Math.max(10, 64 - dead * 30);
  // Borne Totale 3000 : châssis, écran, bras-barrières.
  box(ctx, cx - 26, top, 52, h, hex(color));
  px(ctx, cx - 20, top + 6, 40, 18, p2 ? '#ff3ea5' : '#0b1f3a');
  px(ctx, cx - 16, top + 10, 32, 2, '#f4f6f8');
  px(ctx, cx - 16, top + 15, 20, 2, '#f4f6f8');
  // Le petit auditeur dans le cockpit
  disc(ctx, cx, top - 4, 6, '#f0c8a0');
  px(ctx, cx - 7, top - 10, 14, 3, '#2b2f36');
  const sweep = f.anim === 'attack-sweep' ? f.t * Math.PI : 0;
  const armA = -0.3 - sweep;
  for (const side of [-1, 1]) {
    const sx = cx + side * 26;
    const sy = top + 30;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + side * Math.cos(armA) * 18, sy + Math.sin(armA) * 18 * side);
    ctx.stroke();
    ctx.strokeStyle = side > 0 ? '#e8505b' : '#f4f6f8';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (f.anim === 'attack-barrage' && (f.i === 2 || f.i === 6))
    disc(ctx, cx, top + 30, 5, '#ff3ea5');
  if (f.anim === 'hurt') px(ctx, cx - 26, top, 52, 3, '#ffffff');
}

function drawVfx(
  ctx: Ctx,
  ox: number,
  size: number,
  f: FrameInfo,
  color: number,
  name: string,
): void {
  const c = size / 2;
  const cx = ox + c;
  const fade = 1 - f.t;
  ctx.globalAlpha = Math.max(0.15, fade + 0.2);
  if (name === 'slash-e') {
    ctx.strokeStyle = hex(color);
    ctx.lineWidth = Math.max(2, 6 * fade);
    ctx.beginPath();
    const a0 = -1.2 + f.t * 0.6;
    ctx.arc(cx - 8, c, c - 6, a0, a0 + 1.6 + f.t * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (name === 'slam' || name === 'shockwave' || name === 'telegraph-32') {
    const r = name === 'telegraph-32' ? c - 3 : 4 + (c - 6) * f.t;
    ctx.strokeStyle = hex(color);
    ctx.lineWidth = name === 'telegraph-32' ? (f.i % 2 === 0 ? 2 : 1) : Math.max(1, 5 * fade);
    ctx.beginPath();
    ctx.ellipse(cx, c, r, name === 'slam' ? r * 0.6 : r, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (name === 'explosion' || name === 'spawn-privatix' || name === 'poof') {
    const r = 3 + (c - 4) * Math.sin(Math.min(1, f.t * 1.6) * Math.PI * 0.5);
    disc(ctx, cx, c, r, hex(color), false);
    disc(ctx, cx, c, r * 0.5 * fade, '#ffffff', false);
  } else if (name === 'spin') {
    // Ticket : petit rectangle magenta qui tourne.
    ctx.translate(cx, c);
    ctx.rotate((f.i * Math.PI) / 4);
    box(ctx, -3, -2, 6, 4, hex(color));
    px(ctx, -1, -1, 2, 2, '#ffffff');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    // hit, dash, dust, sparks : étoile qui s'étend.
    const r = 2 + (c - 3) * f.t;
    ctx.fillStyle = hex(color);
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2 + f.i * 0.3;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(c + Math.sin(a) * r) - 1, 2, 2);
    }
    if (f.t < 0.4) disc(ctx, cx, c, Math.max(1, 4 * fade), '#ffffff', false);
  }
  ctx.globalAlpha = 1;
}

function drawPickup(ctx: Ctx, ox: number, size: number, f: FrameInfo, entity: string): void {
  const cx = ox + size / 2;
  if (entity === 'pickup-grain') {
    const w = f.i % 3 === 1 ? 2 : 4;
    box(ctx, cx - w / 2, 2, w, 4, '#6b3e26');
    return;
  }
  // Gobelet fumant
  box(ctx, cx - 4, 6, 8, 8, '#f4f6f8');
  px(ctx, cx - 4, 7, 8, 2, '#8a5a3c');
  px(ctx, cx - 1 + (f.i % 2), 1 + (f.i % 3), 1, 3, '#c8d0dc');
}

/** Crée une feuille de sprites placeholder (une frame par case). */
export function createPlaceholderSheet(scene: Phaser.Scene, def: SheetDef): void {
  const w = def.frameWidth * def.frames;
  const h = def.frameHeight;
  const tex = scene.textures.createCanvas(def.key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const { entity, anim, dir } = parseKey(def.key);
  for (let i = 0; i < def.frames; i += 1) {
    const ox = i * def.frameWidth;
    const f: FrameInfo = {
      i,
      n: def.frames,
      t: def.frames <= 1 ? 1 : i / (def.frames - 1),
      anim,
      dir,
    };
    ctx.save();
    switch (entity) {
      case 'player':
        drawHumanoid(ctx, ox, def.frameWidth, f, def.tint, { helmet: '#ffd200', tool: true });
        break;
      case 'consultant':
        drawHumanoid(ctx, ox, def.frameWidth, f, def.tint, { tie: '#ff3ea5' });
        break;
      case 'manager-kpi':
        drawHumanoid(ctx, ox, def.frameWidth, f, def.tint, { tie: '#ffd200', big: true });
        break;
      case 'borne':
        drawBorne(ctx, ox, def.frameWidth, f, def.tint);
        break;
      case 'drone':
        drawDrone(ctx, ox, def.frameWidth, f, def.tint);
        break;
      case 'auditeur':
        drawBoss(ctx, ox, def.frameWidth, f, def.tint);
        break;
      case 'marcel':
      case 'fatou':
      case 'yasmina':
      case 'kevin':
      case 'bene':
      case 'josiane':
      case 'rudy':
      case 'jeanmi':
        drawHumanoid(
          ctx,
          ox,
          def.frameWidth,
          f,
          def.tint,
          entity === 'marcel' ? { helmet: '#2b2f36' } : {},
        );
        break;
      case 'pickup-cafe':
      case 'pickup-grain':
        drawPickup(ctx, ox, def.frameWidth, f, entity);
        break;
      default:
        drawVfx(ctx, ox, def.frameWidth, f, def.tint, anim);
    }
    ctx.restore();
    tex.add(i, 0, ox, 0, def.frameWidth, def.frameHeight);
  }
  tex.refresh();
}

export function createPlaceholderImage(scene: Phaser.Scene, def: ImageDef): void {
  const tex = scene.textures.createCanvas(def.key, def.width, def.height);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = hex(def.tint);
  ctx.beginPath();
  ctx.ellipse(def.width / 2, def.height / 2, def.width / 2, def.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

/** Couleur d'une tuile placeholder d'après son nom dans le manifeste. */
function tileColor(name: string, occ: boolean): string {
  if (name.startsWith('walltop')) return occ ? '#3a2018' : '#161d27';
  if (name.startsWith('wall') || name.startsWith('facade') || name.startsWith('vault'))
    return occ ? '#6e3b2a' : '#2a3442';
  if (name.startsWith('ballast') || name.startsWith('track') || name.startsWith('switch'))
    return '#4a4440';
  if (name.includes('podo')) return '#ffd200';
  if (name.startsWith('void')) return '#05080d';
  return occ ? '#5a4636' : '#5f6b7a';
}

/** Tileset placeholder au même format que les feuilles livrées (marge, espacement, noms du manifeste). */
export function createPlaceholderTileset(scene: Phaser.Scene, def: TilesetDef): void {
  const step = TILE + def.spacing;
  const w = def.margin * 2 + def.columns * TILE + (def.columns - 1) * def.spacing;
  const h = def.margin * 2 + def.rows * TILE + (def.rows - 1) * def.spacing;
  const tex = scene.textures.createCanvas(def.key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  const occ = def.key === 'tiles_occ';
  for (const [name, index] of Object.entries(def.names)) {
    const x = def.margin + (index % def.columns) * step;
    const y = def.margin + Math.floor(index / def.columns) * step;
    px(ctx, x, y, TILE, TILE, tileColor(name, occ));
    if (name.startsWith('track-H')) {
      px(ctx, x, y + (name.endsWith('bot') ? 11 : 3), TILE, 2, '#b8c0c8');
    }
    if (!name.startsWith('walltop')) px(ctx, x, y + 15, TILE, 1, 'rgba(0,0,0,0.25)');
  }
  tex.refresh();
}

/** Petites textures d'interface et de gameplay sans fichier (particules, cercles, pixel blanc). */
export function createUiTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (ctx: Ctx) => void): void => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    draw(tex.getContext());
    tex.refresh();
  };
  make('px', 2, 2, (c) => {
    px(c, 0, 0, 2, 2, '#ffffff');
  });
  make('spark', 3, 3, (c) => {
    px(c, 1, 0, 1, 3, '#ffffff');
    px(c, 0, 1, 3, 1, '#ffffff');
  });
  make('paper', 4, 3, (c) => {
    px(c, 0, 0, 4, 3, '#f4f6f8');
    px(c, 1, 1, 2, 1, '#9fb0c6');
  });
  make('ring64', 64, 64, (c) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(32, 32, 30, 0, Math.PI * 2);
    c.stroke();
  });
  make('disc64', 64, 64, (c) => {
    disc(c, 32, 32, 31, '#ffffff', false);
  });
  // Rai de lumière : dégradé vertical doux, plus dense en haut, bords fondus.
  make('shaft', 32, 128, (c) => {
    for (let y = 0; y < 128; y += 1) {
      const a = Math.pow(1 - y / 128, 1.4);
      const g = c.createLinearGradient(0, 0, 32, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${String(a)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, y, 32, 1);
    }
  });
  make('vignette', 160, 90, (c) => {
    const g = c.createRadialGradient(80, 45, 20, 80, 45, 92);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, 160, 90);
  });
}
