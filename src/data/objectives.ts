import type { ObjectiveDef } from '@/data/types';

/** Objectifs affichés par l'écran des départs, dans l'ordre. STUB : remplacé par le contenu de l'Acte I. */
export const OBJECTIVES: readonly ObjectiveDef[] = [
  {
    quest: 'P1',
    text: 'Comprendre pourquoi le 7h12 est supprimé',
    doneWhen: { flags: { 'intro-vue': true } },
  },
];

/** Texte affiché quand tous les objectifs de l'acte sont atteints. */
export const OBJECTIVES_DONE_TEXT = 'Acte I terminé. La suite arrive au prochain jalon.';
