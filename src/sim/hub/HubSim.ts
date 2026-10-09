import type { ShiftId } from '@/config/balance';
import { SHIFTS } from '@/config/balance';
import type { BuyResult, MetaState, UpgradeId } from '@/systems/meta/MetaState';
import { buyUpgrade, loadoutOf } from '@/systems/meta/MetaState';
import type { ShiftEnd } from '@/systems/meta/RunState';
import { Arena } from '@/sim/Arena';
import type { Steppable } from '@/sim/clock/FixedClock';
import type { HubZoneId } from '@/sim/hub/layout';
import { HUB_LAYOUTS } from '@/sim/hub/layout';
import type { HubDoorDef, HubNpcId, HubStationDef } from '@/sim/hub/stations';
import {
  arrivalFor,
  HUB_DOORS,
  HUB_NPCS_BY_ID,
  HUB_STATIONS,
  NPC_LINES,
  READ_TEXTS,
  STATION_RADIUS,
} from '@/sim/hub/stations';
import { TrainingDummySim } from '@/sim/hub/TrainingDummySim';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import { World } from '@/sim/World';

/** Ordre des roulements (déverrouillés par la revendication « Tableau de service »). */
export const SHIFT_ORDER: readonly ShiftId[] = ['matin', 'apres-midi', 'nuit'];
/** Fondu d'un passage de porte (temps de sim, comme `RunDirector.goThrough`). */
export const HUB_DOOR_FADE_MS = 220;
/** Une porte se franchit en la touchant : distance (u) au centre de la porte dans l'axe du mur. */
const DOOR_REACH = 20;

/** Ce que la scène doit faire après un pas (ouvrir un menu, afficher une bulle, partir). */
export type HubAction =
  | {
      readonly type: 'talk';
      readonly npc: HubNpcId | 'vieille-dame';
      readonly speaker: string;
      readonly text: string;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'tableau' }
  | { readonly type: 'roulement' }
  | { readonly type: 'dpd' }
  | { readonly type: 'paco' }
  | { readonly type: 'read'; readonly title: string; readonly text: string }
  | { readonly type: 'zone'; readonly zone: HubZoneId }
  | { readonly type: 'depart'; readonly shift: ShiftId };

/** Invite contextuelle (u) : la scène la projette à l'écran. */
export interface HubPrompt {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Hauteur (m) de l'invite au-dessus du sol. */
  readonly height: number;
  readonly door: boolean;
}

export interface HubOptions {
  readonly meta: MetaState;
  readonly seed: number;
  /** Issue du Shift précédent (répliques « après une mort / une victoire »), `null` au démarrage. */
  readonly fromResult?: ShiftEnd | null;
  readonly shift?: ShiftId;
}

/**
 * Le hub côté simulation (pur) : le héros se déplace et frappe (sans dégâts reçus) dans le Centre
 * Opérationnel et la Cour intérieure, parle aux PNJ, ouvre les services (Tableau des revendications,
 * roulement, DPD, PACO) et part en Shift. Le combat et les collisions sont ceux du `World` du Shift
 * (même héros, même arme), avec un gabarit du hub et le mannequin de formation.
 */
export class HubSim implements Steppable {
  public readonly world: World;
  public zone: HubZoneId = 'co';
  public meta: MetaState;
  public shift: ShiftId;
  public readonly fromResult: ShiftEnd | null;
  /** Nombre de répliques déjà dites par PNJ (la première après un Shift réagit à son issue). */
  private readonly talks = new Map<string, number>();
  private actions: HubAction[] = [];
  private transition: { door: HubDoorDef; left: number } | null = null;
  private departing = false;
  public dummy: TrainingDummySim | null = null;
  /** Méta modifiée depuis la dernière sauvegarde. */
  public dirty = false;

  public constructor(opts: HubOptions) {
    this.meta = opts.meta;
    this.fromResult = opts.fromResult ?? null;
    const unlocked = loadoutOf(opts.meta).shiftsUnlocked;
    const wanted = opts.shift ?? 'matin';
    this.shift = SHIFT_ORDER.indexOf(wanted) < unlocked ? wanted : 'matin';
    this.world = new World({ seed: opts.seed, waves: false, room: 'occ', meta: opts.meta });
    this.enterZone('co', null);
  }

  // ─── Pas ───────────────────────────────────────────────────────────────────

  public snapshot(): void {
    this.world.snapshot();
  }

  public step(dtMs: number): void {
    this.world.step(dtMs);
    const interact = this.world.consumeInteract();
    if (this.transition) {
      this.transition.left -= dtMs;
      if (this.transition.left <= 0) {
        const door = this.transition.door;
        this.transition = null;
        if (door.to) this.enterZone(door.to, door);
      }
      return;
    }
    if (this.departing) return;
    const door = this.doorTouched();
    if (door) {
      this.takeDoor(door);
      return;
    }
    if (interact) {
      const s = this.nearestStation();
      if (s) this.interact(s);
    }
  }

  /** Intention du joueur ; ignorée pendant un passage de porte. Pas de café au hub. */
  public queueIntent(intent: PlayerIntent): void {
    if (this.transition || this.departing) {
      this.world.queueIntent(NO_INTENT);
      return;
    }
    this.world.queueIntent({ ...intent, coffee: false });
  }

  /** Actions produites depuis le dernier appel (la scène les consomme une fois par frame). */
  public drainActions(): HubAction[] {
    const out = this.actions;
    this.actions = [];
    return out;
  }

  public get frozen(): boolean {
    return this.transition !== null || this.departing;
  }

  // ─── Zones et portes ───────────────────────────────────────────────────────

  /** Charge une zone : gabarit, héros devant la porte d'arrivée (ou au sas), mannequin dans la Cour. */
  public enterZone(zone: HubZoneId, via: HubDoorDef | null): void {
    const w = this.world;
    this.zone = zone;
    w.arena = new Arena(HUB_LAYOUTS[zone]);
    w.enemies.length = 0;
    w.projectiles.clear();
    w.hazards.length = 0;
    w.pickups.length = 0;
    w.tokens.clear();
    const arrival = via
      ? arrivalFor(HUB_DOORS.find((d) => d.zone === zone && d.to === via.zone) ?? via)
      : w.arena.playerSpawn;
    const b = w.hero.body;
    b.x = arrival.x;
    b.y = arrival.y;
    b.prevX = b.x;
    b.prevY = b.y;
    b.vx = 0;
    b.vy = 0;
    w.hero.facingAngle = via?.side === 1 ? -Math.PI / 2 : Math.PI / 2;
    this.dummy = null;
    const spot = w.arena.marks('dummy')[0];
    if (spot) {
      const dummy = new TrainingDummySim(w, spot.x, spot.y + 8);
      dummy.start(true);
      w.enemies.push(dummy);
      this.dummy = dummy;
    }
    w.emit({ type: 'roomEntered', room: 0, roomType: zone });
    this.actions.push({ type: 'zone', zone });
  }

  private doorTouched(): HubDoorDef | null {
    const h = this.world.hero.body;
    for (const d of HUB_DOORS) {
      if (d.zone !== this.zone) continue;
      if (Math.abs(h.x - d.at.x) > d.halfWidth) continue;
      if (Math.abs(h.y - d.at.y) <= DOOR_REACH) return d;
    }
    return null;
  }

  /** Porte la plus proche (invite), à moins de `reach` (u). */
  private nearDoor(reach: number): HubDoorDef | null {
    const h = this.world.hero.body;
    let best: HubDoorDef | null = null;
    let bestD = reach;
    for (const d of HUB_DOORS) {
      if (d.zone !== this.zone) continue;
      const dist = Math.hypot(Math.max(0, Math.abs(h.x - d.at.x) - d.halfWidth), h.y - d.at.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  public takeDoor(door: HubDoorDef): void {
    if (this.transition || this.departing) return;
    this.world.hero.body.vx = 0;
    this.world.hero.body.vy = 0;
    if (!door.to) {
      this.departing = true;
      this.world.emit({ type: 'doorTaken', room: 1 });
      this.actions.push({ type: 'depart', shift: this.shift });
      return;
    }
    this.transition = { door, left: HUB_DOOR_FADE_MS };
    this.world.emit({ type: 'doorTaken', room: 0 });
  }

  // ─── Stations ──────────────────────────────────────────────────────────────

  public nearestStation(): HubStationDef | null {
    const h = this.world.hero.body;
    let best: HubStationDef | null = null;
    let bestD = STATION_RADIUS;
    for (const s of HUB_STATIONS) {
      if (s.zone !== this.zone) continue;
      const d = Math.hypot(h.x - s.at.x, h.y - s.at.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Invite à afficher : station proche, sinon porte proche. */
  public get prompt(): HubPrompt | null {
    if (this.frozen) return null;
    const s = this.nearestStation();
    if (s) {
      const npc = s.npc ? HUB_NPCS_BY_ID.get(s.npc) : undefined;
      const label = npc ? `${s.verb} — ${npc.name} (${npc.post})` : s.verb;
      return { label, x: s.anchor.x, y: s.anchor.y, height: npc ? 2.35 : 1.8, door: false };
    }
    const d = this.nearDoor(56);
    if (!d) return null;
    const label = d.to ? d.label : `${d.label} — Shift ${shiftOf(this.shift)}`;
    return { label, x: d.at.x, y: d.at.y, height: d.side === 1 ? 1.2 : 2.9, door: true };
  }

  /** Interaction avec une station (appelée sur un appui « interagir », ou par l'UI tactile). */
  public interact(s: HubStationDef): void {
    switch (s.kind) {
      case 'tableau':
        if (s.npc) this.say(s.npc, s);
        this.actions.push({ type: 'tableau' });
        break;
      case 'roulement':
        this.actions.push({ type: 'roulement' });
        break;
      case 'dpd':
        if (s.npc) this.say(s.npc, s);
        this.actions.push({ type: 'dpd' });
        break;
      case 'paco':
        if (s.npc) this.say(s.npc, s);
        this.actions.push({ type: 'paco' });
        break;
      case 'read':
        this.actions.push({
          type: 'read',
          title: s.verb.replace(/^Lire (le |l’)?/, ''),
          text: this.readText(s),
        });
        break;
      case 'talk':
        this.say(s.npc ?? 'vieille-dame', s);
        break;
    }
  }

  private readText(s: HubStationDef): string {
    if (s.id === 'poubelles') return READ_TEXTS.poubelles;
    const st = this.meta.stats;
    return `${READ_TEXTS.synoptique} Shifts assurés : ${String(st.shifts)} · supprimés : ${String(st.deaths)} · meilleure salle : ${String(st.bestRoom)} · Auditeurs renvoyés : ${String(st.bossKills)}.`;
  }

  /** Réplique suivante d'un PNJ (la première réagit à l'issue du Shift précédent). */
  public lineFor(npc: HubNpcId | 'vieille-dame'): string {
    const lines = NPC_LINES[npc];
    const n = this.talks.get(npc) ?? 0;
    this.talks.set(npc, n + 1);
    if (n === 0 && this.fromResult === 'mort') return lines.death;
    if (n === 0 && this.fromResult === 'victoire') return lines.victory;
    const k = this.fromResult ? n - 1 : n;
    return (
      lines.generic[((k % lines.generic.length) + lines.generic.length) % lines.generic.length] ??
      ''
    );
  }

  private say(npc: HubNpcId | 'vieille-dame', s: HubStationDef): void {
    const speaker =
      npc === 'vieille-dame' ? 'La Vieille Dame' : (HUB_NPCS_BY_ID.get(npc)?.name ?? '');
    this.actions.push({
      type: 'talk',
      npc,
      speaker,
      text: this.lineFor(npc),
      x: s.anchor.x,
      y: s.anchor.y,
    });
  }

  // ─── Services ──────────────────────────────────────────────────────────────

  /** Achat au Tableau des revendications : la méta change (la scène sauvegarde). */
  public buy(id: UpgradeId): BuyResult {
    const result = buyUpgrade(this.meta, id);
    if (result.ok) this.commit(result.meta);
    return result;
  }

  /** Remplace la méta (services du loot : DPD, PACO) ; la scène sauvegarde. */
  public commit(next: MetaState): void {
    this.meta = next;
    this.dirty = true;
  }

  /** Roulements accessibles (revendication « Tableau de service »). */
  public get unlockedShifts(): readonly ShiftId[] {
    return SHIFT_ORDER.slice(0, loadoutOf(this.meta).shiftsUnlocked);
  }

  /** Choix du roulement chez Yasmina ; refusé s'il est verrouillé. */
  public setShift(id: ShiftId): boolean {
    if (!this.unlockedShifts.includes(id)) return false;
    this.shift = id;
    return true;
  }
}

export function shiftLabel(id: ShiftId): string {
  return SHIFTS[id].label;
}

/** « du Matin », « de l’Après-midi », « de Nuit » (accord du complément). */
export function shiftOf(id: ShiftId): string {
  return id === 'matin' ? 'du Matin' : id === 'apres-midi' ? 'de l’Après-midi' : 'de Nuit';
}
