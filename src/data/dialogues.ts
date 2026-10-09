import type { DialogueDef } from '@/data/types';

/** Dialogues de l'Acte I. STUB : remplacé par le contenu de l'Acte I. */
export const DIALOGUES = {
  intro: {
    start: 'debut',
    nodes: {
      debut: {
        speaker: 'annonce',
        text: 'Le train de 7h12 est supprimé.',
        effects: [{ kind: 'flag', flag: 'intro-vue' }],
      },
    },
  },
  'mise-a-pied': {
    start: 'debut',
    nodes: {
      debut: { speaker: 'systeme', text: 'Mise à pied.' },
    },
  },
} satisfies Record<string, DialogueDef>;

export type DialogueId = keyof typeof DIALOGUES;
