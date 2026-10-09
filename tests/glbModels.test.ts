// Contrat entre le jeu et les GLB de public/models (tools/render3d/SKELETON.md) : manifeste lisible,
// clips et pièces cités par les vues présents, calage des attaques sur les timings de la sim.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMBO, ENEMY_STATS } from '@/config/balance';
import type { EnemyKind } from '@/config/balance';
import { timingOf } from '@/systems/combat/attackTiming';
import { DEFAULT_GEAR, ENEMY_CLIPS, HERO_CLIPS } from '@/view/actors/actorClips';
import { alignedClipTime, windupClipTime } from '@/view/models/clipTiming';
import { parseManifest, withLods } from '@/view/models/manifest';

const PUBLIC = new URL('../public/', import.meta.url);
const read = (p: string): unknown => JSON.parse(readFileSync(new URL(p, PUBLIC), 'utf8'));
const manifest = parseManifest(read('models/manifest.json'));

describe('manifeste des modèles GLB', () => {
  it('se lit et référence des fichiers présents', () => {
    expect(Object.keys(manifest.characters).length).toBeGreaterThan(5);
    for (const c of Object.values(manifest.characters))
      expect(existsSync(new URL(c.file, PUBLIC)), c.file).toBe(true);
    for (const it of Object.values(manifest.items))
      expect(existsSync(new URL(it.file, PUBLIC)), it.file).toBe(true);
  });

  it('rejette un manifeste mal formé et ignore les entrées invalides', () => {
    expect(() => parseManifest(null)).toThrow();
    const m = parseManifest({
      characters: { a: { file: 'x.glb', outline: 'rouge', clips: { idle: { loop: true } } }, b: 3 },
      items: { c: { file: 'c.glb', slot: 'chaussure' } },
    });
    expect(Object.keys(m.characters)).toEqual(['a']);
    expect(m.characters.a?.outline).toBe(0x06302c);
    expect(m.characters.a?.clips.idle?.loop).toBe(true);
    expect(Object.keys(m.items)).toEqual([]);
  });

  it('a tous les clips du héros et les attaques ont un frame actif', () => {
    const hero = manifest.characters.hero;
    expect(hero?.kind).toBe('hero');
    for (const c of HERO_CLIPS) expect(hero?.clips[c], c).toBeDefined();
    for (const c of ['attack1', 'attack2', 'attack3'])
      expect(hero?.clips[c]?.events.active).toBeGreaterThan(0);
  });

  it('a chaque modèle et chaque clip cités par les vues ennemies', () => {
    for (const kind of Object.keys(ENEMY_STATS) as EnemyKind[]) {
      const map = ENEMY_CLIPS[kind];
      const c = manifest.characters[map.model];
      expect(c, map.model).toBeDefined();
      const clips = [map.idle, map.move, map.death, map.spawn, map.hurt, map.stagger];
      for (const r of Object.values(map.rushes ?? {})) clips.push(r.windup, r.clip);
      for (const name of clips) if (name) expect(c?.clips[name], `${kind}.${name}`).toBeDefined();
      for (const [attack, clip] of Object.entries(map.attacks))
        expect(c?.clips[clip]?.events.active, `${kind}.${attack} → ${clip}`).toBeGreaterThan(0);
    }
  });

  it('a la tenue de départ du héros, sur les bons emplacements', () => {
    for (const [slot, id] of Object.entries(DEFAULT_GEAR)) {
      const it = manifest.items[id];
      expect(it?.slot, id).toBe(slot);
      expect(it?.skinned === true || it?.socket !== null).toBe(true);
    }
    expect(manifest.items.gilet_hv?.skinned).toBe(true);
    expect(manifest.items.cle_tire_fond?.socket).toBe('socket_weapon_R');
  });

  it('fusionne les variantes allégées du preset bas (fichiers présents)', () => {
    const path = 'models/lod/manifest.json';
    if (!existsSync(new URL(path, PUBLIC))) return;
    const m = withLods(manifest, read(path));
    const lods = Object.values(m.characters).filter((c) => c.lod);
    expect(lods.length).toBeGreaterThan(0);
    for (const c of lods) {
      expect(existsSync(new URL(c.lod?.file ?? '', PUBLIC))).toBe(true);
      expect(c.lod?.triangles ?? Infinity).toBeLessThan(c.triangles);
    }
  });
});

describe('calage des clips sur la simulation', () => {
  it('fait tomber le frame actif du clip sur le premier frame actif du coup', () => {
    const hero = manifest.characters.hero;
    COMBO.forEach((step, i) => {
      const clip = hero?.clips[`attack${String(i + 1)}`];
      if (!clip) throw new Error('clip manquant');
      const active = (clip.events.active ?? 0) / 1000;
      for (const speed of [0, 0.3]) {
        const t = timingOf(step, speed);
        const rest = t.activeMs + t.recoveryMs;
        const at = (ms: number): number =>
          alignedClipTime(ms, t.startupMs, rest, active, clip.duration);
        expect(at(0)).toBe(0);
        expect(at(t.startupMs)).toBeCloseTo(active, 6);
        expect(at(t.totalMs)).toBeCloseTo(clip.duration, 6);
        expect(at(t.startupMs - 1)).toBeLessThan(active);
        expect(at(t.totalMs + 500)).toBeCloseTo(clip.duration, 6);
      }
    });
  });

  it("pose l'armé des ennemis jusqu'au frame actif à la fin du télégraphe", () => {
    expect(windupClipTime(0, 0.7)).toBe(0);
    expect(windupClipTime(1, 0.7)).toBeCloseTo(0.7);
    expect(windupClipTime(2, 0.7)).toBeCloseTo(0.7);
    expect(windupClipTime(1, 0.7, 0.5)).toBeCloseTo(0.35);
  });
});
