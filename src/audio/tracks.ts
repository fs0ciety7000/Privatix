/**
 * Musique enregistrée (OST) : table contexte du jeu → morceau, et règles de chargement. Fonctions
 * pures (ni Web Audio, ni DOM), testées en Vitest. La lecture est dans `sampledMusic.ts`, le
 * chargement dans `samples.ts` ; tant qu'un morceau n'est pas décodé, la musique synthétisée de
 * `music.ts` joue à sa place.
 *
 * Couches de combat : l'OST est livrée en mix complet (pas de stems). `combatIntensity()` pilote un
 * passe-bas et le gain du morceau réactif (exploration étouffée, combat ouvert) au lieu d'ouvrir
 * quatre couches. La synthèse ne joue jamais par-dessus un morceau (tonalités et tempos différents).
 */
import type { MusicFileId } from './assetIndex';
import { MUSIC_FILES } from './assetIndex';
import type { AudioProbe } from './router';

export type MusicContext =
  | 'title'
  | 'hubDay'
  | 'hubNight'
  | 'quaisExplore'
  | 'quaisCombat'
  | 'passerelle'
  | 'hallBag'
  | 'bossAuditeur'
  | 'bossInvite'
  | 'bossDiscosaure'
  | 'bossLurcke'
  | 'victory'
  | 'defeat'
  | 'credits'
  /** Silence total (coup final de Lurcke) : ni morceau, ni synthèse. */
  | 'silence';

/** Lot de chargement : le hub et le biome 1 d'abord, les biomes suivants à l'approche. */
export type TrackGroup = 'start' | 'biome1' | 'biome2' | 'biome3' | 'results' | 'credits';

export interface TrackDef {
  readonly id: MusicFileId;
  readonly file: string;
  /** Boucle (fondu enchaîné de `crossfade` s qui se termine à `loopEnd`). */
  readonly loop: boolean;
  /** Reprise de la boucle (s) : après le stinger de la victoire, 0 ailleurs. */
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly duration: number;
  /** Le passe-bas et le gain suivent l'intensité de combat. */
  readonly reactive: boolean;
  /** Plancher d'intensité (boss : la musique reste haute). */
  readonly minIntensity: number;
  readonly group: TrackGroup;
}

/** Durée du fondu enchaîné de la boucle (s). */
export const LOOP_CROSSFADE = 4;
/** Fondu enchaîné entre deux morceaux (s). */
export const TRACK_CROSSFADE = 2.5;

function track(
  id: MusicFileId,
  group: TrackGroup,
  o: { loop?: boolean; loopStart?: number; reactive?: boolean; minIntensity?: number } = {},
): TrackDef {
  const f = MUSIC_FILES[id];
  return {
    id,
    file: f.file,
    loop: o.loop ?? true,
    loopStart: o.loopStart ?? 0,
    loopEnd: f.loopEnd,
    duration: f.duration,
    reactive: o.reactive ?? false,
    minIntensity: o.minIntensity ?? 0,
    group,
  };
}

/** Contexte → morceau (prise t1). */
export const TRACKS: Readonly<Record<Exclude<MusicContext, 'silence'>, TrackDef>> = {
  title: track('ost.01-prise-de-poste', 'start'),
  hubDay: track('ost.02-occ-jour', 'start'),
  hubNight: track('ost.03-occ-nuit', 'start'),
  quaisExplore: track('ost.04-quais-exploration', 'start'),
  quaisCombat: track('ost.05-quais-combat', 'start', { reactive: true }),
  passerelle: track('ost.06-passerelle', 'biome2', { reactive: true }),
  hallBag: track('ost.07-hall-bag', 'biome3', { reactive: true }),
  bossAuditeur: track('ost.08-boss-auditeur', 'biome1', { reactive: true, minIntensity: 0.6 }),
  bossInvite: track('ost.09-boss-invite', 'biome2', { reactive: true, minIntensity: 0.6 }),
  bossDiscosaure: track('ost.10-boss-discosaure', 'biome3', { reactive: true, minIntensity: 0.6 }),
  bossLurcke: track('ost.11-boss-lurcke', 'biome3', { reactive: true, minIntensity: 0.6 }),
  victory: track('ost.12-departs-victoire', 'results', { loopStart: 6 }),
  defeat: track('ost.13-departs-supprime', 'results', { loop: false }),
  credits: track('ost.14-le-7h12', 'credits', { loop: false }),
};

export function trackFor(ctx: MusicContext): TrackDef | null {
  return ctx === 'silence' ? null : TRACKS[ctx];
}

/** État que le directeur garde d'une frame à l'autre pour choisir le contexte. */
export interface MusicContextState {
  /** Combat en cours (ennemis en vie, avec maintien de quelques secondes après le dernier). */
  readonly combat: boolean;
  /** Coup final de Lurcke porté : silence jusqu'à la fin du Shift. */
  readonly finalSilence: boolean;
  /** Issue du dernier Shift (écran des départs). */
  readonly end: 'victoire' | 'mort' | null;
  /** Générique demandé par la scène. */
  readonly credits: boolean;
}

/** Le contexte musical d'un instantané du monde. */
export function musicContextOf(p: AudioProbe, s: MusicContextState): MusicContext {
  if (s.credits) return 'credits';
  switch (p.phase) {
    case 'title':
      return 'title';
    case 'hub':
      return p.shift === 'nuit' ? 'hubNight' : 'hubDay';
    case 'results':
      return s.end === 'victoire' ? 'victory' : 'defeat';
    case 'run':
      break;
  }
  if (s.finalSilence) return 'silence';
  const biome = p.biome;
  if (p.roomType === 'boss')
    return biome >= 2 ? 'bossLurcke' : biome === 1 ? 'bossInvite' : 'bossAuditeur';
  if (p.roomType === 'gardee' && biome >= 2) return 'bossDiscosaure';
  if (biome >= 2) return 'hallBag';
  if (biome === 1) return 'passerelle';
  return s.combat && p.roomType !== 'repos' ? 'quaisCombat' : 'quaisExplore';
}

/** Lots à charger pour un contexte : le sien, puis celui qui suit (anticipation). */
export function groupsFor(ctx: MusicContext, p: AudioProbe): TrackGroup[] {
  const groups: TrackGroup[] = ['start'];
  if (ctx === 'credits') groups.push('credits');
  if (p.phase !== 'run') return groups;
  const biome = p.biome;
  // Biome courant + boss + écrans des départs ; dans la Salle des pauses, le biome suivant.
  groups.push(biome >= 2 ? 'biome3' : biome === 1 ? 'biome2' : 'biome1', 'results');
  if (p.roomType === 'repos' && biome === 0) groups.push('biome2');
  if (p.roomType === 'repos' && biome === 1) groups.push('biome3');
  return groups;
}

export function tracksOfGroups(groups: readonly TrackGroup[]): TrackDef[] {
  const seen = new Set<string>();
  const out: TrackDef[] = [];
  for (const t of Object.values(TRACKS)) {
    if (!groups.includes(t.group) || seen.has(t.file)) continue;
    seen.add(t.file);
    out.push(t);
  }
  return out;
}

/**
 * Filtre et gain d'un morceau réactif selon l'intensité (0..1) : exploration étouffée (passe-bas vers
 * 900 Hz, −3 dB), combat plein (filtre ouvert, gain 1). Morceau non réactif : neutre.
 */
export function reactiveMix(t: TrackDef, intensity: number): { cutoff: number; gain: number } {
  if (!t.reactive) return { cutoff: 20000, gain: 1 };
  const i = Math.max(t.minIntensity, Math.max(0, Math.min(1, intensity)));
  const open = Math.min(1, i / 0.75);
  return { cutoff: Math.min(20000, 900 * Math.pow(20000 / 900, open)), gain: 0.7 + 0.3 * open };
}

/**
 * Planning d'une boucle : la prochaine itération démarre à `start + (loopEnd − crossfade − offset)`
 * pour que le fondu enchaîné se termine exactement au point de bouclage.
 */
export function nextLoopAt(t: TrackDef, startedAt: number, offset: number): number | null {
  if (!t.loop) return null;
  const end = Math.max(offset + LOOP_CROSSFADE + 1, t.loopEnd);
  return startedAt + (end - offset) - LOOP_CROSSFADE;
}
