// Le cheminot en GLB (public/models/hero.glb) : corps skinné sans équipement, auquel on accroche
// casque, gilet skinné et outil (public/models/items, contrat SKELETON.md § 6). Même rôle que
// `HeroView` (procédural, repli) : il lit l'état de `HeroSim`, ne décide de rien.
//
// Calage des coups (règle 1) : chaque clip d'attaque est posé sur le temps de la sim, par morceaux :
// [0, startup] de la sim → [0, active] du clip, puis [startup, total] → [active, durée]. Le frame
// actif du clip (événement `active` du manifeste) tombe donc sur le premier frame actif de la sim,
// quelle que soit la vitesse d'attaque (`sim.timing`).
import * as THREE from 'three';
import { DASH, HERO, PREAVIS, WHISTLE } from '@/config/balance';
import type { HeroSim } from '@/sim/hero/HeroSim';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { ActorFxSink, EquipSlot, HeroActorView, HeroEquipment } from '@/view/actors/ActorView';
import { DEFAULT_GEAR } from '@/view/actors/actorClips';
import { makeFlash } from '@/view/materials/toon';
import type { Flash } from '@/view/materials/toon';
import { alignedClipTime } from '@/view/models/clipTiming';
import { GlbRig } from '@/view/models/GlbRig';
import type { CharacterTemplate, ItemTemplate, ModelLibrary } from '@/view/models/ModelLibrary';
import type { V3 } from '@/view/rig';
import { Rig } from '@/view/rig';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const COMBO_CLIPS = ['attack1', 'attack2', 'attack3'] as const;

export class GlbHeroView implements HeroActorView {
  public readonly flash: Flash = makeFlash();
  public readonly pos = new THREE.Vector3();
  public readonly headLight: THREE.PointLight;
  public readonly equipment: HeroGear;
  private readonly rig = new Rig();
  private readonly model: GlbRig;
  private readonly tmpV = new THREE.Vector3();
  private yaw = Math.PI;
  private hurtFlash = 0;
  private time = 0;
  private lastState = '';

  public constructor(
    tpl: CharacterTemplate,
    lib: ModelLibrary,
    private readonly reducedMotion: boolean,
    private readonly fx: ActorFxSink | null,
  ) {
    this.model = new GlbRig(tpl, {
      flash: this.flash,
      reducedMotion,
      onEvent: (e) => {
        this.onClipEvent(e);
      },
    });
    this.rig.body.add(this.model.object);
    this.model.addSilhouette();
    this.model.play('idle', { fade: 0 });
    this.equipment = new HeroGear(this.model, lib);
    for (const [slot, id] of Object.entries(DEFAULT_GEAR) as [EquipSlot, string][])
      this.equipment.attach(slot, id);
    this.headLight = new THREE.PointLight(0xffc98a, 5, 7, 1.5);
    this.rig.root.add(this.headLight);
    this.headLight.position.set(0, 3.4, 1.6);
  }

  public get root(): THREE.Object3D {
    return this.rig.root;
  }

  public get facingYaw(): number {
    return this.yaw;
  }

  public punch(s: V3): void {
    this.rig.punchScale(s);
  }

  public hurt(): void {
    this.hurtFlash = 1;
    this.flash.color.value.setHex(0xff3060);
    this.rig.punchScale([1.2, 0.82, 1.2]);
  }

  public sync(sim: HeroSim, alpha: number, simDt: number, realDt: number): void {
    const b = sim.body;
    this.pos.set(
      pxToM(b.prevX + (b.x - b.prevX) * alpha),
      0,
      pxToM(b.prevY + (b.y - b.prevY) * alpha),
    );
    this.time += simDt;
    const state = sim.state;
    const target = yawFromAngle(state === 'dash' ? sim.dashAngle : sim.facingAngle);
    const snap = state === 'attack' || state === 'dashAttack' || state === 'dash';
    this.turnTo(target, simDt, snap ? 60 : 16);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;

    this.hurtFlash = Math.max(0, this.hurtFlash - realDt * 6);
    this.flash.amount.value = this.hurtFlash * (this.reducedMotion ? 0.35 : 0.8);
    const body = this.rig.body;
    if (sim.blinking && state !== 'hurt') {
      if (this.reducedMotion) {
        body.visible = true;
        this.flash.color.value.setHex(0xffe6c8);
        this.flash.amount.value = Math.max(this.flash.amount.value, 0.25);
      } else body.visible = Math.floor((this.time * 1000) / HERO.BLINK_MS) % 2 !== 0;
    } else body.visible = true;

    this.animate(sim);
    this.model.update(simDt, this.time);
    this.rig.apply({ rot: {} }, simDt, 14);
  }

  private turnTo(target: number, dt: number, k: number): void {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-k * dt));
  }

  /** Temps du clip calé sur un coup de la sim (voir `alignedClipTime`). */
  private aligned(clip: string, tMs: number, startupMs: number, restMs: number): number {
    const m = this.model;
    const dur = m.duration(clip);
    return alignedClipTime(tMs, startupMs, restMs, m.eventAt(clip, 'active', dur * 0.3), dur);
  }

  private animate(sim: HeroSim): void {
    const m = this.model;
    const state = sim.state;
    const t = sim.stateTime;
    const entered = state !== this.lastState;
    this.lastState = state;
    switch (state) {
      case 'attack': {
        const clip = COMBO_CLIPS[sim.animCombo] ?? 'attack1';
        const tm = sim.timing;
        m.scrub(clip, this.aligned(clip, t, tm.startupMs, tm.activeMs + tm.recoveryMs), 0.04);
        break;
      }
      case 'dashAttack': {
        const s = sim.timing;
        m.scrub(
          'attack2',
          this.aligned('attack2', t, s.startupMs, s.activeMs + s.recoveryMs),
          0.04,
        );
        break;
      }
      case 'special': {
        const def = sim.specialKind === 'preavis' ? PREAVIS : WHISTLE;
        const rest = def.activeMs + def.recoveryMs;
        m.scrub('attack3', this.aligned('attack3', t, def.startupMs, rest), 0.05);
        break;
      }
      case 'charge': {
        // Préavis maintenu : la clé reste levée au-dessus de la tête (armé du coup 3).
        const active = m.eventAt('attack3', 'active', 0.2);
        m.scrub('attack3', Math.min(1, t / 300) * active * 0.85, 0.08);
        break;
      }
      case 'dash':
        m.scrub('dash', Math.min(1, t / DASH.DURATION_MS) * m.duration('dash'), 0.03);
        break;
      case 'hurt':
        if (entered) m.play('hurt', { fade: 0.04, restart: true });
        break;
      case 'dead':
        if (entered) m.play('death', { fade: 0.08, restart: true });
        break;
      case 'drink':
        m.play('idle', { fade: 0.2, timeScale: 0.6 });
        break;
      default: {
        const speed = Math.min(
          1.4,
          pxToM(Math.hypot(sim.body.vx, sim.body.vy)) / pxToM(HERO.SPEED),
        );
        if (speed > 0.15) m.play('run', { fade: 0.12, timeScale: 0.55 + 0.6 * speed });
        else m.play('idle', { fade: 0.2 });
      }
    }
  }

  private onClipEvent(e: string): void {
    if (!this.fx || !this.rig.body.visible) return;
    if (e === 'step' || e === 'land') this.fx.actorEvent(e, this.tmpV.copy(this.pos), 2);
  }

  /** Bout de l'outil en main (m, repère monde), pour la traînée ; `false` sans outil. */
  public toolTip(out: THREE.Vector3): boolean {
    return this.equipment.tip(out);
  }

  public dispose(): void {
    this.equipment.dispose();
    this.model.dispose();
    this.rig.dispose();
  }
}

interface Worn {
  readonly id: string;
  readonly objects: THREE.Object3D[];
  readonly skeletons: THREE.Skeleton[];
  readonly tip: THREE.Object3D | null;
}

/**
 * Équipement visible du héros GLB (implémente `HeroEquipment`, utilisé par l'agent loot) :
 *  - pièce rigide (casque, outil) : clone du gabarit accroché à son socket (`meta.socket`) ;
 *  - pièce skinnée (gilet) : clone lié aux os du héros de mêmes noms, avec les `boneInverses` du
 *    gilet (la quantification meshopt y est intégrée), à côté du corps.
 * Les pièces partagent les matériaux et uniformes du héros (flash, liseré, contour) : 1 à 2 appels de
 * rendu de plus par pièce, aucune recompilation de shader. Une pièce pas encore chargée l'est à la
 * demande, puis accrochée si l'emplacement la demande toujours.
 */
export class HeroGear implements HeroEquipment {
  private readonly worn = new Map<EquipSlot, Worn>();
  private readonly wanted = new Map<EquipSlot, string>();
  private disposed = false;

  public constructor(
    private readonly model: GlbRig,
    private readonly lib: ModelLibrary,
  ) {}

  public get equipped(): Readonly<Record<EquipSlot, string | null>> {
    return {
      casque: this.worn.get('casque')?.id ?? null,
      gilet: this.worn.get('gilet')?.id ?? null,
      outil: this.worn.get('outil')?.id ?? null,
    };
  }

  public attach(slot: EquipSlot, pieceId: string): boolean {
    const meta = this.lib.manifest.items[pieceId];
    if (meta?.slot !== slot) return false;
    this.wanted.set(slot, pieceId);
    const tpl = this.lib.item(pieceId);
    if (tpl) return this.mount(slot, tpl);
    void this.lib.loadItem(pieceId).then((t) => {
      if (t && !this.disposed && this.wanted.get(slot) === pieceId) this.mount(slot, t);
    });
    return true;
  }

  public detach(slot: EquipSlot): void {
    this.wanted.delete(slot);
    this.unmount(slot);
  }

  /** Position monde du bout de l'outil (nœud `tip`). */
  public tip(out: THREE.Vector3): boolean {
    const t = this.worn.get('outil')?.tip;
    if (!t) return false;
    t.getWorldPosition(out);
    return true;
  }

  private mount(slot: EquipSlot, tpl: ItemTemplate): boolean {
    this.unmount(slot);
    const m = this.model;
    const objects: THREE.Object3D[] = [];
    const skeletons: THREE.Skeleton[] = [];
    if (tpl.meta.skinned) {
      const body = m.body;
      const parent = body?.parent;
      if (!body || !parent) return false;
      const src = cloneSkinned(tpl.scene);
      const meshes: THREE.SkinnedMesh[] = [];
      src.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
      });
      for (const piece of meshes) {
        const bones = piece.skeleton.bones.map((b) => m.bone(b.name));
        if (bones.some((b) => b === null || !(b as THREE.Bone).isBone)) {
          console.warn(`[équipement] ${tpl.id} : os absents du héros, pièce ignorée`);
          continue;
        }
        parent.add(piece);
        const sk = new THREE.Skeleton(bones as THREE.Bone[], piece.skeleton.boneInverses);
        piece.bind(sk, piece.bindMatrix);
        skeletons.push(sk);
        objects.push(piece, ...m.toonify(piece));
      }
    } else {
      const socket = tpl.meta.socket ? m.socket(tpl.meta.socket) : null;
      if (!socket) return false;
      const obj = tpl.scene.clone(true);
      m.toonify(obj);
      socket.add(obj);
      objects.push(obj);
    }
    if (objects.length === 0) return false;
    const tip = objects[0]?.getObjectByName('tip') ?? null;
    this.worn.set(slot, { id: tpl.id, objects, skeletons, tip });
    return true;
  }

  private unmount(slot: EquipSlot): void {
    const w = this.worn.get(slot);
    if (!w) return;
    for (const o of w.objects) o.removeFromParent();
    for (const s of w.skeletons) s.dispose();
    this.worn.delete(slot);
  }

  public dispose(): void {
    this.disposed = true;
    for (const slot of [...this.worn.keys()]) this.unmount(slot);
  }
}
