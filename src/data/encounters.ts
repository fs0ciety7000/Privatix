import type { EncounterId } from '@/data/types';

export interface EncounterDef {
  readonly name: string;
  /** Nombre de manches de référence : sert au coût de Fatigue tant que le combat est simulé (jalon M1). */
  readonly referenceRounds: number;
  readonly boss: boolean;
}

/** Rencontres de l'Acte I (GDD § 6 et § 10.1). Les stats et l'IA arrivent avec le jalon M2. */
export const ENCOUNTERS = {
  'borne-rebelle': { name: 'Borne Automatique Rebelle', referenceRounds: 3, boss: false },
  'consultant-junior': {
    name: 'Consultant Junior « Slide-Ninja »',
    referenceRounds: 4,
    boss: false,
  },
  'post-it-vivant': { name: 'Post-it Vivant', referenceRounds: 2, boss: false },
  'audit-manager-kpi': {
    name: 'Manager KPI « Auditeur des quais »',
    referenceRounds: 6,
    boss: true,
  },
} as const satisfies Record<EncounterId, EncounterDef>;
