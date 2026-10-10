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
 * Lecteur du trailer (section #trailer) : quand il joue avec le son, le trailer muet du fond du hero
 * se met en pause, et reprend à la fin ou à la pause (hors mouvement réduit).
 */
function initTrailer(): void {
  const player = document.querySelector<HTMLVideoElement>('[data-trailer-player]');
  const bg = document.querySelector<HTMLVideoElement>('[data-trailer-bg]');
  if (!player) return;
  player.addEventListener('play', () => bg?.pause());
  const resume = (): void => {
    if (bg?.src && !reducedMotion.matches) void bg.play().catch(() => undefined);
  };
  player.addEventListener('pause', resume);
  player.addEventListener('ended', resume);
}

initYear();
initLightbox();
initHeroVideo();
initTrailer();
initMotionLater();
void initDownloads();
