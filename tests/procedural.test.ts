import { describe, expect, it } from 'vitest';
import { SHIFT } from '@/config/balance';
import type { DoorChoice, PlanHistory, RoomType } from '@/systems/procedural/ShiftPlan';
import {
  BOSS_ROOM,
  clockLabel,
  doorsFor,
  REST_ROOM,
  roomIndex,
  templateFor,
} from '@/systems/procedural/ShiftPlan';
import { budgetFor, shouldSendNextWave, wavesFor } from '@/systems/procedural/Waves';
import { createRng } from '@/utils/rng';

const morning = { budgetMult: 1, extraDronesPerWave: 0 };

describe('budget de menace et vagues (GDD § 3.6)', () => {
  it('retrouve les exemples du GDD', () => {
    expect(budgetFor({ r: 1, elite: false, ...morning })).toBe(6);
    expect(budgetFor({ r: 4, elite: false, ...morning })).toBe(12);
    expect(budgetFor({ r: 6, elite: true, ...morning })).toBe(25);
    expect(budgetFor({ r: 8, elite: false, ...morning })).toBe(19);
  });

  it('2 vagues jusqu’à r = 5, puis 3', () => {
    const rng = createRng(1);
    expect(wavesFor({ r: 5, elite: false, ...morning }, rng)).toHaveLength(2);
    expect(wavesFor({ r: 6, elite: false, ...morning }, rng)).toHaveLength(3);
  });

  it('pas de Borne en salle 1, au plus 3 par vague ensuite', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const rng = createRng(seed);
      for (const wave of wavesFor({ r: 1, elite: false, ...morning }, rng))
        expect(wave).not.toContain('borne');
      for (const wave of wavesFor({ r: 8, elite: false, ...morning }, rng)) {
        expect(wave.filter((k) => k === 'borne').length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('le Manager KPI ouvre la vague 2 d’une salle Élite', () => {
    const waves = wavesFor({ r: 6, elite: true, ...morning }, createRng(3));
    expect(waves[1]?.[0]).toBe('manager');
    expect(waves.flat().filter((k) => k === 'manager')).toHaveLength(1);
  });

  it('Matin : +1 Drone par vague à partir de r = 2', () => {
    const waves = wavesFor(
      { r: 3, elite: false, budgetMult: 1, extraDronesPerWave: 1 },
      createRng(5),
    );
    for (const w of waves) expect(w).toContain('drone');
  });

  it('vague suivante à ≤ 2 vivants ou 70 % de la vague éliminée', () => {
    expect(shouldSendNextWave(2, 6, 0)).toBe(true);
    expect(shouldSendNextWave(4, 10, 7)).toBe(true);
    expect(shouldSendNextWave(4, 10, 6)).toBe(false);
  });
});

function first(doors: readonly DoorChoice[]): DoorChoice {
  const door = doors[0];
  if (!door) throw new Error('Aucune porte proposée');
  return door;
}

/** Parcourt un Shift en prenant toujours la porte `pick`. */
function walk(seed: number, pick: (doors: DoorChoice[]) => DoorChoice): DoorChoice[] {
  const path: DoorChoice[] = [];
  let history: PlanHistory = { shopSeen: false, elites: 0, tresorSeen: false, previousType: null };
  for (let room = 1; room <= BOSS_ROOM; room += 1) {
    const doors = doorsFor(seed, room, history);
    const door = pick(doors);
    path.push(door);
    history = {
      shopSeen: history.shopSeen || door.type === 'boutique',
      elites: history.elites + (door.type === 'elite' ? 1 : 0),
      tresorSeen: history.tresorSeen || door.type === 'tresor',
      previousType: door.type,
    };
  }
  return path;
}

describe('portes et déroulé d’un Shift', () => {
  it('est déterministe pour une graine', () => {
    const h: PlanHistory = {
      shopSeen: false,
      elites: 0,
      tresorSeen: false,
      previousType: 'combat',
    };
    expect(doorsFor(42, 3, h)).toEqual(doorsFor(42, 3, h));
  });

  it('salle 1 = combat qui donne un Avantage ; 9 = Salle des pauses ; 10 = boss', () => {
    const path = walk(7, (d) => first(d));
    expect(path[0]).toEqual({ room: 1, type: 'combat', reward: 'avantage' });
    expect(path[REST_ROOM - 1]?.type).toBe('repos');
    expect(path[BOSS_ROOM - 1]?.type).toBe('boss');
  });

  it('propose 2 ou 3 portes, une seule avant le repos, sans récompenses identiques', () => {
    for (let seed = 1; seed < 300; seed += 1) {
      for (let room = 2; room <= SHIFT.BIOME1_ROOMS; room += 1) {
        const doors = doorsFor(seed, room, {
          shopSeen: false,
          elites: 0,
          tresorSeen: false,
          previousType: 'combat',
        });
        if (room === SHIFT.BIOME1_ROOMS) expect(doors).toHaveLength(1);
        else expect(doors.length).toBeGreaterThanOrEqual(2);
        const rewards = doors.map((d) => d.reward).filter((r) => r !== null);
        expect(new Set(rewards).size).toBe(rewards.length);
      }
    }
  });

  it('la Friterie est toujours proposée avant la salle 7 si on évite les autres types', () => {
    for (let seed = 1; seed < 300; seed += 1) {
      // Pire cas : on prend toujours une porte de combat quand c'est possible.
      const path = walk(seed, (d) => d.find((x) => x.type === 'combat') ?? first(d));
      const shopOffered = [2, 3, 4, 5, 6].some((room) =>
        doorsFor(seed, room, {
          shopSeen: false,
          elites: 0,
          tresorSeen: false,
          previousType: path[room - 2]?.type ?? null,
        }).some((d) => d.type === 'boutique'),
      );
      expect(shopOffered).toBe(true);
    }
  });

  it('jamais deux salles Élite d’affilée, au plus deux par Shift', () => {
    for (let seed = 1; seed < 300; seed += 1) {
      const path = walk(seed, (d) => d.find((x) => x.type === 'elite') ?? first(d));
      const types: RoomType[] = path.map((d) => d.type);
      expect(types.filter((t) => t === 'elite').length).toBeLessThanOrEqual(2);
      for (let i = 1; i < types.length; i += 1)
        expect(types[i] === 'elite' && types[i - 1] === 'elite').toBe(false);
    }
  });

  it('deux salles de combat consécutives n’ont pas le même gabarit', () => {
    for (let seed = 1; seed < 100; seed += 1) {
      for (let room = 1; room < SHIFT.BIOME1_ROOMS; room += 1) {
        expect(templateFor(seed, room, 'combat')).not.toBe(templateFor(seed, room + 1, 'combat'));
      }
    }
  });

  it('la Salle des pauses ne fait pas avancer l’horloge', () => {
    expect(roomIndex(REST_ROOM)).toBe(roomIndex(SHIFT.BIOME1_ROOMS));
    expect(roomIndex(BOSS_ROOM)).toBe(SHIFT.BIOME1_ROOMS + 1);
    expect(clockLabel(6, 90)).toBe('07:30');
    expect(clockLabel(22, 150)).toBe('00:30');
  });
});
