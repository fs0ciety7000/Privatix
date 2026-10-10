import './styles/tokens.css';
import './styles/components.css';
import './styles/site.css';
import './styles/artbook.css';
import { initLightbox, initMotionLater, initYear, reducedMotion } from './common';

/**
 * Animations du jeu (WebM, repli MP4) : rien n'est téléchargé avant que la vidéo approche de
 * l'écran (affiche et sources posées à ce moment-là), lecture automatique silencieuse quand elle est
 * visible, pause hors champ. En mouvement réduit ou en économie de données : pas de lecture
 * automatique, les contrôles natifs sont affichés.
 */
function initClips(): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-clip]'));
  if (!videos.length) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const auto = (): boolean => !reducedMotion.matches && conn?.saveData !== true;
  const visible = new Set<HTMLVideoElement>();

  const arm = (v: HTMLVideoElement): void => {
    if (v.dataset.armed) return;
    v.dataset.armed = '1';
    if (v.dataset.poster) v.poster = v.dataset.poster;
    for (const [type, key] of [
      ['video/webm', 'webm'],
      ['video/mp4', 'mp4'],
    ] as const) {
      const url = v.dataset[key];
      if (!url) continue;
      const s = document.createElement('source');
      s.src = url;
      s.type = type;
      v.appendChild(s);
    }
    v.preload = auto() ? 'auto' : 'metadata';
    v.load();
  };
  const sync = (v: HTMLVideoElement): void => {
    v.controls = !auto();
    if (auto() && visible.has(v)) {
      void v.play().catch(() => {
        v.controls = true;
      });
    } else v.pause();
  };

  if (!('IntersectionObserver' in window)) {
    videos.forEach((v) => {
      arm(v);
      visible.add(v);
      sync(v);
    });
    return;
  }
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        arm(e.target as HTMLVideoElement);
        near.unobserve(e.target);
      }
    },
    { rootMargin: '400px 0px' },
  );
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) visible.add(v);
        else visible.delete(v);
        sync(v);
      }
    },
    { threshold: 0.35 },
  );
  videos.forEach((v) => {
    near.observe(v);
    seen.observe(v);
  });
  reducedMotion.addEventListener('change', () => {
    videos.forEach(sync);
  });
}

/** Boutons « Copier » des textes du press kit. */
function initCopy(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
    const target = document.querySelector<HTMLElement>(b.dataset.copy ?? '');
    if (!target || !navigator.clipboard) {
      b.hidden = true;
      return;
    }
    const label = b.textContent ?? 'Copier';
    b.addEventListener('click', () => {
      const text = Array.from(target.querySelectorAll('p'))
        .map((p) => p.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .join('\n\n');
      void navigator.clipboard
        .writeText(text || (target.textContent?.replace(/\s+/g, ' ').trim() ?? ''))
        .then(() => {
          b.textContent = 'Copié';
          setTimeout(() => {
            b.textContent = label;
          }, 1600);
        });
    });
  });
}

initYear();
initLightbox();
initClips();
initCopy();
initMotionLater();
