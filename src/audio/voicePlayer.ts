/**
 * Lecteur des dialogues (Web Audio) : une source au plus par voix, vers le bus « voix ». La radio de
 * Yasmina passe par un petit filtre de haut-parleur (passe-haut 350 Hz, passe-bas 3,4 kHz).
 */
import type { SampleBank } from './samples';
import type { VoiceId, VoiceKind, VoiceOut } from './voice';
import { VOICE_LINES } from './voice';

interface Speaking {
  readonly src: AudioBufferSourceNode;
  readonly gain: GainNode;
}

export class VoicePlayer implements VoiceOut {
  private readonly active = new Map<VoiceId, Speaking>();
  /** Dernières répliques lancées (outil de test et de débogage, 16 au plus). */
  public readonly log: string[] = [];

  public constructor(
    private readonly bank: SampleBank,
    private readonly ctx: () => BaseAudioContext | null,
    private readonly bus: () => AudioNode | null,
  ) {}

  private bufferOf(id: string): AudioBuffer | null {
    const file = VOICE_LINES.get(id)?.file;
    return file ? this.bank.get(file) : null;
  }

  public ready(id: string): boolean {
    return this.bufferOf(id) !== null && this.ctx()?.state === 'running';
  }

  public play(id: string, kind: VoiceKind): number | null {
    const ctx = this.ctx();
    const bus = this.bus();
    const line = VOICE_LINES.get(id);
    const buffer = this.bufferOf(id);
    if (!ctx || !bus || !line || !buffer) return null;
    this.stop(line.voice);
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = kind === 'effort' ? 0.8 : 1;
    let dest: AudioNode = bus;
    if (kind === 'radio') {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3400;
      lp.connect(bus);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 350;
      hp.connect(lp);
      dest = hp;
    }
    src.connect(gain).connect(dest);
    src.start(t);
    this.active.set(line.voice, { src, gain });
    this.log.push(id);
    if (this.log.length > 16) this.log.shift();
    return buffer.duration;
  }

  public stop(voice: VoiceId): void {
    const s = this.active.get(voice);
    const ctx = this.ctx();
    if (!s || !ctx) return;
    this.active.delete(voice);
    const t = ctx.currentTime;
    s.gain.gain.cancelScheduledValues(t);
    s.gain.gain.setTargetAtTime(0, t, 0.015);
    try {
      s.src.stop(t + 0.08);
    } catch {
      // Déjà terminée.
    }
  }

  public stopAll(): void {
    for (const v of [...this.active.keys()]) this.stop(v);
  }
}
