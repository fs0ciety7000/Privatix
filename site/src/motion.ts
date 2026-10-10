/**
 * Mouvement du site (docs/DESIGN_SYSTEM.md § 4). Tout passe par ce module : presets GSAP nommés
 * d'après les tokens CSS (`--dur-*`, `--ease-*`), et une seule règle d'accessibilité,
 * `gsap.matchMedia()` sur `prefers-reduced-motion` : en mouvement réduit, pas de révélation, pas de
 * parallax, pas de compteur animé et AUCUN clignotement.
 *
 * Contenu visible sans JavaScript : l'état initial des révélations n'est posé qu'ici, et seulement
 * pour les éléments encore sous la ligne de flottaison (rien ne masque le LCP).
 * Seuls gsap (cœur) et ScrollTrigger sont importés.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Durées en secondes, miroir des tokens CSS `--dur-*`. */
export const DUR = {
  instant: 0.08,
  fast: 0.15,
  base: 0.25,
  slow: 0.6,
  xslow: 1.2,
} as const;

/** Eases nommées du design system → eases GSAP (miroir des `--ease-*`). */
export const EASE = {
  /** Entrée lourde qui se pose, comme une traverse sur le ballast. */
  ballast: 'expo.out',
  /** Impact, pop du combo : léger dépassement. */
  coup: 'back.out(1.7)',
  /** Glissement continu (parallax, défilement). */
  rail: 'power2.inOut',
  /** Allumage tout ou rien d'un tube néon. */
  neon: 'steps(1)',
  /** Retour élastique (réservé au Coup de sifflet). */
  sifflet: 'elastic.out(1, 0.5)',
} as const;

export const REDUCED = '(prefers-reduced-motion: reduce)';
export const FULL = '(prefers-reduced-motion: no-preference)';

/** Preset « révélation » : glisse de 24 px et apparaît, déclenchée une fois au scroll. */
export function reveal(targets: Element[], opts: { y?: number; stagger?: number } = {}): void {
  const below = targets.filter((t) => t.getBoundingClientRect().top > innerHeight * 0.95);
  ScrollTrigger.batch(below, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: DUR.slow, ease: EASE.ballast, stagger: opts.stagger ?? 0.08, overwrite: true }),
  });
  gsap.set(below, { autoAlpha: 0, y: opts.y ?? 24 });
}

/**
 * Preset « allumage » des portraits (bestiaire, équipement, collègues) : la figurine sort de l'ombre
 * comme sous un projecteur qui chauffe (luminosité, léger recul de zoom), par lot au scroll.
 * Les propriétés sont rendues au CSS à la fin (survol des cartes).
 */
export function portraitIgnite(targets: Element[]): void {
  const below = targets.filter((t) => t.getBoundingClientRect().top > innerHeight * 0.95);
  if (!below.length) return;
  gsap.set(below, { scale: 1.1, filter: 'brightness(0.25) saturate(0.4)' });
  ScrollTrigger.batch(below, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        scale: 1,
        filter: 'brightness(1) saturate(1)',
        duration: DUR.xslow,
        ease: EASE.ballast,
        stagger: 0.12,
        overwrite: true,
        clearProps: 'transform,filter',
      }),
  });
}

/** Preset « néon » : allumage hésitant d'un tube (quelques coupures nettes), puis tenu. */
export function neonIgnite(target: Element, delay = 0): gsap.core.Timeline {
  const tl = gsap.timeline({ delay });
  const steps: [number, number][] = [
    [0.15, 0.06],
    [1, 0.05],
    [0.3, 0.08],
    [1, 0.12],
    [0.55, 0.05],
    [1, 0],
  ];
  tl.set(target, { opacity: 0.15 });
  for (const [o, d] of steps) tl.to(target, { opacity: o, duration: d, ease: EASE.neon });
  return tl;
}

/** Preset « néon fatigué » : micro-coupure aléatoire, rare (toutes les 6 à 12 s). */
export function neonFlicker(target: Element): gsap.core.Timeline {
  return gsap
    .timeline({ repeat: -1, repeatDelay: 6, repeatRefresh: true, delay: 4 })
    .to(target, { opacity: 0.35, duration: 0.04, ease: EASE.neon })
    .to(target, { opacity: 1, duration: 0.06, ease: EASE.neon })
    .to(target, { opacity: 0.6, duration: 0.03, ease: EASE.neon })
    .to(target, { opacity: 1, duration: 0.03, ease: EASE.neon, delay: () => gsap.utils.random(0, 6) });
}

/** Preset « compteur » : le nombre défile de 0 à sa valeur quand il devient visible. */
export function countUp(target: HTMLElement): void {
  const to = Number(target.dataset.count);
  if (!Number.isFinite(to)) return;
  const obj = { v: 0 };
  ScrollTrigger.create({
    trigger: target,
    start: 'top 92%',
    once: true,
    onEnter: () =>
      gsap.to(obj, {
        v: to,
        duration: DUR.xslow,
        ease: 'power2.out',
        onUpdate: () => {
          target.textContent = String(Math.round(obj.v));
        },
      }),
  });
}

/** Preset « jauge » : remplissage depuis zéro (HUD de démonstration). */
export function fillGauge(target: Element): void {
  gsap.from(target, {
    scaleX: 0,
    transformOrigin: 'left center',
    duration: DUR.xslow,
    ease: EASE.ballast,
    scrollTrigger: { trigger: target, start: 'top 90%', once: true },
  });
}

/** Preset « parallax » léger : le média glisse plus lentement que la page. */
export function parallax(target: Element, trigger: Element, yPercent = 12): void {
  gsap.to(target, {
    yPercent,
    ease: 'none',
    scrollTrigger: { trigger, start: 'top top', end: 'bottom top', scrub: 0.4 },
  });
}

/**
 * Preset « entrée du hero » : timeline courte. Rien n'y est masqué (le contenu du hero est déjà peint
 * et compte pour le LCP) : le logo (mono blanc, sans néon) monte d'un simple fondu, puis les actions
 * font un léger « pop » d'impact.
 */
export function heroIntro(root: ParentNode): gsap.core.Timeline {
  const tl = gsap.timeline();
  const logo = root.querySelector('[data-hero-logo]');
  const actions = Array.from(root.querySelectorAll('.hero__actions .btn'));
  if (logo) tl.from(logo, { opacity: 0.2, y: 6, duration: DUR.slow, ease: EASE.ballast, clearProps: 'opacity,transform' }, 0.05);
  if (actions.length) {
    tl.from(actions, { scale: 0.94, duration: DUR.slow, ease: EASE.coup, stagger: 0.08, clearProps: 'transform' }, 0.25);
  }
  return tl;
}

/** Point d'entrée : applique les presets à la page selon la préférence de mouvement. */
export function initMotion(): void {
  const mm = gsap.matchMedia();
  mm.add(FULL, () => {
    const hero = document.querySelector('.hero');
    if (hero) {
      heroIntro(hero);
      const media = hero.querySelector('.hero__video');
      if (media) parallax(media, hero);
    }
    const neon = document.querySelector('[data-neon]');
    if (neon) neonFlicker(neon);
    reveal(Array.from(document.querySelectorAll('[data-reveal]')));
    portraitIgnite(Array.from(document.querySelectorAll('.foe__img, .loadout__img, .mate__img, .kit__img')));
    document.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
    document.querySelectorAll('[data-gauge]').forEach(fillGauge);
  });
  // Mouvement réduit : rien n'est animé ni masqué, aucun clignotement. Les transitions CSS sont
  // ramenées à 0 par les tokens `--dur-*` (tokens.css).
  mm.add(REDUCED, () => {
    gsap.set('[data-reveal], [data-neon], [data-hero-logo]', { clearProps: 'opacity,visibility,transform' });
    gsap.set('.foe__img, .loadout__img, .mate__img, .kit__img', { clearProps: 'transform,filter' });
  });
}
