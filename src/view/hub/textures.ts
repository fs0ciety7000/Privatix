// Textures procédurales du hub (DA § 2.11-2.13) : jamais de photo, tout est dessiné par code.
// Lino du Centre Opérationnel, pavés moussus de la Cour, façades de brique jaune à fenêtres en grille,
// mur synoptique (redessiné à 10 Hz), panneau de liège du Tableau des revendications, panneaux.
import * as THREE from 'three';
import type { ShiftId } from '@/config/balance';
import { canvasTexture, rng } from '@/view/materials/toon';

export const HUB_FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

function repeatable(t: THREE.CanvasTexture): THREE.CanvasTexture {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Lino bleu ardoise du Centre Opérationnel (dalles de 2 m, usure légère). */
export function linoTexture(): THREE.CanvasTexture {
  const r = rng(11);
  return repeatable(
    canvasTexture(256, 256, (g) => {
      g.fillStyle = '#2b3850';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i += 1) {
        const v = 38 + Math.floor(r() * 18);
        g.fillStyle = `rgba(${String(v)},${String(v + 10)},${String(v + 28)},0.35)`;
        g.fillRect(r() * 256, r() * 256, 2 + r() * 3, 1 + r() * 2);
      }
      g.strokeStyle = 'rgba(12,16,28,0.75)';
      g.lineWidth = 3;
      g.strokeRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(120,150,190,0.12)';
      g.lineWidth = 1;
      g.strokeRect(3, 3, 250, 250);
    }),
  );
}

/** Pavé autobloquant gris à joints ondulés, mousse verte dans les joints (motif de 1 m). */
export function paversTexture(): THREE.CanvasTexture {
  const r = rng(23);
  return repeatable(
    canvasTexture(256, 256, (g) => {
      g.fillStyle = '#4c6a3a';
      g.fillRect(0, 0, 256, 256);
      const cols = 4;
      const rowsN = 8;
      const w = 256 / cols;
      const h = 256 / rowsN;
      for (let y = 0; y < rowsN; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const ox = (y % 2) * (w / 2);
          const v = 132 + Math.floor(r() * 26);
          g.fillStyle = `rgb(${String(v)},${String(v + 2)},${String(v + 6)})`;
          const px = x * w + ox;
          for (const dx of [0, -256]) {
            g.beginPath();
            // Pavé « en os » : flancs ondulés.
            const x0 = px + dx + 2;
            const y0 = y * h + 2;
            const x1 = x0 + w - 4;
            const y1 = y0 + h - 4;
            g.moveTo(x0, y0);
            g.quadraticCurveTo((x0 + x1) / 2, y0 + 4, x1, y0);
            g.lineTo(x1, y1);
            g.quadraticCurveTo((x0 + x1) / 2, y1 - 4, x0, y1);
            g.closePath();
            g.fill();
          }
        }
      }
      // Mousse débordante et taches.
      for (let i = 0; i < 260; i += 1) {
        g.fillStyle = `rgba(${String(60 + Math.floor(r() * 30))},${String(110 + Math.floor(r() * 40))},50,${(0.25 + r() * 0.4).toFixed(2)})`;
        const y = Math.floor(r() * rowsN) * h + (r() < 0.5 ? 1 : h - 2);
        g.fillRect(r() * 256, y - 1, 3 + r() * 9, 2 + r() * 2);
      }
      for (let i = 0; i < 40; i += 1) {
        g.fillStyle = `rgba(40,44,52,${(0.08 + r() * 0.12).toFixed(2)})`;
        g.beginPath();
        g.arc(r() * 256, r() * 256, 3 + r() * 10, 0, Math.PI * 2);
        g.fill();
      }
    }),
  );
}

/** État des fenêtres selon le roulement (DA § 2.12 : nuit = ~30 % allumées). */
function windowFill(shift: ShiftId, r: () => number): string {
  if (shift === 'nuit') {
    const lit = r();
    if (lit < 0.22) return '#ffc27a';
    if (lit < 0.3) return '#cfe4ff';
    return '#151c34';
  }
  if (shift === 'apres-midi') return r() < 0.35 ? '#f6b26b' : '#59657a';
  return r() < 0.15 ? '#8796aa' : '#5d6b7e';
}

/**
 * Façade de brique jaune des années 50 (cinq niveaux) : soubassement gris strié de coulures, fenêtres
 * à petits carreaux en grille régulière, descentes d'eau, climatiseurs. `w`, `h` en mètres.
 */
export function facadeTexture(
  w: number,
  h: number,
  shift: ShiftId,
  seed: number,
  opts: { readonly plinth?: number; readonly stairX?: number | null } = {},
): THREE.CanvasTexture {
  const ppm = 48;
  const W = Math.min(2048, Math.round(w * ppm));
  const H = Math.min(2048, Math.round(h * ppm));
  const sx = W / w;
  const sy = H / h;
  const r = rng(seed);
  return canvasTexture(W, H, (g) => {
    g.fillStyle = '#c9a85e';
    g.fillRect(0, 0, W, H);
    // Briques en panneresse, teinte qui varie tous les 8 à 10 rangs.
    const bh = 0.075 * sy;
    const bw = 0.24 * sx;
    let tint = 0;
    for (let row = 0, y = 0; y < H; row += 1, y += bh) {
      if (row % 9 === 0) tint = (r() - 0.5) * 14;
      const off = (row % 2) * (bw / 2);
      for (let x = -off; x < W; x += bw) {
        const v = (r() - 0.5) * 16 + tint;
        g.fillStyle = `rgb(${String(Math.round(214 + v))},${String(Math.round(178 + v))},${String(Math.round(104 + v * 0.6))})`;
        g.fillRect(x + 1, y + 1, bw - 2, bh - 1.5);
      }
    }
    // Soubassement gris strié.
    const plinth = (opts.plinth ?? 1.7) * sy;
    g.fillStyle = '#9a9a96';
    g.fillRect(0, H - plinth, W, plinth);
    for (let i = 0; i < W / 6; i += 1) {
      g.fillStyle = r() < 0.5 ? 'rgba(60,58,56,0.25)' : 'rgba(240,240,232,0.18)';
      g.fillRect(r() * W, H - plinth, 1 + r() * 3, plinth * (0.3 + r() * 0.7));
    }
    g.fillStyle = '#6f6d6a';
    g.fillRect(0, H - plinth - 4, W, 6);
    // Fenêtres : grille régulière par niveau (3,4 m), en évitant la cage d'escalier.
    const level = 3.4 * sy;
    const winW = 1.5 * sx;
    const winH = 1.75 * sy;
    const pitch = 3.0 * sx;
    const stairX = opts.stairX ?? null;
    for (let y = H - plinth - level + (level - winH) / 2; y > -winH; y -= level) {
      for (let x = pitch / 2 - winW / 2; x < W - winW; x += pitch) {
        if (stairX !== null && Math.abs(x + winW / 2 - stairX * sx) < 2.4 * sx) continue;
        g.fillStyle = '#d9d4c8';
        g.fillRect(x - 4, y + winH, winW + 8, 6);
        g.fillStyle = '#3a3f48';
        g.fillRect(x - 2, y - 2, winW + 4, winH + 4);
        const cols = 3;
        const rowsN = 3;
        const pw = winW / cols;
        const ph = winH / rowsN;
        const fillC = windowFill(shift, r);
        for (let cy = 0; cy < rowsN; cy += 1) {
          for (let cx = 0; cx < cols; cx += 1) {
            g.fillStyle = fillC;
            g.fillRect(x + cx * pw + 1.5, y + cy * ph + 1.5, pw - 3, ph - 3);
          }
        }
        // Climatiseur accroché çà et là.
        if (r() < 0.08) {
          g.fillStyle = '#e8e8e2';
          g.fillRect(x + winW + 6, y + winH * 0.55, 0.8 * sx, 0.5 * sy);
          g.fillStyle = '#9da0a4';
          g.fillRect(x + winW + 10, y + winH * 0.6, 0.6 * sx, 2);
        }
      }
    }
    // Descentes d'eau.
    for (let x = pitch * 2; x < W; x += pitch * 4) {
      g.fillStyle = '#5c6066';
      g.fillRect(x, 0, 5, H - plinth);
    }
    // Corniche.
    g.fillStyle = '#e0dccb';
    g.fillRect(0, 0, W, 0.25 * sy);
  });
}

/** Brique sombre du pignon du coin poubelles (fenêtre murée). */
export function darkBrickTexture(w: number, h: number): THREE.CanvasTexture {
  const r = rng(5);
  const ppm = 40;
  const W = Math.round(w * ppm);
  const H = Math.round(h * ppm);
  return canvasTexture(W, H, (g) => {
    g.fillStyle = '#2a2226';
    g.fillRect(0, 0, W, H);
    const bh = 0.075 * ppm;
    const bw = 0.24 * ppm;
    for (let row = 0, y = 0; y < H; row += 1, y += bh) {
      const off = (row % 2) * (bw / 2);
      for (let x = -off; x < W; x += bw) {
        const v = (r() - 0.5) * 20;
        g.fillStyle = `rgb(${String(Math.round(82 + v))},${String(Math.round(64 + v))},${String(Math.round(58 + v))})`;
        g.fillRect(x + 1, y + 1, bw - 2, bh - 1.5);
      }
    }
    // Fenêtre murée (briques plus claires, linteau de pierre).
    const fx = W * 0.4;
    const fy = H * 0.3;
    g.fillStyle = 'rgba(190,160,130,0.35)';
    g.fillRect(fx, fy, W * 0.2, H * 0.3);
    g.fillStyle = '#8e8a84';
    g.fillRect(fx - 6, fy - 10, W * 0.2 + 12, 10);
  });
}

/** Panneau générique (texte blanc sur fond coloré, bordure). */
export function signTexture(
  lines: readonly string[],
  bg: string,
  fg = '#ffffff',
  w = 512,
  h = 160,
): THREE.CanvasTexture {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = Math.floor(((h - 30) / Math.max(1, lines.length)) * 0.62);
    g.font = `900 ${String(size)}px ${HUB_FONT}`;
    lines.forEach((l, i) => {
      g.fillText(l, w / 2, 15 + ((h - 30) * (i + 0.5)) / lines.length, w - 30);
    });
  });
}

/**
 * Vitrage de la cage d'escalier (blanc teinté par le matériau selon le roulement) : montants, paliers,
 * silhouettes de consultants qui montent aux étages Privatix.
 */
export function stairGlassTexture(): THREE.CanvasTexture {
  const r = rng(91);
  return canvasTexture(128, 768, (g) => {
    const grad = g.createLinearGradient(0, 0, 128, 768);
    grad.addColorStop(0, '#e8f0f8');
    grad.addColorStop(1, '#a8b8c8');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 768);
    for (let y = 0; y < 768; y += 154) {
      // Silhouettes (en réunion, toujours).
      if (r() < 0.7) {
        g.fillStyle = 'rgba(30,26,46,0.75)';
        const x = 24 + r() * 70;
        g.beginPath();
        g.arc(x, y + 60, 9, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - 11, y + 70, 22, 46);
      }
      g.fillStyle = '#3a3f48';
      g.fillRect(0, y, 128, 8);
    }
    g.fillStyle = '#3a3f48';
    for (const x of [0, 62, 122]) g.fillRect(x, 0, 6, 768);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(14, 0, 10, 768);
  });
}

/** Panneau de liège du Tableau des revendications : une feuille punaisée par rang obtenu. */
export function corkTexture(ownedRanks: number): THREE.CanvasTexture {
  const r = rng(77);
  return canvasTexture(512, 320, (g) => {
    g.fillStyle = '#a8743f';
    g.fillRect(0, 0, 512, 320);
    for (let i = 0; i < 1400; i += 1) {
      g.fillStyle = r() < 0.5 ? 'rgba(80,45,20,0.35)' : 'rgba(230,180,120,0.25)';
      g.fillRect(r() * 512, r() * 320, 2, 2);
    }
    g.strokeStyle = '#5a3a1e';
    g.lineWidth = 14;
    g.strokeRect(7, 7, 498, 306);
    g.fillStyle = '#fffbe8';
    g.font = `900 26px ${HUB_FONT}`;
    g.textAlign = 'center';
    g.fillText('TABLEAU DES REVENDICATIONS', 256, 44);
    const n = Math.min(24, ownedRanks + 3);
    const pins: [number, number][] = [];
    for (let i = 0; i < n; i += 1) {
      const x = 40 + (i % 8) * 56 + r() * 10;
      const y = 70 + Math.floor(i / 8) * 78 + r() * 10;
      g.save();
      g.translate(x + 20, y + 28);
      g.rotate((r() - 0.5) * 0.25);
      g.fillStyle = i < ownedRanks ? '#fff6d6' : '#e8e2d0';
      g.fillRect(-20, -28, 40, 56);
      g.fillStyle = i < ownedRanks ? '#c0392b' : '#8a8478';
      for (let l = 0; l < 5; l += 1) g.fillRect(-14, -16 + l * 8, 22 + r() * 6, 3);
      g.restore();
      g.fillStyle = '#e8213a';
      g.beginPath();
      g.arc(x + 20, y + 4, 4, 0, Math.PI * 2);
      g.fill();
      pins.push([x + 20, y + 4]);
    }
    // Fils rouges entre les revendications obtenues.
    g.strokeStyle = 'rgba(214,32,52,0.85)';
    g.lineWidth = 2;
    for (let i = 1; i < Math.min(ownedRanks, pins.length); i += 1) {
      const a = pins[i - 1];
      const b = pins[i];
      if (!a || !b) continue;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
  });
}

/** Données affichées par le mur synoptique (état du jeu). */
export interface SynopticInfo {
  /** « du Matin », « de Nuit »… */
  readonly shiftLabel: string;
  readonly shifts: number;
  readonly lastLine: string;
  readonly lastOk: boolean;
}

const STATIONS = ['MONS', 'JEMAPPES', 'ST-GHISLAIN', 'NIMY', 'OBOURG', 'HAVRÉ', 'CUESMES'];

/**
 * Mur synoptique (DA § 2.11) : voies en traits cyan, cantons occupés en vert, trains en points
 * mobiles, retards en ambre (clignotants, fixes en réduction des mouvements). Redessiné à 10 Hz.
 */
export class SynopticWall {
  public readonly texture: THREE.CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private readonly w = 1024;
  private readonly h = 256;
  private acc = 0;

  public constructor(
    private info: SynopticInfo,
    private readonly reducedMotion: boolean,
  ) {
    const holder: { g: CanvasRenderingContext2D | null } = { g: null };
    this.texture = canvasTexture(this.w, this.h, (g) => {
      holder.g = g;
    });
    if (!holder.g) throw new Error('canvas 2D indisponible');
    this.g = holder.g;
    this.draw(0);
  }

  public setInfo(info: SynopticInfo): void {
    this.info = info;
  }

  public update(time: number, dt: number): void {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    this.draw(time);
    this.texture.needsUpdate = true;
  }

  private draw(t: number): void {
    const g = this.g;
    const { w, h } = this;
    g.fillStyle = '#04101a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,140,180,0.12)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    // En-tête.
    g.fillStyle = '#6ff3ff';
    g.font = `900 18px ${HUB_FONT}`;
    g.textAlign = 'left';
    g.fillText(
      `OCC MONS · CIRCULATION EN TEMPS RÉEL · ROULEMENT ${this.info.shiftLabel.toUpperCase()}`,
      16,
      26,
    );
    g.textAlign = 'right';
    g.fillText(`SHIFTS ASSURÉS : ${String(this.info.shifts)}`, w - 16, 26);
    // Voies.
    const tracks = [70, 108, 146, 184];
    g.lineWidth = 4;
    tracks.forEach((y, i) => {
      g.strokeStyle = '#2fd9ff';
      g.beginPath();
      g.moveTo(30, y);
      g.lineTo(w - 30, y);
      g.stroke();
      if (i < tracks.length - 1) {
        const x = 200 + i * 230;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 40, tracks[i + 1] ?? y);
        g.stroke();
      }
    });
    // Cantons occupés.
    tracks.forEach((y, i) => {
      for (let k = 0; k < 6; k += 1) {
        const busy = Math.sin(t * 0.21 + i * 1.7 + k * 2.3) > 0.35;
        if (!busy) continue;
        g.fillStyle = '#5dff8a';
        g.fillRect(40 + k * 160, y - 4, 120, 8);
      }
    });
    // Gares.
    g.font = `900 12px ${HUB_FONT}`;
    g.textAlign = 'center';
    STATIONS.forEach((name, i) => {
      const x = 60 + i * 150;
      g.fillStyle = '#dde8f0';
      g.fillRect(x - 3, 58, 6, 136);
      g.fillText(name, x, 212);
    });
    // Trains (points mobiles) et retards (ambre).
    for (let k = 0; k < 7; k += 1) {
      const y = tracks[k % tracks.length] ?? 70;
      const dirn = k % 2 === 0 ? 1 : -1;
      const x = 40 + ((((t * (18 + k * 5) * dirn + k * 173) % (w - 80)) + (w - 80)) % (w - 80));
      const late = k === 2 || k === 5;
      const blink = this.reducedMotion || Math.sin(t * 6 + k) > -0.2;
      g.fillStyle = late ? (blink ? '#ffb020' : '#7a5210') : '#ffffff';
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
    // Bandeau du bas : le dernier train (cause de la dernière mort).
    g.fillStyle = this.info.lastOk ? '#0c3a1e' : '#3a0c22';
    g.fillRect(0, h - 30, w, 30);
    g.fillStyle = this.info.lastOk ? '#7dff9a' : '#ff8a4a';
    g.font = `900 16px ${HUB_FONT}`;
    g.textAlign = 'left';
    g.fillText(this.info.lastLine, 16, h - 10);
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
