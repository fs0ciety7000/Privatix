import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';

describe('BALANCE', () => {
  it('a des paliers de Fatigue contigus qui couvrent 0 à 100 sans trou', () => {
    const tiers = BALANCE.fatigue.tiers;
    expect(tiers[0].min).toBe(0);
    expect(tiers[tiers.length - 1]?.max).toBe(BALANCE.fatigue.MAX);
    tiers.forEach((tier, i) => {
      expect(tier.min).toBeLessThanOrEqual(tier.max);
      const next = tiers[i + 1];
      if (next) expect(next.min).toBe(tier.max + 1);
    });
  });

  it('suit les seuils canon 40 / 70 / 90 / 100', () => {
    expect(BALANCE.fatigue.tiers.map((t) => t.min)).toEqual([0, 40, 70, 90, 100]);
  });

  it('place les butées de relève 15 min avant chaque relève', () => {
    expect(BALANCE.clock.OVERTIME_CAP[1]).toBe(BALANCE.clock.PAUSE_START.afternoon - 15);
    expect(BALANCE.clock.OVERTIME_CAP[2]).toBe(BALANCE.clock.PAUSE_START.night - 15);
  });

  it('fait débuter les actes II et III à la relève', () => {
    expect(BALANCE.clock.ACT_START_MINUTE[2]).toBe(BALANCE.clock.PAUSE_START.afternoon);
    expect(BALANCE.clock.ACT_START_MINUTE[3]).toBe(BALANCE.clock.PAUSE_START.night);
  });

  it('fixe la signature du contrat au mardi 05:00', () => {
    expect(BALANCE.clock.BOSS_MINUTE).toBe(1 * 1440 + 5 * 60);
  });

  it('a un café OCC par niveau de machine', () => {
    expect(BALANCE.fatigue.recovery.OCC_COFFEE).toHaveLength(3);
  });
});
