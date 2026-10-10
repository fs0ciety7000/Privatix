/**
 * Dialogues enregistrés : qui dit quoi, quand, et sans se marcher dessus. Pur (ni Web Audio, ni DOM) :
 * le lecteur est injecté (`VoiceOut`), l'horloge passée en paramètre. Testé en Vitest.
 *
 * - `lineIdFor` : réplique affichée par le jeu (orateur + texte) → enregistrement du catalogue ;
 * - `voiceCuesFor` : événements de la sim → efforts, douleurs, barks et radio ;
 * - `VoiceScheduler` : une voix ne se chevauche jamais elle-même ; répliques, radio et barks passent
 *   l'un après l'autre (canal de dialogue) ; efforts et douleurs sont immédiats, avec un délai de
 *   récupération ; radio : jamais pendant un télégraphe de boss, au plus une ligne secondaire toutes
 *   les 3 salles (LORE § 8.4).
 * Une réplique sans fichier (Lurcke : 6 manquantes) ou pas encore décodée reste silencieuse : le
 * sous-titre du jeu s'affiche comme avant.
 */
import type { EnemyKind } from '@/config/balance';
import type { SimEvent } from '@/sim/events';
import { FAMILIES } from '@/systems/meta/Avantages';
import type { VoiceLineFile } from './assetIndex';
import { VOICE_FILES } from './assetIndex';

export type VoiceId = VoiceLineFile['voice'];
/** Effort/douleur (immédiat) < bark < radio < réplique (scénario). */
export type VoiceKind = 'effort' | 'bark' | 'radio' | 'line';

export const VOICE_LINES: ReadonlyMap<string, VoiceLineFile> = new Map(
  VOICE_FILES.map((l) => [l.id, l]),
);

/** Minuscules, sans accents ni ponctuation (« L’Auditeur » = « l auditeur »). */
export function normalizeLine(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Répliques du jeu (sim/biomes.ts, ennemis, hub) → enregistrement. Clé : fragment normalisé et
 * distinctif du texte affiché (les textes du jeu et du catalogue diffèrent parfois d'un mot).
 */
const GAME_LINES: readonly (readonly [string, string])[] = [
  // L'Invité d'honneur (biome 2)
  ['mesdames messieurs chers amis', 'vo.invite.boss.01'],
  ['je serai bref', 'vo.invite.boss.04'],
  ['permettez moi une parenthese', 'vo.invite.boss.05'],
  ['une concertation excellente idee', 'vo.invite.boss.11'],
  ['on m avait parle d une inauguration', 'vo.invite.boss.12'],
  ['je n inaugure pas une vente', 'vo.invite.boss.13'],
  // Jean-Cul Lurcke (biome 3)
  ['l equipe terrain entrez', 'vo.lurcke.boss.01'],
  ['du conseil vous m entendez', 'vo.lurcke.boss.14'],
  ['je n ai pas de slide pour ca', 'vo.lurcke.boss.20'],
  ['soyons adultes une phase pilote', 'vo.lurcke.boss.21'],
  // Léon
  ['mais concretement sur le terrain', 'vo.leon.boss.question'],
  ['article 47 alinea 3', 'vo.leon.boss.article47'],
  // Yasmina (hub)
  ['moins de monde plus de cadres', 'vo.yasmina.hub.01'],
  ['incident voyageur sur ta ligne', 'vo.yasmina.hub.02'],
  ['l auditeur est en voie d attente', 'vo.yasmina.hub.03'],
  // Marcel (hub, Tableau des revendications ; radio après l'Invité d'honneur)
  ['le retard on l appelait l aventure', 'vo.marcel.hub.01'],
  ['tableau des revendications fieu', 'vo.marcel.hub.02'],
  ['t as eu une aventure courte', 'vo.marcel.hub.03'],
  ['tant qu ils reprogramment on existe', 'vo.marcel.hub.04'],
  ['on inaugurait les gares', 'vo.marcel.radio.01'],
  // Josiane (hub, DPD et Vestiaire)
  ['ta dotation je la range', 'vo.josiane.hub.01'],
  ['le mannequin la tape dedans', 'vo.josiane.hub.02'],
  ['tu ne m appelles jamais', 'vo.josiane.hub.03'],
  ['mon sanglier de', 'vo.josiane.hub.04'],
  // Béné (hub, PACO) : la réplique après une mort finit par « Numéro suivant ! », elle passe avant.
  ['elle t a imprime la borne', 'vo.bene.hub.03'],
  ['un consultant n a pas de titre de transport', 'vo.bene.hub.01'],
  ['numero suivant', 'vo.bene.hub.02'],
  ['j ai archive ta victoire', 'vo.bene.hub.04'],
];

/** Enregistrement d'une réplique affichée par le jeu, ou `null` (personnage pas encore doublé). */
export function lineIdFor(text: string): string | null {
  const n = normalizeLine(text);
  for (const [frag, id] of GAME_LINES) if (n.includes(frag)) return id;
  return null;
}

/** Orateur d'un enregistrement (une voix = un canal). */
export function voiceOf(id: string): VoiceId | null {
  return VOICE_LINES.get(id)?.voice ?? null;
}

// ─── Déclencheurs ────────────────────────────────────────────────────────────

export interface VoiceCue {
  readonly id: string;
  readonly kind: VoiceKind;
  /** Clé de délai de récupération (par défaut l'id). */
  readonly cooldownKey?: string;
  /** Délai de récupération (s) : rien d'autre sous la même clé avant ce délai. */
  readonly cooldown?: number;
  /** Une seule fois par Shift. */
  readonly once?: boolean;
  /** Radio prioritaire (hors règle des 3 salles). */
  readonly important?: boolean;
}

/** Contexte du Shift dont les déclencheurs ont besoin. */
export interface VoiceContext {
  /** Type d'un ennemi d'après son identifiant. */
  readonly kindOf: (id: number) => EnemyKind | undefined;
  /** Boss de la salle en cours (`null` hors salle de boss). */
  readonly boss: EnemyKind | null;
  /** Énergie max du héros (pour classer une douleur légère ou lourde). */
  readonly maxEnergy: number;
  /** Type de la salle en cours (avant l'événement). */
  readonly roomType: string;
}

const EFFORT_CD = 2.2;

/** Événement de la sim → répliques (efforts, barks, radio). Les sous-titres passent par `lineIdFor`. */
export function voiceCuesFor(e: SimEvent, c: VoiceContext): VoiceCue[] {
  switch (e.type) {
    case 'swing':
      if (e.dashAttack) return [];
      if (e.finisher || e.combo >= 3)
        return [
          { id: 'vo.leon.effort.coup3', kind: 'effort', cooldownKey: 'coup3', cooldown: 1.5 },
        ];
      return [
        {
          id: e.combo === 2 ? 'vo.leon.effort.coup2' : 'vo.leon.effort.coup1',
          kind: 'effort',
          cooldownKey: 'coup',
          cooldown: EFFORT_CD,
        },
      ];
    case 'dash':
      return [{ id: 'vo.leon.effort.dash', kind: 'effort', cooldown: 3.5 }];
    case 'special':
      return [
        {
          id: e.kind === 'preavis' ? 'vo.leon.effort.preavis' : 'vo.leon.effort.sifflet',
          kind: 'effort',
          cooldown: 2,
        },
      ];
    case 'heroHurt': {
      const heavy = e.amount >= c.maxEnergy * 0.2;
      return [
        heavy
          ? { id: 'vo.leon.douleur.lourde', kind: 'effort', cooldownKey: 'douleur', cooldown: 6 }
          : { id: 'vo.leon.douleur.legere', kind: 'effort', cooldownKey: 'douleur', cooldown: 2.5 },
      ];
    }
    case 'heroDied': {
      const cues: VoiceCue[] = [{ id: 'vo.leon.ko', kind: 'line' }];
      if (c.boss === 'dirupo') cues.push({ id: 'vo.invite.boss.15', kind: 'line' });
      if (c.boss === 'lurcke') cues.push({ id: 'vo.lurcke.boss.23', kind: 'line' });
      return cues;
    }
    case 'perfectDash':
      return [
        { id: 'vo.leon.bark.dashparfait', kind: 'bark', once: true },
        { id: 'vo.yasmina.radio.01', kind: 'radio', once: true, important: true },
      ];
    case 'roomEntered':
      // Salle des pauses : le boss du biome est la salle suivante.
      return e.roomType === 'repos'
        ? [{ id: 'vo.yasmina.radio.05', kind: 'radio', important: true, cooldown: 30 }]
        : [];
    case 'doorTaken':
      return c.roomType === 'repos' ? [{ id: 'vo.leon.soupir', kind: 'bark', cooldown: 30 }] : [];
    case 'roomCleared':
      return [{ id: 'vo.leon.bark.salle', kind: 'bark', cooldown: 90 }];
    case 'enemySpawn':
      return c.kindOf(e.id) === 'consultant'
        ? [{ id: 'vo.leon.bark.consultant', kind: 'bark', cooldown: 240 }]
        : [];
    case 'enemyStrike': {
      const kind = c.kindOf(e.id);
      if (kind === 'dirupo' && e.attack === 'scissors')
        return [{ id: 'vo.invite.boss.20', kind: 'bark', cooldown: 10 }];
      if (kind === 'dirupo' && e.attack === 'speech')
        return [{ id: 'vo.invite.boss.06', kind: 'bark', cooldown: 14 }];
      if (kind === 'lurcke' && e.attack === 'copy')
        return [{ id: 'vo.lurcke.boss.12', kind: 'bark', cooldown: 20 }];
      if (kind === 'lurcke' && e.attack === 'bullets')
        return [{ id: 'vo.lurcke.boss.11', kind: 'bark', cooldown: 25 }];
      if (kind === 'lurcke' && e.attack === 'charts')
        return [{ id: 'vo.lurcke.boss.13', kind: 'bark', cooldown: 25 }];
      return [];
    }
    case 'bossIntro':
      // Léon répond à Lurcke après sa réplique d'entrée.
      // Léon répond à Lurcke, puis Josiane à la radio (« Ces quatorze-là, ils ont un nom »).
      return e.kind === 'lurcke'
        ? [
            { id: 'vo.leon.boss.signature', kind: 'line' },
            { id: 'vo.josiane.radio.01', kind: 'radio', important: true, once: true },
          ]
        : [];
    case 'bossPhase':
      if (c.boss === 'lurcke' && e.phase === 2)
        return [{ id: 'vo.leon.boss.preuve', kind: 'line', once: true }];
      if (c.boss === 'lurcke' && e.phase >= 3)
        return [{ id: 'vo.lurcke.boss.19', kind: 'line', once: true }];
      if (c.boss === 'dirupo' && e.phase >= 3)
        return [{ id: 'vo.invite.boss.09', kind: 'line', once: true }];
      return [];
    case 'biomeEntered':
      if (e.biome === 1) return [{ id: 'vo.yasmina.radio.03', kind: 'radio', important: true }];
      if (e.biome === 2) return [{ id: 'vo.yasmina.radio.04', kind: 'radio', important: true }];
      return [];
    case 'lootDropped':
      return e.rank >= 4 ? [{ id: 'vo.leon.bark.loot', kind: 'bark', cooldown: 60 }] : [];
    case 'shiftEnded':
      return e.end === 'victoire'
        ? [{ id: 'vo.yasmina.radio.08', kind: 'radio', important: true }]
        : [];
    default:
      return [];
  }
}

/** Barks déduits de l'état (pas d'événement dédié dans la sim). */
export interface VoiceProbe {
  readonly roomType: string;
  readonly energy: number;
  readonly burnoutTier: number;
  readonly meltdown: boolean;
  readonly gobelets: number;
  readonly heroState: string;
  readonly mobilisation: number;
  /** Familles d'Avantage proposées dans la fenêtre de choix ouverte (couleurs), vide sinon. */
  readonly choiceFamilies: readonly number[];
}

/** Radio du collègue dont l'Avantage est proposé (Marcel, Béné, Josiane). */
const AVANTAGE_RADIO: readonly (readonly [number, string])[] = [
  [FAMILIES.marcel.color, 'vo.marcel.radio.02'],
  [FAMILIES.bene.color, 'vo.bene.radio.01'],
  [FAMILIES.josiane.color, 'vo.josiane.radio.02'],
];

export function voiceCuesFromProbe(prev: VoiceProbe, next: VoiceProbe): VoiceCue[] {
  const cues: VoiceCue[] = [];
  if (next.energy < 0.3 && prev.energy >= 0.3 && next.energy > 0)
    cues.push({ id: 'vo.leon.bark.energie', kind: 'bark', cooldown: 60 });
  if (next.meltdown && !prev.meltdown)
    cues.push({ id: 'vo.leon.bark.petage', kind: 'bark', once: true });
  else if (next.burnoutTier >= 3 && prev.burnoutTier < 3)
    cues.push({ id: 'vo.leon.bark.burnout', kind: 'bark', cooldown: 120 });
  if (next.heroState === 'drink' && prev.heroState !== 'drink')
    cues.push({ id: 'vo.leon.cafe', kind: 'effort', cooldown: 4 });
  if (next.gobelets === 0 && prev.gobelets > 0)
    cues.push({ id: 'vo.yasmina.radio.07', kind: 'radio', cooldown: 120 });
  if (next.mobilisation >= 100 && prev.mobilisation < 100)
    cues.push({ id: 'vo.yasmina.radio.06', kind: 'radio', cooldown: 90 });
  if (next.choiceFamilies.length > 0 && prev.choiceFamilies.length === 0) {
    const hit = AVANTAGE_RADIO.find(([color]) => next.choiceFamilies.includes(color));
    if (hit) cues.push({ id: hit[1], kind: 'radio', cooldownKey: 'avantage', cooldown: 45 });
  }
  return cues;
}

/** Prise de poste (début du Shift) : la radio autorise le départ, Léon y va. */
export const RUN_START_CUES: readonly VoiceCue[] = [
  { id: 'vo.yasmina.radio.02', kind: 'radio', once: true, important: true },
  { id: 'vo.leon.bark.debut', kind: 'bark', once: true },
];

// ─── Ordonnancement ──────────────────────────────────────────────────────────

/** Ce que l'ordonnanceur demande au lecteur. */
export interface VoiceOut {
  /** Le fichier est décodé et peut jouer tout de suite. */
  ready(id: string): boolean;
  /** Joue `id` maintenant ; renvoie sa durée (s), ou `null` s'il n'a pas pu partir. */
  play(id: string, kind: VoiceKind): number | null;
  /** Coupe (fondu court) ce que dit `voice`. */
  stop(voice: VoiceId): void;
}

interface Pending {
  readonly cue: VoiceCue;
  readonly expires: number;
}

const PRIORITY: Readonly<Record<VoiceKind, number>> = { effort: 0, bark: 1, radio: 2, line: 3 };
/** Attente maximale dans la file avant abandon (s). */
const EXPIRY: Readonly<Record<VoiceKind, number>> = { effort: 0, bark: 2.5, radio: 8, line: 12 };
/** Silence entre deux répliques du canal de dialogue (s). */
const GAP = 0.25;
/** Salles minimum entre deux lignes radio secondaires. */
const RADIO_ROOM_GAP = 3;

export class VoiceScheduler {
  private readonly busyUntil = new Map<VoiceId, number>();
  private readonly busyKind = new Map<VoiceId, VoiceKind>();
  private readonly cooldowns = new Map<string, number>();
  private readonly said = new Set<string>();
  private queue: Pending[] = [];
  private channelUntil = 0;
  private roomsSinceRadio = RADIO_ROOM_GAP;
  /** Délais multipliés (« Réduire les sons répétitifs » : ×2). */
  public cooldownScale = 1;

  public constructor(private readonly out: VoiceOut) {}

  /** Nouveau Shift : les répliques « une fois par Shift » redeviennent possibles. */
  public resetRun(): void {
    this.said.clear();
    this.queue = [];
    this.roomsSinceRadio = RADIO_ROOM_GAP;
  }

  public roomEntered(): void {
    this.roomsSinceRadio += 1;
  }

  /** Vide la file (fin du Shift, changement d'écran). */
  public clear(): void {
    this.queue = [];
  }

  /** `true` si `voice` parle encore à `now`. */
  public speaking(voice: VoiceId, now: number): boolean {
    return (this.busyUntil.get(voice) ?? 0) > now;
  }

  /** Une voix (n'importe laquelle) parle sur le canal de dialogue. */
  public dialogueActive(now: number): boolean {
    return this.channelUntil > now;
  }

  /**
   * Demande une réplique. Renvoie `true` si elle jouera (tout de suite ou dans la file) : la scène
   * affiche alors le sous-titre du catalogue. `false` : fichier absent ou pas encore décodé, délai de
   * récupération, déjà dite ce Shift, voix occupée (effort).
   */
  public request(cue: VoiceCue, now: number): boolean {
    const voice = voiceOf(cue.id);
    if (!voice || !this.out.ready(cue.id)) return false;
    if (cue.once && this.said.has(cue.id)) return false;
    const key = cue.cooldownKey ?? cue.id;
    const until = this.cooldowns.get(key);
    if (until !== undefined && now < until) return false;
    if (cue.kind === 'radio' && !cue.important && this.roomsSinceRadio < RADIO_ROOM_GAP)
      return false;
    if (cue.kind === 'effort') {
      // Immédiat, jamais par-dessus la même voix.
      if (this.speaking(voice, now)) return false;
      if (!this.start(cue, voice, now)) return false;
      return true;
    }
    this.mark(cue, now);
    this.queue.push({ cue, expires: now + EXPIRY[cue.kind] });
    this.queue.sort((a, b) => PRIORITY[b.cue.kind] - PRIORITY[a.cue.kind]);
    return true;
  }

  private mark(cue: VoiceCue, now: number): void {
    if (cue.once) this.said.add(cue.id);
    if (cue.cooldown)
      this.cooldowns.set(cue.cooldownKey ?? cue.id, now + cue.cooldown * this.cooldownScale);
  }

  private start(cue: VoiceCue, voice: VoiceId, now: number): boolean {
    const dur = this.out.play(cue.id, cue.kind);
    if (dur === null) return false;
    if (cue.kind === 'effort') this.mark(cue, now);
    this.busyUntil.set(voice, now + dur);
    this.busyKind.set(voice, cue.kind);
    if (cue.kind !== 'effort') this.channelUntil = now + dur + GAP;
    if (cue.kind === 'radio') this.roomsSinceRadio = 0;
    return true;
  }

  /** À chaque frame : fait partir la réplique suivante quand le canal est libre. */
  public update(now: number, opts: { readonly bossTelegraph: boolean }): void {
    this.queue = this.queue.filter((p) => p.expires > now);
    if (this.channelUntil > now) return;
    for (let i = 0; i < this.queue.length; i += 1) {
      const p = this.queue[i];
      if (!p) continue;
      if (p.cue.kind === 'radio' && opts.bossTelegraph) continue;
      const voice = voiceOf(p.cue.id);
      if (!voice) continue;
      if (this.speaking(voice, now)) {
        // Une réplique coupe un effort de la même voix ; sinon elle attend son tour.
        if (this.busyKind.get(voice) !== 'effort') continue;
        this.out.stop(voice);
      }
      this.queue.splice(i, 1);
      this.start(p.cue, voice, now);
      return;
    }
  }
}
