// Vue d'un ennemi GLB (public/models) : même comportement de vue que les ennemis procéduraux
// (apparition magenta, télégraphe au sol à la forme de la hitbox, barre de vie, flash, projection et
// dissolution : `ProceduralEnemyView`), mais le corps est un modèle skinné animé par clips.
//
// Calage sur la simulation (règle 1 : l'animation suit les timings, jamais l'inverse) :
//  - windup : le clip d'attaque est posé (scrub) à `progression × événement active`, donc le frame
//    actif du clip tombe exactement au début de l'état `attack` de la sim, quel que soit le télégraphe
//    (`balance.ts`, tempo du boss) ;
//  - attack / recover : le clip repart de son frame actif à vitesse nominale ;
//  - déplacement : clip de marche à une vitesse proportionnelle à la vitesse réelle du corps.
import * as THREE from 'three';
import { BORNE } from '@/config/balance';
import { AuditeurSim } from '@/sim/enemies/AuditeurSim';
import { BorneSim } from '@/sim/enemies/BorneSim';
import { DiscosaureSim } from '@/sim/enemies/DiscosaureSim';
import { DroneSim } from '@/sim/enemies/DroneSim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { pxToM } from '@/sim/units';
import type { ActorFxSink, OccluderShape } from '@/view/actors/ActorView';
import { ProceduralEnemyView } from '@/view/actors/ProceduralEnemyView';
import { GlbRig } from '@/view/models/GlbRig';
import type { CharacterTemplate } from '@/view/models/ModelLibrary';
import type { EnemyClipMap } from '@/view/actors/actorClips';
import { windupClipTime } from '@/view/models/clipTiming';

/** Pose du drone cloué au sol après un piqué : instant du clip de mort où il est couché. */
const DRONE_GROUNDED_S = 0.85;
/** Sortie digne (Di Rupo) : il salue, puis descend de l'estrade à pied pendant ce temps (s). */
const EXIT_WALK_S = 2.6;
const EXIT_WALK_SPEED = 1.3;
/** Taille (m) à partir de laquelle un acteur peut masquer le héros (héros : 2 m). */
const OCCLUDER_MIN_HEIGHT = 2.5;
/** Opacité tramée d'un acteur qui masque le héros, et vitesse du fondu (1/s). */
const OCCLUDED_FADE = 0.35;
const FADE_RATE = 9;

export class GlbEnemyView extends ProceduralEnemyView {
  private readonly model: GlbRig;
  private readonly map: EnemyClipMap;
  private readonly tmpV = new THREE.Vector3();
  private hurtLeft = 0;
  private spawned = false;
  private lastState = '';
  private lastAttack = '';
  private plates: THREE.Object3D[] = [];
  private platesOff = false;
  private readonly attackClips: ReadonlySet<string>;
  private exitT = 0;
  public readonly occluder: OccluderShape | null;
  private fade = 1;

  public constructor(
    tpl: CharacterTemplate,
    map: EnemyClipMap,
    scene: THREE.Scene,
    reducedMotion: boolean,
    private readonly fx: ActorFxSink | null,
  ) {
    const meta = tpl.meta;
    const death = tpl.clips.find((c) => c.name === map.death)?.duration ?? 1.2;
    const scale = map.scale ?? 1;
    const exit = map.exit === 'walk';
    super(scene, reducedMotion, {
      barY: meta.height * scale + 0.35,
      barW: map.barW,
      spawnR: Math.max(0.4, meta.radius * 1.15 * scale),
      topple: false,
      animatedDeath: true,
      deathFallS: Math.max(1.2, death + 0.25 + (exit ? EXIT_WALK_S : 0)),
      scale,
      calmExit: exit,
    });
    this.map = map;
    this.attackClips = new Set(Object.values(map.attacks));
    this.model = new GlbRig(tpl, {
      flash: this.flash,
      reducedMotion,
      onEvent: (e) => {
        this.onClipEvent(e);
      },
    });
    this.rig.body.add(this.model.object);
    this.model.play(map.idle, { fade: 0 });
    const height = meta.height * scale;
    this.occluder =
      height >= OCCLUDER_MIN_HEIGHT ? { radius: meta.radius * scale, height } : null;
    if (map.model === 'auditeur')
      this.plates = ['plate_L', 'plate_R']
        .map((n) => this.model.bone(n))
        .filter((b): b is THREE.Object3D => b !== null);
  }

  public setOccluding(on: boolean, realDt: number): void {
    const target = on ? OCCLUDED_FADE : 1;
    if (this.fade === target) return;
    const k = 1 - Math.exp(-FADE_RATE * realDt);
    this.fade += (target - this.fade) * k;
    if (Math.abs(target - this.fade) < 0.01) this.fade = target;
    this.model.setFade(this.fade);
  }

  public override hit(heavy: boolean): void {
    super.hit(heavy);
    // Réaction lisible sans masquer un télégraphe : jamais pendant l'armé ou l'attaque.
    if (this.map.hurt && !this.dead && this.lastState !== 'windup' && this.lastState !== 'attack') {
      this.model.play(this.map.hurt, { fade: 0.05, restart: true });
      this.hurtLeft = this.model.duration(this.map.hurt);
    }
  }

  protected animate(sim: EnemySim, dt: number, windup: number): void {
    const m = this.model;
    const map = this.map;
    const state = sim.state;
    const changed = state !== this.lastState || sim.currentAttack !== this.lastAttack;
    this.lastState = state;
    this.lastAttack = sim.currentAttack;
    if (changed && (state === 'windup' || state === 'stagger')) this.hurtLeft = 0;
    // Éclair blanc à l'armé (lecture du télégraphe) ; aucun en Réduction des mouvements.
    if (changed && state === 'windup' && !this.reducedMotion) {
      this.teleFlash = 1;
      this.flash.color.value.setRGB(1, 0.92, 0.97);
    }
    this.hurtLeft = Math.max(0, this.hurtLeft - dt);

    // Télégraphe : contour et écrans (masque `glow`) passent au magenta pendant l'armé.
    m.uniforms.uTelegraph.value = state === 'windup' ? Math.max(0.05, windup) : 0;
    if (sim instanceof DiscosaureSim) {
      // La boule tourne lentement, plus vite quand la piste s'allume ; éteinte au Préavis.
      const spin = sim.blackoutLeft > 0 ? 0 : sim.dancing ? 3.2 : 1.1;
      m.spinRate = spin * (this.reducedMotion ? 0.5 : 1);
    } else m.spinRate = sim instanceof DroneSim && sim.grounded ? 0 : state === 'windup' ? 30 : 22;

    if (!this.spawned) {
      this.spawned = true;
      if (map.spawn && !(sim instanceof BorneSim)) m.play(map.spawn, { fade: 0, restart: true });
    }

    if (sim instanceof BorneSim && sim.deployMs < BORNE.DEPLOY_MS && map.spawn) {
      // La borne se déplie au rythme de la sim.
      m.scrub(map.spawn, (sim.deployMs / BORNE.DEPLOY_MS) * m.duration(map.spawn), 0);
    } else if (this.playingOneShot()) {
      // Apparition (intro du boss) ou réaction au coup : on laisse finir.
    } else if (sim instanceof DroneSim && sim.grounded) {
      m.scrub(map.death, DRONE_GROUNDED_S, 0.1);
    } else if (sim instanceof AuditeurSim && sim.transitionLeft > 0 && m.has('phase2')) {
      if (m.playing !== 'phase2') m.play('phase2', { fade: 0.1, restart: true });
    } else if (state === 'windup') {
      const rush = map.rushes?.[sim.currentAttack];
      // Une attaque sans correspondance mais homonyme d'un clip (plongée du Furet) joue ce clip.
      const clip =
        rush?.windup ??
        map.attacks[sim.currentAttack] ??
        (m.has(sim.currentAttack) ? sim.currentAttack : undefined);
      if (clip && m.has(clip)) {
        const active = m.eventAt(clip, 'active', m.duration(clip) * 0.5);
        m.scrub(clip, windupClipTime(windup, active, rush ? rush.reach : 1), 0.08);
      } else this.locomotion(sim);
    } else if (state === 'attack' || (state === 'recover' && this.inAttackClip())) {
      const rush = map.rushes?.[sim.currentAttack];
      if (rush && state === 'attack') m.play(rush.clip, { fade: 0.06, timeScale: rush.timeScale });
      else if (this.inAttackClip()) {
        if (m.finished) m.play(map.idle, { fade: 0.25 });
        else m.play(m.playing, { timeScale: 1 });
      } else this.locomotion(sim);
    } else if (state === 'stagger' && map.stagger) {
      m.play(map.stagger, { fade: 0.08 });
    } else {
      this.locomotion(sim);
    }

    if (this.plates.length > 0 && sim instanceof AuditeurSim) {
      // Le blindage tombe à la phase 2 et ne revient pas (les autres clips n'ont pas de piste d'échelle).
      if (
        sim.phase >= 2 &&
        (m.playing !== 'phase2' || m.time >= m.eventAt('phase2', 'plates', 0.7))
      )
        this.platesOff = true;
    }
    m.update(dt, this.time);
    if (this.platesOff) for (const p of this.plates) p.scale.setScalar(0.001);
    // Squash & stretch des coups (amorti) : seulement la racine du corps.
    this.rig.apply({ rot: {} }, dt, 18);
  }

  private playingOneShot(): boolean {
    const m = this.model;
    const p = m.playing;
    if (p === '' || m.finished) return false;
    if (p === this.map.spawn) return true;
    return this.hurtLeft > 0 && p === this.map.hurt;
  }

  private inAttackClip(): boolean {
    return this.attackClips.has(this.model.playing);
  }

  private locomotion(sim: EnemySim): void {
    const v = pxToM(Math.hypot(sim.body.vx, sim.body.vy));
    const map = this.map;
    if (v > 0.25 && map.move !== map.idle) {
      const k = THREE.MathUtils.clamp(v / map.moveRef, 0.6, 2.4);
      this.model.play(map.move, { fade: 0.18, timeScale: k });
    } else this.model.play(map.idle, { fade: 0.25 });
  }

  protected override onDeath(): void {
    const m = this.model;
    m.uniforms.uTelegraph.value = 0;
    m.spinRate = 0;
    m.play(this.map.death, { fade: 0.08, restart: true });
  }

  protected override animateDeath(dt: number): void {
    if (this.map.exit === 'walk') {
      // Vaincu, jamais tué : après le salut, il descend de l'estrade en marchant.
      this.exitT += dt;
      const bow = this.model.duration(this.map.death);
      if (this.exitT > bow && this.model.has(this.map.move)) {
        this.model.play(this.map.move, { fade: 0.25 });
        this.turnTo(Math.PI / 2, dt, 6);
        this.pos.x += Math.sin(this.yaw) * EXIT_WALK_SPEED * dt;
        this.pos.z += Math.cos(this.yaw) * EXIT_WALK_SPEED * dt;
      }
    }
    this.model.update(dt, this.time);
    if (this.platesOff) for (const p of this.plates) p.scale.setScalar(0.001);
  }

  private onClipEvent(e: string): void {
    const fx = this.fx;
    if (!fx || !this.rig.root.visible) return;
    const h = this.model.meta.height;
    if (e === 'step' || e === 'land') {
      fx.actorEvent(e, this.tmpV.copy(this.pos), h);
      return;
    }
    if (e === 'glint' || e === 'plates') {
      const s = this.model.socket('socket_vfx') ?? this.model.object;
      s.getWorldPosition(this.tmpV);
      fx.actorEvent(e, this.tmpV, h);
    }
  }

  public override dispose(): void {
    this.model.dispose();
    super.dispose();
  }
}
