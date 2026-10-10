/**
 * Lecture seule du monde simulé pour l'audio (comme la vue, l'audio consomme la sim sans jamais la
 * modifier ; la sim, elle, ne connaît pas l'audio).
 */
import { BURNOUT_TIERS } from '@/config/balance';
import { maxEnergy } from '@/systems/meta/RunState';
import type { World } from '@/sim/World';
import type { AudioPhase, AudioProbe } from './router';

export function probeWorld(
  world: World,
  phase: AudioPhase,
  menu: string,
  paused: boolean,
  shift?: string,
): AudioProbe {
  const run = world.run;
  const hero = world.hero;
  const burnout = run.burnout;
  const tierId = burnout.tier.id;
  const tierIdx = BURNOUT_TIERS.findIndex((t) => t.id === tierId);
  const director = world.director;
  return {
    phase,
    menu,
    paused,
    heroX: hero.body.x,
    heroY: hero.body.y,
    heroState: hero.state,
    gobelets: run.gobelets,
    burnoutTier: burnout.inMeltdown ? BURNOUT_TIERS.length : Math.max(0, tierIdx),
    burnout: burnout.value,
    meltdown: burnout.inMeltdown,
    roomType: director.door.type,
    bossPhase: director.boss?.phase ?? 1,
    biome: director.biome,
    shift: shift ?? run.shift.id,
    energy: Math.max(0, Math.min(1, run.energy / Math.max(1, maxEnergy(run)))),
    mobilisation: run.mobilisation.value,
    choiceFamilies: (director.choice?.options ?? [])
      .map((o) => o.accent)
      .filter((a): a is number => a !== undefined),
    result: director.result?.end ?? null,
    enemies: world.livingEnemies().map((e) => ({
      id: e.id,
      kind: e.kind,
      x: e.body.x,
      y: e.body.y,
      windup: e.state === 'windup',
    })),
    hazards: world.hazards.map((h) => {
      const s = h.spec;
      return {
        id: h.id,
        x: 'x' in s ? s.x : s.x0,
        y: 'y' in s ? s.y : s.y0,
        telegraphing: h.telegraphing,
      };
    }),
  };
}
