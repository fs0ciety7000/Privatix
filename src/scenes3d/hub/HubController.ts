import { SHIFTS } from '@/config/balance';
import type { ShiftId } from '@/config/balance';
import type { HubAction, HubOptions } from '@/sim/hub/HubSim';
import { HubSim, SHIFT_ORDER, shiftLabel, shiftOf } from '@/sim/hub/HubSim';
import { hubZoneOf } from '@/sim/hub/layout';
import { HUB_STATIONS } from '@/sim/hub/stations';
import { TrainingDummySim } from '@/sim/hub/TrainingDummySim';
import type { PlayerIntent } from '@/sim/intent';
import type { MetaState } from '@/systems/meta/MetaState';
import { UPGRADES, rankOf } from '@/systems/meta/MetaState';
import type { Vec2 } from '@/utils/math';
import type { HubUi, RosterOption } from '@/ui/hub/HubUi';
import type { Menus } from '@/ui/menus/Menus';
import type { GameViewOptions } from '@/view/GameView';
import { DummyView } from '@/view/hub/DummyView';
import type { HubDecorInfo } from '@/view/hub/HubRoomView';
import { HubRoomView } from '@/view/hub/HubRoomView';

/** Fondu avant le départ en Shift (temps réel, ms). */
const DEPART_FADE_MS = 450;
/** Distance (u) au-delà de laquelle la bulle d'un PNJ se ferme. */
const BUBBLE_RANGE = 110;

const PLACE: Readonly<Record<'co' | 'cour', string>> = {
  co: 'OCC · Salle des opérations',
  cour: 'Cour intérieure du BAG',
};

/** Ce que le hub demande à la scène qui l'héberge (`Game3D`). */
export interface HubHost {
  readonly menus: Menus;
  /** Projection d'un point logique (u) à l'écran (px CSS), à `height` m du sol. */
  toScreen(x: number, y: number, height: number): Vec2;
  /** Écrit la sauvegarde ; renvoie faux si le stockage est indisponible. */
  save(meta: MetaState): boolean;
  /** Départ en Shift (après le fondu). */
  depart(shift: ShiftId, meta: MetaState): void;
  /** Options (retour : `back`). */
  openOptions(back: () => void): void;
  quitToTitle(): void;
}

/**
 * Le hub 3D côté scène : relie `HubSim` (sim pure), le décor `HubRoomView` et le mannequin
 * (`GameViewOptions`), et l'UI DOM `HubUi` (barre, bulles, Tableau des revendications, roulement,
 * DPD et PACO). Toute écriture de la méta passe par `host.save` (sauvegarde immédiate).
 */
export class HubController {
  public readonly sim: HubSim;
  private decor: HubRoomView | null = null;
  private bubbleAt: { x: number; y: number } | null = null;
  private departIn = -1;
  private afterModal = true;
  private lastResult: { line: string; ok: boolean };

  public constructor(
    private readonly host: HubHost,
    private readonly ui: HubUi,
    opts: HubOptions & { readonly lastCause?: string | null },
  ) {
    this.sim = new HubSim(opts);
    const end = opts.fromResult ?? null;
    this.lastResult =
      end === 'mort'
        ? { line: `IC 0712 — SUPPRIMÉ — cause : ${opts.lastCause ?? 'fatigue'}`, ok: false }
        : end === 'victoire'
          ? { line: 'IC 0712 — À L’HEURE — SHIFT TENU, VOIE 1', ok: true }
          : { line: 'IC 0712 — PRÉVU 07:12 — « Le Sondage propose jeudi. »', ok: true };
    this.ui.setVisible(true);
    this.refreshBar();
  }

  /** Points d'extension de la vue : décor du hub et vue du mannequin. */
  public viewOptions(): GameViewOptions {
    return {
      room: (layout, settings, lights) => {
        const zone = hubZoneOf(layout) ?? 'co';
        const decor = new HubRoomView(layout, zone, settings, lights, () => this.decorInfo());
        this.decor = decor;
        return decor;
      },
      enemyView: (e, scene, reducedMotion) =>
        e instanceof TrainingDummySim ? new DummyView(scene, reducedMotion) : null,
    };
  }

  private decorInfo(): HubDecorInfo {
    const meta = this.sim.meta;
    return {
      shift: this.sim.shift,
      ownedRanks: UPGRADES.reduce((s, u) => s + rankOf(meta, u.id), 0),
      synoptic: {
        shiftLabel: shiftOf(this.sim.shift),
        shifts: meta.stats.shifts,
        lastLine: this.lastResult.line,
        lastOk: this.lastResult.ok,
      },
    };
  }

  // ─── Entrées ───────────────────────────────────────────────────────────────

  /** Intention du joueur (la scène l'a déjà composée : axes, visée, appuis). */
  public input(intent: PlayerIntent, pause: boolean): void {
    const menus = this.host.menus;
    if (menus.open) {
      this.afterModal = true;
      return;
    }
    if (this.afterModal) {
      this.afterModal = false;
      return;
    }
    if (pause && !this.sim.frozen) {
      this.openPause();
      return;
    }
    this.sim.queueIntent(intent);
  }

  private openPause(): void {
    this.ui.openPause(
      () => {
        this.host.menus.close();
      },
      () => {
        this.host.openOptions(() => {
          this.openPause();
        });
      },
      () => {
        this.host.menus.close();
        this.host.quitToTitle();
      },
    );
  }

  // ─── Après les pas ─────────────────────────────────────────────────────────

  public afterStep(): void {
    for (const a of this.sim.drainActions()) this.handle(a);
    if (this.sim.dirty) {
      this.sim.dirty = false;
      this.host.save(this.sim.meta);
      this.refreshBar();
      this.decor?.refresh();
    }
  }

  private handle(a: HubAction): void {
    switch (a.type) {
      case 'talk':
        this.ui.say(a.speaker, a.text);
        this.bubbleAt = { x: a.x, y: a.y };
        if (a.npc !== 'vieille-dame') this.decor?.talk(a.npc);
        break;
      case 'tableau':
        this.openTableau();
        break;
      case 'roulement':
        this.openRoster();
        break;
      case 'dpd':
      case 'paco':
        this.openService(a.type);
        break;
      case 'read':
        this.ui.openRead(a.title, a.text, () => {
          this.host.menus.close();
        });
        break;
      case 'zone':
        this.ui.toast(PLACE[a.zone]);
        this.bubbleAt = null;
        this.refreshBar();
        break;
      case 'depart':
        this.departIn = DEPART_FADE_MS;
        this.host.menus.fade(1, DEPART_FADE_MS);
        break;
    }
  }

  public openTableau(): void {
    this.ui.openTableau(
      this.sim.meta,
      (id) => {
        const r = this.sim.buy(id);
        if (!r.ok) return null;
        this.afterStep();
        return this.sim.meta;
      },
      () => {
        this.host.menus.close();
      },
    );
  }

  private openRoster(): void {
    const unlocked = this.sim.unlockedShifts;
    const options: RosterOption[] = SHIFT_ORDER.map((id) => {
      const s = SHIFTS[id];
      const locked = !unlocked.includes(id);
      const mods = [
        `Départ ${String(s.startHour)} h`,
        `PS ×${String(s.psMult).replace('.', ',')}`,
        s.hpMult > 1 ? 'PV ennemis +10 %' : '',
        s.damageMult > 1 ? 'dégâts ennemis +15 %' : '',
      ].filter((x) => x !== '');
      return {
        id,
        label: s.label,
        desc: locked
          ? 'Verrouillé : revendication « Tableau de service » chez Marcel.'
          : mods.join(' · '),
        locked,
      };
    });
    this.ui.openRoster(
      this.sim.shift,
      options,
      (id) => {
        if (this.sim.setShift(id)) {
          this.host.menus.close();
          this.ui.say('Yasmina', `Roulement ${shiftOf(id)} validé. Je te mets en voie.`);
          const y = HUB_STATIONS.find((s) => s.id === 'yasmina');
          this.bubbleAt = y ? { x: y.anchor.x, y: y.anchor.y } : null;
          this.decor?.refresh();
          this.refreshBar();
        }
      },
      () => {
        this.host.menus.close();
      },
    );
  }

  private openService(id: 'dpd' | 'paco'): void {
    this.ui.openService(id, {
      meta: this.sim.meta,
      commit: (next) => {
        this.sim.commit(next);
        this.afterStep();
      },
      close: () => {
        this.host.menus.close();
      },
    });
  }

  private refreshBar(): void {
    const m = this.sim.meta;
    this.ui.setInfo({
      ps: m.ps,
      grains: m.grains,
      pieces: m.pieces,
      shiftLabel: shiftLabel(this.sim.shift),
      place: PLACE[this.sim.zone],
    });
  }

  // ─── Superposition DOM ─────────────────────────────────────────────────────

  /** Invite, bulle, étiquette du mannequin ; départ après le fondu. */
  public overlay(realDt: number): void {
    const menus = this.host.menus;
    const sim = this.sim;
    const prompt = sim.prompt;
    if (prompt && !menus.open) {
      const p = this.host.toScreen(prompt.x, prompt.y, prompt.height);
      menus.setPrompt(prompt.label, p.x, p.y, !prompt.door);
    } else menus.setPrompt(null, 0, 0, false);

    const h = sim.world.hero.body;
    const b = this.bubbleAt;
    const near = b !== null && Math.hypot(h.x - b.x, h.y - b.y) < BUBBLE_RANGE;
    this.ui.updateBubble(realDt, b && near ? this.host.toScreen(b.x, b.y, 3.25) : null);

    const d = sim.dummy;
    if (d && !menus.open && Math.hypot(h.x - d.body.x, h.y - d.body.y) < 170) {
      const p = this.host.toScreen(d.body.x, d.body.y, 2.35);
      const dps = d.dps;
      this.ui.setDummy(
        dps > 0
          ? `Mannequin · ${dps.toFixed(0)} DPS · total ${String(d.total)}`
          : 'Mannequin de formation · frappe pour mesurer',
        p.x,
        p.y,
      );
    } else this.ui.setDummy(null, 0, 0);

    if (this.departIn >= 0) {
      this.departIn -= realDt * 1000;
      if (this.departIn < 0) this.host.depart(sim.shift, sim.meta);
    }
  }

  public dispose(): void {
    this.ui.setVisible(false);
    this.host.menus.setPrompt(null, 0, 0, false);
    this.decor = null;
  }
}
