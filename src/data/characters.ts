import type { CharacterId } from '@/data/types';

export interface CharacterDef {
  /** Nom affiché dans la boîte de dialogue (`{prenom}` pour le héros). */
  readonly name: string;
  /** Thème de la boîte : SNCB pour les agents et la hiérarchie, OCC pour les rebelles. */
  readonly theme: 'sncb' | 'occ';
  /** Couleur du placeholder (corps du personnage) tant que les sprites n'existent pas. */
  readonly color: number;
}

export const CHARACTERS = {
  heros: { name: '{prenom}', theme: 'sncb', color: 0xffd200 },
  marcel: { name: 'Marcel « Pépé Rail »', theme: 'occ', color: 0x8e6b3a },
  josiane: { name: 'Josiane', theme: 'occ', color: 0xd65db1 },
  rudy: { name: 'Rudy', theme: 'occ', color: 0x3fb8e8 },
  bene: { name: 'Béné', theme: 'occ', color: 0x5bd17a },
  'jean-mi': { name: 'Jean-Mi', theme: 'occ', color: 0xa8734a },
  fatou: { name: 'Fatou', theme: 'occ', color: 0xf2a541 },
  voyageur: { name: 'Voyageur', theme: 'sncb', color: 0x9fb0c6 },
  consultant: { name: 'Consultant Junior', theme: 'sncb', color: 0x19c3b1 },
  'manager-kpi': { name: 'Manager KPI', theme: 'sncb', color: 0x19c3b1 },
  annonce: { name: 'Annonce', theme: 'sncb', color: 0xffffff },
  distributeur: { name: 'Distributeur', theme: 'sncb', color: 0x7a7a7a },
  systeme: { name: '', theme: 'sncb', color: 0xffffff },
} as const satisfies Record<CharacterId, CharacterDef>;
