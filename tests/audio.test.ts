import { describe, expect, it } from 'vitest';
import { AudioDirector } from '@/audio/AudioDirector';
import {
  AUDIO_SETTINGS_KEY,
  AudioEngine,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  MAX_VOICES,
  spatialize,
} from '@/audio/AudioEngine';
import { MusicDirector } from '@/audio/music';
import type { MusicMode } from '@/audio/music';
import type { AudioProbe } from '@/audio/router';
import { combatIntensity, diffProbe, EMPTY_PROBE, materialFor, routeEvent } from '@/audio/router';
import { lootSfx, SFX, SFX_IDS } from '@/audio/sfx';
import type { SimEvent } from '@/sim/events';
import type { KeyValueStorage } from '@/systems/save/SaveManager';

// ─── AudioContext simulé (Node n'a pas de Web Audio) ─────────────────────────

class MockParam {
  public value = 0;
  public events = 0;
  public setValueAtTime(v: number): this {
    this.value = v;
    this.events += 1;
    return this;
  }
  public linearRampToValueAtTime(v: number): this {
    this.value = v;
    this.events += 1;
    return this;
  }
  public exponentialRampToValueAtTime(v: number): this {
    if (v <= 0) throw new RangeError('rampe exponentielle vers 0');
    this.value = v;
    this.events += 1;
    return this;
  }
  public setTargetAtTime(v: number): this {
    this.value = v;
    this.events += 1;
    return this;
  }
  public cancelScheduledValues(): this {
    return this;
  }
}

class MockNode {
  public outputs: MockNode[] = [];
  public constructor(public readonly ctx: MockContext) {
    ctx.nodes += 1;
  }
  public connect<T>(n: T): T {
    this.outputs.push(n as unknown as MockNode);
    return n;
  }
  public disconnect(): void {
    this.outputs = [];
  }
}

class MockGain extends MockNode {
  public gain = new MockParam();
  public constructor(ctx: MockContext) {
    super(ctx);
    this.gain.value = 1;
  }
}

class MockSource extends MockNode {
  public started = -1;
  public stopped = -1;
  public start(t = 0): void {
    if (this.started >= 0) throw new Error('start() appelé deux fois');
    this.started = t;
  }
  public stop(t = 0): void {
    if (this.started < 0) throw new Error('stop() avant start()');
    this.stopped = t;
  }
}

class MockOsc extends MockSource {
  public type = 'sine';
  public frequency = new MockParam();
  public detune = new MockParam();
}

class MockBufferSource extends MockSource {
  public buffer: unknown = null;
  public loop = false;
  public playbackRate = new MockParam();
}

class MockFilter extends MockNode {
  public type = 'lowpass';
  public frequency = new MockParam();
  public Q = new MockParam();
}

class MockComp extends MockNode {
  public threshold = new MockParam();
  public knee = new MockParam();
  public ratio = new MockParam();
  public attack = new MockParam();
  public release = new MockParam();
}

class MockPanner extends MockNode {
  public pan = new MockParam();
}

class MockContext {
  public currentTime = 0;
  public sampleRate = 8000;
  public state: 'suspended' | 'running' | 'closed' = 'suspended';
  public nodes = 0;
  public readonly destination: MockNode;
  public constructor() {
    this.destination = new MockNode(this);
  }
  public resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  public suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  public close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
  public createGain(): MockGain {
    return new MockGain(this);
  }
  public createOscillator(): MockOsc {
    return new MockOsc(this);
  }
  public createBufferSource(): MockBufferSource {
    return new MockBufferSource(this);
  }
  public createBiquadFilter(): MockFilter {
    return new MockFilter(this);
  }
  public createDynamicsCompressor(): MockComp {
    return new MockComp(this);
  }
  public createStereoPanner(): MockPanner {
    return new MockPanner(this);
  }
  public createBuffer(channels: number, length: number, sampleRate: number): unknown {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, sampleRate, getChannelData: (c: number) => data[c] };
  }
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function engineWith(storage: KeyValueStorage | null = null): {
  engine: AudioEngine;
  ctx: () => MockContext;
} {
  let made: MockContext | null = null;
  const engine = new AudioEngine({
    storage,
    random: () => 0.5,
    createContext: () => {
      made = new MockContext();
      return made as unknown as AudioContext;
    },
  });
  return {
    engine,
    ctx: () => {
      if (!made) throw new Error('contexte pas encore créé');
      return made;
    },
  };
}

async function unlocked(storage: KeyValueStorage | null = null): Promise<{
  engine: AudioEngine;
  ctx: MockContext;
}> {
  const { engine, ctx } = engineWith(storage);
  const target = new EventTarget();
  engine.attachUnlock(target);
  target.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();
  await Promise.resolve();
  return { engine, ctx: ctx() };
}

// ─── Routeur ─────────────────────────────────────────────────────────────────

const kinds = new Map<number, 'consultant' | 'borne' | 'drone' | 'manager' | 'auditeur'>([
  [1, 'consultant'],
  [2, 'borne'],
  [3, 'drone'],
  [4, 'manager'],
  [5, 'auditeur'],
]);
const kindOf = (id: number) => kinds.get(id);
const ids = (e: SimEvent): string[] => routeEvent(e, kindOf).map((c) => c.id);

function swing(combo: number, finisher = false, dashAttack = false): SimEvent {
  return {
    type: 'swing',
    combo,
    finisher,
    dashAttack,
    x: 0,
    y: 0,
    angle: 0,
    reach: 30,
    arcDeg: 90,
  };
}

function hit(id: number, crit = false, heavy = false): SimEvent {
  return { type: 'enemyHit', id, x: 10, y: 0, amount: 5, crit, heavy, angle: 0 };
}

describe('audio : routeur événements → sons', () => {
  it('le combo de la clé a trois coups distincts, plus le coup en dash', () => {
    const combo = [ids(swing(1)), ids(swing(2)), ids(swing(3, true))].flat();
    expect(combo).toEqual(['swing1', 'swing2', 'swing3']);
    expect(new Set(combo).size).toBe(3);
    expect(ids(swing(1, false, true))).toEqual(['swingDash']);
  });

  it("un impact = clé métallique + matière de l'ennemi, critique en plus", () => {
    expect(ids(hit(1))).toEqual(['impact', 'hitPaper']);
    expect(ids(hit(1, false, true))).toEqual(['impact', 'hitLaptop']);
    expect(ids(hit(2))).toEqual(['impact', 'hitMetal']);
    expect(ids(hit(3))).toEqual(['impact', 'hitDrone']);
    expect(ids(hit(4))).toEqual(['impact', 'hitLaptop']);
    expect(ids(hit(5, true))).toEqual(['impact', 'hitBoss', 'crit']);
    expect(materialFor(undefined, false)).toBe('hitPaper');
    const c = routeEvent(hit(1), kindOf)[0];
    expect(c?.x).toBe(10);
  });

  it('capacités, dégâts, mort, salles et fin du Shift', () => {
    expect(ids({ type: 'dash', x: 0, y: 0, angle: 0 })).toEqual(['dash']);
    expect(ids({ type: 'special', kind: 'whistle', x: 0, y: 0, radius: 9 })).toEqual(['whistle']);
    expect(ids({ type: 'special', kind: 'preavis', x: 0, y: 0, radius: 9 })).toEqual(['preavis']);
    expect(ids({ type: 'heroHurt', x: 0, y: 0, amount: 3, angle: 0 })).toEqual(['hurt']);
    expect(ids({ type: 'heroDied', x: 0, y: 0 })).toEqual(['death']);
    expect(ids({ type: 'roomEntered', room: 2, roomType: 'combat' })).toEqual(['chime']);
    expect(ids({ type: 'roomCleared', room: 2 })).toEqual(['doorUnlock']);
    expect(ids({ type: 'doorTaken', room: 2 })).toEqual(['doorTaken']);
    expect(ids({ type: 'shiftEnded', end: 'victoire' })).toEqual(['victory']);
    expect(ids({ type: 'shiftEnded', end: 'mort' })).toEqual([]);
    expect(ids({ type: 'enemyKilled', id: 1, x: 0, y: 0, angle: 0, last: true })).toEqual([
      'kill',
      'lastKill',
    ]);
    expect(ids({ type: 'shake', px: 3, ms: 100 })).toEqual([]);
  });

  it('projectiles, zones et attaques ennemies (borne, drone, manager, Auditeur)', () => {
    expect(ids({ type: 'projectileFired', x: 0, y: 0 })).toEqual(['ticketFire']);
    expect(ids({ type: 'projectileBroken', x: 0, y: 0, by: 'weapon' })).toEqual(['ticketTear']);
    expect(ids({ type: 'projectileBroken', x: 0, y: 0, by: 'hero' })).toEqual([]);
    expect(ids({ type: 'hazardImpact', kind: 'band', x: 0, y: 0, radius: 9 })).toEqual(['train']);
    expect(ids({ type: 'hazardImpact', kind: 'circle', x: 0, y: 0, radius: 9 })).toEqual([
      'hazardThud',
    ]);
    const strike = (attack: string): string[] =>
      ids({ type: 'enemyStrike', id: 5, attack, x: 0, y: 0, angle: 0 });
    expect(strike('chrono')).toEqual(['chrono']);
    expect(strike('barrage')).toEqual(['bossBarrier']);
    expect(strike('stamp')).toEqual(['bossStamp']);
    expect(strike('shot')).toEqual(['droneShot']);
    expect(strike('slam')).toEqual(['slam']);
    expect(strike('inconnue')).toEqual([]);
  });

  it('ramassages et loot par rareté (5 timbres)', () => {
    for (const kind of ['tickets', 'ps', 'grains', 'gobelet', 'cornet', 'avantage'])
      expect(ids({ type: 'pickup', kind, x: 0, y: 0, text: '' })).toHaveLength(1);
    const loot = [0, 1, 2, 3, 4].map(lootSfx);
    expect(new Set(loot).size).toBe(5);
    expect(lootSfx(9)).toBe('loot4');
    expect(lootSfx(-1)).toBe('loot0');
  });
});

describe('audio : instantanés du monde', () => {
  const run: AudioProbe = { ...EMPTY_PROBE, phase: 'run' };

  it('un télégraphe sonne une fois, au début du windup', () => {
    const e = { id: 7, kind: 'consultant' as const, x: 5, y: 5, windup: false };
    const a = { ...run, enemies: [e] };
    const b = { ...run, enemies: [{ ...e, windup: true }] };
    expect(diffProbe(a, b).map((c) => c.id)).toEqual(['telegraph']);
    expect(diffProbe(b, b)).toEqual([]);
    const h = { id: 3, x: 0, y: 0, telegraphing: true };
    expect(diffProbe(run, { ...run, hazards: [h] }).map((c) => c.id)).toEqual(['telegraph']);
    expect(diffProbe({ ...run, hazards: [h] }, { ...run, hazards: [h] })).toEqual([]);
  });

  it('Burnout qui monte, pétage de plombs, café, menus', () => {
    expect(diffProbe(run, { ...run, burnoutTier: 1 }).map((c) => c.id)).toEqual(['burnoutUp']);
    expect(diffProbe({ ...run, burnoutTier: 2 }, { ...run, burnoutTier: 1 })).toEqual([]);
    expect(diffProbe(run, { ...run, burnoutTier: 4, meltdown: true }).map((c) => c.id)).toEqual([
      'meltdown',
    ]);
    const drinking = { ...run, heroState: 'drink', gobelets: 2 };
    expect(diffProbe({ ...run, gobelets: 2 }, drinking).map((c) => c.id)).toEqual(['coffeeCup']);
    expect(diffProbe(drinking, { ...drinking, gobelets: 1 }).map((c) => c.id)).toEqual([
      'coffeeSip',
    ]);
    expect(diffProbe(run, { ...run, menu: 'choice' }).map((c) => c.id)).toEqual(['choice']);
    expect(diffProbe(run, { ...run, menu: 'pause' }).map((c) => c.id)).toEqual(['uiOpen']);
    expect(diffProbe({ ...run, menu: 'pause' }, run)).toEqual([]);
  });

  it("l'intensité monte avec les ennemis et le Burnout", () => {
    const enemy = { id: 1, kind: 'consultant' as const, x: 0, y: 0, windup: false };
    expect(combatIntensity(run)).toBe(0);
    const few = combatIntensity({ ...run, enemies: [enemy] });
    const many = combatIntensity({ ...run, enemies: Array.from({ length: 6 }, () => enemy) });
    const burnt = combatIntensity({
      ...run,
      enemies: Array.from({ length: 6 }, () => enemy),
      burnout: 100,
    });
    expect(few).toBeGreaterThan(0);
    expect(many).toBeGreaterThan(few);
    expect(burnt).toBeGreaterThan(many);
    expect(burnt).toBeLessThanOrEqual(1);
    expect(combatIntensity({ ...run, phase: 'title', enemies: [enemy] })).toBe(0);
  });
});

// ─── Moteur ──────────────────────────────────────────────────────────────────

describe('audio : moteur (AudioContext simulé)', () => {
  it('rien avant le premier geste, puis déverrouillage', async () => {
    const { engine, ctx } = engineWith();
    expect(engine.play('swing1')).toBe(false);
    const target = new EventTarget();
    engine.attachUnlock(target);
    target.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(ctx().state).toBe('running');
    expect(engine.running).toBe(true);
    expect(engine.play('swing1')).toBe(true);
  });

  it('tous les sons se rendent sans erreur (enveloppes valides)', async () => {
    const { engine, ctx } = await unlocked();
    for (const id of SFX_IDS) {
      ctx.currentTime += 1;
      expect(engine.play(id, { x: 50, y: 0, amount: 1 }), id).toBe(true);
    }
  });

  it('écart minimal et limite de voix par son', async () => {
    const { engine, ctx } = await unlocked();
    expect(engine.play('impact')).toBe(true);
    expect(engine.play('impact')).toBe(false); // même instant : ignoré
    for (let i = 0; i < 10; i += 1) {
      ctx.currentTime += SFX.impact.gapMs / 1000 + 0.001;
      engine.play('impact');
    }
    // Les voix volées sont coupées en 60 ms puis libérées.
    ctx.currentTime += 0.07;
    expect(engine.activeVoices).toBeLessThanOrEqual(SFX.impact.max);
  });

  it('plafond global de voix', async () => {
    const { engine, ctx } = await unlocked();
    for (let i = 0; i < 200; i += 1) {
      ctx.currentTime += 0.001;
      engine.play(SFX_IDS[i % SFX_IDS.length] ?? 'impact');
    }
    expect(engine.activeVoices).toBeLessThanOrEqual(MAX_VOICES);
  });

  it("la pause coupe les effets mais garde l'interface", async () => {
    const { engine, ctx } = await unlocked();
    engine.setPaused(true);
    expect(engine.busGain('sfx')).toBe(0);
    expect(engine.busGain('music')).toBeGreaterThan(0);
    expect(engine.play('impact')).toBe(false);
    expect(engine.play('uiClick')).toBe(true);
    engine.setPaused(false);
    ctx.currentTime += 1;
    expect(engine.play('impact')).toBe(true);
  });

  it('volumes persistés, valeurs invalides et stockage défaillant tolérés', async () => {
    const storage = memoryStorage();
    const { engine } = await unlocked(storage);
    engine.setSettings({ music: 0.2, muted: true });
    const saved = JSON.parse(storage.data.get(AUDIO_SETTINGS_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(saved.music).toBe(0.2);
    expect(saved.muted).toBe(true);
    expect(new AudioEngine({ storage }).settings.music).toBe(0.2);
    engine.setSettings({ master: 7 });
    expect(engine.settings.master).toBe(1);

    storage.data.set(AUDIO_SETTINGS_KEY, '{pas du json');
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    storage.data.set(AUDIO_SETTINGS_KEY, JSON.stringify({ sfx: 'fort', master: 0.5 }));
    expect(loadAudioSettings(storage).sfx).toBe(DEFAULT_AUDIO_SETTINGS.sfx);
    expect(loadAudioSettings(storage).master).toBe(0.5);

    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('plein');
      },
      removeItem: () => undefined,
    };
    const e2 = new AudioEngine({ storage: broken });
    expect(e2.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(() => {
      e2.setSettings({ sfx: 0.1 });
    }).not.toThrow();
    expect(e2.settings.sfx).toBe(0.1);
  });

  it('musique basse par défaut : sous les effets', () => {
    const e = new AudioEngine({ createContext: () => null });
    expect(e.busGain('music')).toBeLessThan(e.busGain('sfx') / 2);
  });

  it('« réduire les sons répétitifs » resserre seulement les sons répétitifs', () => {
    const e = new AudioEngine({ createContext: () => null });
    e.setSettings({ reduceRepetitive: true });
    expect(e.limits(SFX.impact).max).toBe(1);
    expect(e.limits(SFX.impact).gapMs).toBeGreaterThan(SFX.impact.gapMs);
    expect(e.limits(SFX.chime)).toEqual({ max: SFX.chime.max, gapMs: SFX.chime.gapMs });
  });

  it('spatialisation : panoramique selon x, atténuation par la distance', () => {
    expect(spatialize(-200, 0).pan).toBeLessThan(0);
    expect(spatialize(200, 0).pan).toBeGreaterThan(0);
    expect(spatialize(0, 0)).toEqual({ pan: 0, gain: 1 });
    expect(spatialize(0, 600).gain).toBeLessThan(spatialize(0, 150).gain);
    expect(spatialize(5000, 0).gain).toBeGreaterThanOrEqual(0.3);
  });

  it('sans Web Audio : aucun plantage', () => {
    const e = new AudioEngine({ createContext: () => null });
    e.unlock();
    expect(e.play('swing1')).toBe(false);
  });
});

describe('audio : musique et directeur', () => {
  it('les couches de combat s’ouvrent avec l’intensité ; le boss reste haut', () => {
    const m = new MusicDirector();
    m.setMode('combat');
    m.setIntensity(0);
    expect(Object.values(m.layerTargets()).every((v) => v === 0)).toBe(true);
    m.setIntensity(0.4);
    const mid = m.layerTargets();
    expect(mid.bass).toBeGreaterThan(0);
    expect(mid.arp).toBe(0);
    m.setIntensity(1);
    expect(m.layerTargets().arp).toBe(1);
    m.setMode('boss');
    m.setIntensity(0);
    expect(m.layerTargets().kick).toBe(1);
    m.setMode('hub');
    expect(m.layerTargets().bass).toBe(0);
  });

  it('chaque mode se planifie sans erreur', () => {
    const ctx = new MockContext();
    ctx.state = 'running';
    const m = new MusicDirector();
    const bus = ctx.createGain();
    m.attach(
      ctx as unknown as BaseAudioContext,
      bus as unknown as AudioNode,
      bus as unknown as AudioNode,
    );
    for (const mode of ['quai', 'combat', 'boss', 'hub', 'off'] as MusicMode[]) {
      m.setMode(mode);
      m.setIntensity(1, 3);
      for (let i = 0; i < 40; i += 1) {
        ctx.currentTime += 0.25;
        m.update();
      }
    }
    expect(ctx.nodes).toBeGreaterThan(100);
  });

  it('le directeur joue les sons des événements et suit la pause', async () => {
    let made: MockContext | null = null;
    const d = new AudioDirector({
      random: () => 0.5,
      createContext: () => {
        made = new MockContext();
        return made as unknown as AudioContext;
      },
    });
    d.engine.unlock();
    await Promise.resolve();
    expect(made).not.toBeNull();
    const probe: AudioProbe = {
      ...EMPTY_PROBE,
      phase: 'run',
      enemies: [{ id: 1, kind: 'drone', x: 40, y: 0, windup: false }],
    };
    d.frame([swing(1), hit(1), { type: 'roomEntered', room: 1, roomType: 'combat' }], probe);
    expect(d.log).toEqual(['swing1', 'impact', 'hitDrone', 'chime']);
    expect(d.music.mode).toBe('combat');
    d.frame([], { ...probe, roomType: 'boss' });
    expect(d.music.mode).toBe('boss');
    d.frame([], { ...probe, paused: true, menu: 'pause' });
    expect(d.engine.paused).toBe(true);
    expect(d.log.at(-1)).toBe('uiOpen');
    d.frame([], { ...EMPTY_PROBE, phase: 'hub' });
    expect(d.music.mode).toBe('hub');
    d.dispose();
  });
});
