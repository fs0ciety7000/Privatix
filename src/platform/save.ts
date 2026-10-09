import { browserStorage } from '@/platform/storage';
import type { MetaState } from '@/systems/meta/MetaState';
import { META_SAVE_SCHEMA, newMeta } from '@/systems/meta/MetaState';
import { SaveManager } from '@/systems/save/SaveManager';

/** Sauvegarde de la progression permanente (une seule, écrite à chaque retour à l'OCC). */
export const metaSave = new SaveManager<MetaState>(browserStorage(), META_SAVE_SCHEMA);

export function loadMeta(): MetaState {
  const result = metaSave.load();
  return result.ok ? result.data.state : newMeta();
}
