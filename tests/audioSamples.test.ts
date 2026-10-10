import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MUSIC_FILES, VOICE_FILES } from '@/audio/assetIndex';
import { AudioDirector } from '@/audio/AudioDirector';
import type { AudioProbe } from '@/audio/router';
import { EMPTY_PROBE } from '@/audio/router';
import { MUSIC_DECODED_BUDGET, SampleBank } from '@/audio/samples';
import type { MusicContext, MusicContextState } from '@/audio/tracks';
import {
  groupsFor,
  LOOP_CROSSFADE,
  musicContextOf,
  nextLoopAt,
  reactiveMix,
  TRACKS,
  tracksOfGroups,
} from '@/audio/tracks';
import type { VoiceCue, VoiceKind, VoiceOut } from '@/audio/voice';
import {
  lineIdFor,
  VOICE_LINES,
  voiceCuesFor,
  voiceCuesFromProbe,
  VoiceScheduler,
} from '@/audio/voice';
import { BIOMES, PHASE_LINES } from '@/sim/biomes';
import type { SimEvent } from '@/sim/events';
import { NPC_LINES } from '@/sim/hub/stations';
import { FAMILIES } from '@/systems/meta/Avantages';

// ─── AudioContext simulé (minimal : gains, filtres, sources, décodage factice) ─

class Param {
  public value = 0;
  public setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  public linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  public exponentialRampToValueAtTime(v: number): this {
    if (v <= 0) throw new RangeError('rampe exponentielle vers 0');
    this.value = v;
    return this;
  }
  public setTargetAtTime(v: number): this {
    this.value = v;
    return this;
  }
  public cancelScheduledValues(): this {
    return this;
  }
}

class Node {
  public connect<T>(n: T): T {
    return n;
  }
  public disconnect(): void {
    // Rien à débrancher.
  }
}

class Gain extends Node {
  public gain = new Param();
  public constructor() {
    super();
    this.gain.value = 1;
  }
}

class Source extends Node {
  public started = -1;
  public offset = 0;
  public stopped = -1;
  public buffer: unknown = null;
  public loop = false;
  public type = 'sine';
  public frequency = new Param();
  public detune = new Param();
  public playbackRate = new Param();
  public constructor(private readonly ctx: Ctx) {
    super();
  }
  public start(t = 0, offset = 0): void {
    if (this.started >= 0) throw new Error('start() appelé deux fois');
    this.started = t;
    this.offset = offset;
    if (this.buffer) this.ctx.sources.push(this);
  }
  public stop(t = 0): void {
    if (this.started < 0) throw new Error('stop() avant start()');
    this.stopped = t;
  }
}

class Filter extends Node {
  public type = 'lowpass';
  public frequency = new Param();
  public Q = new Param();
  public threshold = new Param();
  public knee = new Param();
  public ratio = new Param();
  public attack = new Param();
  public release = new Param();
  public pan = new Param();
}

interface FakeBuffer {
  readonly duration: number;
  readonly length: number;
  readonly numberOfChannels: number;
  readonly tag: string;
}

/** Élément audio simulé (streaming de l'OST). */
class FakeMedia {
  public static all: FakeMedia[] = [];
  public static refuse = false;
  public src = '';
  public preload = '';
  public currentTime = 0;
  public duration = 100;
  public paused = true;
  public ended = false;
  public plays = 0;
  private readonly listeners = new Map<string, (() => void)[]>();
  public constructor() {
    FakeMedia.all.push(this);
  }
  public play(): Promise<void> {
    this.plays += 1;
    if (FakeMedia.refuse) return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  public pause(): void {
    this.paused = true;
  }
  public load(): void {
    // Rien à charger.
  }
  public addEventListener(type: string, cb: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }
  public removeEventListener(type: string, cb: () => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((f) => f !== cb),
    );
  }
  public fire(type: string): void {
    for (const cb of this.listeners.get(type) ?? []) cb();
  }
}

class Ctx {
  public currentTime = 0;
  public sampleRate = 8000;
  public state: 'suspended' | 'running' | 'closed' = 'suspended';
  public readonly destination = new Node();
  public readonly sources: Source[] = [];
  public decodeFails = false;
  public resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  public suspend(): Promise<void> {
    return Promise.resolve();
  }
  public close(): Promise<void> {
    return Promise.resolve();
  }
  public createGain(): Gain {
    return new Gain();
  }
  public createOscillator(): Source {
    return new Source(this);
  }
  public createBufferSource(): Source {
    return new Source(this);
  }
  public createBiquadFilter(): Filter {
    return new Filter();
  }
  public createDynamicsCompressor(): Filter {
    return new Filter();
  }
  public createMediaElementSource(): Node {
    return new Node();
  }
  public createStereoPanner(): Filter {
    return new Filter();
  }
  public createBuffer(channels: number, length: number, sampleRate: number): unknown {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (c: number) => data[c],
    };
  }
  /** Décodage factice : les octets contiennent la durée (s) en float64. */
  public decodeAudioData(bytes: ArrayBuffer): Promise<FakeBuffer> {
    if (this.decodeFails) return Promise.reject(new Error('format non pris en charge'));
    const duration = new Float64Array(bytes)[0] ?? 1;
    return Promise.resolve({
      duration,
      length: Math.round(duration * 48000),
      numberOfChannels: 2,
      tag: 'buffer',
    });
  }
}

/** Octets factices d'un fichier de `duration` s. */
function fakeBytes(duration: number): ArrayBuffer {
  return new Float64Array([duration]).buffer;
}

async function flush(n = 6): Promise<void> {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
}

const ctxState = (o: Partial<MusicContextState> = {}): MusicContextState => ({
  combat: false,
  finalSilence: false,
  end: null,
  credits: false,
  ...o,
});
const run = (o: Partial<AudioProbe> = {}): AudioProbe => ({ ...EMPTY_PROBE, phase: 'run', ...o });

// ─── Table contexte → morceau ────────────────────────────────────────────────

describe('audio enregistré : contexte → morceau', () => {
  it('chaque contexte du jeu a son morceau (prise t1)', () => {
    const cases: [AudioProbe, Partial<MusicContextState>, MusicContext, string][] = [
      [{ ...EMPTY_PROBE, phase: 'title' }, {}, 'title', 'ost.01-prise-de-poste'],
      [{ ...EMPTY_PROBE, phase: 'hub', shift: 'matin' }, {}, 'hubDay', 'ost.02-occ-jour'],
      [{ ...EMPTY_PROBE, phase: 'hub', shift: 'apres-midi' }, {}, 'hubDay', 'ost.02-occ-jour'],
      [{ ...EMPTY_PROBE, phase: 'hub', shift: 'nuit' }, {}, 'hubNight', 'ost.03-occ-nuit'],
      [run(), {}, 'quaisExplore', 'ost.04-quais-exploration'],
      [run(), { combat: true }, 'quaisCombat', 'ost.05-quais-combat'],
      [run({ roomType: 'repos' }), { combat: true }, 'quaisExplore', 'ost.04-quais-exploration'],
      [run({ biome: 1 }), { combat: true }, 'passerelle', 'ost.06-passerelle'],
      [run({ biome: 1, roomType: 'gardee' }), {}, 'passerelle', 'ost.06-passerelle'],
      [run({ biome: 2 }), {}, 'hallBag', 'ost.07-hall-bag'],
      [run({ roomType: 'boss' }), {}, 'bossAuditeur', 'ost.08-boss-auditeur'],
      [run({ biome: 1, roomType: 'boss' }), {}, 'bossInvite', 'ost.09-boss-invite'],
      [run({ biome: 2, roomType: 'gardee' }), {}, 'bossDiscosaure', 'ost.10-boss-discosaure'],
      [run({ biome: 2, roomType: 'boss' }), {}, 'bossLurcke', 'ost.11-boss-lurcke'],
      [
        { ...EMPTY_PROBE, phase: 'results' },
        { end: 'victoire' },
        'victory',
        'ost.12-departs-victoire',
      ],
      [{ ...EMPTY_PROBE, phase: 'results' }, { end: 'mort' }, 'defeat', 'ost.13-departs-supprime'],
      [{ ...EMPTY_PROBE, phase: 'hub' }, { credits: true }, 'credits', 'ost.14-le-7h12'],
    ];
    for (const [probe, s, ctx, id] of cases) {
      const got = musicContextOf(probe, ctxState(s));
      expect(got, `${probe.phase}/${probe.roomType}/${String(probe.biome)}`).toBe(ctx);
      if (got !== 'silence') expect(TRACKS[got].id).toBe(id);
    }
  });

  it('coup final de Lurcke : silence total, levé à la fin du Shift', () => {
    const boss = run({ biome: 2, roomType: 'boss' });
    expect(musicContextOf(boss, ctxState({ finalSilence: true }))).toBe('silence');
    expect(
      musicContextOf(
        { ...boss, phase: 'results' },
        ctxState({ finalSilence: true, end: 'victoire' }),
      ),
    ).toBe('victory');
  });

  it('les 14 fichiers existent, en WebM/Opus, et bouclent avant leur fin réelle', () => {
    expect(Object.keys(MUSIC_FILES)).toHaveLength(14);
    for (const t of Object.values(TRACKS)) {
      const path = `public/audio/${t.file}`;
      expect(existsSync(path), path).toBe(true);
      expect(t.file.endsWith('.webm')).toBe(true);
      expect(t.loopEnd).toBeLessThanOrEqual(t.duration);
      expect(t.loopEnd - t.loopStart).toBeGreaterThan(LOOP_CROSSFADE * 3);
    }
    // Poids raisonnable : ≈ 96 kb/s en VBR (conteneur compris), rien d'aberrant.
    const all = Object.values(MUSIC_FILES);
    const bytes = all.reduce((n, m) => n + m.bytes, 0);
    const secs = all.reduce((n, m) => n + m.duration, 0);
    expect((bytes * 8) / secs).toBeLessThan(110_000);
    for (const m of all) expect((m.bytes * 8) / m.duration).toBeLessThan(140_000);
  });

  it('boucle : le fondu enchaîné se termine au point de bouclage mesuré', () => {
    const t = TRACKS.quaisCombat;
    const at = nextLoopAt(t, 10, 0);
    expect(at).toBeCloseTo(10 + t.loopEnd - LOOP_CROSSFADE, 6);
    const v = TRACKS.victory;
    // Victoire : reprise après le stinger de 6 s.
    expect(nextLoopAt(v, 0, v.loopStart)).toBeCloseTo(v.loopEnd - v.loopStart - LOOP_CROSSFADE, 6);
    expect(nextLoopAt(TRACKS.defeat, 0, 0)).toBeNull();
  });

  it('couches de combat : un passe-bas et un gain sur le morceau unique', () => {
    const explore = reactiveMix(TRACKS.passerelle, 0);
    const full = reactiveMix(TRACKS.passerelle, 1);
    expect(explore.cutoff).toBeLessThan(1000);
    expect(explore.gain).toBeLessThan(full.gain);
    expect(full.cutoff).toBeGreaterThan(15000);
    // Boss : la musique reste haute même sans ennemi.
    expect(reactiveMix(TRACKS.bossAuditeur, 0).cutoff).toBeGreaterThan(5000);
    expect(reactiveMix(TRACKS.hubDay, 0)).toEqual({ cutoff: 20000, gain: 1 });
  });

  it('chargement paresseux : hub et biome 1 d’abord, biome suivant depuis la Salle des pauses', () => {
    const files = (groups: ReturnType<typeof groupsFor>): string[] =>
      tracksOfGroups(groups).map((t) => t.id);
    const hub = files(groupsFor('hubDay', { ...EMPTY_PROBE, phase: 'hub' }));
    expect(hub).toEqual(
      expect.arrayContaining(['ost.02-occ-jour', 'ost.03-occ-nuit', 'ost.04-quais-exploration']),
    );
    expect(hub).not.toContain('ost.06-passerelle');
    const b1 = files(groupsFor('quaisCombat', run()));
    expect(b1).toContain('ost.08-boss-auditeur');
    expect(b1).not.toContain('ost.09-boss-invite');
    expect(files(groupsFor('quaisExplore', run({ roomType: 'repos' })))).toContain(
      'ost.09-boss-invite',
    );
    expect(files(groupsFor('hallBag', run({ biome: 2 })))).toContain('ost.11-boss-lurcke');
  });
});

// ─── Dialogues ───────────────────────────────────────────────────────────────

describe('audio enregistré : sélection des répliques', () => {
  it('les répliques affichées par le jeu retrouvent leur enregistrement', () => {
    const b1 = BIOMES[1].boss;
    const b2 = BIOMES[2].boss;
    expect(lineIdFor(b1.intro.text)).toBe('vo.invite.boss.01');
    expect(lineIdFor(b1.defeat[1]?.text ?? '')).toBe('vo.invite.boss.12');
    expect(lineIdFor(b1.defeat[2]?.text ?? '')).toBe('vo.invite.boss.13');
    expect(lineIdFor(PHASE_LINES.dirupo?.[0]?.text ?? '')).toBe('vo.invite.boss.04');
    expect(lineIdFor(PHASE_LINES.dirupo?.[1]?.text ?? '')).toBe('vo.invite.boss.05');
    expect(lineIdFor('Une concertation ? Excellente idée. Je note… je note.')).toBe(
      'vo.invite.boss.11',
    );
    expect(lineIdFor(b2.intro.text)).toBe('vo.lurcke.boss.01');
    expect(lineIdFor(PHASE_LINES.lurcke?.[0]?.text ?? '')).toBe('vo.lurcke.boss.14');
    expect(lineIdFor(b2.defeat[0]?.text ?? '')).toBe('vo.lurcke.boss.20');
    expect(lineIdFor(b2.defeat[1]?.text ?? '')).toBe('vo.lurcke.boss.21');
    expect(lineIdFor('Mais concrètement, sur le terrain, ça donne quoi ?')).toBe(
      'vo.leon.boss.question',
    );
    expect(lineIdFor('Article 47, alinéa 3 : préavis de sept jours.')).toBe(
      'vo.leon.boss.article47',
    );
    const y = NPC_LINES.yasmina;
    expect(lineIdFor(y.generic[0] ?? '')).toBe('vo.yasmina.hub.01');
    expect(lineIdFor(y.death)).toBe('vo.yasmina.hub.02');
    expect(lineIdFor(y.victory)).toBe('vo.yasmina.hub.03');
    // Personnages pas encore doublés : texte seul.
    expect(lineIdFor(BIOMES[0].boss.intro.text)).toBeNull();
    expect(lineIdFor(NPC_LINES.kevin.death)).toBeNull();
  });

  it('chaque réplique enregistrée a son fichier ; les 6 manquantes de Lurcke restent muettes', () => {
    const missing = VOICE_FILES.filter((l) => !l.file).map((l) => l.id);
    expect(missing).toEqual([
      'vo.lurcke.boss.10',
      'vo.lurcke.boss.15',
      'vo.lurcke.boss.16',
      'vo.lurcke.boss.17',
      'vo.lurcke.boss.18',
      'vo.lurcke.boss.20',
    ]);
    for (const l of VOICE_FILES) {
      if (l.file) expect(existsSync(`public/audio/${l.file}`), l.file).toBe(true);
      expect(l.subtitle).not.toMatch(/\[/);
    }
    expect(VOICE_LINES.get('vo.invite.boss.01')?.fictive).toBe(true);
    const total = VOICE_FILES.reduce(
      (s, l) => s + (l.file ? statSync(`public/audio/${l.file}`).size : 0),
      0,
    );
    expect(total).toBeLessThan(4e6);
  });

  it('efforts et barks : coups, dash, douleurs, radio', () => {
    const c = { kindOf: () => undefined, boss: null, maxEnergy: 100, roomType: 'combat' };
    const ids = (e: SimEvent): string[] => voiceCuesFor(e, c).map((x) => x.id);
    const swing = (combo: number, finisher = false): SimEvent => ({
      type: 'swing',
      combo,
      finisher,
      dashAttack: false,
      x: 0,
      y: 0,
      angle: 0,
      reach: 1,
      arcDeg: 90,
    });
    expect(ids(swing(1))).toEqual(['vo.leon.effort.coup1']);
    expect(ids(swing(2))).toEqual(['vo.leon.effort.coup2']);
    expect(ids(swing(3, true))).toEqual(['vo.leon.effort.coup3']);
    expect(ids({ type: 'dash', x: 0, y: 0, angle: 0 })).toEqual(['vo.leon.effort.dash']);
    expect(ids({ type: 'heroHurt', x: 0, y: 0, amount: 5, angle: 0 })).toEqual([
      'vo.leon.douleur.legere',
    ]);
    expect(ids({ type: 'heroHurt', x: 0, y: 0, amount: 30, angle: 0 })).toEqual([
      'vo.leon.douleur.lourde',
    ]);
    expect(ids({ type: 'biomeEntered', biome: 1, name: '', tagline: '' })).toEqual([
      'vo.yasmina.radio.03',
    ]);
    expect(ids({ type: 'shiftEnded', end: 'victoire' })).toEqual(['vo.yasmina.radio.08']);
    const probe = {
      roomType: 'combat',
      energy: 0.5,
      burnoutTier: 0,
      meltdown: false,
      gobelets: 1,
      heroState: 'idle',
      mobilisation: 0,
      choiceFamilies: [],
    };
    expect(
      voiceCuesFromProbe(probe, { ...probe, energy: 0.2, gobelets: 0 }).map((x) => x.id),
    ).toEqual(['vo.leon.bark.energie', 'vo.yasmina.radio.07']);
  });
});

/** Lecteur factice : chaque réplique dure `dur` s ; `absent` : pas de fichier décodé. */
function fakeOut(
  dur = 1,
  absent: readonly string[] = [],
): VoiceOut & {
  played: [string, VoiceKind][];
  stopped: string[];
} {
  const played: [string, VoiceKind][] = [];
  const stopped: string[] = [];
  return {
    played,
    stopped,
    ready: (id) => (VOICE_LINES.get(id)?.file ?? null) !== null && !absent.includes(id),
    play: (id, kind) => {
      played.push([id, kind]);
      return dur;
    },
    stop: (v) => {
      stopped.push(v);
    },
  };
}

describe('audio enregistré : ordonnancement des voix', () => {
  const effort = (id: string, cooldown?: number): VoiceCue => ({
    id,
    kind: 'effort',
    ...(cooldown ? { cooldown } : {}),
  });

  it('une voix ne se chevauche pas ; délai de récupération sur les efforts fréquents', () => {
    const out = fakeOut(0.5);
    const s = new VoiceScheduler(out);
    expect(s.request(effort('vo.leon.effort.coup1', 2), 0)).toBe(true);
    expect(s.request(effort('vo.leon.effort.dash'), 0.2)).toBe(false); // Léon parle encore
    expect(s.request(effort('vo.leon.effort.coup1', 2), 1)).toBe(false); // délai
    expect(s.request(effort('vo.leon.effort.coup1', 2), 2.1)).toBe(true);
    // « Réduire les sons répétitifs » double les délais.
    s.cooldownScale = 2;
    expect(s.request(effort('vo.leon.effort.dash', 3), 3)).toBe(true);
    expect(s.request(effort('vo.leon.effort.dash', 3), 7)).toBe(false);
    expect(s.request(effort('vo.leon.effort.dash', 3), 9.1)).toBe(true);
  });

  it('réplique absente ou pas encore décodée : silencieuse (le sous-titre du jeu reste)', () => {
    const out = fakeOut(1, ['vo.invite.boss.01']);
    const s = new VoiceScheduler(out);
    expect(s.request({ id: 'vo.lurcke.boss.20', kind: 'line' }, 0)).toBe(false);
    expect(s.request({ id: 'vo.invite.boss.01', kind: 'line' }, 0)).toBe(false);
    expect(s.request({ id: 'vo.inconnu', kind: 'line' }, 0)).toBe(false);
    s.update(0, { bossTelegraph: false });
    expect(out.played).toEqual([]);
  });

  it('canal de dialogue : les répliques passent avant les barks, l’une après l’autre', () => {
    const out = fakeOut(2);
    const s = new VoiceScheduler(out);
    s.request({ id: 'vo.leon.bark.salle', kind: 'bark' }, 0);
    s.request({ id: 'vo.invite.boss.12', kind: 'line' }, 0);
    s.update(0, { bossTelegraph: false });
    expect(out.played.map((p) => p[0])).toEqual(['vo.invite.boss.12']);
    s.update(1, { bossTelegraph: false });
    expect(out.played).toHaveLength(1);
    // Le bark a expiré pendant la réplique (2,5 s d'attente au plus).
    s.update(2.3, { bossTelegraph: false });
    expect(out.played.map((p) => p[0])).toEqual(['vo.invite.boss.12', 'vo.leon.bark.salle']);
    expect(s.dialogueActive(2.5)).toBe(true);
  });

  it('une réplique de Léon coupe son propre effort', () => {
    const out = fakeOut(1);
    const s = new VoiceScheduler(out);
    s.request(effort('vo.leon.effort.coup3'), 0);
    s.request({ id: 'vo.leon.boss.question', kind: 'line' }, 0.1);
    s.update(0.1, { bossTelegraph: false });
    expect(out.stopped).toEqual(['leon']);
    expect(out.played.at(-1)?.[0]).toBe('vo.leon.boss.question');
  });

  it('radio : jamais pendant un télégraphe de boss, une ligne secondaire toutes les 3 salles', () => {
    const out = fakeOut(1);
    const s = new VoiceScheduler(out);
    expect(s.request({ id: 'vo.yasmina.radio.05', kind: 'radio', important: true }, 0)).toBe(true);
    s.update(0, { bossTelegraph: true });
    expect(out.played).toEqual([]);
    s.update(0.5, { bossTelegraph: false });
    expect(out.played.map((p) => p[0])).toEqual(['vo.yasmina.radio.05']);
    // Secondaire juste après : refusée tant que 3 salles ne sont pas passées.
    expect(s.request({ id: 'vo.yasmina.radio.07', kind: 'radio' }, 5)).toBe(false);
    s.roomEntered();
    s.roomEntered();
    s.roomEntered();
    expect(s.request({ id: 'vo.yasmina.radio.07', kind: 'radio' }, 6)).toBe(true);
  });

  it('une fois par Shift', () => {
    const s = new VoiceScheduler(fakeOut(0.1));
    const cue: VoiceCue = { id: 'vo.leon.bark.petage', kind: 'bark', once: true };
    expect(s.request(cue, 0)).toBe(true);
    expect(s.request(cue, 50)).toBe(false);
    s.resetRun();
    expect(s.request(cue, 60)).toBe(true);
  });
});

// ─── Chargeur et repli ───────────────────────────────────────────────────────

describe('audio enregistré : chargeur et repli sur la synthèse', () => {
  it('désactivé (?procedural) : rien n’est demandé', async () => {
    const asked: string[] = [];
    const bank = new SampleBank({
      baseUrl: 'audio/',
      enabled: false,
      fetchBytes: (u) => {
        asked.push(u);
        return Promise.resolve(fakeBytes(1));
      },
    });
    bank.attach(new Ctx() as unknown as BaseAudioContext);
    bank.request('music/a.webm', 'music');
    await flush();
    expect(asked).toEqual([]);
    expect(bank.get('music/a.webm')).toBeNull();
  });

  it('rien avant le déverrouillage ; puis fetch, décodage, cache', async () => {
    const asked: string[] = [];
    const bank = new SampleBank({
      baseUrl: 'audio/',
      enabled: true,
      fetchBytes: (u) => {
        asked.push(u);
        return Promise.resolve(fakeBytes(2));
      },
    });
    bank.request('vo/leon/leon.ko.webm', 'voice');
    await flush();
    expect(asked).toEqual([]);
    bank.attach(new Ctx() as unknown as BaseAudioContext);
    await flush();
    expect(asked).toEqual(['audio/vo/leon/leon.ko.webm']);
    expect(bank.status('vo/leon/leon.ko.webm')).toBe('ready');
    expect(bank.get('vo/leon/leon.ko.webm')?.duration).toBe(2);
    bank.request('vo/leon/leon.ko.webm', 'voice');
    await flush();
    expect(asked).toHaveLength(1);
  });

  it('le morceau du contexte courant passe devant la file', async () => {
    const asked: string[] = [];
    const bank = new SampleBank({
      baseUrl: '',
      enabled: true,
      fetchBytes: (u) => {
        asked.push(u);
        return new Promise<ArrayBuffer>(() => undefined); // téléchargements en cours
      },
    });
    bank.attach(new Ctx() as unknown as BaseAudioContext);
    for (const f of ['a', 'b', 'c', 'd']) bank.request(f, 'music');
    bank.request('d', 'music', true);
    await flush();
    expect(asked).toEqual(['a', 'b']);
    // « d » est en tête : il partira dès qu'un téléchargement se libère.
    expect(bank.status('d')).toBe('loading');
    expect((bank as unknown as { queue: { file: string }[] }).queue.map((e) => e.file)).toEqual([
      'd',
      'c',
    ]);
  });

  it('échec (hors ligne, format refusé) : entrée en échec, pas de nouvel essai', async () => {
    const warnings: string[] = [];
    let calls = 0;
    const bank = new SampleBank({
      baseUrl: '',
      enabled: true,
      fetchBytes: () => {
        calls += 1;
        return Promise.reject(new Error('hors ligne'));
      },
      warn: (m) => warnings.push(m),
    });
    bank.attach(new Ctx() as unknown as BaseAudioContext);
    bank.request('music/x.webm', 'music');
    await flush();
    expect(bank.status('music/x.webm')).toBe('failed');
    expect(bank.get('music/x.webm')).toBeNull();
    bank.request('music/x.webm', 'music');
    await flush();
    expect(calls).toBe(1);
    expect(warnings).toHaveLength(1);
  });

  it('mémoire : au-delà du budget, les morceaux décodés les plus anciens sont libérés', async () => {
    let calls = 0;
    const bank = new SampleBank({
      baseUrl: '',
      enabled: true,
      fetchBytes: () => {
        calls += 1;
        return Promise.resolve(fakeBytes(MUSIC_DECODED_BUDGET / 3));
      },
    });
    bank.attach(new Ctx() as unknown as BaseAudioContext);
    for (const f of ['a', 'b', 'c', 'd']) {
      bank.request(f, 'music');
      await flush();
    }
    expect(bank.decodedCount).toBe(3);
    expect(bank.get('a')).toBeNull();
    // Retour sur « a » : redécodé depuis les octets gardés, sans réseau.
    bank.request('a', 'music');
    await flush();
    expect(bank.get('a')).not.toBeNull();
    expect(calls).toBe(4);
  });
});

describe('audio enregistré : directeur', () => {
  async function director(
    opts: { fail?: boolean; decodeFails?: boolean; stream?: boolean } = {},
  ): Promise<{
    d: AudioDirector;
    ctx: Ctx;
    asked: string[];
  }> {
    const asked: string[] = [];
    const box: { ctx: Ctx | null } = { ctx: null };
    const d = new AudioDirector({
      random: () => 0.5,
      createContext: () => {
        const made = new Ctx();
        box.ctx = made;
        made.decodeFails = opts.decodeFails ?? false;
        return made as unknown as AudioContext;
      },
      samples: {
        baseUrl: 'audio/',
        enabled: true,
        createMedia: opts.stream ? () => new FakeMedia() : null,
        fetchBytes: (u) => {
          asked.push(u);
          if (opts.fail) return Promise.reject(new Error('hors ligne'));
          const music = Object.values(MUSIC_FILES).find((m) => u.endsWith(m.file));
          return Promise.resolve(fakeBytes(music?.duration ?? 1.5));
        },
      },
    });
    d.engine.unlock();
    await flush();
    if (!box.ctx) throw new Error('pas de contexte');
    return { d, ctx: box.ctx, asked };
  }

  it('synthèse tant que le morceau n’est pas décodé, puis fondu vers l’OST', async () => {
    const { d, ctx, asked } = await director();
    const hub: AudioProbe = { ...EMPTY_PROBE, phase: 'hub' };
    d.frame([], hub);
    expect(d.musicContext).toBe('hubDay');
    // Au déverrouillage, le thème titre est parti ; le morceau du hub passe devant le reste.
    // Ordre : thème titre (déjà parti au déverrouillage), puis le morceau du hub passe devant les
    // autres morceaux du lot (les voix, légères, sont intercalées).
    await flush(40);
    expect(asked[0]).toBe('audio/music/01-prise-de-poste.webm');
    const music = asked.filter((u) => u.includes('/music/'));
    expect(music.slice(0, 2)).toEqual([
      'audio/music/01-prise-de-poste.webm',
      'audio/music/02-occ-jour.webm',
    ]);
    expect(asked.some((u) => u.includes('06-passerelle'))).toBe(false);
    for (let i = 0; i < 30; i += 1) await flush();
    ctx.currentTime += 0.1;
    d.frame([], hub);
    expect(d.trackPlaying).toBe('ost.02-occ-jour');
    expect(d.music.musicMuted).toBe(true);
    // La boucle repart avant la fin réelle, sans coupure.
    const t = TRACKS.hubDay;
    ctx.currentTime += t.loopEnd - LOOP_CROSSFADE - 0.3;
    d.frame([], hub);
    const hubSources = ctx.sources.filter((s) => (s.buffer as FakeBuffer).duration === t.duration);
    expect(hubSources.length).toBeGreaterThanOrEqual(2);
    d.dispose();
  });

  it('hors ligne : la synthèse reste, aucune erreur', async () => {
    const { d } = await director({ fail: true });
    for (let i = 0; i < 5; i += 1) {
      d.frame([], { ...EMPTY_PROBE, phase: 'hub' });
      await flush(10);
    }
    expect(d.trackPlaying).toBeNull();
    expect(d.music.musicMuted).toBe(false);
    expect(d.music.mode).toBe('hub');
    d.dispose();
  });

  it('format non décodable (Safari ancien) : synthèse', async () => {
    const { d } = await director({ decodeFails: true });
    for (let i = 0; i < 5; i += 1) {
      d.frame([], run());
      await flush(10);
    }
    expect(d.trackPlaying).toBeNull();
    expect(d.music.musicMuted).toBe(false);
    d.dispose();
  });

  it('coup final de Lurcke : silence, puis musique des départs', async () => {
    const { d, ctx } = await director();
    const boss = run({ biome: 2, roomType: 'boss', enemies: [] });
    d.frame([], boss);
    for (let i = 0; i < 40; i += 1) await flush();
    ctx.currentTime += 0.1;
    d.frame([], boss);
    expect(d.trackPlaying).toBe('ost.11-boss-lurcke');
    d.frame([{ type: 'fx', name: 'finalBlow', x: 0, y: 0 }], boss);
    expect(d.musicContext).toBe('silence');
    expect(d.trackPlaying).toBeNull();
    expect(d.music.mode).toBe('off');
    d.frame([], boss);
    expect(d.musicContext).toBe('silence');
    d.frame([], { ...boss, phase: 'results', result: 'victoire' });
    expect(d.musicContext).toBe('victory');
    d.dispose();
  });

  it('réplique de boss : voix jouée, sous-titre du catalogue, musique baissée', async () => {
    const { d, ctx } = await director();
    const probe = run({ biome: 1, roomType: 'boss' });
    d.frame([], probe);
    for (let i = 0; i < 80; i += 1) await flush();
    const line = BIOMES[1].boss.defeat[1];
    if (!line) throw new Error('réplique absente');
    ctx.currentTime += 0.1;
    d.frame([{ type: 'bossLine', ...line }], probe);
    expect(d.voices.log).toContain('vo.invite.boss.12');
    expect(d.subtitleFor(line.text)).toBe('… On m’avait parlé d’une inauguration.');
    // Réplique de Lurcke manquante : rien ne joue, le texte du jeu reste.
    const missing = BIOMES[2].boss.defeat[0];
    if (!missing) throw new Error('réplique absente');
    d.frame([{ type: 'bossLine', ...missing }], probe);
    expect(d.subtitleFor(missing.text)).toBe(missing.text);
    d.dispose();
  });
});

describe('audio enregistré : OST en streaming', () => {
  async function streamed(): Promise<{ d: AudioDirector; ctx: Ctx }> {
    FakeMedia.all = [];
    FakeMedia.refuse = false;
    const box: { ctx: Ctx | null } = { ctx: null };
    const d = new AudioDirector({
      random: () => 0.5,
      createContext: () => {
        const made = new Ctx();
        box.ctx = made;
        return made as unknown as AudioContext;
      },
      samples: {
        baseUrl: 'audio/',
        enabled: true,
        createMedia: () => new FakeMedia(),
        fetchBytes: () => Promise.resolve(fakeBytes(1.5)),
      },
    });
    d.engine.unlock();
    await flush();
    if (!box.ctx) throw new Error('pas de contexte');
    return { d, ctx: box.ctx };
  }
  const media = (file: string): FakeMedia[] => FakeMedia.all.filter((m) => m.src.endsWith(file));

  it('aucun morceau décodé : élément préchargé, branché, joué après le geste', async () => {
    const { d } = await streamed();
    const hub: AudioProbe = { ...EMPTY_PROBE, phase: 'hub' };
    d.frame([], hub);
    const [el] = media('music/02-occ-jour.webm');
    if (!el) throw new Error('élément absent');
    expect(el.preload).toBe('auto');
    // Pas encore prêt : synthèse.
    expect(d.trackPlaying).toBeNull();
    expect(d.music.musicMuted).toBe(false);
    el.fire('canplaythrough');
    d.frame([], hub);
    expect(d.trackPlaying).toBe('ost.02-occ-jour');
    expect(el.paused).toBe(false);
    expect(d.music.musicMuted).toBe(true);
    // Seules les voix sont décodées ; la musique n'a aucun PCM en mémoire.
    for (let i = 0; i < 60; i += 1) await flush();
    const voicePcm = d.musicMemory.pcmMo;
    expect(voicePcm).toBeLessThan(60);
    expect(d.samples.status('music/02-occ-jour.webm')).toBe('idle');
    d.dispose();
  });

  it('boucle : deux éléments alternés en fondu enchaîné au point de bouclage', async () => {
    const { d, ctx } = await streamed();
    const hub: AudioProbe = { ...EMPTY_PROBE, phase: 'hub' };
    d.frame([], hub);
    const [a] = media('music/02-occ-jour.webm');
    a?.fire('canplaythrough');
    d.frame([], hub);
    const both = media('music/02-occ-jour.webm');
    expect(both).toHaveLength(2);
    const [, b] = both;
    if (!a || !b) throw new Error('éléments absents');
    expect(b.paused).toBe(true);
    a.currentTime = TRACKS.hubDay.loopEnd - LOOP_CROSSFADE + 0.05;
    ctx.currentTime += 1;
    d.frame([], hub);
    expect(b.paused).toBe(false);
    expect(b.currentTime).toBe(TRACKS.hubDay.loopStart);
    // Fin du fondu : l'ancien élément s'arrête.
    ctx.currentTime += LOOP_CROSSFADE + 0.1;
    d.frame([], hub);
    expect(a.paused).toBe(true);
    d.dispose();
  });

  it('lecture refusée (autoplay) : retour à la synthèse', async () => {
    const { d } = await streamed();
    FakeMedia.refuse = true;
    const hub: AudioProbe = { ...EMPTY_PROBE, phase: 'hub' };
    d.frame([], hub);
    media('music/02-occ-jour.webm')[0]?.fire('canplaythrough');
    d.frame([], hub);
    await flush();
    d.frame([], hub);
    expect(d.trackPlaying).toBeNull();
    expect(d.music.musicMuted).toBe(false);
    d.dispose();
  });

  it('erreur de chargement : synthèse ; coup final : silence', async () => {
    const { d } = await streamed();
    const boss = run({ biome: 2, roomType: 'boss' });
    d.frame([], boss);
    media('music/11-boss-lurcke.webm')[0]?.fire('error');
    d.frame([], boss);
    expect(d.trackPlaying).toBeNull();
    expect(d.music.mode).toBe('boss');
    d.frame([{ type: 'fx', name: 'finalBlow', x: 0, y: 0 }], boss);
    expect(d.music.mode).toBe('off');
    d.dispose();
  });

  it('onglet caché : les éléments s’arrêtent, reprise au retour', async () => {
    const { d } = await streamed();
    const hub: AudioProbe = { ...EMPTY_PROBE, phase: 'hub' };
    d.frame([], hub);
    const [el] = media('music/02-occ-jour.webm');
    el?.fire('canplaythrough');
    d.frame([], hub);
    d.setHidden(true);
    expect(el?.paused).toBe(true);
    d.setHidden(false);
    expect(el?.paused).toBe(false);
    d.dispose();
  });
});

describe('audio enregistré : PNJ du hub (Marcel, Josiane, Béné)', () => {
  it('leurs bulles retrouvent leur enregistrement', () => {
    const m = NPC_LINES.marcel;
    expect(lineIdFor(m.generic[0] ?? '')).toBe('vo.marcel.hub.01');
    expect(lineIdFor(m.generic[1] ?? '')).toBe('vo.marcel.hub.02');
    expect(lineIdFor(m.death)).toBe('vo.marcel.hub.03');
    expect(lineIdFor(m.victory)).toBe('vo.marcel.hub.04');
    const j = NPC_LINES.josiane;
    expect(lineIdFor(j.generic[0] ?? '')).toBe('vo.josiane.hub.01');
    expect(lineIdFor(j.generic[1] ?? '')).toBe('vo.josiane.hub.02');
    expect(lineIdFor(j.death)).toBe('vo.josiane.hub.03');
    expect(lineIdFor(j.victory)).toBe('vo.josiane.hub.04');
    const b = NPC_LINES.bene;
    expect(lineIdFor(b.generic[0] ?? '')).toBe('vo.bene.hub.01');
    expect(lineIdFor(b.generic[1] ?? '')).toBe('vo.bene.hub.02');
    expect(lineIdFor(b.death)).toBe('vo.bene.hub.03');
    expect(lineIdFor(b.victory)).toBe('vo.bene.hub.04');
    // Radio de Marcel après la défaite de l'Invité d'honneur.
    expect(lineIdFor(BIOMES[1].boss.defeat[3]?.text ?? '')).toBe('vo.marcel.radio.01');
    // Encore sans voix : Fatou, Kevin, Rudy.
    expect(lineIdFor(NPC_LINES.fatou.death)).toBeNull();
    for (const v of ['marcel', 'josiane', 'bene'])
      expect(VOICE_FILES.filter((l) => l.voice === v).every((l) => l.file !== null)).toBe(true);
  });

  it('Avantage d’un collègue proposé : sa radio', () => {
    const probe = {
      roomType: 'combat',
      energy: 1,
      burnoutTier: 0,
      meltdown: false,
      gobelets: 1,
      heroState: 'idle',
      mobilisation: 0,
      choiceFamilies: [] as number[],
    };
    const ids = (families: number[]): string[] =>
      voiceCuesFromProbe(probe, { ...probe, choiceFamilies: families }).map((c) => c.id);
    expect(ids([FAMILIES.marcel.color, FAMILIES.rudy.color])).toEqual(['vo.marcel.radio.02']);
    expect(ids([FAMILIES.bene.color])).toEqual(['vo.bene.radio.01']);
    expect(ids([FAMILIES.josiane.color])).toEqual(['vo.josiane.radio.02']);
    expect(ids([FAMILIES.kevin.color])).toEqual([]);
  });

  it('le hub fait dire la bulle et affiche le texte enregistré', async () => {
    const box: { ctx: Ctx | null } = { ctx: null };
    const d = new AudioDirector({
      createContext: () => {
        box.ctx = new Ctx();
        return box.ctx as unknown as AudioContext;
      },
      samples: {
        baseUrl: '',
        enabled: true,
        createMedia: null,
        fetchBytes: () => Promise.resolve(fakeBytes(1)),
      },
    });
    d.engine.unlock();
    await flush();
    d.frame([], { ...EMPTY_PROBE, phase: 'hub' });
    for (let i = 0; i < 200; i += 1) await flush();
    const text = NPC_LINES.bene.victory;
    expect(d.say(text)).toBe(
      'J’ai archivé ta victoire. Classement : rare. Sous-classement : à renouveler.',
    );
    d.frame([], { ...EMPTY_PROBE, phase: 'hub' });
    expect(d.voices.log).toContain('vo.bene.hub.04');
    expect(d.say(NPC_LINES.fatou.death)).toBe(NPC_LINES.fatou.death);
    d.dispose();
  });
});
