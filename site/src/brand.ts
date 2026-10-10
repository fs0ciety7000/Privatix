/**
 * Emblèmes de CARDOR Media animés (pied de page) : portage minimal, en TypeScript sans framework,
 * du mouvement des emblèmes du site de la holding (dépôt mons-corp, `src/lib/brand/emblem-motion.ts`
 * et `src/lib/components/brand/Logo.svelte`, charte `docs/brand/emblem-motion.md`). Provenance et
 * règles d'usage : `src/assets/brand/README.md`.
 *
 * Seuls deux emblèmes sont portés :
 * - le Dragon du Doudou (OCC Interactive) : révélation « démarrage en glitch » au premier passage
 *   dans l'écran, puis le glitch signature au survol ou au focus du lockup ;
 * - la roue du Car d'Or (monogramme CARDOR) : un tour complet, le noyau Ember « bat », au survol.
 *
 * Le HTML porte des <img data-emblem="…"> (rendu statique, sans JavaScript). Ce module, chargé à
 * part et jamais en mouvement réduit, les remplace par le SVG en ligne (même fichier, déjà en cache)
 * pour animer chaque facette. Échec de chargement : l'image statique reste.
 */
import { gsap } from 'gsap';

type EmblemName = 'interactive' | 'cardor-monogram';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Courbes CARDOR (`cardor.*`, définies comme CustomEase sur le site de la holding) : ce sont des
 * Bézier cubiques simples, recalculées ici pour ne pas embarquer le greffon CustomEase.
 */
function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (u: number): number => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number): number => ((ay * u + by) * u + cy) * u;
  const dx = (u: number): number => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Newton, puis dichotomie si la pente s'annule.
    let u = t;
    for (let i = 0; i < 6; i += 1) {
      const e = sx(u) - t;
      const d = dx(u);
      if (Math.abs(e) < 1e-5) return sy(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0;
    let hi = 1;
    u = t;
    for (let i = 0; i < 24; i += 1) {
      if (sx(u) < t) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

const EASE = {
  out: bezier(0.16, 1, 0.3, 1),
  snap: bezier(0.87, 0, 0.13, 1),
  elastic: 'elastic.out(1, 0.45)',
} as const;

/**
 * SVG détaillé en ligne : chaque forme est enveloppée (le <g> extérieur garde son translate(),
 * le <g class="part"> intérieur est libre d'être animé sans perdre sa position).
 */
async function inline(img: HTMLImageElement, name: EmblemName): Promise<SVGSVGElement> {
  const txt = await fetch(img.currentSrc || img.src).then((r) =>
    r.ok ? r.text() : Promise.reject(new Error(r.statusText)),
  );
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const src = doc.documentElement;
  if (src.nodeName !== 'svg') throw new Error('SVG illisible');
  doc.querySelectorAll('path, circle').forEach((shape) => {
    const outer = doc.createElementNS(SVG_NS, 'g');
    const inner = doc.createElementNS(SVG_NS, 'g');
    inner.setAttribute('class', 'part');
    const t = shape.getAttribute('transform');
    if (t) {
      outer.setAttribute('transform', t);
      shape.removeAttribute('transform');
    }
    shape.replaceWith(outer);
    outer.appendChild(inner);
    inner.appendChild(shape);
  });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', src.getAttribute('viewBox') ?? '0 0 100 100');
  svg.setAttribute('class', `${img.className} emblem`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.dataset.emblem = name;
  const root = document.createElementNS(SVG_NS, 'g');
  root.setAttribute('data-root', '');
  root.append(...Array.from(src.childNodes, (n) => document.importNode(n, true)));
  svg.appendChild(root);
  img.replaceWith(svg);
  return svg;
}

/** Mouvement signature (reconstruit à chaque lecture, comme sur le site de la holding). */
function signature(name: EmblemName, svg: SVGSVGElement, root: SVGGElement): () => gsap.core.Timeline {
  const [vx = 0, vy = 0, vw = 100, vh = 100] = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);

  if (name === 'cardor-monogram') {
    // Long amorti : les 14 rayons ne semblent jamais tourner à l'envers.
    const core = root.querySelectorAll('.t3 .part');
    return () =>
      gsap
        .timeline()
        .to(root, { rotation: '+=360', duration: 1.6, ease: EASE.out, svgOrigin: '50 50' }, 0)
        .to(core, { scale: 1.6, duration: 0.2, ease: EASE.out, svgOrigin: '50 50' }, 0.15)
        .to(core, { scale: 1, duration: 0.9, ease: EASE.elastic, svgOrigin: '50 50' }, 0.35);
  }

  // Dragon : les facettes sautent au pixel près par paliers secs, un fantôme RVB magenta passe,
  // puis tout se recale. L'opacité reste à 1 (un glitch, pas un clignotement).
  const t2 = root.querySelector<SVGGElement>('.t2');
  const facets = Array.from(root.querySelectorAll<SVGGElement>('.t2 .part'));
  let ghost: SVGGElement | null = null;
  if (t2) {
    ghost = t2.cloneNode(true) as SVGGElement;
    ghost.removeAttribute('class');
    ghost.setAttribute('fill', '#ff2bd6');
    ghost.setAttribute('style', 'mix-blend-mode:screen;opacity:0');
    t2.after(ghost);
  }
  const unit = (): number => vw / (svg.getBoundingClientRect().width || vw); // unités SVG par pixel
  return () => {
    const u = unit();
    const jump = (): number => gsap.utils.snap(u, gsap.utils.random(-1, 1) * Math.max(0.05 * vw, 6 * u));
    return gsap
      .timeline()
      .to(
        root,
        {
          skewX: -10,
          duration: 0.24,
          ease: 'steps(3)',
          yoyo: true,
          repeat: 1,
          svgOrigin: `${vx + vw / 2} ${vy + vh / 2}`,
        },
        0,
      )
      .to(
        facets,
        {
          x: jump,
          y: jump,
          duration: 0.06,
          ease: 'none',
          stagger: { each: 0.01, from: 'random' },
          repeat: 4,
          repeatRefresh: true,
        },
        0,
      )
      .to(
        ghost ?? [],
        {
          keyframes: [
            { opacity: 0.7, x: 4 * u },
            { opacity: 0, x: -3 * u },
            { opacity: 0.55, x: 2 * u },
            { opacity: 0, x: 0 },
          ],
          duration: 0.36,
          ease: 'steps(1)',
        },
        0.04,
      )
      .to(facets, { x: 0, y: 0, duration: 0.18, ease: EASE.snap });
  };
}

/** Révélation du Dragon : « démarrage en glitch », les facettes s'allument par paliers aléatoires. */
function dragonReveal(root: SVGGElement): gsap.core.Timeline {
  const parts = Array.from(root.querySelectorAll<SVGGElement>('.part'));
  gsap.set(parts, { autoAlpha: 0 });
  return gsap
    .timeline({ paused: true })
    .to(parts, { autoAlpha: 1, duration: 0.01, ease: 'none', stagger: { each: 0.025, from: 'random' } })
    .fromTo(root, { skewX: -12 }, { skewX: 0, duration: 0.5, ease: 'steps(5)' }, 0);
}

async function upgrade(img: HTMLImageElement): Promise<void> {
  const name = img.dataset.emblem as EmblemName;
  if (name !== 'interactive' && name !== 'cardor-monogram') return;
  const host = img.closest<HTMLElement>('[data-emblem-host]') ?? img.parentElement;
  if (!img.complete) await img.decode().catch(() => undefined);
  let svg: SVGSVGElement;
  try {
    svg = await inline(img, name);
  } catch {
    return; // l'image statique reste
  }
  const root = svg.querySelector<SVGGElement>('g[data-root]');
  if (!root) return;
  const build = signature(name, svg, root);

  let current: gsap.core.Timeline | null = null;
  let revealing = false;
  const play = (): void => {
    if (revealing || current?.isActive() || document.hidden) return;
    current?.kill();
    current = build();
  };

  if (name === 'interactive') {
    // Premier passage dans l'écran (≥ 1 % visible), ou 4 s au plus tard si l'emblème est déjà
    // à l'écran : un emblème rogné ne reste jamais invisible.
    const reveal = dragonReveal(root);
    revealing = true;
    const start = (): void => {
      io.disconnect();
      clearTimeout(fallback);
      void reveal.play().then(() => {
        revealing = false;
      });
    };
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && start(), { threshold: 0.01 });
    io.observe(svg);
    const fallback = setTimeout(() => {
      if (svg.getBoundingClientRect().top < innerHeight) start();
    }, 4000);
  }

  host?.addEventListener('pointerenter', play);
  host?.addEventListener('focusin', play);
}

/** Point d'entrée : chaque <img data-emblem> de la page devient un emblème animé. */
export function initEmblems(): void {
  document.querySelectorAll<HTMLImageElement>('img[data-emblem]').forEach((img) => {
    void upgrade(img);
  });
}
