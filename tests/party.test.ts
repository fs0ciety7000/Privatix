import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';
import { SKILLS } from '@/data/combat';
import type { SkillDef } from '@/data/combat';
import type { MapDefinition } from '@/data/types';
import type { GameState } from '@/systems/GameState';
import { createInitialGameState, spawnPosition } from '@/systems/GameState';
import { gainXp, statsAt, xpToNext } from '@/systems/party/Leveling';
import type { BattleReport } from '@/systems/party/Party';
import {
  applyBattleReport,
  buildBattleSetup,
  partyMembers,
  skillsFor,
} from '@/systems/party/Party';
import { formatClock } from '@/systems/time/FatigueClock';
import { buildWorldMap, isBlocked, isMarkerVisible } from '@/systems/world/WorldMap';

const at = (hh: number, mm: number): number => hh * 60 + mm;

function game(patch: Partial<GameState> = {}): GameState {
  const base = createInitialGameState('Léa');
  return { ...base, time: { ...base.time, totalMinutes: at(9, 0), restShiftIndex: 0 }, ...patch };
}

function report(patch: Partial<BattleReport> = {}): BattleReport {
  return {
    outcome: 'victory',
    rounds: 4,
    fatigue: 20,
    members: [{ id: 'heros', hp: 30, pe: 12, ko: false, demotivated: false }],
    inventory: { gaufre: 2 },
    gobelets: 0,
    rewards: { xp: 10, tickets: 7, coffeeBeans: 0 },
    ...patch,
  };
}

describe('Leveling (GDD § 8.1)', () => {
  it('suit la table des niveaux du héros', () => {
    expect(xpToNext(1)).toBe(40);
    expect(xpToNext(4)).toBe(320);
    expect(statsAt('heros', 1)).toEqual({ maxHp: 60, maxPe: 20, force: 10, defense: 8, speed: 10 });
    expect(statsAt('heros', 4)).toEqual({
      maxHp: 96,
      maxPe: 29,
      force: 16,
      defense: 12,
      speed: 13,
    });
    expect(statsAt('heros', 7)).toEqual({
      maxHp: 132,
      maxPe: 38,
      force: 22,
      defense: 17,
      speed: 16,
    });
  });

  it('applique les coefficients des collègues', () => {
    // Josiane : PV ×1,3, Force ×0,8, Déf ×1,4, Vit ×0,8
    expect(statsAt('josiane', 1)).toEqual({
      maxHp: 78,
      maxPe: 20,
      force: 8,
      defense: 11,
      speed: 8,
    });
  });

  it('enchaîne plusieurs niveaux et plafonne au niveau 20', () => {
    expect(gainXp(1, 0, 40 + 113 + 5)).toEqual({ level: 3, xp: 5, levelsGained: 2 });
    expect(gainXp(19, 0, 1_000_000).level).toBe(20);
  });
});

describe('équipe', () => {
  it('héros seul, puis les deux premiers collègues recrutés', () => {
    expect(partyMembers(game())).toEqual(['heros']);
    expect(partyMembers(game({ flags: { 'rudy-recrute': true } }))).toEqual(['heros', 'rudy']);
    const all = game({
      flags: { 'josiane-recrutee': true, 'rudy-recrute': true, 'bene-recrutee': true },
    });
    expect(partyMembers(all)).toEqual(['heros', 'josiane', 'rudy']);
  });

  it('ne donne que les compétences apprises à ce niveau, du bon propriétaire', () => {
    for (const level of [1, 2, 4, 6, 7]) {
      for (const id of skillsFor('heros', level)) {
        const def: SkillDef = SKILLS[id];
        expect(def.owner).toBe('heros');
        expect(def.learnLevel ?? 1).toBeLessThanOrEqual(level);
      }
    }
  });

  it('prépare le combat : stats du niveau, PV conservés, collègues au maximum par défaut', () => {
    const s = game({
      flags: { 'josiane-recrutee': true },
      player: { ...game().player, hp: 33 },
      time: { ...game().time, fatigue: 42 },
      moral: 25,
    });
    const setup = buildBattleSetup(s, 'consultant-junior');
    expect(setup.encounterId).toBe('consultant-junior');
    expect(setup.party.map((m) => m.id)).toEqual(['heros', 'josiane']);
    expect(setup.party[0]).toMatchObject({ name: 'Léa', hp: 33, maxHp: 60, force: 10 + 4 }); // clé de tirefond rouillée
    expect(setup.party[1]).toMatchObject({ hp: 78, maxHp: 78 });
    expect(setup).toMatchObject({ fatigue: 42, moral: 25, shift: 'morning' });
  });
});

describe('résultat de combat', () => {
  it('victoire : récompenses, PV conservés, coûts de temps et de Fatigue', () => {
    const { state, notices } = applyBattleReport(game(), report(), 'gare-mons:x');
    expect(state.tickets).toBe(7);
    expect(state.player.xp).toBe(10);
    expect(state.player.hp).toBe(30);
    expect(state.player.energy).toBe(12);
    expect(state.inventory).toEqual({ gaufre: 2 });
    expect(formatClock(state.time.totalMinutes)).toBe('09:10');
    expect(state.time.fatigue).toBeCloseTo(20 + 2 + 1 + (10 * 2) / 60);
    expect(state.defeatedEncounters['gare-mons:x']).toBe(state.time.totalMinutes);
    expect(notices[0]).toMatch(/\+10 XP/);
  });

  it('montée de niveau : PV max et PV actuels augmentent, nouvelle compétence annoncée', () => {
    const { state, notices } = applyBattleReport(
      game(),
      report({ rewards: { xp: 45, tickets: 0, coffeeBeans: 0 } }),
    );
    expect(state.player.level).toBe(2);
    expect(state.player.xp).toBe(5);
    expect(state.player.maxHp).toBe(72);
    expect(state.player.hp).toBe(42);
    expect(notices).toContain('Niveau 2 !');
  });

  it('un K.O. revient avec 1 PV ; finir Démotivé coûte 1 de Moral', () => {
    const r = report({ members: [{ id: 'heros', hp: 0, pe: 0, ko: true, demotivated: true }] });
    const { state } = applyBattleReport(game({ moral: 20 }), r);
    expect(state.player.hp).toBe(1);
    expect(state.moral).toBe(20 + BALANCE.moral.gains.endDemotivated);
  });

  it('fuite : pas de récompense, +5 Fatigue et +10 min', () => {
    const { state } = applyBattleReport(
      game(),
      report({ outcome: 'fled', rewards: null, fatigue: 20 }),
      'gare-mons:x',
    );
    expect(state.tickets).toBe(0);
    expect(state.time.fatigue).toBeCloseTo(25 + (10 * 2) / 60);
    expect(state.defeatedEncounters).toEqual({});
  });

  it('défaite : Mise à pied, équipe soignée', () => {
    const s = game({
      tickets: 40,
      moral: 20,
      flags: { 'josiane-recrutee': true },
      allies: { josiane: { hp: 3, pe: 0 } },
    });
    const { state } = applyBattleReport(s, report({ outcome: 'defeat', rewards: null }));
    expect(state.position).toEqual(spawnPosition('gare-mons', 'depart'));
    expect(state.time.fatigue).toBe(BALANCE.fatigue.DEFEAT_SET);
    expect(state.tickets).toBe(30);
    expect(state.moral).toBe(15);
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.allies).toEqual({});
  });
});

describe('groupes d’ennemis visibles', () => {
  const def: MapDefinition = {
    id: 'gare-mons',
    name: 'Test',
    theme: 'sncb',
    floor: 'platform',
    rows: ['#####', '#S_x#', '#####'],
    markers: {
      S: { kind: 'spawn', id: 'depart' },
      x: {
        kind: 'encounter',
        encounter: 'patrouille-bornes',
        character: 'borne',
        label: 'Bornes',
        respawnMinutes: 60,
      },
    },
  };
  const map = buildWorldMap(def);
  const marker = map.markers.find((m) => m.char === 'x');

  it('bloque, disparaît une fois vaincu, puis réapparaît après le délai', () => {
    if (!marker) throw new Error('marqueur absent');
    expect(marker.key).toBe('gare-mons:x');
    const base = { flags: {}, act: 1 as const };
    expect(isBlocked(map, 3, 1, base)).toBe(true);
    const defeated = { 'gare-mons:x': 100 };
    expect(isMarkerVisible(marker, { ...base, now: 130, defeated })).toBe(false);
    expect(isBlocked(map, 3, 1, { ...base, now: 130, defeated })).toBe(false);
    expect(isMarkerVisible(marker, { ...base, now: 160, defeated })).toBe(true);
  });
});
