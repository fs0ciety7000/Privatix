/**
 * Comportements communs aux pages du site (accueil, artbook) : année du pied de page, visionneuse
 * d'images, chargement différé du mouvement GSAP.
 */

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Année du pied de page (repli statique dans le HTML). */
export function initYear(): void {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((n) => {
    n.textContent = year;
  });
}

/**
 * Visionneuse (élément <dialog> natif ; sans JS, le lien ouvre l'image). La légende vient de
 * `data-caption`, sinon de la `.shot__cap` voisine.
 */
export function initLightbox(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox-dialog]');
  const img = document.querySelector<HTMLImageElement>('[data-lightbox-img]');
  const cap = document.querySelector<HTMLElement>('[data-lightbox-cap]');
  if (!dialog || !img || !cap || typeof dialog.showModal !== 'function') return;
  document.querySelectorAll<HTMLAnchorElement>('[data-lightbox]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const thumb = a.querySelector('img');
      img.removeAttribute('src');
      img.src = a.href;
      img.alt = thumb?.alt ?? '';
      cap.textContent =
        a.dataset.caption ?? a.parentElement?.querySelector('.shot__cap')?.textContent?.trim() ?? '';
      dialog.showModal();
    });
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

/**
 * Le mouvement (GSAP) est chargé à part, quand le navigateur est libre : il ne bloque pas le rendu.
 * Les emblèmes animés de CARDOR Media (pied de page) aussi, et jamais en mouvement réduit : les
 * logos restent alors les images statiques du HTML.
 */
export function initMotionLater(): void {
  const load = (): void => {
    void import('./motion').then((m) => {
      m.initMotion();
    });
    if (!reducedMotion.matches) {
      void import('./brand').then((m) => {
        m.initEmblems();
      });
    }
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (ric) ric(load, { timeout: 1200 });
  else setTimeout(load, 200);
}
