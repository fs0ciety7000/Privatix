/**
 * Chef d'orchestre de l'audio : seul point de contact entre la scène (`Game3D`) et `src/audio/`.
 * À chaque frame, la scène lui passe les événements de la sim et un instantané du monde ; il en tire
 * les effets (routeur), la musique (mode et intensité), la boucle de rotor des drones, la pause.
 * Il écoute aussi l'interface (survol et clic des boutons) par délégation sur la racine des menus,
 * sans toucher au code des menus.
 */
import type { EnemyKind } from '@/config/balance';
import type { SimEvent } from '@/sim/events';
import type { AudioEngineDeps, AudioSettings } from './AudioEngine';
import { AudioEngine, spatialize } from './AudioEngine';
import type { MusicMode } from './music';
import { MusicDirector } from './music';
import type { AudioProbe, SfxCue } from './router';
import { combatIntensity, diffProbe, EMPTY_PROBE, routeEvent } from './router';
import { lootSfx } from './sfx';
import type { SfxId } from './sfx';

const UI_SELECTOR = '.px-btn, .px-card, .px-seg, .px-prompt, .px-pause-btn';

export class AudioDirector {
  public readonly engine: AudioEngine;
  public readonly music = new MusicDirector();
  private prev: AudioProbe = EMPTY_PROBE;
  private readonly kinds = new Map<number, EnemyKind>();
  private rotor: { gain: GainNode; pan: StereoPannerNode | null; stop: () => void } | null = null;
  private uiRoot: HTMLElement | null = null;
  private hovered: Element | null = null;
  private readonly onOver = (e: Event): void => {
    const t = e.target instanceof Element ? e.target.closest(UI_SELECTOR) : null;
    if (t && t !== this.hovered) this.engine.play('uiHover');
    this.hovered = t;
  };
  private readonly onClick = (e: Event): void => {
    const t = e.target instanceof Element ? e.target.closest(UI_SELECTOR) : null;
    if (t) this.engine.play('uiClick');
  };
  /** Dernières demandes jouées (outil de test et de débogage, 32 au plus). */
  public readonly log: SfxId[] = [];

  public constructor(deps: AudioEngineDeps = {}) {
    this.engine = new AudioEngine(deps);
    this.engine.onReady(() => {
      const ctx = this.engine.ctx;
      const music = this.engine.bus('music');
      const amb = this.engine.bus('ambience');
      if (ctx && music && amb) this.music.attach(ctx, music, amb);
    });
  }

  /** Déverrouillage au premier geste, sons d'interface délégués sur `uiRoot`. */
  public bind(doc: Document, uiRoot: HTMLElement): void {
    this.engine.attachUnlock(doc);
    this.uiRoot = uiRoot;
    uiRoot.addEventListener('pointerover', this.onOver);
    uiRoot.addEventListener('click', this.onClick);
  }

  public get settings(): AudioSettings {
    return this.engine.settings;
  }

  public setSettings(next: Partial<AudioSettings>): void {
    this.engine.setSettings(next);
  }

  public setHidden(hidden: boolean): void {
    this.engine.setHidden(hidden);
  }

  /** Force un mode de musique (le hub l'utilise : `setMusic('hub')`). */
  public setMusic(mode: MusicMode): void {
    this.music.setMode(mode);
  }

  /** Loot au sol par rareté (0 = Réformé … 4 = Patrimoine), à brancher sur l'événement de drop. */
  public loot(rank: number, x?: number, y?: number): void {
    this.cue({ id: lootSfx(rank), x, y });
  }

  private cue(c: SfxCue): void {
    const played = this.engine.play(c.id, { x: c.x, y: c.y, amount: c.amount, gain: c.gain });
    if (played) {
      this.log.push(c.id);
      if (this.log.length > 32) this.log.shift();
    }
  }

  /** Une frame : événements de la sim, instantané du monde. */
  public frame(events: readonly SimEvent[], probe: AudioProbe): void {
    const eng = this.engine;
    eng.listenerX = probe.heroX;
    eng.listenerY = probe.heroY;
    eng.setPaused(probe.paused && probe.phase === 'run');
    for (const e of probe.enemies) this.kinds.set(e.id, e.kind);
    const kindOf = (id: number): EnemyKind | undefined => this.kinds.get(id);
    for (const e of events) {
      if (e.type === 'roomEntered') this.kinds.clear();
      for (const c of routeEvent(e, kindOf)) this.cue(c);
    }
    for (const c of diffProbe(this.prev, probe)) this.cue(c);
    this.prev = probe;

    // Musique.
    const boss = probe.roomType === 'boss';
    let mode: MusicMode = 'quai';
    if (probe.phase === 'hub') mode = 'hub';
    else if (probe.phase === 'run') mode = boss ? 'boss' : 'combat';
    this.music.setMode(mode);
    this.music.setIntensity(combatIntensity(probe), probe.bossPhase);
    this.music.update();
    this.updateRotor(probe);
  }

  /** Boucle de rotor : un seul bourdonnement pour tous les drones, réglé sur le plus proche. */
  private updateRotor(p: AudioProbe): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('sfx');
    if (!ctx || !bus || ctx.state !== 'running') return;
    const drones = p.phase === 'run' ? p.enemies.filter((e) => e.kind === 'drone') : [];
    if (drones.length === 0) {
      if (this.rotor) {
        this.rotor.stop();
        this.rotor = null;
      }
      return;
    }
    this.rotor ??= this.makeRotor(ctx, bus);
    let best = drones[0];
    let bestD = Infinity;
    for (const d of drones) {
      const dist = Math.hypot(d.x - p.heroX, d.y - p.heroY);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (!best) return;
    const sp = spatialize(best.x - p.heroX, best.y - p.heroY);
    const level = 0.05 * sp.gain * Math.min(1.5, 0.8 + drones.length * 0.2);
    const t = ctx.currentTime;
    this.rotor.gain.gain.setTargetAtTime(level, t, 0.15);
    this.rotor.pan?.pan.setTargetAtTime(sp.pan, t, 0.15);
  }

  private makeRotor(
    ctx: AudioContext,
    bus: AudioNode,
  ): { gain: GainNode; pan: StereoPannerNode | null; stop: () => void } {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let out: AudioNode = bus;
    let pan: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      pan.connect(bus);
      out = pan;
    }
    gain.connect(out);
    // Rotor : dent de scie grave modulée en amplitude (battement des pales), filtrée en médium.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 92;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 520;
    f.Q.value = 0.9;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 26;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(am.gain);
    osc.connect(f).connect(am).connect(gain);
    const t = ctx.currentTime;
    osc.start(t);
    lfo.start(t);
    return {
      gain,
      pan,
      stop: () => {
        const now = ctx.currentTime;
        gain.gain.setTargetAtTime(0, now, 0.1);
        osc.stop(now + 0.6);
        lfo.stop(now + 0.6);
      },
    };
  }

  public dispose(): void {
    this.uiRoot?.removeEventListener('pointerover', this.onOver);
    this.uiRoot?.removeEventListener('click', this.onClick);
    this.rotor?.stop();
    this.rotor = null;
    this.music.dispose();
    this.engine.dispose();
  }
}
