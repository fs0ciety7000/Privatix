import type { ObjectiveDef } from '@/data/types';

/**
 * Objectifs affichés par l'écran des départs (« IC 4211 — {objectif} — RETARD +∞ »), dans l'ordre :
 * l'objectif courant est le premier non atteint. Quêtes principales de l'Acte I (GDD § 10.2) :
 * P1 Trouver le dossier, P2 Trois tasses, trois collègues, P3 L'audit des quais.
 */
export const OBJECTIVES: readonly ObjectiveDef[] = [
  {
    quest: 'P1',
    text: 'Trouver le dossier : l’imprimante du sous-chef (hall)',
    doneWhen: { flags: { 'dossier-trouve': true } },
  },
  {
    quest: 'P1',
    text: 'Faire taire la borne qui mord (hall)',
    doneWhen: { flags: { 'borne-vaincue': true } },
  },
  {
    quest: 'P1',
    text: 'Un consultant réclame son impression (bureau du sous-chef)',
    doneWhen: { flags: { 'consultant-vaincu': true } },
  },
  {
    quest: 'P1',
    text: 'Reprendre ses esprits dans le couloir technique',
    doneWhen: { flags: { 'occ-decouverte': true } },
  },
  {
    quest: 'P1',
    text: 'Boire la Tasse de Relève à l’OCC',
    doneWhen: { flags: { 'tasse-releve-vue': true } },
  },
  {
    quest: 'P2',
    text: 'Trois tasses : le thermos volé de Josiane (quai 2)',
    doneWhen: { flags: { 'josiane-recrutee': true } },
  },
  {
    quest: 'P2',
    text: 'Trois tasses : le sifflet de Rudy (passerelle)',
    doneWhen: { flags: { 'rudy-recrute': true } },
  },
  {
    quest: 'P2',
    text: 'Trois tasses : la file éternelle de Béné (hall)',
    doneWhen: { flags: { 'bene-recrutee': true } },
  },
  {
    quest: 'P3',
    text: 'L’audit des quais : retrouver Marcel à l’OCC',
    doneWhen: { flags: { 'audit-annonce': true } },
  },
  {
    quest: 'P3',
    text: 'L’audit des quais : le Manager KPI (quai 2)',
    doneWhen: { flags: { 'audit-vaincu': true } },
  },
];

/** Texte affiché quand tous les objectifs de l'acte sont atteints. */
export const OBJECTIVES_DONE_TEXT = 'Acte I terminé. La suite arrive au prochain jalon.';
