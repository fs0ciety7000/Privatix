// Bibliothèque des modèles GLB (public/models, produits par tools/render3d) : lecture du manifeste,
// chargement (GLTFLoader + MeshoptDecoder), cache des gabarits, préchargement avec progression. Les
// vues clonent un gabarit (SkeletonUtils.clone) : les géométries sont partagées entre tous les clones
// et ne sont libérées qu'avec la bibliothèque.
//
// Une seule bibliothèque par page, installée par l'entrée (`main3d.ts`) avant la création des vues ;
// sans bibliothèque (`?procedural`, échec du manifeste) ou pour un modèle absent ou en échec, la
// fabrique des vues retombe sur les personnages procéduraux.
import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CharacterMeta, ItemMeta, ModelManifest } from '@/view/models/manifest';
import { parseManifest, withLods } from '@/view/models/manifest';

/** Gabarit chargé d'un personnage : à cloner, jamais à ajouter tel quel à la scène. */
export interface CharacterTemplate {
  readonly name: string;
  readonly meta: CharacterMeta;
  readonly scene: THREE.Object3D;
  readonly clips: readonly THREE.AnimationClip[];
  /** Variante allégée chargée (preset bas). */
  readonly lod: boolean;
}

/** Gabarit chargé d'une pièce d'équipement. */
export interface ItemTemplate {
  readonly id: string;
  readonly meta: ItemMeta;
  readonly scene: THREE.Object3D;
}

export type ProgressFn = (loaded: number, total: number) => void;

export class ModelLibrary {
  private readonly loader = new GLTFLoader();
  private readonly chars = new Map<string, CharacterTemplate>();
  private readonly items = new Map<string, ItemTemplate>();
  private readonly failed = new Set<string>();
  private readonly pending = new Map<string, Promise<unknown>>();

  /**
   * @param baseUrl préfixe des fichiers du manifeste (`import.meta.env.BASE_URL`)
   * @param lowDetail charger la variante allégée (`lod`) quand elle existe (preset bas)
   */
  public constructor(
    public readonly manifest: ModelManifest,
    private readonly baseUrl: string,
    public readonly lowDetail: boolean,
  ) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  /** Lit `models/manifest.json` ; `null` si absent ou invalide (repli procédural). */
  public static async open(baseUrl: string, lowDetail: boolean): Promise<ModelLibrary | null> {
    try {
      const res = await fetch(`${baseUrl}models/manifest.json`);
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      let manifest = parseManifest(await res.json());
      if (lowDetail) {
        // Variantes allégées (preset bas) : facultatives.
        const lods = await fetch(`${baseUrl}models/lod/manifest.json`).catch(() => null);
        if (lods?.ok) manifest = withLods(manifest, await lods.json().catch(() => null));
      }
      return new ModelLibrary(manifest, baseUrl, lowDetail);
    } catch (e) {
      console.warn('[modèles] manifeste indisponible, personnages procéduraux :', e);
      return null;
    }
  }

  /** Gabarit d'un personnage déjà chargé, ou `null` (non préchargé, absent ou en échec). */
  public character(name: string): CharacterTemplate | null {
    return this.chars.get(name) ?? null;
  }

  /** Gabarit d'une pièce d'équipement déjà chargée, ou `null`. */
  public item(id: string): ItemTemplate | null {
    return this.items.get(id) ?? null;
  }

  public hasFailed(name: string): boolean {
    return this.failed.has(name);
  }

  private fileOf(meta: { readonly file: string; readonly lod: { readonly file: string } | null }): {
    url: string;
    lod: boolean;
  } {
    const lod = this.lowDetail && meta.lod !== null;
    return { url: `${this.baseUrl}${meta.lod && lod ? meta.lod.file : meta.file}`, lod };
  }

  private bytesOf(meta: CharacterMeta | ItemMeta): number {
    return this.lowDetail && meta.lod ? meta.lod.bytes : meta.bytes;
  }

  /** Charge un personnage (une seule fois) ; `null` s'il n'existe pas ou si le chargement échoue. */
  public loadCharacter(name: string, onBytes?: (b: number) => void): Promise<CharacterTemplate | null> {
    const done = this.chars.get(name);
    if (done) return Promise.resolve(done);
    const meta = this.manifest.characters[name];
    if (!meta || this.failed.has(name)) return Promise.resolve(null);
    const key = `c:${name}`;
    const running = this.pending.get(key) as Promise<CharacterTemplate | null> | undefined;
    if (running) return running;
    const { url, lod } = this.fileOf(meta);
    const p = this.fetch(url, onBytes)
      .then((gltf) => {
        const runtime = meta.runtimeBones;
        // Les os pilotés à l'exécution (boule disco, rotors) n'ont pas de piste ; on filtre quand même
        // pour qu'un export futur ne se batte pas avec la vue.
        const clips = gltf.animations.map((c) => {
          const clip = c.clone();
          clip.tracks = clip.tracks.filter((t) => !runtime.some((b) => t.name.startsWith(`${b}.`)));
          return clip;
        });
        const tpl: CharacterTemplate = { name, meta, scene: gltf.scene, clips, lod };
        this.chars.set(name, tpl);
        return tpl;
      })
      .catch((e: unknown) => {
        this.failed.add(name);
        console.warn(`[modèles] ${name} : échec du chargement, repli procédural :`, e);
        return null;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  /** Charge une pièce d'équipement (une seule fois) ; `null` si absente ou en échec. */
  public loadItem(id: string, onBytes?: (b: number) => void): Promise<ItemTemplate | null> {
    const done = this.items.get(id);
    if (done) return Promise.resolve(done);
    const meta = this.manifest.items[id];
    if (!meta || this.failed.has(`item:${id}`)) return Promise.resolve(null);
    const key = `i:${id}`;
    const running = this.pending.get(key) as Promise<ItemTemplate | null> | undefined;
    if (running) return running;
    const p = this.fetch(this.fileOf(meta).url, onBytes)
      .then((gltf) => {
        const tpl: ItemTemplate = { id, meta, scene: gltf.scene };
        this.items.set(id, tpl);
        return tpl;
      })
      .catch((e: unknown) => {
        this.failed.add(`item:${id}`);
        console.warn(`[modèles] équipement ${id} : échec du chargement :`, e);
        return null;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  private async fetch(
    url: string,
    onBytes?: (b: number) => void,
  ): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
    let last = 0;
    const gltf = await this.loader.loadAsync(url, (ev) => {
      if (!onBytes) return;
      onBytes(ev.loaded - last);
      last = ev.loaded;
    });
    return { scene: gltf.scene, animations: gltf.animations };
  }

  /**
   * Précharge des personnages et des pièces d'équipement en parallèle. `onProgress(loaded, total)`
   * suit les octets (tailles du manifeste). Les échecs sont absorbés (repli procédural).
   */
  public async preload(
    characters: readonly string[],
    items: readonly string[],
    onProgress?: ProgressFn,
  ): Promise<void> {
    const metas: { kind: 'c' | 'i'; id: string; bytes: number }[] = [];
    for (const c of characters) {
      const m = this.manifest.characters[c];
      if (m) metas.push({ kind: 'c', id: c, bytes: this.bytesOf(m) });
    }
    for (const i of items) {
      const m = this.manifest.items[i];
      if (m) metas.push({ kind: 'i', id: i, bytes: this.bytesOf(m) });
    }
    const total = metas.reduce((s, m) => s + m.bytes, 0) || 1;
    let loaded = 0;
    onProgress?.(0, total);
    await Promise.all(
      metas.map(async (m) => {
        let got = 0;
        const onBytes = (b: number): void => {
          // Les tailles réelles peuvent différer du manifeste : on borne la part de chaque fichier.
          const add = Math.max(0, Math.min(b, m.bytes - got));
          got += add;
          loaded += add;
          onProgress?.(loaded, total);
        };
        if (m.kind === 'c') await this.loadCharacter(m.id, onBytes);
        else await this.loadItem(m.id, onBytes);
        loaded += m.bytes - got;
        onProgress?.(loaded, total);
      }),
    );
  }

  /** Libère toutes les géométries chargées (fin de la page). */
  public dispose(): void {
    const free = (o: THREE.Object3D): void => {
      o.traverse((c) => {
        const g = (c as Partial<THREE.Mesh>).geometry;
        g?.dispose();
      });
    };
    for (const c of this.chars.values()) free(c.scene);
    for (const i of this.items.values()) free(i.scene);
    this.chars.clear();
    this.items.clear();
  }
}

let installed: ModelLibrary | null = null;

/** Installe la bibliothèque de la page (une fois, au démarrage, avant de créer les vues). */
export function installModelLibrary(lib: ModelLibrary | null): void {
  installed = lib;
}

/** Bibliothèque installée, ou `null` (personnages procéduraux). */
export function modelLibrary(): ModelLibrary | null {
  return installed;
}
