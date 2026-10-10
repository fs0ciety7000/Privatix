import './styles/tokens.css';
import './styles/components.css';
import './styles/site.css';
import heroVideoUrl from './assets/video/hero-loop.webm?url';
import { initDownloads } from './downloads';
import { initLightbox, initMotionLater, initYear, reducedMotion } from './common';

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

initYear();
initLightbox();
initHeroVideo();
initMotionLater();
void initDownloads();
