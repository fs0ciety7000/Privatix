/**
 * Banque d'échantillons : chargement paresseux (`fetch` + `decodeAudioData`), cache et repli.
 *
 * - Rien n'est demandé avant le déverrouillage du contexte (`attach`) ; les demandes passent dans une
 *   file (au plus `PARALLEL` téléchargements à la fois, la musique du contexte courant d'abord).
 * - Tout échec (hors ligne, 404, page HTML renvoyée à la place du fichier, format non décodable) laisse
 *   l'entrée en `failed` : l'appelant garde la synthèse. Pas de nouvel essai pendant la session.
 * - Mémoire : un morceau décodé pèse ≈ 46 Mo (2 min, stéréo, 48 kHz). Les octets compressés restent
 *   en cache (≈ 1,5 Mo par morceau) et les buffers décodés de musique sont limités à
 *   `MUSIC_DECODED_BUDGET` secondes : les plus anciens (hors `keep`) sont libérés, puis redécodés
 *   sans réseau si on y revient.
 */

export type SampleKind = 'music' | 'voice';
export type SampleStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface SampleBankDeps {
  /** Préfixe des fichiers (`import.meta.env.BASE_URL` + `audio/`). */
  readonly baseUrl: string;
  /** `false` : aucun chargement, la synthèse joue seule (`?procedural`, tests). */
  readonly enabled: boolean;
  /** Téléchargement (injecté par les tests). */
  readonly fetchBytes?: (url: string) => Promise<ArrayBuffer>;
  /** Journal des échecs (développement). */
  readonly warn?: (msg: string) => void;
}

interface Entry {
  readonly file: string;
  readonly kind: SampleKind;
  status: SampleStatus;
  bytes: ArrayBuffer | null;
  buffer: AudioBuffer | null;
  usedAt: number;
}

const PARALLEL = 2;
/** Secondes de musique décodée gardées en mémoire (≈ 4 morceaux). */
export const MUSIC_DECODED_BUDGET = 480;

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  // Un serveur qui renvoie sa page d'accueil à la place d'un fichier absent (repli SPA).
  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith('text/')) throw new Error(`type inattendu ${type}`);
  return res.arrayBuffer();
}

export class SampleBank {
  private ctx: BaseAudioContext | null = null;
  private readonly entries = new Map<string, Entry>();
  private readonly queue: Entry[] = [];
  private active = 0;
  private clock = 0;
  private readonly fetchBytes: (url: string) => Promise<ArrayBuffer>;
  private readonly listeners: ((file: string) => void)[] = [];
  /** Fichiers à ne pas libérer (morceau en cours, morceau suivant). */
  public keep: ReadonlySet<string> = new Set();

  public constructor(private readonly deps: SampleBankDeps) {
    this.fetchBytes = deps.fetchBytes ?? defaultFetch;
  }

  public get enabled(): boolean {
    return this.deps.enabled;
  }

  /** Contexte déverrouillé : les demandes en attente partent. */
  public attach(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.pump();
  }

  /** Appelé quand un fichier devient disponible (décodé). */
  public onReady(cb: (file: string) => void): void {
    this.listeners.push(cb);
  }

  public status(file: string): SampleStatus {
    return this.entries.get(file)?.status ?? 'idle';
  }

  /** Buffer décodé, ou `null` (pas encore là, libéré ou en échec). */
  public get(file: string): AudioBuffer | null {
    const e = this.entries.get(file);
    if (!e?.buffer) return null;
    e.usedAt = ++this.clock;
    return e.buffer;
  }

  /** Demande un fichier (sans effet s'il est déjà là, en route ou en échec). `urgent` : en tête. */
  public request(file: string, kind: SampleKind, urgent = false): void {
    if (!this.deps.enabled) return;
    let e = this.entries.get(file);
    if (!e) {
      e = { file, kind, status: 'idle', bytes: null, buffer: null, usedAt: 0 };
      this.entries.set(file, e);
    }
    if (e.status === 'loading' && urgent) {
      // Encore dans la file : passe devant (le morceau du contexte courant d'abord).
      const i = this.queue.indexOf(e);
      if (i > 0) {
        this.queue.splice(i, 1);
        this.queue.unshift(e);
      }
    }
    if (e.status !== 'idle') return;
    e.status = 'loading';
    if (urgent) this.queue.unshift(e);
    else this.queue.push(e);
    this.pump();
  }

  private pump(): void {
    if (!this.ctx) return;
    while (this.active < PARALLEL && this.queue.length > 0) {
      const e = this.queue.shift();
      if (!e) break;
      this.active += 1;
      void this.load(e).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }

  private async load(e: Entry): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      e.bytes ??= await this.fetchBytes(this.deps.baseUrl + e.file);
      // decodeAudioData détache le tableau : on décode une copie pour garder les octets compressés.
      const buffer = await ctx.decodeAudioData(e.bytes.slice(0));
      e.buffer = buffer;
      e.status = 'ready';
      e.usedAt = ++this.clock;
      if (e.kind === 'voice') e.bytes = null;
      this.trim();
      for (const cb of this.listeners) cb(e.file);
    } catch (err) {
      e.status = 'failed';
      e.bytes = null;
      this.deps.warn?.(`[audio] ${e.file} indisponible (${String(err)}) : synthèse conservée`);
    }
  }

  /** Libère les morceaux décodés les plus anciens au-delà du budget (octets compressés gardés). */
  private trim(): void {
    const music = [...this.entries.values()].filter((e) => e.kind === 'music' && e.buffer);
    let total = music.reduce((s, e) => s + (e.buffer?.duration ?? 0), 0);
    music.sort((a, b) => a.usedAt - b.usedAt);
    for (const e of music) {
      if (total <= MUSIC_DECODED_BUDGET) break;
      if (this.keep.has(e.file)) continue;
      total -= e.buffer?.duration ?? 0;
      e.buffer = null;
      // Octets encore là : un nouveau `request` redécode sans réseau.
      e.status = 'idle';
    }
  }

  /** Nombre de fichiers décodés (outil de test et de débogage). */
  public get decodedCount(): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.buffer) n += 1;
    return n;
  }
}
