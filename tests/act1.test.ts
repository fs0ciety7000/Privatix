import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/config/balance';
import { OBJECTIVES } from '@/data/objectives';
import type { GameState } from '@/systems/GameState';
import { createInitialGameState } from '@/systems/GameState';
import { contextOf } from '@/systems/story/DialogueRunner';
import { currentObjective } from '@/systems/story/Objectives';
import { formatClock } from '@/systems/time/FatigueClock';
import type { SimLog } from './support/simulate';
import { arrive, newLog, preferChoices, talkTo, walkTo } from './support/simulate';

/**
 * Bout en bout de l'Acte I (jalon M1), sans Phaser : chaque étape vérifie que la cible est visible et
 * accessible à pied dans l'état courant de l'histoire, puis joue le dialogue comme le ferait le joueur.
 */
function objective(state: GameState): string | null {
  return currentObjective(OBJECTIVES, contextOf(state))?.text ?? null;
}

function playActOne(): { state: GameState; log: SimLog; objectives: (string | null)[] } {
  const log = newLog();
  const objectives: (string | null)[] = [];
  const track = (s: GameState): GameState => {
    objectives.push(objective(s));
    return s;
  };

  // P1 — Trouver le dossier
  let s = track(arrive(createInitialGameState('Léa'), log));
  s = track(talkTo(s, { prop: 'borne-rebelle' }, log));
  s = track(talkTo(s, { prop: 'imprimante' }, log));
  // Le Consultant, puis Marcel au couloir (téléportations et dialogues d'arrivée enchaînés).
  s = track(talkTo(s, { character: 'consultant' }, log));

  // P2 — Trois tasses, trois collègues
  s = walkTo(s, 'gare-couloir-technique', log);
  s = track(
    talkTo(
      s,
      { prop: 'post-it-vivant' },
      log,
      preferChoices('combat', 'attraper', 'récupérer', 'rendre'),
    ),
  );
  s = walkTo(s, 'gare-mons', log);
  s = track(talkTo(s, { character: 'josiane' }, log));
  s = track(talkTo(s, { prop: 'escalator-b' }, log));
  s = track(talkTo(s, { character: 'rudy' }, log));
  for (const marker of ['1', '2', '3'])
    s = track(talkTo(s, { character: 'voyageur', marker }, log));
  s = track(talkTo(s, { character: 'bene' }, log));

  // P3 — L'audit des quais : retour à l'OCC par le distributeur (code 7-1-2), annonce, puis le quai.
  s = walkTo(s, 'gare-couloir-technique', log);
  s = track(
    talkTo(s, { prop: 'distributeur-hs' }, log, preferChoices('code', 'composer', 'expresso')),
  );
  if (s.flags['audit-annonce'] !== true) s = track(talkTo(s, { character: 'marcel' }, log));
  s = walkTo(s, 'gare-couloir-technique', log);
  s = walkTo(s, 'gare-mons', log);
  s = track(talkTo(s, { character: 'manager-kpi' }, log));
  return { state: s, log, objectives };
}

describe('Acte I de bout en bout', () => {
  const { state, log, objectives } = playActOne();

  it('pose tous les drapeaux du fil principal et de « Trois tasses, trois collègues »', () => {
    for (const flag of [
      'intro-vue',
      'borne-vaincue',
      'dossier-trouve',
      'consultant-vaincu',
      'code-occ-connu',
      'occ-decouverte',
      'tasse-releve-vue',
      'quete-trois-tasses',
      'thermos-retrouve',
      'josiane-recrutee',
      'sifflet-recupere',
      'rudy-recrute',
      'voyageur-1-renseigne',
      'voyageur-2-renseigne',
      'voyageur-3-renseigne',
      'bene-recrutee',
      'audit-annonce',
      'audit-vaincu',
    ] as const) {
      expect(state.flags[flag], flag).toBe(true);
    }
  });

  it('passe à l’Acte II à la relève de 14h00', () => {
    expect(state.time.act).toBe(2);
    expect(formatClock(state.time.totalMinutes)).toBe('14:00');
  });

  it('gagne le Moral prévu : 3 recrutements et le mini-boss (+5 chacun)', () => {
    const { START, gains } = BALANCE.moral;
    expect(state.moral).toBeGreaterThanOrEqual(START + 3 * gains.recruitAlly + gains.actOneBoss);
  });

  it('atteint tous les objectifs, dans l’ordre, sans jamais revenir en arrière', () => {
    expect(objective(state)).toBeNull();
    const seen = objectives.filter((o): o is string => o !== null);
    const order = OBJECTIVES.map((o) => o.text);
    const indexes = seen.map((o) => order.indexOf(o));
    expect(indexes.every((v, i) => i === 0 || v >= (indexes[i - 1] ?? 0))).toBe(true);
  });

  it('enchaîne Consultant → couloir (Marcel) → OCC → Tasse de Relève sans intervention', () => {
    const i = log.dialogues.indexOf('consultant');
    expect(log.dialogues.slice(i, i + 3)).toEqual([
      'consultant',
      'marcel-couloir',
      'occ-bienvenue',
    ]);
  });

  it('tient la pause du Matin sans Mise à pied ni texte avec jeton inconnu', () => {
    expect(log.dialogues).not.toContain('mise-a-pied');
    expect(state.time.fatigue).toBeLessThan(BALANCE.fatigue.MAX);
    const tokens = log.texts.flatMap((t) => t.match(/\{[a-z]+\}/g) ?? []);
    const known = new Set([
      '{prenom}',
      '{objectif}',
      '{heure}',
      '{pause}',
      '{fatigue}',
      '{moral}',
      '{tickets}',
    ]);
    expect(tokens.filter((t) => !known.has(t))).toEqual([]);
  });

  it('joue les 4 combats scénarisés, dans l’ordre du récit', () => {
    expect(log.battles).toEqual([
      'borne-rebelle',
      'consultant-junior',
      'post-it-vivant',
      'audit-manager-kpi',
    ]);
  });
});

describe('services de l’OCC', () => {
  it('la Vieille Dame sauvegarde et soigne ; le café est refusé la deuxième fois', () => {
    const { state } = playActOne();
    const log = newLog();
    let s = walkTo(state, 'gare-couloir-technique', log);
    s = talkTo(s, { prop: 'distributeur-hs' }, log, preferChoices('code', 'composer', 'expresso'));
    expect(s.position.mapId).toBe('occ');
    const hurt: GameState = { ...s, player: { ...s.player, hp: 1 } };

    const saveLog = newLog();
    const saved = talkTo(hurt, { prop: 'vieille-dame' }, saveLog, preferChoices('sauve'));
    expect(saved.player.hp).toBe(saved.player.maxHp);

    const coffeeLog = newLog();
    const once = talkTo(saved, { prop: 'vieille-dame' }, coffeeLog, preferChoices('café'));
    const twice = talkTo(once, { prop: 'vieille-dame' }, coffeeLog, preferChoices('café'));
    expect(once.time.restUsed.coffee).toBe(true);
    expect(coffeeLog.notices).toContain('Déjà fait pendant cette pause.');
    expect(twice.time.fatigue).toBeGreaterThanOrEqual(once.time.fatigue);
  });
});
