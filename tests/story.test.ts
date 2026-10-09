import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';
import type { DialogueDef, ObjectiveDef } from '@/data/types';
import { OCC_CODE } from '@/data/story';
import type { GameState } from '@/systems/GameState';
import {
  activeDrink,
  activeTimeModifiers,
  createInitialGameState,
  isGameState,
  spawnPosition,
} from '@/systems/GameState';
import { advance, choose, startDialogue, visibleChoices } from '@/systems/story/DialogueRunner';
import { applyEffect, applyEffects } from '@/systems/story/Effects';
import { applyLayoff } from '@/systems/story/Layoff';
import { currentObjective } from '@/systems/story/Objectives';
import { interpolate, textTokens } from '@/systems/story/TextTokens';
import { formatClock, shiftIndexAt } from '@/systems/time/FatigueClock';
import { matchesCode, summarizePresses } from '@/systems/vending/VendingCode';

const at = (hh: number, mm: number, day = 0): number => day * 1440 + hh * 60 + mm;

function gameAt(totalMinutes: number, patch: Partial<GameState> = {}): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    time: { ...base.time, totalMinutes, restShiftIndex: shiftIndexAt(totalMinutes) },
    ...patch,
  };
}

describe('GameState', () => {
  it('démarre au quai, 4h47, Fatigue 20, Moral 10, sans drapeau', () => {
    const s = createInitialGameState('Léa');
    expect(isGameState(s)).toBe(true);
    expect(s.player.name).toBe('Léa');
    expect(formatClock(s.time.totalMinutes)).toBe('04:47');
    expect(s.time.fatigue).toBe(20);
    expect(s.moral).toBe(BALANCE.moral.START);
    expect(s.flags).toEqual({});
    expect(s.position).toEqual(spawnPosition('gare-mons', 'depart'));
  });

  it('rejette les états incomplets ou invalides', () => {
    const s = createInitialGameState();
    expect(isGameState(null)).toBe(false);
    expect(isGameState({ ...s, version: 2 })).toBe(false);
    expect(isGameState({ ...s, moral: Number.NaN })).toBe(false);
    expect(isGameState({ ...s, position: { ...s.position, mapId: 'bruxelles-midi' } })).toBe(false);
    expect(isGameState({ ...s, flags: { 'intro-vue': 'oui' } })).toBe(false);
    expect(isGameState({ ...s, time: { ...s.time, restUsed: {} } })).toBe(false);
    expect(isGameState({ ...s, occMachineLevel: 4 })).toBe(false);
  });

  it('n’applique la boisson de relève que pendant sa pause', () => {
    const s = gameAt(at(9, 0), { drink: { id: 'lungo', shiftIndex: shiftIndexAt(at(9, 0)) } });
    expect(activeDrink(s)).toBe('lungo');
    expect(activeTimeModifiers(s)).toEqual({ timeMultipliers: [BALANCE.fatigue.timeMult.lungo] });
    const later = { ...s, time: { ...s.time, totalMinutes: at(15, 0) } };
    expect(activeDrink(later)).toBeNull();
    expect(activeTimeModifiers(later)).toEqual({});
  });
});

describe('effets de dialogue', () => {
  it('pose et retire des drapeaux', () => {
    const s = applyEffect(createInitialGameState(), { kind: 'flag', flag: 'intro-vue' }).state;
    expect(s.flags['intro-vue']).toBe(true);
    expect(
      applyEffect(s, { kind: 'flag', flag: 'intro-vue', value: false }).state.flags['intro-vue'],
    ).toBe(false);
  });

  it('borne le Moral à [0, 100] et les Tickets à 0', () => {
    const s = createInitialGameState();
    expect(applyEffect(s, { kind: 'moral', delta: 500 }).state.moral).toBe(100);
    expect(applyEffect(s, { kind: 'moral', delta: -500 }).state.moral).toBe(0);
    expect(applyEffect(s, { kind: 'tickets', delta: -5 }).state.tickets).toBe(0);
    expect(applyEffect(s, { kind: 'moral', delta: 5 }).notices).toEqual(['Moral +5']);
  });

  it('café de l’OCC une fois par pause, avec un motif en cas de refus', () => {
    const s = gameAt(at(9, 0), { time: { ...gameAt(at(9, 0)).time, fatigue: 60 } });
    const first = applyEffect(s, { kind: 'rest', rest: 'coffee' });
    expect(first.state.time.fatigue).toBeCloseTo(60 - 40 + (10 * 2) / 60);
    expect(first.notices[0]).toMatch(/Fatigue 60 → 20/);
    const second = applyEffect(first.state, { kind: 'rest', rest: 'coffee' });
    expect(second.state).toBe(first.state);
    expect(second.notices).toEqual(['Déjà fait pendant cette pause.']);
  });

  it('dormir remet PV/PE au maximum et met fin à la boisson', () => {
    const base = gameAt(at(9, 0));
    const s: GameState = {
      ...base,
      player: { ...base.player, hp: 1, energy: 0 },
      drink: { id: 'lungo', shiftIndex: shiftIndexAt(at(9, 0)) },
    };
    const slept = applyEffect(s, { kind: 'rest', rest: 'sleep' }).state;
    expect(slept.time.fatigue).toBe(0);
    expect(slept.player.hp).toBe(slept.player.maxHp);
    expect(slept.drink).toBeNull();
  });

  it('Ristretto : Fatigue −10 ; Lungo ralentit la Fatigue liée au temps', () => {
    const s = gameAt(at(9, 0));
    expect(applyEffect(s, { kind: 'drink', drink: 'ristretto' }).state.time.fatigue).toBe(10);
    const lungo = applyEffect(s, { kind: 'drink', drink: 'lungo' }).state;
    const hour = applyEffect(lungo, { kind: 'time', minutes: 60 }).state;
    expect(hour.time.fatigue).toBeCloseTo(20 + 2 * 0.75);
  });

  it('combat simulé : +10 min, Fatigue de combat, bandeau de victoire', () => {
    const s = gameAt(at(9, 0));
    const r = applyEffect(s, { kind: 'battle', encounter: 'consultant-junior' });
    expect(r.state.time.totalMinutes).toBe(at(9, 10));
    expect(r.state.time.fatigue).toBeCloseTo(20 + 3 + (10 * 2) / 60);
    expect(r.notices[0]).toMatch(/Victoire/);
  });

  it('téléporte, soigne, passe à l’acte suivant et délègue sauvegarde et clavier à la scène', () => {
    const s = gameAt(at(13, 0));
    expect(
      applyEffect(s, { kind: 'teleport', map: 'occ', spawn: 'entree' }).state.position,
    ).toEqual(spawnPosition('occ', 'entree'));
    const hurt = { ...s, player: { ...s.player, hp: 3 } };
    expect(applyEffect(hurt, { kind: 'heal' }).state.player.hp).toBe(s.player.maxHp);
    const act2 = applyEffect(
      { ...s, drink: { id: 'cappuccino', shiftIndex: 0 } },
      { kind: 'nextAct' },
    ).state;
    expect(act2.time.act).toBe(2);
    expect(formatClock(act2.time.totalMinutes)).toBe('14:00');
    expect(act2.drink).toBeNull();
    expect(applyEffects(s, [{ kind: 'save' }, { kind: 'keypad' }]).actions).toEqual([
      { kind: 'save' },
      { kind: 'keypad' },
    ]);
  });
});

describe('DialogueRunner', () => {
  const def: DialogueDef = {
    start: 'a',
    nodes: {
      a: {
        speaker: 'rudy',
        text: 'Bonjour {prenom}',
        next: 'b',
        effects: [{ kind: 'flag', flag: 'intro-vue' }],
      },
      b: {
        speaker: 'rudy',
        text: 'Alors ?',
        choices: [
          { label: 'Moral', next: 'c', effects: [{ kind: 'moral', delta: 5 }] },
          { label: 'Secret', when: { flags: { 'audit-vaincu': true } } },
          { label: 'Partir' },
        ],
      },
      c: { speaker: 'rudy', text: 'Bien.', effects: [{ kind: 'save' }] },
    },
  };

  it('applique les effets à l’entrée des nœuds et des choix, jusqu’à la fin', () => {
    const s0 = createInitialGameState();
    const s1 = startDialogue(def, s0);
    expect(s1.nodeId).toBe('a');
    expect(s1.state.flags['intro-vue']).toBe(true);

    const s2 = advance(def, 'a', s1.state);
    expect(s2.nodeId).toBe('b');
    expect(visibleChoices(def, 'b', s2.state).map((c) => c.label)).toEqual(['Moral', 'Partir']);

    const s3 = choose(def, 'b', s2.state, 0);
    expect(s3.nodeId).toBe('c');
    expect(s3.state.moral).toBe(s0.moral + 5);
    expect(s3.notices).toEqual(['Moral +5']);
    expect(s3.actions).toEqual([{ kind: 'save' }]);

    expect(advance(def, 'c', s3.state).nodeId).toBeNull();
  });

  it('un choix sans suite termine le dialogue', () => {
    const s = advance(def, 'a', startDialogue(def, createInitialGameState()).state).state;
    expect(choose(def, 'b', s, 1).nodeId).toBeNull();
    expect(() => choose(def, 'b', s, 5)).toThrow();
  });
});

describe('textes et objectifs', () => {
  it('remplace les jetons connus et garde les inconnus', () => {
    const s = createInitialGameState('Léa');
    const tokens = textTokens(s, 'Trouver le dossier');
    expect(interpolate('{prenom} — {objectif} à {heure} ({pause}), {inconnu}', tokens)).toBe(
      'Léa — Trouver le dossier à 04:47 (Nuit), {inconnu}',
    );
  });

  it('renvoie le premier objectif non atteint', () => {
    const list: ObjectiveDef[] = [
      { quest: 'P1', text: 'Un', doneWhen: { flags: { 'intro-vue': true } } },
      { quest: 'P1', text: 'Deux', doneWhen: { flags: { 'dossier-trouve': true } } },
    ];
    expect(currentObjective(list, { flags: {}, act: 1 })?.text).toBe('Un');
    expect(currentObjective(list, { flags: { 'intro-vue': true }, act: 1 })?.text).toBe('Deux');
    expect(
      currentObjective(list, { flags: { 'intro-vue': true, 'dossier-trouve': true }, act: 1 }),
    ).toBeNull();
  });
});

describe('Mise à pied', () => {
  it('avant l’OCC : retour au départ, Fatigue 50, +2 h, Moral −5, Tickets −25 %', () => {
    const base = gameAt(at(9, 0));
    const s: GameState = { ...base, tickets: 101, moral: 30, time: { ...base.time, fatigue: 100 } };
    const after = applyLayoff(s);
    expect(after.position).toEqual(spawnPosition('gare-mons', 'depart'));
    expect(after.time.fatigue).toBe(50);
    expect(after.time.totalMinutes).toBe(at(11, 0));
    expect(after.moral).toBe(25);
    expect(after.tickets).toBe(75);
  });

  it('après la découverte de l’OCC : retour à l’OCC ; l’horloge reste plafonnée à la butée', () => {
    const s = gameAt(at(13, 0), { flags: { 'occ-decouverte': true }, moral: 2 });
    const after = applyLayoff(s);
    expect(after.position).toEqual(spawnPosition('occ', 'entree'));
    expect(formatClock(after.time.totalMinutes)).toBe('13:45');
    expect(after.moral).toBe(0);
  });
});

describe('code du distributeur', () => {
  it('accepte 7 Expresso, 1 Lungo, 2 Sucre dans n’importe quel ordre', () => {
    const presses = [...Array<'expresso'>(7).fill('expresso'), 'sucre', 'lungo', 'sucre'] as const;
    expect(matchesCode(presses, OCC_CODE)).toBe(true);
    expect(matchesCode(['expresso', 'lungo', 'sucre'], OCC_CODE)).toBe(false);
    expect(matchesCode([...presses, 'sucre'], OCC_CODE)).toBe(false);
    expect(summarizePresses(presses)).toBe('7 Expresso · 1 Lungo · 2 Sucre+');
  });
});
