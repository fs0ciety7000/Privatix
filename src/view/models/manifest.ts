// Types du manifeste des modèles GLB (`public/models/manifest.json`, produit par tools/render3d) et
// lecture défensive : un manifeste mal formé ne fait pas planter le jeu, il désactive les GLB (repli
// procédural). Contrat : tools/render3d/SKELETON.md.

export type ModelKind = 'hero' | 'enemy' | 'elite' | 'boss' | 'npc';
export type EquipSlot = 'casque' | 'gilet' | 'outil';

export interface ClipMeta {
  /** Durée nominale (s). */
  readonly duration: number;
  readonly loop: boolean;
  /** Événements en ms depuis le début du clip (`active`, `windup`, `land`, `glint`…). */
  readonly events: Readonly<Record<string, number>>;
}

/** Variante allégée (preset bas), produite par `tools/render3d/viewer/lod.mjs`. */
export interface LodMeta {
  readonly file: string;
  readonly triangles: number;
  readonly bytes: number;
}

export interface CharacterMeta {
  readonly file: string;
  readonly kind: ModelKind;
  readonly height: number;
  readonly radius: number;
  /** Couleur du contour (`#RRGGBB`). */
  readonly outline: number;
  /** Couleur du liseré. */
  readonly rim: number;
  readonly sockets: readonly string[];
  /** Os pilotés à l'exécution (boule disco, rotors) : non animés par les clips. */
  readonly runtimeBones: readonly string[];
  readonly triangles: number;
  readonly clips: Readonly<Record<string, ClipMeta>>;
  /** Taille du fichier (octets), pour la barre de progression. */
  readonly bytes: number;
  readonly lod: LodMeta | null;
}

export interface ItemMeta {
  readonly file: string;
  readonly slot: EquipSlot;
  /** Socket d'accroche (pièces rigides) ; `null` pour une pièce skinnée. */
  readonly socket: string | null;
  readonly skinned: boolean;
  readonly rarity: number;
  /** Bout de l'outil (repère du socket), pour la traînée. */
  readonly tip: readonly [number, number, number] | null;
  readonly triangles: number;
  readonly bytes: number;
  readonly lod: LodMeta | null;
}

export interface ModelManifest {
  readonly version: number;
  readonly characters: Readonly<Record<string, CharacterMeta>>;
  readonly items: Readonly<Record<string, ItemMeta>>;
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function color(v: unknown, d: number): number {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) return d;
  return parseInt(v.slice(1), 16);
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
}

function lod(v: unknown): LodMeta | null {
  if (!isObj(v) || typeof v.file !== 'string') return null;
  return { file: v.file, triangles: num(v.triangles, 0), bytes: num(v.bytes, 50_000) };
}

function clips(v: unknown): Record<string, ClipMeta> {
  const out: Record<string, ClipMeta> = {};
  if (!isObj(v)) return out;
  for (const [name, c] of Object.entries(v)) {
    if (!isObj(c)) continue;
    const events: Record<string, number> = {};
    if (isObj(c.events))
      for (const [e, ms] of Object.entries(c.events)) if (typeof ms === 'number') events[e] = ms;
    out[name] = { duration: num(c.duration, 1), loop: c.loop === true, events };
  }
  return out;
}

const KINDS: readonly ModelKind[] = ['hero', 'enemy', 'elite', 'boss', 'npc'];
const SLOTS: readonly EquipSlot[] = ['casque', 'gilet', 'outil'];

/** Lit le manifeste JSON ; lève une erreur s'il n'a pas la forme attendue. */
export function parseManifest(raw: unknown): ModelManifest {
  if (!isObj(raw) || !isObj(raw.characters)) throw new Error('manifeste des modèles invalide');
  const characters: Record<string, CharacterMeta> = {};
  for (const [name, c] of Object.entries(raw.characters)) {
    if (!isObj(c) || typeof c.file !== 'string') continue;
    const kind = KINDS.find((k) => k === c.kind) ?? 'enemy';
    characters[name] = {
      file: c.file,
      kind,
      height: num(c.height, 2),
      radius: num(c.radius, 0.5),
      outline: color(c.outline, kind === 'hero' ? 0x14101a : 0x06302c),
      rim: color(c.rim, 0x6ff3ff),
      sockets: strings(c.sockets),
      runtimeBones: strings(c.runtimeBones),
      triangles: num(c.triangles, 0),
      clips: clips(c.clips),
      bytes: num(c.bytes, 100_000),
      lod: lod(c.lod),
    };
  }
  const items: Record<string, ItemMeta> = {};
  if (isObj(raw.items))
    for (const [name, it] of Object.entries(raw.items)) {
      if (!isObj(it) || typeof it.file !== 'string') continue;
      const slot = SLOTS.find((s) => s === it.slot);
      if (!slot) continue;
      const tip =
        Array.isArray(it.tip) && it.tip.length === 3 ? it.tip.map((x) => num(x, 0)) : null;
      items[name] = {
        file: it.file,
        slot,
        socket: typeof it.socket === 'string' ? it.socket : null,
        skinned: it.skinned === true,
        rarity: num(it.rarity, 1),
        tip: tip ? [tip[0] ?? 0, tip[1] ?? 0, tip[2] ?? 0] : null,
        triangles: num(it.triangles, 0),
        bytes: num(it.bytes, 20_000),
        lod: lod(it.lod),
      };
    }
  return { version: num(raw.version, 1), characters, items };
}

/**
 * Ajoute les variantes allégées de `public/models/lod/manifest.json` (produit par
 * `tools/render3d/viewer/lod.mjs`, à part du manifeste principal que l'export réécrit).
 */
export function withLods(m: ModelManifest, raw: unknown): ModelManifest {
  if (!isObj(raw)) return m;
  const cl = isObj(raw.characters) ? raw.characters : {};
  const il = isObj(raw.items) ? raw.items : {};
  const characters: Record<string, CharacterMeta> = {};
  for (const [k, c] of Object.entries(m.characters))
    characters[k] = { ...c, lod: lod(cl[k]) ?? c.lod };
  const items: Record<string, ItemMeta> = {};
  for (const [k, it] of Object.entries(m.items)) items[k] = { ...it, lod: lod(il[k]) ?? it.lod };
  return { ...m, characters, items };
}
