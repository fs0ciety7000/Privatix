import './styles/tokens.css';
import './styles/components.css';
import './styles/site.css';
import heroVideoUrl from './assets/video/hero-loop.webm?url';
import { initDownloads } from './downloads';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Année du pied de page (repli statique dans le HTML). */
function initYear(): void {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((n) => {
    n.textContent = year;
  });
}

/**
 * Boucle vidéo du hero : chargée après la page, jamais en mouvement réduit ni en économie de
 * données. L'affiche (WebP) reste l'image du LCP.
 */
function initHeroVideo(): void {
  const video = document.querySelector<HTMLVideoElement>('.hero__video');
  if (!video) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const allowed = (): boolean => !reducedMotion.matches && conn?.saveData !== true;
  const start = (): void => {
    if (!allowed()) return;
    if (!video.src) {
      video.src = heroVideoUrl;
      video.preload = 'auto';
    }
    void video.play().catch(() => {
      /* lecture automatique refusée : l'affiche reste */
    });
  };
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) video.pause();
    else start();
  });
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

/** Visionneuse de la galerie (élément <dialog> natif ; sans JS, le lien ouvre l'image). */
function initLightbox(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox-dialog]');
  const img = document.querySelector<HTMLImageElement>('[data-lightbox-img]');
  const cap = document.querySelector<HTMLElement>('[data-lightbox-cap]');
  if (!dialog || !img || !cap || typeof dialog.showModal !== 'function') return;
  document.querySelectorAll<HTMLAnchorElement>('[data-lightbox]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const thumb = a.querySelector('img');
      img.src = a.href;
      img.alt = thumb?.alt ?? '';
      cap.textContent = a.parentElement?.querySelector('.shot__cap')?.textContent?.trim() ?? '';
      dialog.showModal();
    });
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

/** Le mouvement (GSAP) est chargé à part, quand le navigateur est libre : il ne bloque pas le rendu. */
function initMotionLater(): void {
  const load = (): void => {
    void import('./motion').then((m) => {
      m.initMotion();
    });
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(load, { timeout: 1200 });
  else setTimeout(load, 200);
}

initYear();
initLightbox();
initHeroVideo();
initMotionLater();
void initDownloads();
