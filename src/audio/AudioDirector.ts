/**
 * Chef d'orchestre de l'audio : seul point de contact entre la scène (`Game3D`) et `src/audio/`.
 * À chaque frame, la scène lui passe les événements de la sim et un instantané du monde ; il en tire
 * les effets (routeur), la musique (mode et intensité), les dialogues, la boucle de rotor des drones,
 * la pause. Il écoute aussi l'interface (survol et clic des boutons) par délégation sur la racine des
 * menus, sans toucher au code des menus.
 *
 * Musique : l'OST enregistrée (`tracks.ts`) joue dès que le morceau du contexte est prêt : en
 * streaming (`streamedMusic.ts`, élément audio, rien de décodé d'avance) pour les morceaux, décodée
 * (`sampledMusic.ts`) pour les stingers de moins de 10 s ou là où le streaming manque. Avant
 * (chargement, hors ligne, `?procedural`, format ou lecture refusés), la synthèse de `music.ts`
 * prend le relais, et réciproquement en fondu enchaîné. Graphe :
 *
 *   synthèse (music.ts) ─ porte ─┐
 *   OST (streamedMusic.ts) ──────┤
 *   stingers (sampledMusic.ts) ──┴─ ducking (voix, télégraphe) ─ bus musique
 *   dialogues (voicePlayer.ts) ──── bus voix
 */
import type { EnemyKind } from '@/config/balance';
import { HERO } from '@/config/balance';
import type { SimEvent } from '@/sim/events';
import type { AudioEngineDeps, AudioSettings } from './AudioEngine';
import { AudioEngine, spatialize } from './AudioEngine';
import type { MusicMode } from './music';
import { MusicDirector } from './music';
import type { AudioProbe, SfxCue } from './router';
import { combatIntensity, diffProbe, EMPTY_PROBE, routeEvent } from './router';
import { SampledMusic } from './sampledMusic';
import type { MediaFactory } from './streamedMusic';
import { canStream, MusicStreams, StreamedMusic } from './streamedMusic';
import { SampleBank } from './samples';
import { lootSfx } from './sfx';
import type { SfxId } from './sfx';
import type { MusicContext, TrackDef } from './tracks';
import {
  groupsFor,
  musicContextOf,
  reactiveMix,
  TRACK_CROSSFADE,
  trackFor,
  tracksOfGroups,
} from './tracks';
import type { VoiceCue, VoiceId, VoiceProbe } from './voice';
import {
  lineIdFor,
  RUN_START_CUES,
  VOICE_LINES,
  voiceCuesFor,
  voiceCuesFromProbe,
  VoiceScheduler,
} from './voice';
import { VoicePlayer } from './voicePlayer';

const UI_SELECTOR = '.px-btn, .px-card, .px-seg, .px-prompt, .px-pause-btn';

/** Chargement des échantillons (OST, dialogues). Absent ou désactivé : synthèse seule. */
export interface SampleOptions {
  readonly baseUrl: string;
  readonly enabled: boolean;
  readonly fetchBytes?: (url: string) => Promise<ArrayBuffer>;
  readonly warn?: (msg: string) => void;
  /** Fabrique d'éléments audio (streaming de l'OST) ; par défaut `new Audio()` si disponible. */
  readonly createMedia?: MediaFactory | null;
}

/** En dessous, un morceau est décodé (stinger) plutôt que lu en streaming. */
export const STINGER_MAX = 10;

function defaultMediaFactory(): MediaFactory | null {
  return typeof Audio === 'undefined' ? null : () => new Audio();
}

export interface AudioDirectorDeps extends AudioEngineDeps {
  readonly samples?: SampleOptions;
}

/** Ducking de la musique : −4 dB sous une réplique, −3 dB pendant 300 ms sur un télégraphe. */
const DUCK_VOICE = 0.63;
const DUCK_TELEGRAPH = 0.71;
/** Le combat « tient » la musique de combat quelques secondes après le dernier ennemi. */
const COMBAT_HOLD = 4;
/** Voix chargées par lot (Léon et Yasmina d'abord, l'Invité et Lurcke à l'approche de leur biome). */
const VOICE_GROUPS: Readonly<Record<VoiceId, (p: AudioProbe) => boolean>> = {
  leon: () => true,
  yasmina: () => true,
  invite: (p) => p.phase === 'run' && (p.biome >= 1 || p.roomType === 'repos'),
  lurcke: (p) => p.phase === 'run' && (p.biome >= 2 || (p.biome === 1 && p.roomType === 'repos')),
  // PNJ du hub (et leurs quelques lignes radio) : légers, chargés d'emblée.
  marcel: () => true,
  josiane: () => true,
  bene: () => true,
};

function voiceProbe(p: AudioProbe): VoiceProbe {
  return {
    roomType: p.roomType,
    energy: p.energy,
    burnoutTier: p.burnoutTier,
    meltdown: p.meltdown,
    gobelets: p.gobelets,
    heroState: p.heroState,
    mobilisation: p.mobilisation,
    choiceFamilies: p.choiceFamilies,
  };
}

/** Boss de la salle en cours d'après le biome. */
function bossOf(p: AudioProbe): EnemyKind | null {
  if (p.roomType !== 'boss') return null;
  return p.biome >= 2 ? 'lurcke' : p.biome === 1 ? 'dirupo' : 'auditeur';
}

export class AudioDirector {
  public readonly engine: AudioEngine;
  public readonly music = new MusicDirector();
  public readonly samples: SampleBank;
  public readonly voices: VoicePlayer;
  private readonly scheduler: VoiceScheduler;
  private prev: AudioProbe = EMPTY_PROBE;
  private readonly kinds = new Map<number, EnemyKind>();
  private rotor: { gain: GainNode; pan: StereoPannerNode | null; stop: () => void } | null = null;
  private uiRoot: HTMLElement | null = null;
  private hovered: Element | null = null;
  private sampled: SampledMusic | null = null;
  private streamed: StreamedMusic | null = null;
  private streams: MusicStreams | null = null;
  private readonly createMedia: MediaFactory | null;
  private readonly baseUrl: string;
  private readonly warn: ((msg: string) => void) | undefined;
  private synthGate: GainNode | null = null;
  private duck: GainNode | null = null;
  private duckTarget = 1;
  private telegraphUntil = 0;
  private synthOn = true;
  private combatUntil = -1;
  private finalSilence = false;
  private creditsRef = false;
  private contextRef: MusicContext = 'title';
  private groupsKey = '';
  private mixKey = '';
  private reducedMotionRef = false;
  /** Répliques acceptées pendant la dernière frame : texte du jeu → texte enregistré. */
  private readonly subtitles = new Map<string, string>();
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

  public constructor(deps: AudioDirectorDeps = {}) {
    this.engine = new AudioEngine(deps);
    const so = deps.samples;
    this.createMedia = so?.createMedia === undefined ? defaultMediaFactory() : so.createMedia;
    this.baseUrl = so?.baseUrl ?? '';
    this.warn = so?.warn;
    this.samples = new SampleBank({
      baseUrl: so?.baseUrl ?? '',
      enabled: so?.enabled ?? false,
      ...(so?.fetchBytes ? { fetchBytes: so.fetchBytes } : {}),
      ...(so?.warn ? { warn: so.warn } : {}),
    });
    this.voices = new VoicePlayer(
      this.samples,
      () => this.engine.ctx,
      () => this.engine.bus('voice'),
    );
    this.scheduler = new VoiceScheduler(this.voices);
    this.applyRepetitive();
    this.engine.onReady(() => {
      const ctx = this.engine.ctx;
      const music = this.engine.bus('music');
      const amb = this.engine.bus('ambience');
      if (!ctx || !music || !amb) return;
      const duck = ctx.createGain();
      duck.connect(music);
      const gate = ctx.createGain();
      gate.connect(duck);
      this.duck = duck;
      this.synthGate = gate;
      this.music.attach(ctx, gate, amb);
      this.sampled = new SampledMusic(ctx, duck);
      const create = this.createMedia;
      if (this.samples.enabled && create && canStream(ctx)) {
        const streams = new MusicStreams(this.baseUrl, create, this.warn);
        const streamed = new StreamedMusic(ctx, duck, create, (f) => streams.url(f));
        streamed.onFail = (file, why) => {
          streams.fail(file, why);
        };
        this.streams = streams;
        this.streamed = streamed;
      }
      this.samples.attach(ctx);
      this.requestSamples(this.prev, this.contextRef);
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
    this.applyRepetitive();
  }

  private applyRepetitive(): void {
    this.scheduler.cooldownScale = this.engine.settings.reduceRepetitive ? 2 : 1;
  }

  public setHidden(hidden: boolean): void {
    this.engine.setHidden(hidden);
    this.streamed?.setHidden(hidden);
  }

  /** Force un mode de musique (le hub l'utilise : `setMusic('hub')`). */
  public setMusic(mode: MusicMode): void {
    this.music.setMode(mode);
  }

  /** Contexte musical courant (outil de test et de débogage). */
  public get musicContext(): MusicContext {
    return this.contextRef;
  }

  /** Morceau enregistré en cours, `null` : synthèse (ou silence). */
  public get trackPlaying(): string | null {
    return this.streamed?.trackId ?? this.sampled?.trackId ?? null;
  }

  /** Mémoire de l'OST (outil de mesure) : PCM décodé (Mo), éléments audio en vie. */
  public get musicMemory(): { pcmMo: number; elements: number } {
    return {
      pcmMo: Math.round(this.samples.decodedBytes / 1e5) / 10,
      elements: (this.streams?.alive ?? 0) + (this.streamed?.elements ?? 0),
    };
  }

  /** Le morceau passe-t-il en streaming (sinon : décodé) ? */
  private isStreamed(t: TrackDef): boolean {
    return this.streams !== null && t.duration >= STINGER_MAX;
  }

  /** Générique de fin (le 7h12) : à activer par l'écran qui l'affiche. */
  public setCredits(on: boolean): void {
    this.creditsRef = on;
  }

  /** Réduction des mouvements : coupe aussi les « flashs sonores » (néon, boule à facettes). */
  public set reducedMotion(on: boolean) {
    this.reducedMotionRef = on;
    this.music.reduceFlashes = on;
  }

  public get reducedMotion(): boolean {
    return this.reducedMotionRef;
  }

  /** Loot au sol par rareté (0 = Réformé … 4 = Patrimoine), à brancher sur l'événement de drop. */
  public loot(rank: number, x?: number, y?: number): void {
    this.cue({ id: lootSfx(rank), x, y });
  }

  private cue(c: SfxCue): void {
    // Réduction des mouvements : le scintillement de la boule à facettes reste discret.
    const gain = this.reducedMotionRef && c.id === 'discoShimmer' ? (c.gain ?? 1) * 0.4 : c.gain;
    if (c.id === 'telegraph') this.telegraphUntil = (this.engine.ctx?.currentTime ?? 0) + 0.3;
    const played = this.engine.play(c.id, { x: c.x, y: c.y, amount: c.amount, gain });
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
    this.hearVoices(events, probe, kindOf);
    const prev = this.prev;
    this.prev = probe;

    // Musique : morceau enregistré du contexte, sinon synthèse.
    const now = eng.ctx?.currentTime ?? 0;
    if (probe.phase !== 'run' || prev.phase !== 'run') this.finalSilence = false;
    for (const e of events) if (e.type === 'fx' && e.name === 'finalBlow') this.finalSilence = true;
    if (probe.phase === 'run' && probe.enemies.length > 0) this.combatUntil = now + COMBAT_HOLD;
    const context = musicContextOf(probe, {
      combat: probe.phase === 'run' && now < this.combatUntil,
      finalSilence: this.finalSilence,
      end: probe.result,
      credits: this.creditsRef,
    });
    this.contextRef = context;
    this.requestSamples(probe, context);
    const boss = probe.roomType === 'boss';
    let mode: MusicMode = 'quai';
    if (probe.phase === 'hub') mode = 'hub';
    else if (probe.phase === 'run') mode = boss ? 'boss' : 'combat';
    if (context === 'silence') mode = 'off';
    this.music.setMode(mode);
    const intensity = combatIntensity(probe);
    this.music.setIntensity(intensity, probe.bossPhase);
    this.updateSampled(trackFor(context), context, intensity);
    this.music.update();
    this.updateDuck(now);
    this.updateRotor(probe);
  }

  // ─── OST enregistrée ──────────────────────────────────────────────────────

  /** Demande les morceaux et les voix du contexte (et du biome suivant à l'approche). */
  private requestSamples(probe: AudioProbe, context: MusicContext): void {
    if (!this.samples.enabled || !this.engine.ctx) return;
    const groups = groupsFor(context, probe);
    const voices = (Object.keys(VOICE_GROUPS) as VoiceId[]).filter((v) => VOICE_GROUPS[v](probe));
    const key = `${context}|${groups.join(',')}|${voices.join(',')}`;
    if (key === this.groupsKey) return;
    this.groupsKey = key;
    // Ordre : le morceau du contexte, les voix (légères : ≈ 30 ko par réplique), puis le reste du lot.
    const current = trackFor(context);
    const music = (t: TrackDef, urgent: boolean): void => {
      if (this.streams && this.isStreamed(t)) this.streams.request(t.file);
      else this.samples.request(t.file, 'music', urgent);
    };
    if (current) music(current, true);
    for (const line of VOICE_LINES.values())
      if (line.file && voices.includes(line.voice)) this.samples.request(line.file, 'voice');
    for (const t of tracksOfGroups(groups)) music(t, false);
  }

  private updateSampled(track: TrackDef | null, context: MusicContext, intensity: number): void {
    const sampled = this.sampled;
    if (!sampled) return;
    const streamed = this.streamed;
    const stop = (fade: number): void => {
      if (sampled.playing) sampled.stop(fade);
      if (streamed?.playing) streamed.stop(fade);
    };
    if (context === 'silence') {
      // Coup final de Lurcke : tout se tait d'un coup.
      stop(0.05);
      this.setSynth(false, 0.05);
      sampled.update();
      streamed?.update();
      return;
    }
    const keep = new Set(track ? [track.file] : []);
    this.samples.keep = keep;
    if (this.streams) this.streams.keep = keep;
    const viaStream = track !== null && this.isStreamed(track);
    const el = track && viaStream ? (this.streams?.take(track.file) ?? null) : null;
    const buffer = track && !viaStream ? this.samples.get(track.file) : null;
    if (track && streamed && el) {
      if (sampled.playing) sampled.stop(TRACK_CROSSFADE);
      streamed.play(track, el);
    } else if (track && buffer) {
      if (streamed?.playing) streamed.stop(TRACK_CROSSFADE);
      sampled.play(track, buffer);
    } else {
      // Pas (encore) de fichier pour ce contexte : la synthèse reprend.
      stop(TRACK_CROSSFADE);
      this.setSynth(true, TRACK_CROSSFADE);
    }
    if (track && (el || buffer)) {
      this.setSynth(false, TRACK_CROSSFADE);
      const mix = reactiveMix(track, intensity);
      const key = `${String(Math.round(mix.cutoff / 50))}|${mix.gain.toFixed(2)}`;
      if (key !== this.mixKey) {
        this.mixKey = key;
        sampled.setMix(mix.cutoff, mix.gain);
        streamed?.setMix(mix.cutoff, mix.gain);
      }
    }
    sampled.update();
    streamed?.update();
  }

  private setSynth(on: boolean, fade: number): void {
    const gate = this.synthGate;
    const ctx = this.engine.ctx;
    if (!gate || !ctx || on === this.synthOn) return;
    this.synthOn = on;
    const t = ctx.currentTime;
    gate.gain.cancelScheduledValues(t);
    gate.gain.setValueAtTime(gate.gain.value, t);
    gate.gain.linearRampToValueAtTime(on ? 1 : 0, t + fade);
    // Coupée, la synthèse ne planifie plus de notes (l'ambiance continue).
    this.music.musicMuted = !on;
  }

  private updateDuck(now: number): void {
    const duck = this.duck;
    if (!duck) return;
    let target = 1;
    if (this.scheduler.dialogueActive(now)) target = DUCK_VOICE;
    else if (now < this.telegraphUntil) target = DUCK_TELEGRAPH;
    if (target === this.duckTarget) return;
    const down = target < this.duckTarget;
    this.duckTarget = target;
    // Attaque 80 ms, relâchement 400 ms (constantes de temps ≈ durée / 3).
    duck.gain.setTargetAtTime(target, now, down ? 0.027 : 0.13);
  }

  // ─── Dialogues ────────────────────────────────────────────────────────────

  private hearVoices(
    events: readonly SimEvent[],
    probe: AudioProbe,
    kindOf: (id: number) => EnemyKind | undefined,
  ): void {
    this.subtitles.clear();
    const now = this.engine.ctx?.currentTime ?? 0;
    const prev = this.prev;
    const runStart = probe.phase === 'run' && prev.phase !== 'run';
    if (runStart) this.scheduler.resetRun();
    if (probe.phase !== prev.phase && probe.phase !== 'run' && probe.phase !== 'results')
      this.scheduler.clear();
    const vc = { kindOf, boss: bossOf(probe), maxEnergy: HERO.MAX_ENERGY, roomType: prev.roomType };
    const request = (c: VoiceCue): boolean => this.scheduler.request(c, now);
    if (runStart) for (const c of RUN_START_CUES) request(c);
    for (const e of events) {
      if (e.type === 'roomEntered') this.scheduler.roomEntered();
      if (e.type === 'bossLine' || e.type === 'bossIntro') {
        const text = e.type === 'bossLine' ? e.text : e.line;
        const id = lineIdFor(text);
        // Une ligne radio (Marcel après l'Invité d'honneur) passe par le haut-parleur.
        const kind = id?.includes('.radio.') ? 'radio' : 'line';
        if (id && request({ id, kind, important: true })) {
          const sub = VOICE_LINES.get(id)?.subtitle;
          if (sub) this.subtitles.set(text, sub);
        }
      }
      for (const c of voiceCuesFor(e, vc)) request(c);
    }
    if (probe.phase === 'run' && prev.phase === 'run')
      for (const c of voiceCuesFromProbe(voiceProbe(prev), voiceProbe(probe))) request(c);
    const bossTelegraph =
      probe.roomType === 'boss' &&
      (probe.enemies.some((e) => e.windup) || probe.hazards.some((h) => h.telegraphing));
    this.scheduler.update(now, { bossTelegraph });
  }

  /**
   * Texte à afficher pour une réplique du jeu : celui de l'enregistrement s'il va être dit (les deux
   * diffèrent parfois d'un mot), sinon le texte du jeu, inchangé.
   */
  public subtitleFor(text: string): string {
    return this.subtitles.get(text) ?? text;
  }

  /**
   * Réplique hors Shift (bulles du hub) : la dit si elle est enregistrée et prête. Renvoie le texte à
   * afficher (celui de l'enregistrement, ou celui du jeu).
   */
  public say(text: string): string {
    const id = lineIdFor(text);
    const now = this.engine.ctx?.currentTime ?? 0;
    if (id && this.scheduler.request({ id, kind: 'line' }, now))
      return VOICE_LINES.get(id)?.subtitle ?? text;
    return text;
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
    this.voices.stopAll();
    this.sampled?.dispose();
    this.streamed?.dispose();
    this.streams?.dispose();
    this.music.dispose();
    this.engine.dispose();
  }
}
