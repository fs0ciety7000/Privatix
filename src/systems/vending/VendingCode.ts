import type { VendingButton } from '@/data/story';

/** Nombre maximal de pressions avant validation automatique (assez pour 7 + 1 + 2). */
export const MAX_PRESSES = 12;

/** Vrai si les pressions contiennent exactement les quantités du code, dans n'importe quel ordre. */
export function matchesCode(
  presses: readonly VendingButton[],
  code: Readonly<Record<VendingButton, number>>,
): boolean {
  const counts: Record<VendingButton, number> = { expresso: 0, lungo: 0, sucre: 0 };
  for (const p of presses) counts[p] += 1;
  return (Object.keys(code) as VendingButton[]).every((b) => counts[b] === code[b]);
}

/** Résumé affiché sur l'écran du distributeur : « 7 Expresso · 1 Lungo · 2 Sucre+ ». */
export function summarizePresses(presses: readonly VendingButton[]): string {
  const counts: Record<VendingButton, number> = { expresso: 0, lungo: 0, sucre: 0 };
  for (const p of presses) counts[p] += 1;
  return `${String(counts.expresso)} Expresso · ${String(counts.lungo)} Lungo · ${String(counts.sucre)} Sucre+`;
}
