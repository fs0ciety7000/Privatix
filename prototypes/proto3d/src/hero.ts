// Le cheminot : casque de chantier, gilet orange haute visibilité à bandes réfléchissantes, tenue
// sombre, écharpe syndicale rouge, clé à tire-fond. Modèle procédural + animations procédurales.
import * as THREE from 'three';
import { easeIn, easeOut, keyed, merge, Rig, type Pose, type V3 } from './rig';
import { glow, makeFlash, PAL, sncbLogoTexture, toon, type Flash } from './toon';
import type { HitShape, World } from './types';

export type HelmetKind = 'base' | 'legend';
export type VestKind = 'base' | 'rare';
export type WrenchKind = 'base' | 'epic';

const C = {
  skin: 0xeb9a72,
  helmet: 0xffa419,
  vest: 0xff6a12,
  stripe: 0xe8eeff,
  cloth: 0x27345e,
  clothDark: 0x1b2244,
  boots: 0x3a2c38,
  glove: 0x4b3b46,
  steel: 0x9aaad0,
  steelDark: 0x4a5878,
  scarf: 0xe0283c,
  hair: 0x4a2c22,
  eyes: 0x14101a,
};

// ─── Timings du combo (GDD § 5.2, en ms) ────────────────────────────────────────
interface AttackDef {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  knockback: number;
  stun: number;
  hitstop: number;
  step: number;
  shake: number;
}
const ATTACKS: AttackDef[] = [
  { startup: 90, active: 60, recovery: 160, damage: 12, knockback: 1.2, stun: 180, hitstop: 50, step: 0.35, shake: 0.32 },
  { startup: 80, active: 60, recovery: 170, damage: 12, knockback: 1.2, stun: 180, hitstop: 50, step: 0.35, shake: 0.32 },
  { startup: 200, active: 80, recovery: 320, damage: 30, knockback: 3.2, stun: 420, hitstop: 110, step: 0.7, shake: 0.75 },
];
const CHAIN_DELAY = 80;
const CHAIN_GRACE = 150;
const DASH_MS = 160;
const DASH_IFRAMES = 135;
const DASH_DIST = 3.8;
const DASH_RECHARGE = 750;
const SPEED = 6.2;

export interface HeroIntent {
  move: THREE.Vector2; // x = droite écran, y = bas écran (déjà en monde XZ)
  aim: THREE.Vector3 | null; // point visé au sol
  attack: boolean;
  dash: boolean;
}

type State = 'idle' | 'run' | 'attack' | 'dash' | 'hurt';

export class Hero {
  readonly rig = new Rig();
  readonly flash: Flash = makeFlash();
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  facing = Math.PI; // vers -Z (vers la voie) au départ
  hp = 100;
  maxHp = 100;
  armor = 0;
  dmgBonus = 0;
  speedMul = 1;
  dashCharges = 2;
  private dashRecharge = 0;
  state: State = 'idle';
  private t = 0; // temps dans l'état (ms)
  private attackIdx = 0;
  hasHit = false;
  private queued = 0; // ms restantes du tampon d'attaque
  private chainUntil = -1;
  private nextIdx = 0;
  private dashDir = new THREE.Vector3();
  private ghostT = 0;
  private hurtFlash = 0;
  private invuln = 0;
  private runPhase = 0;
  private scarfV = 0;
  private aimAngle = Math.PI;
  private lastActiveFrame = -1;
  readonly headLight: THREE.PointLight;
  readonly lamp: THREE.Mesh;

  // Équipement
  helmetKind: HelmetKind = 'base';
  vestKind: VestKind = 'base';
  wrenchKind: WrenchKind = 'base';
  private helmets = new Map<HelmetKind, THREE.Group>();
  private wrenches = new Map<WrenchKind, THREE.Group>();
  private vestMat: THREE.MeshToonMaterial;
  private stripeMat: THREE.MeshToonMaterial;
  private beamCone: THREE.Mesh;

  constructor(private readonly world: World) {
    const f = this.flash;
    const m = (c: number, rim = 0.85, extra: Partial<Parameters<typeof toon>[1]> = {}) => toon(c, { rimStrength: rim, flash: f, ...extra });
    const skin = m(C.skin);
    const cloth = m(C.cloth);
    const clothDark = m(C.clothDark);
    const boots = m(C.boots);
    const glove = m(C.glove);
    const scarf = m(C.scarf);
    const hair = m(C.hair, 0.5);
    const eyes = m(C.eyes, 0);
    this.vestMat = m(C.vest, 1.0);
    this.stripeMat = toon(C.stripe, { emissive: 0xb8c8ff, emissiveIntensity: 0.22, flash: f, rimStrength: 0.4 });
    const vest = this.vestMat;
    const stripe = this.stripeMat;
    const r = this.rig;

    r.joint('pelvis', null, [0, 0.66, 0]);
    r.joint('spine', 'pelvis', [0, 0.1, 0]);
    r.joint('chest', 'spine', [0, 0.17, 0]);
    r.joint('neck', 'chest', [0, 0.3, 0]);
    r.joint('head', 'neck', [0, 0.05, 0]);
    for (const [s, sx] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      r.joint(`shoulder_${s}`, 'chest', [0.34 * sx, 0.2, 0]);
      r.joint(`elbow_${s}`, `shoulder_${s}`, [0, -0.24, 0]);
      r.joint(`hand_${s}`, `elbow_${s}`, [0, -0.21, 0]);
      r.joint(`hip_${s}`, 'pelvis', [0.13 * sx, -0.03, 0]);
      r.joint(`knee_${s}`, `hip_${s}`, [0, -0.3, 0]);
      r.joint(`foot_${s}`, `knee_${s}`, [0, -0.28, 0]);
    }
    r.joint('scarf0', 'neck', [0.13, 0.0, -0.12]);
    r.joint('scarf1', 'scarf0', [0, 0, -0.15]);
    r.joint('scarf2', 'scarf1', [0, 0, -0.15]);
    r.joint('scarf3', 'scarf2', [0, 0, -0.13]);

    // Jambes et bottes de sécurité
    for (const s of ['L', 'R']) {
      r.capsule(`hip_${s}`, cloth, [0, 0, 0], [0, -0.3, 0], 0.112);
      r.capsule(`knee_${s}`, cloth, [0, 0, 0], [0, -0.22, 0], 0.096);
      r.box(`knee_${s}`, clothDark, [0, -0.0, 0.07], [0.17, 0.14, 0.06], 0.03); // genouillère
      r.box(`foot_${s}`, boots, [0, 0.035, 0.05], [0.21, 0.17, 0.34], 0.07);
      r.box(`foot_${s}`, m(0xff7a1a, 0.4), [0, -0.035, 0.05], [0.22, 0.035, 0.35], 0.012, { outline: false }); // semelle
    }
    r.box('pelvis', cloth, [0, 0, 0], [0.42, 0.2, 0.28], 0.08);
    r.box('pelvis', m(0x3a241c, 0.3), [0, 0.08, 0], [0.44, 0.06, 0.3], 0.025, { outline: false }); // ceinture
    r.box('spine', clothDark, [0, 0.04, 0], [0.4, 0.2, 0.27], 0.09);
    // Gilet haute visibilité : corps, bretelles et deux bandes réfléchissantes
    r.box('chest', vest, [0, 0.1, 0], [0.64, 0.44, 0.37], 0.13);
    r.box('chest', stripe, [0, 0.02, 0], [0.655, 0.05, 0.385], 0.02, { outline: false });
    r.box('chest', stripe, [0, 0.15, 0], [0.655, 0.05, 0.385], 0.02, { outline: false });
    r.box('chest', stripe, [0.15, 0.14, 0], [0.065, 0.28, 0.39], 0.02, { outline: false });
    r.box('chest', stripe, [-0.15, 0.14, 0], [0.065, 0.28, 0.39], 0.02, { outline: false });
    r.box('chest', clothDark, [0, 0.33, 0.0], [0.3, 0.06, 0.24], 0.03); // col du t-shirt
    // logo SNCB au dos du gilet
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.18), new THREE.MeshBasicMaterial({ map: sncbLogoTexture(), transparent: true }));
    back.position.set(-0.08, 0.1, -0.2);
    back.rotation.y = Math.PI;
    back.userData.noGhost = true;
    r.j('chest').add(back);
    // Bras
    for (const s of ['L', 'R']) {
      r.sphere(`shoulder_${s}`, vest, [0, -0.01, 0], [0.155, 0.145, 0.16]);
      r.capsule(`shoulder_${s}`, cloth, [0, -0.04, 0], [0, -0.23, 0], 0.088);
      r.capsule(`elbow_${s}`, cloth, [0, 0, 0], [0, -0.17, 0], 0.08);
      r.sphere(`hand_${s}`, glove, [0, -0.04, 0], [0.105, 0.105, 0.105]);
    }
    // Tête : gros visage lisible, moustache, oreilles
    r.cyl('neck', skin, [0, 0.0, 0], 0.085, 0.12);
    r.sphere('head', skin, [0, 0.17, 0.01], [0.29, 0.28, 0.27]);
    r.sphere('head', hair, [0, 0.2, -0.08], [0.28, 0.22, 0.22]);
    for (const sx of [1, -1]) {
      r.sphere('head', skin, [0.285 * sx, 0.15, -0.0], [0.055, 0.075, 0.05]);
      r.sphere('head', eyes, [0.1 * sx, 0.2, 0.25], [0.038, 0.058, 0.03], { outline: false, shadow: false });
      r.box('head', hair, [0.11 * sx, 0.285, 0.255], [0.12, 0.035, 0.04], 0.012, { rot: [0, 0, -12 * sx], outline: false, shadow: false });
    }
    r.sphere('head', skin, [0, 0.13, 0.275], [0.055, 0.05, 0.05], { outline: false });
    r.box('head', hair, [0, 0.075, 0.255], [0.24, 0.055, 0.07], 0.025, { outline: false }); // moustache
    // Écharpe syndicale
    r.cyl('neck', scarf, [0, -0.03, 0], 0.175, 0.13);
    r.box('scarf0', scarf, [0, 0, -0.07], [0.17, 0.055, 0.17], 0.02);
    r.box('scarf1', scarf, [0, 0, -0.07], [0.155, 0.05, 0.17], 0.02);
    r.box('scarf2', scarf, [0, 0, -0.07], [0.14, 0.045, 0.16], 0.02);
    r.box('scarf3', scarf, [0, 0, -0.05], [0.13, 0.04, 0.12], 0.02);

    // Casques (le casque légendaire remplace le casque de chantier)
    this.helmets.set('base', this.buildHelmet(false));
    this.helmets.set('legend', this.buildHelmet(true));
    for (const [k, g] of this.helmets) {
      g.visible = k === 'base';
      r.j('head').add(g);
    }
    // Lampe frontale (lentille émissive + lumière) : héritée par les deux casques
    this.lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 12).rotateX(Math.PI / 2), glow(0xfff0c0, 1.6));
    this.lamp.position.set(0, 0.36, 0.31);
    this.lamp.userData.noGhost = true;
    r.j('head').add(this.lamp);
    this.beamCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.7, 2.4, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe6a0).multiplyScalar(0.07), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.beamCone.position.set(0, 0.36, 0.33);
    this.beamCone.rotation.x = 0.35;
    this.beamCone.visible = false;
    this.beamCone.userData.noGhost = true;
    r.j('head').add(this.beamCone);

    // Clés à tire-fond
    this.wrenches.set('base', this.buildWrench(false));
    this.wrenches.set('epic', this.buildWrench(true));
    for (const [k, g] of this.wrenches) {
      g.visible = k === 'base';
      r.j('hand_R').add(g);
    }

    this.addSilhouette();
    this.headLight = new THREE.PointLight(0xffc98a, 5, 7, 1.5);
    this.rig.root.add(this.headLight);
    this.headLight.position.set(0, 3.4, 1.6);
  }

  /**
   * Silhouette tramée visible quand le héros est caché (décor, Discosaure) : chaque pièce reçoit un
   * double dessiné AVANT le héros avec un test de profondeur inversé (seulement là où autre chose
   * est devant). Le héros lui-même est dessiné après, donc il ne se masque pas.
   */
  private addSilhouette(): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        void main(){
          vec2 p = floor(gl_FragCoord.xy / 2.0);
          if (mod(p.x + p.y, 2.0) < 0.5) discard;
          gl_FragColor = vec4(1.0, 0.55, 0.15, 1.0);
        }`,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    const targets: THREE.Mesh[] = [];
    this.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline && !o.userData.noGhost && !(o.material instanceof THREE.MeshBasicMaterial)) targets.push(o);
    });
    // les contours du héros aussi sont dessinés après la silhouette (sinon ils la « révèlent »)
    this.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.outline) o.renderOrder = 2;
    });
    for (const m of targets) {
      m.renderOrder = 2;
      const s = new THREE.Mesh(m.geometry, mat);
      s.renderOrder = 1;
      s.castShadow = false;
      s.userData.outline = true;
      s.raycast = () => undefined;
      m.add(s);
    }
  }

  private buildHelmet(legend: boolean): THREE.Group {
    const g = new THREE.Group();
    const mk = (c: number, o: Partial<Parameters<typeof toon>[1]> = {}) => toon(c, { rimStrength: 1, flash: this.flash, ...o });
    const shell = legend ? mk(0xe8a81c, { emissive: 0x6a3a00, emissiveIntensity: 0.25, rim: 0xfff2a8, rimStrength: 0.9 }) : mk(C.helmet);
    const r = this.rig;
    const p = { parent: g };
    const k = legend ? 1.06 : 1;
    r.hemi('head', shell, [0, 0.25, -0.01], [0.315 * k, 0.25 * k, 0.335 * k], p);
    r.cyl('head', shell, [0, 0.255, 0.0], 0.33 * k, 0.035, { ...p, seg: 22 });
    r.box('head', shell, [0, 0.26, 0.33 * k], [0.34, 0.035, 0.14], 0.015, p); // visière
    if (legend) {
      const dark = mk(0x7a1424, { rimStrength: 0.6 });
      const gold = mk(0xf0c040, { emissive: 0x804a00, emissiveIntensity: 0.3, rim: 0xffffff, rimStrength: 1.0 });
      r.cyl('head', dark, [0, 0.3, 0], 0.318, 0.06, { ...p, seg: 22 }); // bandeau rouge
      // crête
      r.box('head', gold, [0, 0.5, -0.02], [0.07, 0.15, 0.56], 0.03, p);
      r.box('head', mk(0xd8203a, { rimStrength: 0.8 }), [0, 0.6, -0.12], [0.05, 0.12, 0.36], 0.025, p);
      // insigne : roue ailée
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 18), gold);
      t.position.set(0, 0.34, 0.33);
      g.add(t);
      for (const sx of [1, -1]) {
        r.box('head', gold, [0.13 * sx, 0.36, 0.31], [0.13, 0.04, 0.03], 0.012, { ...p, rot: [0, -20 * sx, 18 * sx] });
        r.box('head', gold, [0.13 * sx, 0.31, 0.31], [0.1, 0.035, 0.03], 0.012, { ...p, rot: [0, -20 * sx, 5 * sx] });
      }
    } else {
      r.box('head', shell, [0, 0.47, -0.01], [0.07, 0.07, 0.48], 0.03, p); // nervure
    }
    // support de lampe
    r.box('head', toon(0x2a2234, { flash: this.flash }), [0, 0.36, 0.29], [0.14, 0.09, 0.07], 0.02, p);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline) o.castShadow = false;
    });
    return g;
  }

  private buildWrench(epic: boolean): THREE.Group {
    const g = new THREE.Group();
    const r = this.rig;
    const p = { parent: g };
    const steel = toon(epic ? 0xb6a8ff : C.steel, { rimStrength: 1.4, rim: epic ? 0x9cf6ff : PAL.rim, flash: this.flash });
    const dark = toon(epic ? 0x3a2a7a : C.steelDark, { rimStrength: 0.8, flash: this.flash });
    const grip = toon(epic ? 0x9a3cff : 0xd02a2a, { rimStrength: 0.6, flash: this.flash });
    const L = epic ? 1.12 : 0.98;
    // Le manche part vers l'avant de la main (+Z local) ; poignée en T au poing.
    r.cyl('hand_R', steel, [0, 0, L / 2 - 0.12], 0.038, L, { ...p, rot: [90, 0, 0] });
    r.cyl('hand_R', dark, [0, 0, -0.12], 0.034, 0.42, { ...p, rot: [0, 0, 90] });
    for (const sx of [1, -1]) r.cyl('hand_R', grip, [0.16 * sx, 0, -0.12], 0.048, 0.12, { ...p, rot: [0, 0, 90] });
    r.cyl('hand_R', dark, [0, 0, L - 0.08], epic ? 0.12 : 0.095, 0.22, { ...p, rot: [90, 0, 0] });
    r.cyl('hand_R', steel, [0, 0, L + 0.04], epic ? 0.13 : 0.105, 0.05, { ...p, rot: [90, 0, 0] });
    if (epic) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20), glow(0x6ff3ff, 4));
      ring.position.set(0, 0, L - 0.14);
      g.add(ring);
      const ring2 = ring.clone();
      ring2.position.z = L + 0.06;
      g.add(ring2);
      for (let i = 0; i < 3; i++) r.cyl('hand_R', glow(0xb05cff, 2.5), [0, 0, 0.2 + i * 0.18], 0.045, 0.04, { ...p, rot: [90, 0, 0], outline: false });
    }
    g.userData.tip = L + 0.06;
    return g;
  }

  // ─── Équipement ────────────────────────────────────────────────────────────────

  equip(slot: 'casque' | 'gilet' | 'cle', variant: string): void {
    if (slot === 'casque') {
      this.helmetKind = variant as HelmetKind;
      for (const [k, g] of this.helmets) g.visible = k === this.helmetKind;
      this.beamCone.visible = this.helmetKind === 'legend';
      (this.lamp.material as THREE.MeshBasicMaterial).color.setHex(this.helmetKind === 'legend' ? 0xffe9a0 : 0xfff0c0).multiplyScalar(this.helmetKind === 'legend' ? 3.5 : 1.6);
      this.headLight.intensity = this.helmetKind === 'legend' ? 5 : 5;
    } else if (slot === 'gilet') {
      this.vestKind = variant as VestKind;
      if (this.vestKind === 'rare') {
        this.vestMat.color.setHex(0xc8ff2a);
        this.stripeMat.color.setHex(0xd8f6ff);
        this.stripeMat.emissive.setHex(0x6ff3ff);
        this.stripeMat.emissiveIntensity = 1.6;
      }
    } else {
      this.wrenchKind = variant as WrenchKind;
      for (const [k, g] of this.wrenches) g.visible = k === this.wrenchKind;
    }
    this.rig.punchScale([1.18, 0.86, 1.18]);
  }

  // ─── Boucle ────────────────────────────────────────────────────────────────────

  get attackInfo(): { attackIdx: number; t: number } {
    return { attackIdx: this.attackIdx, t: this.t };
  }

  get invulnerable(): boolean {
    return this.invuln > 0 || (this.state === 'dash' && this.t < DASH_IFRAMES);
  }

  update(dtS: number, input: HeroIntent): void {
    const dt = dtS * 1000;
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.queued = Math.max(0, this.queued - dt);
    if (input.attack) this.queued = 220;

    // Recharge du dash
    if (this.dashCharges < 2) {
      this.dashRecharge += dt;
      if (this.dashRecharge >= DASH_RECHARGE) {
        this.dashCharges++;
        this.dashRecharge = 0;
      }
    }

    const mv = new THREE.Vector3(input.move.x, 0, input.move.y);
    const moving = mv.lengthSq() > 0.01;
    if (mv.lengthSq() > 1) mv.normalize();
    if (input.aim) {
      const d = input.aim.clone().sub(this.pos);
      if (d.lengthSq() > 0.04) this.aimAngle = Math.atan2(d.x, d.z);
    } else if (moving) this.aimAngle = Math.atan2(mv.x, mv.z);

    const canDash = this.dashCharges > 0 && input.dash;
    const startDash = () => {
      this.state = 'dash';
      this.t = 0;
      this.dashCharges--;
      this.dashRecharge = 0;
      const d = moving ? mv.clone().normalize() : new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.dashDir.copy(d);
      this.facing = Math.atan2(d.x, d.z);
      this.ghostT = 0;
      this.world.puffs.dustRing(this.pos, 8, 0.3, 0x50486a, 3);
      this.world.rings.spawn(this.pos, 0x6ff3ff, 0.3, 1.4, 0.25, 0.2, 0.1, 1.6);
      this.rig.punchScale([0.8, 1.15, 1.3]);
      if (this.attackIdx < 2 && this.nextIdx !== 0) this.nextIdx = this.attackIdx + 1;
    };

    switch (this.state) {
      case 'idle':
      case 'run': {
        if (canDash) {
          startDash();
          break;
        }
        if (this.queued > 0) {
          const idx = this.world.time * 1000 <= this.chainUntil ? this.nextIdx : 0;
          this.startAttack(idx);
          break;
        }
        const sp = SPEED * this.speedMul;
        const target = mv.clone().multiplyScalar(sp);
        this.vel.lerp(target, 1 - Math.exp(-14 * dtS));
        this.state = this.vel.lengthSq() > 0.4 ? 'run' : 'idle';
        if (moving) this.turnTo(Math.atan2(mv.x, mv.z), dtS, 16);
        break;
      }
      case 'attack': {
        const a = ATTACKS[this.attackIdx];
        const total = a.startup + a.active + a.recovery;
        const inStartup = this.t < a.startup;
        const inActive = this.t >= a.startup && this.t < a.startup + a.active;
        // Annulation par dash : startup des coups 1-2 (120 ms pour le 3), et toute la recovery
        if (canDash && ((inStartup && (this.attackIdx < 2 || this.t < 120)) || this.t >= a.startup + a.active)) {
          this.nextIdx = (this.attackIdx + 1) % 3;
          startDash();
          break;
        }
        // Avance pendant startup/active
        const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
        if (inStartup || inActive) {
          this.vel.copy(mv.multiplyScalar(SPEED * 0.25));
          if (inActive) this.vel.addScaledVector(fwd, (a.step / a.active) * 1000);
        } else this.vel.multiplyScalar(Math.exp(-20 * dtS));
        if (inActive && this.lastActiveFrame !== this.attackIdx) {
          this.lastActiveFrame = this.attackIdx;
          this.onActive(a);
        }
        // Enchaînement
        if (this.t >= a.startup + a.active + CHAIN_DELAY && this.queued > 0 && this.attackIdx < 2) {
          this.startAttack(this.attackIdx + 1);
          break;
        }
        if (this.t >= total) {
          this.state = 'idle';
          this.t = 0;
          this.nextIdx = (this.attackIdx + 1) % 3;
          this.chainUntil = this.world.time * 1000 + CHAIN_GRACE;
        }
        break;
      }
      case 'dash': {
        const k = this.t / DASH_MS;
        const sp = (DASH_DIST / DASH_MS) * 1000 * (k > 0.7 ? 1 - (k - 0.7) / 0.3 * 0.7 : 1.1);
        this.vel.copy(this.dashDir).multiplyScalar(sp);
        this.ghostT -= dt;
        if (this.ghostT <= 0) {
          this.ghostT = 32;
          this.world.ghosts.spawn(this.rig.root, 0x6ff3ff, 0.26);
        }
        if (Math.random() < 0.6) {
          const p = this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.5));
          this.world.sparks.emit(p, this.dashDir.clone().multiplyScalar(-6), 0x6ff3ff, 0.18, 0.025, 0, 2, false);
        }
        if (this.t >= DASH_MS) {
          this.state = 'idle';
          this.t = 0;
          this.vel.multiplyScalar(0.3);
          this.world.puffs.dustRing(this.pos, 5, 0.25, 0x50486a, 1.5);
          if (this.queued > 0) this.startAttack(this.world.time * 1000 <= this.chainUntil + 400 ? this.nextIdx : 0);
          this.chainUntil = this.world.time * 1000 + 400;
        }
        break;
      }
      case 'hurt': {
        this.vel.multiplyScalar(Math.exp(-10 * dtS));
        if (canDash && this.t > 120) {
          startDash();
          break;
        }
        if (this.t > 280) {
          this.state = 'idle';
          this.t = 0;
        }
        break;
      }
    }

    this.pos.addScaledVector(this.vel, dtS);
    this.world.collide(this.pos, 0.42);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.facing;

    // Flash
    this.hurtFlash = Math.max(0, this.hurtFlash - dtS * 6);
    this.flash.amount.value = this.hurtFlash * 0.8;
    // Clignotement d'invulnérabilité après un coup reçu
    this.rig.body.visible = !(this.invuln > 0 && this.state !== 'hurt' && Math.floor(this.invuln / 60) % 2 === 0);

    this.animate(dtS);
  }

  private turnTo(target: number, dt: number, k: number): void {
    let d = target - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * (1 - Math.exp(-k * dt));
  }

  private startAttack(idx: number): void {
    this.state = 'attack';
    this.attackIdx = idx;
    this.t = 0;
    this.queued = 0;
    this.hasHit = false;
    this.lastActiveFrame = -1;
    this.facing = this.aimAngle;
    this.chainUntil = -1;
    if (idx === 2) this.rig.punchScale([0.92, 1.1, 0.92]);
  }

  private onActive(a: AttackDef): void {
    const w = this.world;
    const idx = this.attackIdx;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const left = new THREE.Vector3(Math.cos(this.facing), 0, -Math.sin(this.facing));
    const epic = this.wrenchKind === 'epic';
    const colors = epic ? { core: 0xe8fbff, edge: 0x9a5cff } : { core: 0xfff6d8, edge: 0xff8a1a };
    const reach = epic ? 0.25 : 0;
    if (idx < 2) {
      const center = this.pos.clone().add(new THREE.Vector3(0, 1.0, 0));
      const tilt = idx === 0 ? 0.18 : -0.12;
      const up = new THREE.Vector3(0, 1, 0);
      const v = left.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(up, Math.sin(tilt));
      const [p0, p1] = idx === 0 ? [-120, 80] : [110, -85];
      w.heroSmear.fire(center, fwd, v, p0, p1, 0.45, 2.15 + reach, a.active / 1000 + 0.02, 0.13, colors);
    } else {
      const center = this.pos.clone().add(new THREE.Vector3(0, 1.15, 0)).addScaledVector(fwd, 0.15);
      w.heroSmear.fire(center, new THREE.Vector3(0, 1, 0), fwd, -25, 128, 0.5, 2.0 + reach, a.active / 1000, 0.16, colors);
    }
    const shape: HitShape =
      idx < 2
        ? { kind: 'arc', origin: this.pos.clone(), angle: this.facing, radius: 2.15 + reach, spread: THREE.MathUtils.degToRad(idx === 0 ? 110 : 125), near: 0, far: 0, half: 0 }
        : { kind: 'rect', origin: this.pos.clone(), angle: this.facing, radius: 0, spread: 0, near: 0.1, far: 3.0 + reach, half: 0.85 + reach * 0.5 };
    const crit = Math.random() < (this.helmetKind === 'legend' ? 0.2 : 0.06);
    const dmg = Math.round((a.damage + this.dmgBonus) * (crit ? 1.75 : 1) * (0.92 + Math.random() * 0.16));
    const n = w.strike(shape, { damage: dmg, knockback: a.knockback, stun: a.stun, heavy: idx === 2, crit });
    if (idx === 2) {
      // Frappe au sol : onde de choc, débris, poussière, même à vide
      const impact = this.pos.clone().addScaledVector(fwd, 1.9);
      impact.y = 0.05;
      w.rings.spawn(impact, epic ? 0x9a5cff : 0xff8a1a, 0.2, 2.6 + reach * 2, 0.35, 0.22, 0.35, 2.4);
      w.rings.spawn(impact, 0xfff2c0, 0.1, 1.5, 0.18, 0.4, 0.6, 2.4);
      w.puffs.dustRing(impact, 14, 0.5, 0x5a5070, 4.5);
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 6;
        w.sparks.emit(impact.clone().setY(0.1), new THREE.Vector3(Math.sin(ang) * sp, 3 + Math.random() * 6, Math.cos(ang) * sp), i % 3 === 0 ? 0xffffff : 0xffa040, 0.5 + Math.random() * 0.4, 0.04);
      }
      for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        w.puffs.emit(impact.clone().setY(0.15), new THREE.Vector3(Math.sin(ang) * 3, 4 + Math.random() * 3, Math.cos(ang) * 3), 0x6a6488, 0.8, 0.09, { grav: 16, drag: 0.5, alpha: 1, shape: 1 });
      }
      w.bursts.spawn(impact.clone().setY(0.5), 0xffd08a, 3.2, 0.2, 3);
      w.shake.add(n > 0 ? a.shake : a.shake * 0.7);
      if (n === 0) w.hitstop(40);
    }
    if (n > 0) {
      this.hasHit = true;
      w.hitstop(a.hitstop + Math.min(30, (n - 1) * 10));
      w.shake.add(a.shake);
    }
  }

  takeHit(damage: number, from: THREE.Vector3): boolean {
    if (this.invulnerable || this.hp <= 0) return false;
    const d = Math.max(1, Math.round(damage * (1 - this.armor / 100)));
    this.hp = Math.max(0, this.hp - d);
    this.state = 'hurt';
    this.t = 0;
    this.invuln = 700;
    this.hurtFlash = 1;
    this.flash.color.value.setHex(0xff3060);
    const push = this.pos.clone().sub(from).setY(0).normalize();
    this.vel.copy(push.multiplyScalar(7));
    this.rig.punchScale([1.2, 0.82, 1.2]);
    this.world.dmg.spawn(this.pos.clone().setY(1.6), `-${d}`, 'hurt');
    if (this.hp <= 0) {
      // Démo : on se relève aussitôt, plein d'Énergie
      this.hp = this.maxHp;
      this.world.dmg.spawn(this.pos.clone().setY(2.2), 'CAFÉ !', 'crit');
    }
    return true;
  }

  // ─── Animation procédurale ────────────────────────────────────────────────────

  private animate(dt: number): void {
    const time = this.world.time;
    const speed = Math.min(1, this.vel.length() / SPEED);
    let pose: Pose;
    let k = 14;
    if (this.state === 'attack') {
      pose = attackPose(this.attackIdx, this.t);
      k = 32;
    } else if (this.state === 'dash') {
      pose = dashPose();
      k = 30;
    } else if (this.state === 'hurt') {
      pose = hurtPose(this.t);
      k = 24;
    } else if (speed > 0.15) {
      this.runPhase += dt * (2 * Math.PI) * (1.9 * speed + 0.2);
      pose = lerpRun(idlePose(time), runPose(this.runPhase), Math.min(1, speed * 1.4));
    } else {
      pose = idlePose(time);
    }
    // Écharpe : flotte derrière selon la vitesse, retombe au repos
    const targetV = this.state === 'dash' ? 1.3 : this.state === 'attack' ? 0.7 : speed;
    this.scarfV += (targetV - this.scarfV) * (1 - Math.exp(-5 * dt));
    const sv = this.scarfV;
    const w = (ph: number, a: number) => Math.sin(time * (6 + sv * 8) + ph) * a * (0.4 + sv);
    pose.rot.scarf0 = [-68 + sv * 52 + w(0, 6), 14 - sv * 10 + w(0.5, 8), 0];
    pose.rot.scarf1 = [-12 + sv * 8 + w(1.2, 12), w(1.6, 10), 0];
    pose.rot.scarf2 = [-6 + w(2.4, 16), w(2.8, 12), 0];
    pose.rot.scarf3 = [-4 + w(3.6, 20), w(3.9, 14), 0];
    this.rig.apply(pose, dt, k);
  }
}

// ─── Poses ────────────────────────────────────────────────────────────────────

function idlePose(t: number): Pose {
  const b = Math.sin((t * 2 * Math.PI) / 2.6);
  return {
    rot: {
      spine: [7 + b * 1.4, 0, 0],
      chest: [-3 - b * 2, 0, 0],
      head: [-3 + b * 1.2, 0, 0],
      shoulder_L: [-6 + b * 2, 0, 13 + b * 2.5],
      elbow_L: [-32, 0, 0],
      shoulder_R: [-20 + b * 2, 0, -16 - b * 2],
      elbow_R: [-42, 0, 0],
      hand_R: [58, 8, 0],
      hip_L: [-7, 0, 8],
      knee_L: [16, 0, 0],
      foot_L: [-9, 0, -8],
      hip_R: [9, 0, -8],
      knee_R: [13, 0, 0],
      foot_R: [-22, 0, 8],
    },
    root: [0, -0.025 + b * 0.012, 0],
    scale: [1 + b * 0.012, 1 - b * 0.008, 1 + b * 0.012],
  };
}

function runPose(ph: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const a = 40 * s;
  const kl = 18 + 78 * Math.max(0, c);
  const kr = 18 + 78 * Math.max(0, -c);
  return {
    rot: {
      pelvis: [0, 9 * s, 0],
      spine: [17, -5 * s, 0],
      chest: [-2, -14 * s, 0],
      head: [-12, 7 * s, 0],
      shoulder_L: [a * 0.95, 0, 12],
      elbow_L: [-72 + 18 * s, 0, 0],
      shoulder_R: [-a * 0.45 + 8, 0, -16],
      elbow_R: [-80, 0, 0],
      hand_R: [30, 0, 0],
      hip_L: [-a - 8, 0, 4],
      knee_L: [kl, 0, 0],
      foot_L: [-(-a - 8 + kl) * 0.45, 0, 0],
      hip_R: [a - 8, 0, -4],
      knee_R: [kr, 0, 0],
      foot_R: [-(a - 8 + kr) * 0.45, 0, 0],
    },
    root: [0, -0.05 + 0.08 * Math.abs(c), 0],
    scale: [1, 1 + 0.04 * Math.abs(c) - 0.02, 1],
  };
}

function lerpRun(a: Pose, b: Pose, t: number): Pose {
  return keyed([
    [0, a],
    [1, b],
  ], t);
}

function dashPose(): Pose {
  return {
    rot: {
      spine: [34, 0, 0],
      chest: [8, 0, 0],
      head: [-24, 0, 0],
      shoulder_L: [58, 0, 28],
      elbow_L: [-24, 0, 0],
      shoulder_R: [52, 0, -28],
      elbow_R: [-26, 0, 0],
      hand_R: [100, 0, 0],
      hip_L: [-62, 0, 4],
      knee_L: [88, 0, 0],
      foot_L: [-10, 0, 0],
      hip_R: [38, 0, -4],
      knee_R: [34, 0, 0],
      foot_R: [-20, 0, 0],
    },
    root: [0, 0.14, 0],
    scale: [0.86, 0.92, 1.28],
  };
}

function hurtPose(t: number): Pose {
  const k = Math.min(1, t / 80);
  return {
    rot: {
      spine: [-20 * k, 0, 6],
      chest: [-10 * k, 0, 0],
      head: [-24 * k, 0, 0],
      shoulder_L: [-30, 0, 48],
      elbow_L: [-40, 0, 0],
      shoulder_R: [-26, 0, -50],
      elbow_R: [-40, 0, 0],
      hand_R: [70, 0, 0],
      hip_L: [-24, 0, 8],
      knee_L: [30, 0, 0],
      hip_R: [16, 0, -8],
      knee_R: [26, 0, 0],
      foot_R: [-40, 0, 0],
    },
    root: [0, -0.06, -0.12 * k],
  };
}

/** Pose de coup horizontal : `yaw` = direction du bras (degrés, 0 = devant, + = vers sa gauche). */
function sw(yaw: number, arm = -88, lean = 10, lunge = 0): Pose {
  return {
    rot: {
      pelvis: [0, yaw * 0.15, 0],
      spine: [lean, yaw * 0.2, 0],
      chest: [0, yaw * 0.3, 0],
      head: [-lean * 0.6, -yaw * 0.4, 0],
      shoulder_R: [arm, yaw * 0.4, -8],
      elbow_R: [-10, 0, 0],
      hand_R: [84, 0, 0],
      shoulder_L: [-30, -yaw * 0.2, 42],
      elbow_L: [-78, 0, 0],
      hip_L: [-30 - lunge, 0, 7],
      knee_L: [32 + lunge, 0, 0],
      foot_L: [-2, 0, -6],
      hip_R: [24, 0, -7],
      knee_R: [24, 0, 0],
      foot_R: [-46, 0, 6],
    },
    root: [0, -0.1 - lunge * 0.004, 0.04 + lunge * 0.006],
  };
}

const OVERHEAD = (extra: number): Pose => ({
  rot: {
    spine: [-14 - extra * 0.4, 0, 0],
    chest: [-10 - extra * 0.3, 0, 0],
    head: [8, 0, 0],
    shoulder_R: [-172 - extra, 0, 14],
    elbow_R: [-34, 0, 0],
    hand_R: [72, 0, 0],
    shoulder_L: [-166 - extra, 0, -26],
    elbow_L: [-46, 0, 0],
    hip_L: [-22, 0, 8],
    knee_L: [38, 0, 0],
    foot_L: [-16, 0, 0],
    hip_R: [10, 0, -8],
    knee_R: [32, 0, 0],
    foot_R: [-42, 0, 0],
  },
  root: [0, 0.04 + extra * 0.006, -0.06],
  scale: [0.95, 1.06 + extra * 0.003, 0.95],
});

const SLAM: Pose = {
  rot: {
    spine: [40, 0, 0],
    chest: [12, 0, 0],
    head: [-26, 0, 0],
    shoulder_R: [-98, 0, 10],
    elbow_R: [-6, 0, 0],
    hand_R: [106, 0, 0],
    shoulder_L: [-96, 0, -16],
    elbow_L: [-12, 0, 0],
    hip_L: [-56, 0, 8],
    knee_L: [76, 0, 0],
    foot_L: [-20, 0, 0],
    hip_R: [34, 0, -8],
    knee_R: [52, 0, 0],
    foot_R: [-80, 0, 0],
  },
  root: [0, -0.26, 0.22],
  scale: [1.1, 0.86, 1.06],
};

function attackPose(idx: number, t: number): Pose {
  if (idx === 0) {
    return keyed(
      [
        [0, sw(-50, -70, 6)],
        [90, sw(-118, -84, 4), easeOut],
        [150, sw(78, -88, 16, 12), easeIn],
        [215, sw(104, -80, 14, 12), easeOut],
        [310, sw(70, -55, 8)],
      ],
      t,
    );
  }
  if (idx === 1) {
    return keyed(
      [
        [0, sw(70, -60, 6)],
        [80, sw(112, -80, 4), easeOut],
        [140, sw(-82, -92, 16, 12), easeIn],
        [205, sw(-108, -84, 14, 12), easeOut],
        [310, sw(-60, -55, 8)],
      ],
      t,
    );
  }
  return keyed(
    [
      [0, sw(0, -60, 4)],
      [120, OVERHEAD(0), easeOut],
      [200, OVERHEAD(14), easeOut],
      [250, SLAM, easeIn],
      [420, merge(SLAM, {}, { root: [0, -0.24, 0.22] as V3, scale: [1.02, 0.96, 1.02] })],
      [600, sw(0, -50, 8)],
    ],
    t,
  );
}
