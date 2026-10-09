import type { BattleResumeData } from '@/scenes/BattleScene';

/** Garde de type pour les données passées à `scene.resume` par BattleScene. */
export function isBattleResume(data: unknown): data is BattleResumeData {
  if (typeof data !== 'object' || data === null) return false;
  const outcome = (data as Partial<BattleResumeData>).battleOutcome;
  return outcome === 'victory' || outcome === 'defeat' || outcome === 'fled';
}
