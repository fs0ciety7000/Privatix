import { describe, expect, it } from 'vitest';
import { Shift } from '@/config/constants';
import { formatClock, shiftAt } from '@/systems/GameState';

describe('shiftAt', () => {
  it('classe les heures dans les bonnes pauses 3x8', () => {
    expect(shiftAt(6 * 60)).toBe(Shift.Morning);
    expect(shiftAt(13 * 60 + 59)).toBe(Shift.Morning);
    expect(shiftAt(14 * 60)).toBe(Shift.Afternoon);
    expect(shiftAt(21 * 60 + 59)).toBe(Shift.Afternoon);
    expect(shiftAt(22 * 60)).toBe(Shift.Night);
    expect(shiftAt(3 * 60)).toBe(Shift.Night);
  });

  it('gère le dépassement de minuit', () => {
    expect(shiftAt(25 * 60)).toBe(Shift.Night);
  });
});

describe('formatClock', () => {
  it('formate en HH:MM', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(7 * 60 + 12)).toBe('07:12');
    expect(formatClock(24 * 60 + 5)).toBe('00:05');
  });
});
