/**
 * HUD minimal de l'entrée 3D, en DOM (jamais three) : Énergie, Burnout (palier, Pétage de plombs),
 * charges de dash, Mobilisation, Gobelets, vague en cours, bandeau central et compteurs F3.
 * Mise à jour événementielle : on ne touche au DOM que si la valeur affichée change.
 */

export interface HudSnapshot {
  readonly energy: number;
  readonly maxEnergy: number;
  readonly burnout: number;
  readonly burnoutLabel: string;
  readonly meltdown: boolean;
  readonly dashCharges: number;
  readonly dashMax: number;
  /** Progression de la charge en cours (0..1). */
  readonly dashProgress: number;
  readonly mobilisation: number;
  readonly gobelets: number;
  readonly room: number;
  readonly wave: number;
  readonly waveCount: number;
  readonly kills: number;
  /** Heure du Shift (« 06:30 »), type de salle, monnaies du run. */
  readonly clock: string;
  readonly roomLabel: string;
  /** Salles du biome en cours, pauses et boss compris (défaut : 10, biome 1). */
  readonly roomTotal?: number;
  readonly tickets: number;
  readonly ps: number;
  /** Héros marqué par un drone (+25 % de dégâts subis). */
  readonly marked: boolean;
}

export interface HudStats {
  readonly fps: number;
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly pixelRatio: number;
  readonly quality: string;
  readonly enemies: number;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly energyFill: HTMLDivElement;
  private readonly energyGhost: HTMLDivElement;
  private readonly energyText: HTMLSpanElement;
  private readonly burnFill: HTMLDivElement;
  private readonly burnText: HTMLSpanElement;
  private readonly burnBar: HTMLDivElement;
  private readonly mobFill: HTMLDivElement;
  private readonly pips: HTMLDivElement;
  private readonly cups: HTMLSpanElement;
  private readonly wave: HTMLDivElement;
  private readonly purse: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly statsBox: HTMLDivElement;
  private readonly cache = new Map<string, string>();
  private ghost = 1;
  private bannerLeft = 0;
  private statsOn = false;

  public constructor(host: HTMLElement) {
    this.root = el('div', 'hud', host);
    const top = el('div', 'hud-top', this.root);
    const bars = el('div', 'hud-bars', top);

    const energyLabel = el('div', 'hud-label', bars);
    energyLabel.textContent = 'ÉNERGIE ';
    this.energyText = el('span', 'hud-value', energyLabel);
    const energy = el('div', 'hud-bar hud-energy', bars);
    this.energyGhost = el('div', 'hud-ghost', energy);
    this.energyFill = el('div', 'hud-fill', energy);

    const burnLabel = el('div', 'hud-label', bars);
    burnLabel.textContent = 'BURNOUT ';
    this.burnText = el('span', 'hud-value', burnLabel);
    this.burnBar = el('div', 'hud-bar hud-burnout', bars);
    this.burnFill = el('div', 'hud-fill', this.burnBar);

    const row = el('div', 'hud-row', bars);
    this.pips = el('div', 'hud-pips', row);
    const mob = el('div', 'hud-bar hud-mob', row);
    mob.title = 'Mobilisation';
    this.mobFill = el('div', 'hud-fill', mob);
    this.cups = el('span', 'hud-cups', row);

    this.wave = el('div', 'hud-wave', this.root);
    this.purse = el('div', 'hud-purse', this.root);
    this.banner = el('div', 'hud-banner', this.root);
    this.statsBox = el('div', 'hud-stats', this.root);
    const help = el('div', 'hud-help', this.root);
    help.innerHTML =
      '<span><kbd>ZQSD</kbd>/<kbd>WASD</kbd> bouger</span><span><kbd>Clic</kbd>/<kbd>J</kbd> frapper</span>' +
      '<span><kbd>Espace</kbd> dash</span><span><kbd>F</kbd> sifflet</span><span><kbd>R</kbd> café</span>' +
      '<span><kbd>E</kbd> interagir</span><span><kbd>Échap</kbd> pause</span><span><kbd>F3</kbd> perf</span>';
  }

  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }

  public update(s: HudSnapshot, realDt: number): void {
    const e = Math.max(0, Math.min(1, s.energy / Math.max(1, s.maxEnergy)));
    this.ghost += (e - this.ghost) * Math.min(1, realDt * 3);
    if (this.ghost < e) this.ghost = e;
    this.set('ew', `${(e * 100).toFixed(1)}%`, (v) => (this.energyFill.style.width = v));
    this.set('eg', `${(this.ghost * 100).toFixed(1)}%`, (v) => (this.energyGhost.style.width = v));
    this.set(
      'et',
      `${String(Math.ceil(s.energy))} / ${String(s.maxEnergy)}`,
      (v) => (this.energyText.textContent = v),
    );
    this.set('bw', `${s.burnout.toFixed(1)}%`, (v) => (this.burnFill.style.width = v));
    this.set(
      'bt',
      `${String(Math.round(s.burnout))} · ${s.burnoutLabel}`,
      (v) => (this.burnText.textContent = v),
    );
    this.set('bm', String(s.meltdown), (v) =>
      this.burnBar.classList.toggle('meltdown', v === 'true'),
    );
    this.set('mw', `${String(s.mobilisation)}%`, (v) => (this.mobFill.style.width = v));
    this.set('cu', `☕ ${String(s.gobelets)}`, (v) => (this.cups.textContent = v));
    const pips = `${String(s.dashCharges)}/${String(s.dashMax)}/${s.dashProgress.toFixed(2)}`;
    this.set('dp', pips, () => {
      this.pips.replaceChildren();
      for (let i = 0; i < s.dashMax; i += 1) {
        const pip = el('i', i < s.dashCharges ? 'on' : '', this.pips);
        if (i === s.dashCharges) pip.style.setProperty('--p', s.dashProgress.toFixed(2));
      }
    });
    const waves =
      s.waveCount > 0 ? ` · VAGUE ${String(Math.max(1, s.wave))}/${String(s.waveCount)}` : '';
    const wave = `${s.clock} · ${s.roomLabel.toUpperCase()} · SALLE ${String(s.room)}/${String(s.roomTotal ?? 10)}${waves}`;
    this.set('wv', wave, (v) => (this.wave.textContent = v));
    const purse = `${String(s.tickets)} TICKETS · ${String(s.ps)} PS · ${String(s.kills)} K.O.${s.marked ? ' · SIGNALÉ' : ''}`;
    this.set('pu', purse, (v) => {
      this.purse.textContent = v;
      this.purse.classList.toggle('marked', s.marked);
    });
    if (this.bannerLeft > 0) {
      this.bannerLeft -= realDt;
      if (this.bannerLeft <= 0) this.banner.classList.remove('show');
    }
  }

  /** Bandeau central (fin de vague, salle nettoyée, fin de service). */
  public announce(text: string, seconds = 2.2, tone: 'info' | 'danger' | 'gold' = 'info'): void {
    this.banner.textContent = text;
    this.banner.dataset.tone = tone;
    this.banner.classList.remove('show');
    // Relance la transition : on force le calcul de style entre le retrait et l'ajout de la classe.
    this.banner.getBoundingClientRect();
    this.banner.classList.add('show');
    this.bannerLeft = seconds;
  }

  public toggleStats(): void {
    this.statsOn = !this.statsOn;
    this.statsBox.classList.toggle('show', this.statsOn);
  }

  public get statsVisible(): boolean {
    return this.statsOn;
  }

  public showStats(s: HudStats): void {
    if (!this.statsOn) return;
    this.statsBox.textContent =
      `${String(Math.round(s.fps))} fps · ${String(s.calls)} appels · ${(s.triangles / 1000).toFixed(1)} k tri · ` +
      `${String(s.geometries)} géo · ${String(s.textures)} tex · ×${s.pixelRatio.toFixed(2)} · ${s.quality} · ${String(s.enemies)} ennemis`;
  }

  /** HUD masqué derrière les menus (écran titre, résultats). */
  public setVisible(on: boolean): void {
    this.root.hidden = !on;
  }

  public dispose(): void {
    this.root.remove();
  }
}
