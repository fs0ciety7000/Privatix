import './styles/tokens.css';
import './styles/components.css';
import './styles/site.css';
import { initDownloads } from './downloads';
import { initLightbox, initMotionLater, initYear, reducedMotion } from './common';

/** Trailer (public/trailer/) : WebM VP9 1080p, repli MP4 720p (Safari, anciens navigateurs). */
const TRAILER_WEBM = '/trailer/privatix-trailer-16x9.webm';
const TRAILER_MP4 = '/trailer/privatix-trailer-720p.mp4';

/** Source lisible par ce navigateur : WebM si possible, sinon MP4. */
function trailerSrc(video: HTMLVideoElement): string {
  return video.canPlayType('video/webm; codecs="vp9"') ? TRAILER_WEBM : TRAILER_MP4;
}

/**
 * Trailer muet en fond du hero : chargé après la page (métadonnées d'abord), jamais en mouvement
 * réduit ni en économie de données. L'affiche (WebP) reste l'image du LCP.
 */
function initHeroVideo(): void {
  const video = document.querySelector<HTMLVideoElement>('.hero__video');
  if (!video) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const allowed = (): boolean => !reducedMotion.matches && conn?.saveData !== true;
  const start = (): void => {
    if (!allowed()) return;
    if (!video.src) {
      video.preload = 'metadata';
      video.src = trailerSrc(video);
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

/**
 * « Regarder avec le son » : le trailer s'ouvre en plein cadre dans un <dialog>, avec le lecteur
 * natif et le son ; le fond du hero se met en pause pendant ce temps. Sans JS, le lien ouvre le MP4.
 */
function initTrailer(): void {
  const open = document.querySelector<HTMLAnchorElement>('[data-trailer-open]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-trailer-dialog]');
  const video = dialog?.querySelector<HTMLVideoElement>('video');
  const bg = document.querySelector<HTMLVideoElement>('[data-trailer-bg]');
  if (!open || !dialog || !video || typeof dialog.showModal !== 'function') return;
  open.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    bg?.pause();
    dialog.showModal();
    video.muted = false;
    video.currentTime = 0;
    void video.play().catch(() => {
      /* lecture refusée : les contrôles natifs restent disponibles */
    });
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    if (bg?.src && !reducedMotion.matches) void bg.play().catch(() => undefined);
  });
}

initYear();
initLightbox();
initHeroVideo();
initTrailer();
initMotionLater();
void initDownloads();
