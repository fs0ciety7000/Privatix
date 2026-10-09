// Butin : objets d'équipement à rareté, objet au sol avec faisceau coloré, carte HTML de l'objet.
import * as THREE from 'three';
import { addOutline, canvasTexture, glow, rboxGeo, toon } from './toon';
import { fxFlags } from './quality';

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire';
export type Slot = 'casque' | 'gilet' | 'cle';

export const RARITY: Record<Rarity, { label: string; color: number; css: string }> = {
  commun: { label: 'Commun', color: 0xc8cbd8, css: '#c8cbd8' },
  rare: { label: 'Rare', color: 0x3aa0ff, css: '#3aa0ff' },
  epique: { label: 'Épique', color: 0xb05cff, css: '#b05cff' },
  legendaire: { label: 'Légendaire', color: 0xffb52e, css: '#ffb52e' },
};

export const SLOT_LABEL: Record<Slot, string> = { casque: 'Casque', gilet: 'Gilet', cle: 'Clé à tire-fond' };

export interface Item {
  id: string;
  slot: Slot;
  variant: string;
  name: string;
  rarity: Rarity;
  stats: Array<{ label: string; value: string; up?: boolean }>;
  perk?: string;
  flavor: string;
  apply: { armor?: number; hp?: number; dmg?: number; speed?: number };
}

export const STARTER: Record<Slot, Item> = {
  casque: { id: 'casque0', slot: 'casque', variant: 'base', name: 'Casque de chantier', rarity: 'commun', stats: [{ label: 'Armure', value: '+4' }], flavor: '', apply: {} },
  gilet: { id: 'gilet0', slot: 'gilet', variant: 'base', name: 'Gilet haute visibilité', rarity: 'commun', stats: [{ label: 'Armure', value: '+6' }], flavor: '', apply: {} },
  cle: { id: 'cle0', slot: 'cle', variant: 'base', name: 'Clé à tire-fond', rarity: 'commun', stats: [{ label: 'Dégâts', value: '12 / 12 / 30' }], flavor: '', apply: {} },
};

export const LOOT_TABLE: Item[] = [
  {
    id: 'casque-chef',
    slot: 'casque',
    variant: 'legend',
    name: 'Casque du Chef de Gare',
    rarity: 'legendaire',
    stats: [
      { label: 'Armure', value: '+18', up: true },
      { label: 'Énergie max', value: '+25', up: true },
      { label: 'Critique', value: '+14 %', up: true },
    ],
    perk: 'Lampe frontale : éclaire le quai et révèle les télégraphes plus tôt.',
    flavor: '« Transmis de chef en chef depuis 1952. Jamais privatisé. »',
    apply: { armor: 14, hp: 25 },
  },
  {
    id: 'gilet-nuit',
    slot: 'gilet',
    variant: 'rare',
    name: 'Gilet de Nuit Fluo',
    rarity: 'rare',
    stats: [
      { label: 'Armure', value: '+10', up: true },
      { label: 'Vitesse', value: '+8 %', up: true },
    ],
    perk: 'Bandes réfléchissantes : aveuglent brièvement les consultants au dash.',
    flavor: '« Visible à 300 m. Même par la direction. »',
    apply: { armor: 4, speed: 0.08 },
  },
  {
    id: 'cle-trempee',
    slot: 'cle',
    variant: 'epic',
    name: 'Clé Trempée du Dépôt',
    rarity: 'epique',
    stats: [
      { label: 'Dégâts', value: '+6', up: true },
      { label: 'Portée', value: '+12 %', up: true },
    ],
    perk: 'Coup 3 : onde de choc élargie.',
    flavor: '« Forgée dans l’atelier qu’ils voulaient fermer. »',
    apply: { dmg: 6 },
  },
];

// ─── Modèles miniatures des objets ──────────────────────────────────────────────

function itemModel(item: Item): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, outline = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    if (outline) addOutline(m, 2.6);
    g.add(m);
    return m;
  };
  if (item.slot === 'casque') {
    const gold = toon(0xe8a81c, { emissive: 0x7a4400, emissiveIntensity: 0.3, rimStrength: 1.0, rim: 0xfff2a8 });
    const red = toon(0x7a1424, { rimStrength: 0.6 });
    const dome = add(new THREE.SphereGeometry(0.42, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.scale.set(1, 0.8, 1.05);
    add(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 24), gold, 0, 0.0, 0);
    add(new THREE.CylinderGeometry(0.425, 0.425, 0.08, 24), red, 0, 0.06, 0, 0, 0, 0, false);
    add(rboxGeo(0.09, 0.2, 0.72, 0.04), gold, 0, 0.36, -0.02);
    add(rboxGeo(0.07, 0.15, 0.48, 0.03), toon(0xd8203a, { rimStrength: 0.8 }), 0, 0.48, -0.14);
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12), glow(0xfff0c0, 6), 0, 0.15, 0.44, Math.PI / 2, 0, 0, false);
  } else if (item.slot === 'gilet') {
    const vest = toon(0xc8ff2a, { rimStrength: 1.2 });
    const stripe = toon(0xd8f6ff, { emissive: 0x6ff3ff, emissiveIntensity: 1.6 });
    add(rboxGeo(0.8, 0.62, 0.32, 0.12), vest);
    add(rboxGeo(0.82, 0.07, 0.34, 0.02), stripe, 0, -0.08, 0, 0, 0, 0, false);
    add(rboxGeo(0.82, 0.07, 0.34, 0.02), stripe, 0, 0.12, 0, 0, 0, 0, false);
    add(rboxGeo(0.34, 0.12, 0.34, 0.04), toon(0x1b2244), 0, 0.3, 0);
  } else {
    const steel = toon(0xb6a8ff, { rimStrength: 1.4, rim: 0x9cf6ff });
    const dark = toon(0x3a2a7a, { rimStrength: 0.8 });
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 10), steel, 0, 0, 0);
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 10), dark, 0, 0.65, 0, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 14), dark, 0, -0.62, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20), glow(0x6ff3ff, 4));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.5;
    g.add(ring);
    g.rotation.z = 0.5;
  }
  return g;
}

// ─── Objet au sol ───────────────────────────────────────────────────────────────

const BEAM_VS = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const BEAM_FS = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.2);
  float h = pow(1.0 - vUv.y, 2.2);
  float wave = 0.75 + 0.25 * sin(vUv.y * 30.0 - uTime * 6.0);
  float a = f * h * wave * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

let glowTex: THREE.Texture | null = null;
function groundGlowTex(): THREE.Texture {
  if (!glowTex) {
    glowTex = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.3, 'rgba(255,255,255,0.35)');
      gr.addColorStop(0.62, 'rgba(255,255,255,0.12)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.7)');
      gr.addColorStop(0.76, 'rgba(255,255,255,0.0)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }, false);
  }
  return glowTex;
}

export class LootDrop {
  readonly group = new THREE.Group();
  private model: THREE.Group;
  private beams: THREE.Mesh[] = [];
  private beamMats: THREE.ShaderMaterial[] = [];
  private disc: THREE.Mesh;
  private vel = new THREE.Vector3();
  private t = 0;
  private landed = false;
  taken = false;
  private takeT = 0;
  readonly pos = new THREE.Vector3();

  constructor(readonly item: Item, from: THREE.Vector3, to: THREE.Vector3, private readonly light: THREE.PointLight | null) {
    const col = new THREE.Color(RARITY[item.rarity].color);
    this.model = itemModel(item);
    this.group.add(this.model);
    for (const [r, h, inten] of [
      [0.42, 9, 0.8],
      [0.14, 11, 1.7],
    ] as const) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VS,
        fragmentShader: BEAM_FS,
        uniforms: { uColor: { value: col.clone().multiplyScalar(inten) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, h, 20, 1, true).translate(0, h / 2, 0), mat);
      beam.renderOrder = 7;
      beam.scale.y = 0.01;
      this.beams.push(beam);
      this.beamMats.push(mat);
    }
    this.disc = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: groundGlowTex(), color: col.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.disc.renderOrder = 4;
    this.pos.copy(to);
    this.model.position.copy(from).setY(1.2);
    // trajectoire balistique jusqu'au point d'arrivée en 0,6 s
    const T = 0.6;
    this.vel.set((to.x - from.x) / T, 0.5 * 16 * T, (to.z - from.z) / T);
    if (light) {
      light.color.copy(col);
      light.intensity = 0;
    }
  }

  get readyToPick(): boolean {
    return this.landed && !this.taken;
  }

  attach(scene: THREE.Scene): void {
    scene.add(this.group);
    for (const b of this.beams) {
      b.position.copy(this.pos).setY(0);
      scene.add(b);
    }
    this.disc.position.copy(this.pos).setY(0.025);
    scene.add(this.disc);
  }

  detach(scene: THREE.Scene): void {
    scene.remove(this.group);
    for (const b of this.beams) scene.remove(b);
    scene.remove(this.disc);
    if (this.light) this.light.intensity = 0;
  }

  /** Renvoie true quand l'objet a fini d'être aspiré par le héros. */
  update(dt: number, time: number, heroPos: THREE.Vector3, onLand: (p: THREE.Vector3) => void): boolean {
    this.t += dt;
    if (this.taken) {
      this.takeT += dt;
      const k = Math.min(1, this.takeT / 0.28);
      this.model.position.lerp(heroPos.clone().setY(1.6), k);
      this.model.scale.setScalar(1 - k * 0.8);
      for (const m of this.beamMats) m.uniforms.uAlpha.value *= 0.8;
      (this.disc.material as THREE.MeshBasicMaterial).opacity *= 0.8;
      if (this.light) this.light.intensity *= 0.8;
      return k >= 1;
    }
    if (!this.landed) {
      this.vel.y -= 16 * dt;
      this.model.position.addScaledVector(this.vel, dt);
      this.model.rotation.y += dt * 9;
      if (this.t >= 0.6) {
        this.landed = true;
        this.model.position.copy(this.pos).setY(0.9);
        onLand(this.pos);
      }
      return false;
    }
    const k = Math.min(1, (this.t - 0.6) / 0.5);
    const e = 1 - (1 - k) * (1 - k);
    for (const b of this.beams) b.scale.y = Math.max(0.01, e);
    for (const m of this.beamMats) {
      m.uniforms.uAlpha.value = e;
      m.uniforms.uTime.value = time;
    }
    const pulse = fxFlags.reducedMotion ? 0 : Math.sin(time * 4);
    (this.disc.material as THREE.MeshBasicMaterial).opacity = e * (0.75 + 0.25 * pulse);
    this.disc.rotation.y += dt * 0.6;
    this.model.position.set(this.pos.x, 0.95 + Math.sin(time * 2.4) * 0.12, this.pos.z);
    this.model.rotation.y += dt * 1.4;
    if (this.light) {
      this.light.position.set(this.pos.x, 2.6, this.pos.z);
      this.light.intensity = e * (4.5 + pulse);
    }
    return false;
  }

  take(): void {
    this.taken = true;
    this.takeT = 0;
  }
}

// ─── Carte HTML ─────────────────────────────────────────────────────────────────

export function cardHtml(item: Item, current: Item, touch: boolean): string {
  const r = RARITY[item.rarity];
  const stats = item.stats.map((s) => `<li><b class="${s.up ? 'up' : ''}">${s.value}</b> ${s.label}</li>`).join('');
  return `
    <div class="card-rar" style="color:${r.css}">${r.label} · ${SLOT_LABEL[item.slot]}</div>
    <div class="card-name">${item.name}</div>
    <div class="card-icon">${slotIcon(item.slot, r.css)}</div>
    <ul class="card-stats">${stats}</ul>
    ${item.perk ? `<div class="card-perk">${item.perk}</div>` : ''}
    <div class="card-flavor">${item.flavor}</div>
    <div class="card-cmp">Remplace : <span style="color:${RARITY[current.rarity].css}">${current.name}</span></div>
    <div class="card-act"><kbd>${touch ? '✋' : 'E'}</kbd> Équiper</div>`;
}

export function slotIcon(slot: Slot, color: string): string {
  if (slot === 'casque')
    return `<svg viewBox="0 0 40 40" width="40" height="40"><path d="M6 27 Q6 9 20 9 Q34 9 34 27 Z" fill="${color}" stroke="#14101a" stroke-width="2.5"/><rect x="3" y="26" width="34" height="5" rx="2" fill="${color}" stroke="#14101a" stroke-width="2.5"/><rect x="18" y="5" width="4" height="10" rx="1.5" fill="#14101a" opacity=".55"/></svg>`;
  if (slot === 'gilet')
    return `<svg viewBox="0 0 40 40" width="40" height="40"><path d="M9 7 L16 7 Q20 13 24 7 L31 7 L33 34 L7 34 Z" fill="${color}" stroke="#14101a" stroke-width="2.5"/><rect x="8" y="21" width="24" height="3.5" fill="#e8eeff"/><rect x="8" y="27" width="24" height="3.5" fill="#e8eeff"/></svg>`;
  return `<svg viewBox="0 0 40 40" width="40" height="40"><rect x="18" y="4" width="4.5" height="26" rx="2" fill="${color}" stroke="#14101a" stroke-width="2"/><rect x="10" y="4" width="20" height="5" rx="2" fill="#14101a"/><rect x="15" y="28" width="10.5" height="9" rx="2" fill="${color}" stroke="#14101a" stroke-width="2"/></svg>`;
}
