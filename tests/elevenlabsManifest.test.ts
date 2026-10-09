// Contrat entre le jeu et le manifeste de production audio ElevenLabs (tools/elevenlabs/manifest.json,
// généré par build-manifest.mjs depuis le catalogue) : chaque son du jeu a son prompt, le lot d'écoute
// a la taille annoncée par la bible, les répliques de l'Invité d'honneur sont toutes fictives.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SFX_IDS } from '@/audio/sfx';

interface Asset {
  readonly id: string;
  readonly type: 'voice-design' | 'tts' | 'sfx' | 'music' | 'stem-split';
  readonly sample: boolean;
  readonly voice?: string;
  readonly out: string;
  readonly from?: string;
  readonly params: {
    readonly text?: string;
    readonly voice_description?: string;
    readonly reference_audio_base64?: string;
    readonly duration_seconds?: number;
    readonly music_length_ms?: number;
  };
  readonly meta?: { readonly sfxId?: string; readonly fictive?: boolean };
  readonly status?: string;
  readonly voiceId?: string;
}
interface Manifest {
  readonly verifiedAt: string;
  readonly assets: readonly Asset[];
}

const manifest = JSON.parse(
  readFileSync(new URL('../tools/elevenlabs/manifest.json', import.meta.url), 'utf8'),
) as Manifest;
const of = (t: Asset['type']): readonly Asset[] => manifest.assets.filter((a) => a.type === t);

describe('manifeste ElevenLabs', () => {
  it('donne un prompt à chaque son du jeu, et à aucun son inconnu', () => {
    const ids = of('sfx').flatMap((a) => (a.meta?.sfxId ? [a.meta.sfxId] : []));
    expect([...ids].sort()).toEqual([...SFX_IDS].sort());
  });

  it('a des identifiants et des sorties uniques', () => {
    const ids = manifest.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const outs = manifest.assets.map((a) => a.out);
    expect(new Set(outs).size).toBe(outs.length);
  });

  it('relie chaque réplique à une voix conçue et chaque séparation à une musique', () => {
    const voices = new Set(of('voice-design').map((a) => a.voice));
    for (const a of of('tts')) expect(voices.has(a.voice), a.id).toBe(true);
    const music = new Set(of('music').map((a) => a.id));
    for (const a of of('stem-split')) expect(music.has(a.from ?? ''), a.id).toBe(true);
  });

  it('compose le lot d’écoute annoncé : 2 répliques par voix clé, 4 bruitages, 2 extraits de 20 s', () => {
    const keyVoices = of('voice-design').filter((a) => a.sample);
    for (const v of keyVoices)
      expect(of('tts').filter((a) => a.sample && a.voice === v.voice).length, v.id).toBe(2);
    expect(of('sfx').filter((a) => a.sample)).toHaveLength(4);
    const extraits = of('music').filter((a) => a.sample);
    expect(extraits).toHaveLength(2);
    for (const m of extraits) expect(m.params.music_length_ms).toBe(20000);
  });

  it('marque fictives toutes les répliques de l’Invité d’honneur, sans clonage ni nom réel', () => {
    const lines = of('tts').filter((a) => a.voice === 'invite');
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) expect(l.meta?.fictive, l.id).toBe(true);
    const design = of('voice-design').find((a) => a.voice === 'invite');
    const desc = design?.params.voice_description ?? '';
    expect(desc).not.toMatch(/rupo|sounds like|imitat/i);
    for (const a of of('voice-design')) expect(a.params.reference_audio_base64).toBeUndefined();
  });

  it('respecte les bornes de l’API', () => {
    for (const a of of('sfx')) {
      const d = a.params.duration_seconds ?? 0;
      expect(d, a.id).toBeGreaterThanOrEqual(0.5);
      expect(d, a.id).toBeLessThanOrEqual(30);
    }
    for (const a of of('voice-design')) {
      const n = (a.params.text ?? '').length;
      expect(n, a.id).toBeGreaterThanOrEqual(100);
      expect(n, a.id).toBeLessThanOrEqual(1000);
    }
    expect(manifest.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('porte les 4 voix arrêtées et exclut les bruitages déjà validés', () => {
    const ids: Record<string, string | undefined> = Object.fromEntries(
      of('voice-design').map((a): [string, string | undefined] => [a.voice ?? '', a.voiceId]),
    );
    expect(ids).toMatchObject({
      leon: 'Ql8Hq7echfwTF90Fec6K',
      yasmina: 'ROy6nWoXjRMqzkdFdAkB',
      invite: 'BHaCuTcypMPA9jhksYPX',
      lurcke: 'MAZdzkb78f8SA7DNBT41',
    });
    const validated = of('sfx')
      .filter((a) => a.status === 'validé')
      .map((a) => a.meta?.sfxId);
    expect(validated.sort()).toEqual(['dash', 'impact', 'loot4', 'whistle']);
  });
});
