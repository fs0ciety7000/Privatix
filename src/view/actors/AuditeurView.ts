// Boss 1 en 3D : l'Auditeur des Quais aux commandes de la Borne Totale 3000. Une borne géante sur
// chenilles, grand écran frontal (froid, puis rouge en phase 2 et 3), bras-barrière rayé rouge et blanc
// (balayage), bouche à tickets (barrage) et, dans la cabine vitrée, l'Auditeur, chauve, lunettes,
// cravate magenta. Il disparaît pendant le saut du « Contrôle ! ».
import * as THREE from 'three';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { AuditeurSim } from '@/sim/enemies/AuditeurSim';
import { ProceduralEnemyView } from '@/view/actors/ProceduralEnemyView';
import { canvasTexture, glow, PAL } from '@/view/materials/toon';
import type { Pose } from '@/view/rig';

export class AuditeurView extends ProceduralEnemyView {
  private readonly screen: THREE.MeshBasicMaterial;
  private readonly mouth: THREE.MeshBasicMaterial;
  private readonly beacon: THREE.MeshBasicMaterial;
  private readonly screenTex: THREE.CanvasTexture;
  private screenCtx: CanvasRenderingContext2D | null = null;
  private screenPhase = 0;
  private treads = 0;

  public constructor(scene: THREE.Scene, reducedMotion: boolean) {
    super(scene, reducedMotion, { barY: 3.6, barW: 2.2, spawnR: 1.2, topple: false });
    const r = this.rig;
    const shell = this.mat(0x19c3b1, 1.0);
    const dark = this.mat(0x1d2a48, 0.6);
    const steel = this.mat(0x8c98b8, 0.8);
    const red = this.mat(0xe0302a, 0.4);
    const white = this.mat(0xf4f6ff, 0.3);
    const skin = this.mat(0xe9b088, 0.6, { rim: PAL.rim });
    const suit = this.mat(0x2a2148, 0.6);
    const tie = this.mat(PAL.danger, 0.4, { emissive: PAL.danger, emissiveIntensity: 0.4 });
    const ink = this.mat(0x14101a, 0);
    this.screenTex = canvasTexture(256, 160, (g) => {
      this.screenCtx = g;
      drawScreen(g, 1);
    });
    this.screen = this.track(new THREE.MeshBasicMaterial({ map: this.screenTex }));
    this.screen.color.setScalar(1.8);
    this.mouth = this.track(glow(PAL.danger, 1.5));
    this.beacon = this.track(glow(0xffc83a, 3));

    r.joint('base', null, [0, 0, 0]);
    r.joint('trunk', 'base', [0, 0.5, 0]);
    r.joint('cab', 'trunk', [0, 2.0, -0.2]);
    r.joint('pilot', 'cab', [0, 0.05, 0]);
    r.joint('arm', 'trunk', [-1.0, 1.1, 0.2]);

    // Chenilles
    for (const sx of [1, -1]) {
      r.box('base', dark, [0.85 * sx, 0.25, 0], [0.42, 0.5, 1.7], 0.18);
      for (let i = 0; i < 5; i += 1)
        r.cyl('base', steel, [0.85 * sx, 0.25, -0.65 + i * 0.32], 0.12, 0.44, {
          rot: [0, 0, 90],
          outline: false,
        });
    }
    // Fût : une borne géante, bandes magenta, grand écran
    r.box('trunk', shell, [0, 0.95, 0], [1.9, 1.9, 1.3], 0.18);
    r.box('trunk', dark, [0, 0.05, 0], [2.0, 0.2, 1.4], 0.06);
    for (const sx of [1, -1])
      r.box('trunk', this.mat(PAL.danger, 0.3), [0.96 * sx, 0.95, 0], [0.03, 1.6, 0.9], 0.01, {
        outline: false,
      });
    r.box('trunk', dark, [0, 1.2, 0.62], [1.5, 0.95, 0.1], 0.05);
    const face = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.36, 0.82)), this.screen);
    face.position.set(0, 1.2, 0.68);
    r.j('trunk').add(face);
    r.box('trunk', dark, [0, 0.45, 0.66], [0.9, 0.2, 0.08], 0.04);
    const slot = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.76, 0.07, 0.05)), this.mouth);
    slot.position.set(0, 0.45, 0.71);
    r.j('trunk').add(slot);
    // Cabine vitrée et l'Auditeur
    r.box('cab', dark, [0, 0.02, 0], [1.2, 0.12, 0.9], 0.05);
    const glass = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(1.1, 0.8, 0.8)),
      this.track(
        new THREE.MeshBasicMaterial({
          color: 0x6ff3ff,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
      ),
    );
    glass.position.y = 0.48;
    r.j('cab').add(glass);
    r.box('cab', steel, [0, 0.9, 0], [1.2, 0.08, 0.9], 0.03);
    const lamp = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.1, 10, 8)), this.beacon);
    lamp.position.set(0, 1.02, 0);
    r.j('cab').add(lamp);
    r.box('pilot', suit, [0, 0.25, 0], [0.5, 0.36, 0.3], 0.1);
    r.box('pilot', tie, [0, 0.27, 0.16], [0.07, 0.26, 0.02], 0.01, { outline: false });
    r.sphere('pilot', skin, [0, 0.6, 0], [0.28, 0.3, 0.27]);
    for (const sx of [1, -1]) {
      r.box('pilot', ink, [0.08 * sx, 0.62, 0.24], [0.1, 0.06, 0.02], 0.01, { outline: false });
      r.sphere('pilot', skin, [0.27 * sx, 0.6, 0], [0.05, 0.07, 0.05]);
    }
    r.box('pilot', ink, [0, 0.5, 0.24], [0.12, 0.02, 0.02], 0.005, { outline: false });
    // Bras-barrière (balayage à 180°) : rayé rouge et blanc
    r.cyl('arm', steel, [0, 0, 0], 0.16, 0.24, { rot: [0, 0, 90] });
    for (let i = 0; i < 6; i += 1)
      r.box('arm', i % 2 === 0 ? red : white, [-0.2 - i * 0.42, 0, 0], [0.42, 0.14, 0.14], 0.03, {
        outline: i === 0,
      });
  }

  protected override readonly turnRate: number = 4;

  protected animate(sim: EnemySim, dt: number, windup: number): void {
    const boss = sim instanceof AuditeurSim ? sim : null;
    const phase = boss?.phase ?? 1;
    const attack = sim.currentAttack;
    const w = sim.state === 'windup' ? windup : sim.state === 'attack' ? 1 : 0;
    const moving = Math.hypot(sim.body.vx, sim.body.vy) > 5;
    if (moving) this.treads += dt;
    // Bras-barrière : relevé au repos, armé sur le côté pendant le télégraphe, balaie à l'attaque.
    let armYaw = 0;
    let armRoll = -20;
    if (attack === 'sweep') {
      if (sim.state === 'windup') {
        armYaw = 90 * w;
        armRoll = 0;
      } else if (sim.state === 'attack') {
        armYaw = 90 - Math.min(1, sim.stateTime / 200) * 180;
        armRoll = 0;
      }
    }
    const transition = boss && boss.transitionLeft > 0;
    const shake = transition && !this.reducedMotion ? Math.sin(this.time * 60) * 2 : 0;
    const crouch = attack === 'stamp' && sim.state === 'windup' ? w : 0;
    const pose: Pose = {
      rot: {
        arm: [0, armYaw, armRoll],
        cab: [0, shake, 0],
        pilot: [moving ? Math.sin(this.time * 6) * 3 : 0, 0, 0],
        trunk: [attack === 'kpi' && sim.state === 'attack' ? 12 : 0, 0, shake * 0.5],
      },
      root: [0, -0.25 * crouch + (moving ? Math.abs(Math.sin(this.treads * 9)) * 0.03 : 0), 0],
      scale: [1 + 0.08 * crouch, 1 - 0.12 * crouch, 1 + 0.08 * crouch],
    };
    this.rig.apply(pose, dt, sim.state === 'attack' ? 30 : 10);
    // Écran : graphique froid en phase 1, rouge « SIGNATURE IMMINENTE » ensuite.
    if (phase !== this.screenPhase) {
      this.screenPhase = phase;
      if (this.screenCtx) drawScreen(this.screenCtx, phase);
      this.screenTex.needsUpdate = true;
    }
    const hot = sim.state === 'windup' && (attack === 'barrage' || attack === 'chrono');
    this.mouth.color.setHex(PAL.danger).multiplyScalar(hot ? 1.5 + 4 * w : 1.2);
    this.screen.color.setScalar(phase >= 2 ? 2.2 : 1.8);
    const blink = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(this.time * (phase >= 2 ? 10 : 4));
    this.beacon.color.setHex(phase >= 2 ? 0xff3030 : 0xffc83a).multiplyScalar(3 * blink);
  }

  protected override onDeath(): void {
    this.screen.color.setScalar(0.3);
    this.mouth.color.setHex(0x101018);
    this.beacon.color.setHex(0x101018);
  }

  public override dispose(): void {
    this.screenTex.dispose();
    super.dispose();
  }
}

function drawScreen(g: CanvasRenderingContext2D, phase: number): void {
  const hot = phase >= 2;
  g.fillStyle = hot ? '#3a0610' : '#071a26';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = hot ? '#ff4060' : '#5ff7e4';
  g.font = '900 26px Arial Black, Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(hot ? 'SIGNATURE' : 'AUDIT EN COURS', 128, 46);
  g.fillText(hot ? 'IMMINENTE' : 'BIENVEILLANT', 128, 80);
  g.strokeStyle = hot ? '#ff3ea5' : '#19c3b1';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(20, 140);
  g.lineTo(80, hot ? 132 : 120);
  g.lineTo(140, hot ? 140 : 104);
  g.lineTo(236, hot ? 150 : 96);
  g.stroke();
}
