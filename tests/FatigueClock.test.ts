import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';
import { Shift } from '@/config/constants';
import type { FatigueClockState } from '@/systems/time/FatigueClock';
import {
  addFatigue,
  advanceTime,
  combatFatigueGain,
  createFatigueClock,
  dayOf,
  drinkOccCoffee,
  fatiguePerMinute,
  fatigueTier,
  finishCombat,
  formatClock,
  realMsToGameMinutes,
  shiftAt,
  shiftIndexAt,
  sleepUntilCap,
  startNextAct,
  takeNap,
  timeMultiplier,
} from '@/systems/time/FatigueClock';

const at = (hh: number, mm: number, day = 0): number => day * 1440 + hh * 60 + mm;

function clockAt(totalMinutes: number, fatigue: number, act: 1 | 2 | 3 = 1): FatigueClockState {
  return {
    ...createFatigueClock(act),
    totalMinutes,
    fatigue,
    restShiftIndex: shiftIndexAt(totalMinutes),
  };
}

describe('lecture de l’horloge', () => {
  it('classe les heures dans les pauses 3x8', () => {
    expect(shiftAt(at(4, 47))).toBe(Shift.Night);
    expect(shiftAt(at(6, 0))).toBe(Shift.Morning);
    expect(shiftAt(at(13, 59))).toBe(Shift.Morning);
    expect(shiftAt(at(14, 0))).toBe(Shift.Afternoon);
    expect(shiftAt(at(21, 59))).toBe(Shift.Afternoon);
    expect(shiftAt(at(22, 0))).toBe(Shift.Night);
    expect(shiftAt(at(5, 0, 1))).toBe(Shift.Night);
  });

  it('formate en HH:MM et passe minuit', () => {
    expect(formatClock(at(4, 47))).toBe('04:47');
    expect(formatClock(at(7, 12))).toBe('07:12');
    expect(formatClock(at(0, 5, 1))).toBe('00:05');
    expect(dayOf(at(0, 5, 1))).toBe(1);
  });

  it('numérote chaque pause de façon unique', () => {
    expect(shiftIndexAt(at(4, 47))).toBe(-1);
    expect(shiftIndexAt(at(6, 0))).toBe(0);
    expect(shiftIndexAt(at(14, 0))).toBe(1);
    expect(shiftIndexAt(at(22, 0))).toBe(2);
    expect(shiftIndexAt(at(5, 59, 1))).toBe(2);
  });

  it('convertit le temps réel : 1 min in-game toutes les 8 s', () => {
    expect(realMsToGameMinutes(7999)).toEqual({ minutes: 0, carryMs: 7999 });
    expect(realMsToGameMinutes(8000)).toEqual({ minutes: 1, carryMs: 0 });
    expect(realMsToGameMinutes(20_000)).toEqual({ minutes: 2, carryMs: 4000 });
    expect(realMsToGameMinutes(-50)).toEqual({ minutes: 0, carryMs: 0 });
  });
});

describe('paliers de Fatigue', () => {
  it.each([
    [0, 'frais'],
    [39.9, 'frais'],
    [40, 'fatigue'],
    [69, 'fatigue'],
    [70, 'epuise'],
    [89.99, 'epuise'],
    [90, 'burn-out'],
    [99, 'burn-out'],
    [100, 'effondre'],
    [150, 'effondre'],
    [-5, 'frais'],
  ])('fatigue %d → %s', (value, id) => {
    expect(fatigueTier(value).id).toBe(id);
  });
});

describe('gain de Fatigue lié au temps', () => {
  it('suit +2 / +3 / +5 par heure selon la pause', () => {
    expect(fatiguePerMinute(Shift.Morning, false) * 60).toBeCloseTo(2);
    expect(fatiguePerMinute(Shift.Afternoon, false) * 60).toBeCloseTo(3);
    expect(fatiguePerMinute(Shift.Night, false) * 60).toBeCloseTo(5);
  });

  it('multiplie par 1,5 en heures sup’', () => {
    expect(fatiguePerMinute(Shift.Morning, true) * 60).toBeCloseTo(3);
  });

  it('applique les multiplicateurs de temps avec un plancher à ×0,5', () => {
    const { thermos, lungo } = BALANCE.fatigue.timeMult;
    expect(timeMultiplier({ timeMultipliers: [thermos, lungo] })).toBeCloseTo(0.6);
    expect(timeMultiplier({ timeMultipliers: [0.5, 0.5] })).toBe(0.5);
    expect(timeMultiplier()).toBe(1);
  });
});

describe('advanceTime', () => {
  it('ajoute 2 de Fatigue par heure le matin', () => {
    const { state, events } = advanceTime(clockAt(at(8, 0), 20), 60);
    expect(state.totalMinutes).toBe(at(9, 0));
    expect(state.fatigue).toBeCloseTo(22);
    expect(events).toEqual([]);
  });

  it('n’ajoute pas de Fatigue quand accrueFatigue est faux', () => {
    const { state } = advanceTime(clockAt(at(8, 0), 20), 60, { accrueFatigue: false });
    expect(state.fatigue).toBe(20);
    expect(state.totalMinutes).toBe(at(9, 0));
  });

  it('change de pause à 06:00 et compte chaque minute au taux de sa pause', () => {
    // Prologue : 04:47 → 06:47. 73 min de nuit (5/h) puis 47 min de matin (2/h).
    const { state, events } = advanceTime(createFatigueClock(1), 120);
    expect(formatClock(state.totalMinutes)).toBe('06:47');
    expect(state.fatigue).toBeCloseTo(20 + (73 * 5) / 60 + (47 * 2) / 60);
    expect(events[0]).toEqual({ type: 'shiftChanged', from: Shift.Night, to: Shift.Morning });
  });

  it('s’arrête à la butée de 13h45 et passe en heures sup’', () => {
    const { state, events } = advanceTime(clockAt(at(13, 30), 30), 15);
    expect(state.totalMinutes).toBe(BALANCE.clock.OVERTIME_CAP[1]);
    expect(state.overtime).toBe(true);
    expect(events).toContainEqual({ type: 'overtimeStarted' });
  });

  it('continue de fatiguer à ×1,5 pendant les heures sup’ sans faire avancer l’horloge', () => {
    const capped = advanceTime(clockAt(at(13, 45), 30), 0).state;
    expect(capped.overtime).toBe(true);
    const { state, events } = advanceTime(capped, 60);
    expect(state.totalMinutes).toBe(at(13, 45));
    expect(state.fatigue).toBeCloseTo(30 + 3);
    expect(events).not.toContainEqual({ type: 'overtimeStarted' });
  });

  it('n’a pas de butée pendant l’acte III et passe minuit', () => {
    const { state } = advanceTime(clockAt(at(23, 0), 10, 3), 120);
    expect(formatClock(state.totalMinutes)).toBe('01:00');
    expect(dayOf(state.totalMinutes)).toBe(1);
    expect(state.overtime).toBe(false);
    expect(state.fatigue).toBeCloseTo(20);
  });

  it('borne la Fatigue à 100 et signale l’effondrement une seule fois', () => {
    const first = advanceTime(clockAt(at(23, 0), 99, 3), 60);
    expect(first.state.fatigue).toBe(100);
    expect(first.events).toContainEqual({ type: 'collapsed' });
    expect(first.events).toContainEqual({ type: 'tierChanged', from: 'burn-out', to: 'effondre' });
    const second = advanceTime(first.state, 60);
    expect(second.events).not.toContainEqual({ type: 'collapsed' });
  });

  it('tombe sur des valeurs exactes malgré l’addition minute par minute', () => {
    // 120 × (3/60) en flottants donne 5,999… : l'affichage (floor) montrerait 5 et un palier serait raté.
    expect(advanceTime(clockAt(at(15, 0), 0, 2), 120).state.fatigue).toBe(6);
    expect(fatigueTier(advanceTime(clockAt(at(15, 0), 34, 2), 120).state.fatigue).id).toBe(
      'fatigue',
    );
  });

  it('respecte le budget de nuit du GDD : 7 h de nuit = +35', () => {
    const { state } = advanceTime(clockAt(at(22, 0), 10, 3), 7 * 60);
    expect(state.fatigue).toBeCloseTo(45);
  });

  it('ignore les durées négatives ou fractionnaires', () => {
    const start = clockAt(at(8, 0), 20);
    expect(advanceTime(start, -10).state.totalMinutes).toBe(start.totalMinutes);
    expect(advanceTime(start, 2.9).state.totalMinutes).toBe(start.totalMinutes + 2);
  });

  it('ne modifie jamais l’état reçu', () => {
    const start = Object.freeze(clockAt(at(8, 0), 20));
    advanceTime(start, 30);
    expect(start.totalMinutes).toBe(at(8, 0));
  });
});

describe('addFatigue', () => {
  it('borne à [0, 100] et signale les changements de palier', () => {
    const start = clockAt(at(8, 0), 35);
    const up = addFatigue(start, 10);
    expect(up.state.fatigue).toBe(45);
    expect(up.events).toEqual([{ type: 'tierChanged', from: 'frais', to: 'fatigue' }]);
    expect(addFatigue(start, -80).state.fatigue).toBe(0);
    expect(addFatigue(start, 500).state.fatigue).toBe(100);
  });
});

describe('fin de combat', () => {
  it('coûte +2, +1 par tranche de 3 manches, ou +5 en cas de fuite', () => {
    expect(combatFatigueGain(2, false)).toBe(2);
    expect(combatFatigueGain(3, false)).toBe(3);
    expect(combatFatigueGain(7, false)).toBe(4);
    expect(combatFatigueGain(4, true)).toBe(5);
  });

  it('ajoute la Fatigue du combat puis 10 min d’horloge', () => {
    const { state } = finishCombat(clockAt(at(8, 0), 20), { rounds: 6, fled: false });
    expect(state.totalMinutes).toBe(at(8, 10));
    expect(state.fatigue).toBeCloseTo(20 + 4 + (10 * 2) / 60);
  });
});

describe('changement d’acte', () => {
  it('saute à 14:00 avec la Tasse de Relève (−30) et coupe les heures sup’', () => {
    const overtime = { ...clockAt(at(13, 45), 60), overtime: true };
    const { state, events } = startNextAct(overtime);
    expect(state.act).toBe(2);
    expect(state.totalMinutes).toBe(at(14, 0));
    expect(state.overtime).toBe(false);
    expect(state.fatigue).toBe(30);
    expect(events).toContainEqual({
      type: 'shiftChanged',
      from: Shift.Morning,
      to: Shift.Afternoon,
    });
    expect(events).toContainEqual({ type: 'actStarted', act: 2 });
  });

  it('saute à 22:00 avec la veillée d’armes (−50)', () => {
    const { state } = startNextAct(clockAt(at(21, 0), 70, 2));
    expect(state.act).toBe(3);
    expect(formatClock(state.totalMinutes)).toBe('22:00');
    expect(state.fatigue).toBe(20);
  });

  it('refuse d’aller au-delà de l’acte III', () => {
    expect(() => startNextAct(clockAt(at(23, 0), 10, 3))).toThrow();
  });
});

describe('repos à l’OCC', () => {
  it('café gratuit : −30 au niveau 1, −10 de plus le matin, +10 min', () => {
    const result = drinkOccCoffee(clockAt(at(9, 0), 60), 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.fatigue).toBeCloseTo(60 - 40 + (10 * 2) / 60);
    expect(result.state.totalMinutes).toBe(at(9, 10));
    expect(result.state.restUsed.coffee).toBe(true);
  });

  it('café gratuit : −60 au niveau 3 l’après-midi', () => {
    const result = drinkOccCoffee(clockAt(at(15, 0), 80, 2), 3);
    expect(result.ok && result.state.fatigue).toBeCloseTo(80 - 60 + (10 * 3) / 60);
  });

  it('une seule fois par pause, puis de nouveau à la pause suivante', () => {
    const first = drinkOccCoffee(clockAt(at(5, 0), 60), 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(drinkOccCoffee(first.state, 1)).toEqual({ ok: false, reason: 'already-used' });
    const nextShift = advanceTime(first.state, 60).state; // 05:10 → 06:10
    expect(nextShift.restUsed.coffee).toBe(false);
    expect(drinkOccCoffee(nextShift, 1).ok).toBe(true);
  });

  it('sieste : −40 et +2 h sans fatiguer', () => {
    const result = takeNap(clockAt(at(9, 0), 70));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.fatigue).toBe(30);
    expect(result.state.totalMinutes).toBe(at(11, 0));
    expect(takeNap(result.state)).toEqual({ ok: false, reason: 'already-used' });
  });

  it('sieste trop tardive : l’horloge s’arrête à la butée', () => {
    const result = takeNap(clockAt(at(12, 30), 70));
    expect(result.ok && result.state.totalMinutes).toBe(BALANCE.clock.OVERTIME_CAP[1]);
    expect(result.ok && result.state.overtime).toBe(true);
  });

  it('dormir : Fatigue à 0 et saut à la butée de relève', () => {
    const result = sleepUntilCap(clockAt(at(15, 0), 85, 2));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.fatigue).toBe(0);
    expect(formatClock(result.state.totalMinutes)).toBe('21:45');
    expect(result.state.overtime).toBe(true);
    expect(result.events).toContainEqual({ type: 'overtimeStarted' });
  });

  it('pas de lit de camp pendant l’acte III', () => {
    expect(sleepUntilCap(clockAt(at(23, 0), 50, 3))).toEqual({ ok: false, reason: 'no-bed' });
  });
});
