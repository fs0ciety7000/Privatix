// Ambiances des biomes du Shift (LORE § 5, art_director.md § 2.3) : sol, murs, néon, affiches, lumière
// des lampes, ciel et brouillard. Le biome 1 garde exactement le rendu validé des quais.
// - Passerelle « Calatrava » : l'aube, des arcs blancs, une verrière, le vide sous les pieds ;
// - Hall & BAG : bois clair du hall historique, moquette grise et néons froids de l'open-space.
import * as THREE from 'three';
import type { BiomeIndex } from '@/systems/procedural/roomTemplates';
import { canvasTexture, rng } from '@/view/materials/toon';

export interface AdSpec {
  readonly title: string;
  readonly line: string;
  readonly small: string;
  readonly bg: string;
  readonly fg: string;
  readonly accent: string;
}

export interface RoomAmbience {
  readonly background: number;
  readonly fog: number;
  readonly fogDensity: number;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemiIntensity: number;
  readonly sun: number;
  readonly sunIntensity: number;
}

export interface RoomTheme {
  readonly biome: BiomeIndex;
  readonly floor: 'quai' | 'deck' | 'parquet';
  readonly wall: 'brick' | 'glass' | 'panel';
  /** Texte du néon de façade et sa couleur (CSS). */
  readonly neon: string;
  readonly neonColor: string;
  readonly neonLight: number;
  /** Tube lumineux sous la corniche. */
  readonly tube: number;
  readonly ads: readonly AdSpec[];
  readonly lamp: number;
  readonly lampIntensity: number;
  readonly pool: number;
  readonly pillar: number;
  readonly pillarDark: number;
  /** Hauteur des piliers (les arcs de la Passerelle sont plus hauts). */
  readonly pillarH: number;
  readonly lowWall: number;
  readonly trim: number;
  readonly shutter: number;
  /** Panneaux « MONS » + logo SNCB sur les piliers du milieu. */
  readonly stationSigns: boolean;
  readonly ambience: RoomAmbience;
}

const PRIVATIX_ADS: readonly AdSpec[] = [
  {
    title: 'PRIVATIX',
    line: 'Optimisons vos trajets.*',
    small: '* sous réserve de rentabilité',
    bg: '#5a0f3e',
    fg: '#ff6ec0',
    accent: '#ff3ea5',
  },
  {
    title: 'MODERNISATION',
    line: 'Votre gare, bientôt plus agile.',
    small: 'Plan Mons 2032 · merci de votre patience.',
    bg: '#0d4a52',
    fg: '#5ff7e4',
    accent: '#19c3b1',
  },
];

export const ROOM_THEMES: Readonly<Record<BiomeIndex, RoomTheme>> = {
  0: {
    biome: 0,
    floor: 'quai',
    wall: 'brick',
    neon: 'PRIVATIX',
    neonColor: '#ff6ec0',
    neonLight: 0xff3ea5,
    tube: 0x19c3b1,
    ads: PRIVATIX_ADS,
    lamp: 0xffa64d,
    lampIntensity: 26,
    pool: 0xffa040,
    pillar: 0x2a3a6a,
    pillarDark: 0x1a2244,
    pillarH: 3.3,
    lowWall: 0x2c2944,
    trim: 0x2a3a6a,
    shutter: 0x3a4266,
    stationSigns: true,
    ambience: {
      background: 0x0a0818,
      fog: 0x120c2a,
      fogDensity: 0.017,
      hemiSky: 0x5a5ad0,
      hemiGround: 0x2a1438,
      hemiIntensity: 0.7,
      sun: 0xa8b8ff,
      sunIntensity: 1.9,
    },
  },
  1: {
    biome: 1,
    floor: 'deck',
    wall: 'glass',
    neon: 'MONS 2032',
    neonColor: '#ffd27a',
    neonLight: 0xffb35a,
    tube: 0xfff0d8,
    ads: [
      {
        title: 'MONS 2032',
        line: 'Une gare, zéro guichet.',
        small: 'Privatix Rail Experience · lot n° 1',
        bg: '#4a2a5e',
        fg: '#ffd27a',
        accent: '#b05cff',
      },
      {
        title: 'INAUGURATION',
        line: 'Passerelle fermée pour cérémonie.',
        small: 'Accès invités. Gilets orange non admis.',
        bg: '#5e1a26',
        fg: '#ffe2c0',
        accent: '#ff7a5a',
      },
    ],
    lamp: 0xffe2c8,
    lampIntensity: 14,
    pool: 0xffc8a0,
    pillar: 0xd4d8e4,
    pillarDark: 0x8a92aa,
    pillarH: 4.4,
    lowWall: 0xa8b0c4,
    trim: 0xf4f6fb,
    shutter: 0xc8d0e0,
    stationSigns: true,
    ambience: {
      background: 0x261e3a,
      fog: 0x3e3054,
      fogDensity: 0.012,
      hemiSky: 0xb898c8,
      hemiGround: 0x241c40,
      hemiIntensity: 0.55,
      sun: 0xffc8a8,
      sunIntensity: 1.25,
    },
  },
  2: {
    biome: 2,
    floor: 'parquet',
    wall: 'panel',
    neon: 'PRIVATIX',
    neonColor: '#c89bff',
    neonLight: 0xb05cff,
    tube: 0xe8f0ff,
    ads: [
      {
        title: 'NOS VALEURS',
        line: 'Agilité · Excellence · Bienveillance · RENTABILITÉ',
        small: 'Synergia Partners pour Privatix',
        bg: '#241a46',
        fg: '#c89bff',
        accent: '#b05cff',
      },
      {
        title: 'CORNER EXPÉRIENCE',
        line: 'Un écran tactile. Une plante. Zéro guichet.',
        small: 'Votre avis compte (sondage en cours depuis 2019).',
        bg: '#0d3a4a',
        fg: '#8ff3ff',
        accent: '#19c3b1',
      },
    ],
    lamp: 0xffcf8a,
    lampIntensity: 15,
    pool: 0xffb060,
    pillar: 0x6a4a34,
    pillarDark: 0x3a2a20,
    pillarH: 3.3,
    lowWall: 0x4a3a40,
    trim: 0xc8a060,
    shutter: 0x5a6078,
    stationSigns: false,
    ambience: {
      background: 0x120e1a,
      fog: 0x1e1828,
      fogDensity: 0.014,
      hemiSky: 0xc8b8c8,
      hemiGround: 0x1c1626,
      hemiIntensity: 0.5,
      sun: 0xd8d0ff,
      sunIntensity: 1.05,
    },
  },
};

/** Ambiances propres à certaines arènes (Afterwork : seule la boule éclaire). */
export function ambienceFor(theme: RoomTheme, layoutId: string): RoomAmbience {
  if (layoutId === 'afterwork')
    return {
      background: 0x07040e,
      fog: 0x120820,
      fogDensity: 0.016,
      hemiSky: 0x4a7ab8,
      hemiGround: 0x100818,
      hemiIntensity: 0.42,
      sun: 0x8ac8ff,
      sunIntensity: 0.75,
    };
  return theme.ambience;
}

function repeatTex(t: THREE.CanvasTexture): THREE.CanvasTexture {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Tablier de la Passerelle : dalles d'acier clair, joints, rivets, traces d'usure. */
export function deckTexture(): THREE.CanvasTexture {
  const R = rng(21);
  return repeatTex(
    canvasTexture(512, 512, (g) => {
      g.fillStyle = '#4a5064';
      g.fillRect(0, 0, 512, 512);
      const n = 4;
      const s = 512 / n;
      for (let y = 0; y < n; y += 1)
        for (let x = 0; x < n; x += 1) {
          const v = 92 + Math.floor(R() * 16);
          g.fillStyle = `rgb(${String(v)},${String(v + 6)},${String(v + 22)})`;
          g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          for (let i = 0; i < 6; i += 1) g.fillRect(x * s + 6, y * s + 10 + i * 20, s - 12, 2);
          g.fillStyle = 'rgba(40,40,70,0.5)';
          for (const [dx, dy] of [
            [8, 8],
            [s - 10, 8],
            [8, s - 10],
            [s - 10, s - 10],
          ] as const)
            g.fillRect(x * s + dx, y * s + dy, 3, 3);
        }
      for (let i = 0; i < 5; i += 1) {
        const sx = R() * 512;
        const sy = R() * 512;
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 60 + R() * 70);
        gr.addColorStop(0, 'rgba(30,24,60,0.18)');
        gr.addColorStop(1, 'rgba(30,24,60,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 512, 512);
      }
    }),
  );
}

/** Parquet du hall historique : lames de bois clair à bâtons rompus simplifiés. */
export function parquetTexture(): THREE.CanvasTexture {
  const R = rng(33);
  return repeatTex(
    canvasTexture(512, 512, (g) => {
      g.fillStyle = '#4a2e1c';
      g.fillRect(0, 0, 512, 512);
      const lw = 128;
      const lh = 32;
      for (let y = 0; y < 512 / lh; y += 1)
        for (let x = -1; x < 512 / lw + 1; x += 1) {
          const v = R();
          const r = 98 + Math.floor(v * 30);
          g.fillStyle = `rgb(${String(r)},${String(Math.floor(r * 0.66))},${String(Math.floor(r * 0.42))})`;
          const ox = (y % 2) * (lw / 2);
          g.fillRect(x * lw + ox + 1, y * lh + 1, lw - 2, lh - 2);
          g.fillStyle = 'rgba(60,30,10,0.18)';
          for (let i = 0; i < 4; i += 1)
            g.fillRect(x * lw + ox + 4, y * lh + 6 + i * 6, lw - 10, 1);
        }
      g.fillStyle = 'rgba(255,240,210,0.05)';
      g.fillRect(0, 0, 512, 512);
    }),
  );
}

/** Moquette grise de l'open-space (texture fine, motifs de dalles). */
export function carpetTexture(): THREE.CanvasTexture {
  const R = rng(44);
  return repeatTex(
    canvasTexture(256, 256, (g) => {
      g.fillStyle = '#3c4258';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i += 1) {
        const v = 50 + Math.floor(R() * 40);
        g.fillStyle = `rgba(${String(v)},${String(v + 6)},${String(v + 24)},0.6)`;
        g.fillRect(R() * 256, R() * 256, 2, 2);
      }
      g.strokeStyle = 'rgba(20,20,40,0.5)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, 254, 254);
    }),
  );
}

/** Mur rideau de la Passerelle : ciel d'aube derrière une verrière à meneaux blancs. */
export function skyWallTexture(): THREE.CanvasTexture {
  return repeatTex(
    canvasTexture(512, 512, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, '#5a6aa8');
      gr.addColorStop(0.45, '#c88aa8');
      gr.addColorStop(0.75, '#ffc89a');
      gr.addColorStop(1, '#ffe2b8');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 512);
      // Silhouette lointaine de la ville (beffroi compris), sans détail identifiable.
      g.fillStyle = 'rgba(70,50,90,0.55)';
      const R = rng(5);
      let x = 0;
      while (x < 512) {
        const w = 18 + R() * 40;
        const h = 30 + R() * 70;
        g.fillRect(x, 512 - h, w, h);
        x += w + 2;
      }
      g.fillRect(300, 352, 16, 160);
      g.beginPath();
      g.moveTo(296, 352);
      g.lineTo(308, 318);
      g.lineTo(320, 352);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 7;
      for (let i = 0; i <= 4; i += 1) {
        g.beginPath();
        g.moveTo(i * 128, 0);
        g.lineTo(i * 128, 512);
        g.stroke();
      }
      g.lineWidth = 4;
      for (let i = 1; i < 4; i += 1) {
        g.beginPath();
        g.moveTo(0, i * 128);
        g.lineTo(512, i * 128);
        g.stroke();
      }
    }),
  );
}

/** Boiseries du hall : soubassement de bois sombre, panneaux crème moulurés. */
export function panelWallTexture(): THREE.CanvasTexture {
  return repeatTex(
    canvasTexture(512, 512, (g) => {
      g.fillStyle = '#d8c8a8';
      g.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 128) {
        g.strokeStyle = 'rgba(120,90,60,0.55)';
        g.lineWidth = 4;
        g.strokeRect(x + 14, 40, 100, 250);
      }
      g.fillStyle = '#6a4228';
      g.fillRect(0, 330, 512, 182);
      for (let x = 0; x < 512; x += 64) {
        g.fillStyle = 'rgba(30,15,5,0.35)';
        g.fillRect(x, 330, 3, 182);
      }
      g.fillStyle = '#8a5a36';
      g.fillRect(0, 320, 512, 14);
    }),
  );
}

/** Écrans du mur de visio de la Salle du Conseil (carrés noirs, dont « HR »). */
export function visioTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 256, (g) => {
    g.fillStyle = '#0a0a14';
    g.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 8; i += 1) {
      const x = 16 + i * 126;
      g.fillStyle = '#05050a';
      g.fillRect(x, 24, 112, 92);
      g.fillRect(x, 136, 112, 92);
      g.strokeStyle = '#2a2a50';
      g.lineWidth = 3;
      g.strokeRect(x, 24, 112, 92);
      g.strokeRect(x, 136, 112, 92);
    }
    g.fillStyle = '#b05cff';
    g.font = '900 54px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('HR', 16 + 3 * 126 + 56, 70);
    g.fillStyle = '#6a6a90';
    g.font = 'bold 18px Arial, sans-serif';
    for (let i = 0; i < 8; i += 1) g.fillText('caméra coupée', 16 + i * 126 + 56, 200);
  });
}

/** Banderole (inauguration, afterwork). */
export function bannerTexture(
  title: string,
  sub: string,
  bg: string,
  fg: string,
): THREE.CanvasTexture {
  return canvasTexture(1024, 192, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 192);
    g.strokeStyle = fg;
    g.lineWidth = 8;
    g.strokeRect(10, 10, 1004, 172);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 72px "Arial Black", Arial, sans-serif';
    g.fillText(title, 512, 78);
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px Arial, sans-serif';
    g.fillText(sub, 512, 146);
  });
}
