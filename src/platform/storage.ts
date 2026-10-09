import type { KeyValueStorage } from '@/systems/save/SaveManager';

/**
 * Seul point de contact avec le stockage du navigateur.
 * L'accès lui-même peut lever (navigation privée, stockage bloqué) : on renvoie alors `null`.
 */
export function browserStorage(): KeyValueStorage | null {
  try {
    const storage = localStorage;
    const probe = 'privatix.probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
