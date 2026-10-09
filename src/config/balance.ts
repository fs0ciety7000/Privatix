/**
 * Valeurs d'équilibrage (docs/GDD.md, annexe des chiffres). Aucune valeur de gameplay en dur ailleurs.
 * Durées en millisecondes, distances en pixels logiques (640×360), vitesses en px/s.
 */

// ─── Héros ────────────────────────────────────────────────────────────────────

export const HERO = {
  MAX_ENERGY: 100,
  /** L'Énergie max ne descend jamais sous ce seuil (séquelles du Pétage de plombs). */
  MIN_MAX_ENERGY: 50,
  SPEED: 150,
  ACCEL: 1800,
  DECEL: 2400,
  /** Rayon du corps Arcade (pieds) : collisions avec le décor. */
  FEET_RADIUS: 6,
  /** Rayon de la hurtbox (torse), centrée 10 px au-dessus des pieds. */
  HURT_RADIUS: 8,
  /**
   * Hurtbox : cercle dans le plan du sol, 10 px « au-dessus » des pieds. Les tests de touche se font
   * dans le plan du sol (vue de dessus) : ce décalage ne dépend PAS de la taille du sprite.
   */
  HURT_OFFSET_Y: 10,
  /** Origine des attaques, dans le plan du sol (même convention que la hurtbox). */
  ATTACK_ORIGIN_Y: 10,
  BALLAST_SLOW: 0.15,
  WALL_SLAM_SPEED: 150,
  WALL_SLAM_DAMAGE: 5,
  WALL_SLAM_STUN_MS: 300,
  IFRAMES_AFTER_HIT_MS: 600,
  BLINK_MS: 60,
  KNOCKBACK_TAKEN_PX: 24,
  KNOCKBACK_TAKEN_MS: 120,
  HURT_STUN_MS: 240,
  CRIT_CHANCE: 0.05,
  CRIT_MULT: 1.75,
} as const;

// ─── Combo de la clé à tire-fond ──────────────────────────────────────────────

export type HitShape =
  | { readonly kind: 'arc'; readonly radius: number; readonly angleDeg: number }
  | {
      readonly kind: 'rect';
      /** Le rectangle part de `from` px devant le héros et s'étend sur `length` px. */
      readonly from: number;
      readonly length: number;
      readonly width: number;
      /** Cercle d'impact supplémentaire au bout (rayon, distance). */
      readonly tipRadius: number;
      readonly tipAt: number;
    };

export interface AttackStep {
  readonly startupMs: number;
  readonly activeMs: number;
  readonly recoveryMs: number;
  readonly shape: HitShape;
  readonly damage: number;
  readonly knockbackPx: number;
  readonly knockbackMs: number;
  readonly stunMs: number;
  readonly hitstopMs: number;
  /** Petit pas en avant au début de l'active. */
  readonly lungePx: number;
  /** Le coup détruit les projectiles qu'il touche. */
  readonly breaksProjectiles: boolean;
  readonly shakePx: number;
  readonly shakeMs: number;
}

export const COMBO: readonly [AttackStep, AttackStep, AttackStep] = [
  {
    startupMs: 90,
    activeMs: 60,
    recoveryMs: 160,
    shape: { kind: 'arc', radius: 38, angleDeg: 100 },
    damage: 12,
    knockbackPx: 18,
    knockbackMs: 100,
    stunMs: 0,
    hitstopMs: 50,
    lungePx: 6,
    breaksProjectiles: false,
    shakePx: 1,
    shakeMs: 60,
  },
  {
    startupMs: 80,
    activeMs: 60,
    recoveryMs: 170,
    shape: { kind: 'arc', radius: 40, angleDeg: 120 },
    damage: 12,
    knockbackPx: 18,
    knockbackMs: 100,
    stunMs: 0,
    hitstopMs: 50,
    lungePx: 6,
    breaksProjectiles: false,
    shakePx: 1,
    shakeMs: 60,
  },
  {
    startupMs: 200,
    activeMs: 80,
    recoveryMs: 320,
    shape: { kind: 'rect', from: 8, length: 56, width: 28, tipRadius: 20, tipAt: 56 },
    damage: 30,
    knockbackPx: 64,
    knockbackMs: 160,
    stunMs: 250,
    hitstopMs: 110,
    lungePx: 12,
    breaksProjectiles: true,
    shakePx: 3,
    shakeMs: 120,
  },
];

export const COMBO_RULES = {
  /** Vitesse de déplacement pendant startup et active (fraction de la vitesse normale). */
  MOVE_FACTOR: 0.25,
  /** On peut enchaîner le coup suivant à partir de ce délai dans la recovery… */
  CHAIN_FROM_RECOVERY_MS: 80,
  /** …et jusqu'à ce délai après la fin de la recovery (sinon le combo repart du coup 1). */
  CHAIN_GRACE_MS: 150,
  /** Le dash annule le startup du coup 3 seulement pendant ses premières ms. */
  FINISHER_DASH_CANCEL_MS: 120,
  /** Hitstop supplémentaire par cible au-delà de la première, plafonné. */
  HITSTOP_PER_EXTRA_TARGET_MS: 10,
  HITSTOP_EXTRA_CAP_MS: 30,
  CRIT_HITSTOP_BONUS_MS: 30,
} as const;

// ─── Dash « Retard SNCB » ─────────────────────────────────────────────────────

export const DASH = {
  DISTANCE_PX: 72,
  DURATION_MS: 140,
  IFRAMES_MS: 120,
  CHARGES: 2,
  RECHARGE_MS: 750,
  MIN_INTERVAL_MS: 200,
  /** Dash parfait : un coup ennemi évité dans les premières ms du dash. */
  PERFECT_WINDOW_MS: 80,
  PERFECT_TIMESCALE: 0.6,
  PERFECT_SLOWMO_MS: 200,
  PERFECT_CHARGE_REFUND: 0.5,
  /** Dash-attaque « Attaque de correspondance » : attaque pendant le dash ou dans les 120 ms qui suivent. */
  ATTACK_WINDOW_MS: 120,
  /** Après une dash-attaque, la Frappe reprend au coup 2. */
  ATTACK_RESUME_COMBO: 1,
  PERFECT_BURNOUT: -6,
  PERFECT_MOBILISATION: 5,
} as const;

export const DASH_ATTACK: AttackStep = {
  startupMs: 60,
  activeMs: 80,
  recoveryMs: 200,
  shape: { kind: 'rect', from: 0, length: 64, width: 20, tipRadius: 0, tipAt: 0 },
  damage: 18,
  knockbackPx: 30,
  knockbackMs: 100,
  stunMs: 0,
  hitstopMs: 60,
  lungePx: 20,
  breaksProjectiles: false,
  shakePx: 2,
  shakeMs: 80,
};

// ─── Spéciale : Coup de sifflet / Préavis de grève ────────────────────────────

export const MOBILISATION = {
  MAX: 100,
  /** +1 point par tranche de N dégâts infligés. */
  DAMAGE_PER_POINT: 4,
  PER_KILL: 6,
  PER_HIT_TAKEN: 10,
  PER_PERFECT_DASH: 5,
  ELITE_KILL_BONUS: 20,
} as const;

export interface SpecialDef {
  readonly cost: number;
  readonly startupMs: number;
  readonly activeMs: number;
  readonly recoveryMs: number;
  readonly radius: number;
  readonly damage: number;
  readonly stunMs: number;
  readonly knockbackPx: number;
  readonly shakePx: number;
  readonly shakeMs: number;
  /** Étourdissement réduit pour les élites et le boss. */
  readonly eliteStunMs: number;
}

export const WHISTLE: SpecialDef = {
  cost: 50,
  startupMs: 150,
  activeMs: 100,
  recoveryMs: 250,
  radius: 72,
  damage: 25,
  stunMs: 1200,
  knockbackPx: 40,
  shakePx: 5,
  shakeMs: 250,
  eliteStunMs: 400,
};

export const PREAVIS: SpecialDef = {
  cost: 100,
  startupMs: 400,
  activeMs: 120,
  recoveryMs: 400,
  radius: 120,
  damage: 60,
  stunMs: 2500,
  knockbackPx: 64,
  shakePx: 7,
  shakeMs: 350,
  eliteStunMs: 800,
};

export const SPECIAL_RULES = {
  /** Maintien du bouton au-delà de ce délai : Préavis de grève (si la jauge est pleine). */
  HOLD_FOR_PREAVIS_MS: 600,
  /** Vitesse pendant le maintien. */
  HOLD_SPEED_FACTOR: 0.5,
  COOLDOWN_MS: 4000,
} as const;

// ─── Burnout ──────────────────────────────────────────────────────────────────

export const BURNOUT = {
  MAX: 100,
  PER_DAMAGE_TAKEN: 0.6,
  PER_DASH: 2,
  PER_COFFEE: 20,
  /** Récupération passive après un délai sans coup reçu ni dash. */
  CALM_DELAY_MS: 3000,
  CALM_DECAY_PER_S: 3,
  PER_KILL: -1,
  PER_ELITE_KILL: -10,
  PER_PERFECT_DASH: -6,
  PER_ROOM_CLEARED: -10,
  REST_ROOM: -50,
  /** Plancher = N × heures écoulées dans le Shift (×1,5 la nuit). */
  FLOOR_PER_HOUR: 3,
  MELTDOWN_MS: 8000,
  MELTDOWN_EXIT_MIN: 30,
  MELTDOWN_MAX_ENERGY_PENALTY: 8,
} as const;

export interface BurnoutTierDef {
  readonly id: 'frais' | 'pression' | 'bord' | 'rouleau' | 'meltdown';
  readonly label: string;
  readonly from: number;
  readonly damageDealt: number;
  readonly speed: number;
  readonly crit: number;
  readonly damageTaken: number;
  readonly coffeeHeal: number;
  readonly attackSpeed: number;
}

/** Paliers, du plus bas au plus haut. Les bonus sont additifs (0,1 = +10 %). */
export const BURNOUT_TIERS: readonly BurnoutTierDef[] = [
  {
    id: 'frais',
    label: 'Frais',
    from: 0,
    damageDealt: 0,
    speed: 0,
    crit: 0,
    damageTaken: 0,
    coffeeHeal: 1,
    attackSpeed: 0,
  },
  {
    id: 'pression',
    label: 'Sous pression',
    from: 30,
    damageDealt: 0.1,
    speed: 0.05,
    crit: 0,
    damageTaken: 0,
    coffeeHeal: 1,
    attackSpeed: 0,
  },
  {
    id: 'bord',
    label: 'Au bord',
    from: 60,
    damageDealt: 0.25,
    speed: 0.1,
    crit: 0.1,
    damageTaken: 0.15,
    coffeeHeal: 0.75,
    attackSpeed: 0,
  },
  {
    id: 'rouleau',
    label: 'Au bout du rouleau',
    from: 90,
    damageDealt: 0.35,
    speed: 0.1,
    crit: 0.15,
    damageTaken: 0.25,
    coffeeHeal: 0.5,
    attackSpeed: 0,
  },
];

/** Pétage de plombs : remplace les bonus de palier pendant sa durée. */
export const MELTDOWN_TIER: BurnoutTierDef = {
  id: 'meltdown',
  label: 'PÉTAGE DE PLOMBS',
  from: 100,
  damageDealt: 0.5,
  speed: 0.1,
  crit: 0.15,
  damageTaken: 0.5,
  coffeeHeal: 0,
  attackSpeed: 0.25,
};

// ─── Café ─────────────────────────────────────────────────────────────────────

export const COFFEE = {
  START: 2,
  MAX: 4,
  HEAL_FRACTION: 0.3,
  DRINK_MS: 600,
  /** La gorgée (soin) a lieu à 400 ms ; interrompu avant, le Gobelet n'est pas perdu. */
  SIP_AT_MS: 400,
  DRINK_MOVE_FACTOR: 0.5,
  CAFFEINE_MS: 6000,
  CAFFEINE_ATTACK_SPEED: 0.15,
} as const;

// ─── Ennemis ──────────────────────────────────────────────────────────────────

export const ENEMY_RULES = {
  SPAWN_TELEGRAPH_MS: 600,
  SPAWN_IDLE_MS: 400,
  /** Jamais d'apparition à moins de 96 px du héros. */
  SPAWN_MIN_DIST_PX: 96,
  SPAWN_STAGGER_MS: 150,
  MAX_MELEE_TOKENS: 2,
  MAX_RANGED_TOKENS: 2,
  /** Séparation douce entre ennemis (px/s²), sans collider dur. */
  SEPARATION_ACCEL: 200,
  SEPARATION_RADIUS: 18,
  MAX_ALIVE: 24,
  FLASH_MS: 60,
  STAGGER_MS: 220,
  CORPSE_FADE_MS: 400,
} as const;

export interface EnemyStats {
  readonly hp: number;
  readonly speed: number;
  /** Rayon de la hurtbox (cercle), centrée `hurtOffsetY` px au-dessus des pieds. */
  readonly hurtRadius: number;
  readonly hurtOffsetY: number;
  /** Multiplicateur du knockback reçu (masse) ; 0 = immobile. */
  readonly mass: number;
  /** Coût dans le budget de menace d'une salle. */
  readonly cost: number;
  readonly tickets: number;
  /** Les coups 1-2 ne l'interrompent pas tant que sa posture tient. */
  readonly superArmor: boolean;
}

export const CONSULTANT = {
  hp: 30,
  speed: 85,
  hurtRadius: 8,
  hurtOffsetY: 12,
  mass: 1,
  cost: 1,
  tickets: 2,
  superArmor: false,
  STRAFE_SPEED: 60,
  AGGRO_PX: 220,
  AGGRO_ALL_AFTER_MS: 2000,
  /** « Coup de diaporama » : arc de 90°, portée 28 px, engagé à 32 px. */
  MELEE_RANGE: 32,
  MELEE_TELEGRAPH_MS: 450,
  MELEE_ARC_DEG: 90,
  MELEE_REACH: 28,
  MELEE_DAMAGE: 8,
  MELEE_KNOCKBACK: 24,
  MELEE_RECOVERY_MS: 600,
  /** « Quick win » : ruée rectiligne de 96 px en 240 ms, engagée entre 64 et 120 px. */
  QW_MIN: 64,
  QW_MAX: 120,
  QW_TELEGRAPH_MS: 450,
  QW_DISTANCE: 96,
  QW_DURATION_MS: 240,
  QW_WIDTH: 16,
  QW_DAMAGE: 10,
  QW_RECOVERY_MS: 800,
  QW_RECOVERY_DAMAGE_TAKEN: 0.25,
  QW_COOLDOWN_MS: 4000,
} as const satisfies EnemyStats & Record<string, unknown>;

export const BORNE = {
  hp: 50,
  speed: 30,
  hurtRadius: 10,
  hurtOffsetY: 12,
  mass: 0,
  cost: 2,
  tickets: 4,
  superArmor: true,
  RETREAT_UNDER: 32,
  /** Blindage frontal (−50 %) et panneau arrière exposé (×2). */
  FRONT_ARMOR: 0.5,
  BACK_MULT: 2,
  MAX_PER_WAVE: 3,
  MIN_ROOM: 2,
  DEPLOY_MS: 800,
  TURN_DEG_PER_S: 90,
  SALVE_TELEGRAPH_MS: 500,
  SALVE_COUNT: 3,
  SALVE_SPREAD_DEG: 15,
  PROJECTILE_SPEED: 140,
  PROJECTILE_LIFE_MS: 2500,
  PROJECTILE_RADIUS: 3,
  PROJECTILE_DAMAGE: 7,
  RELOAD_MS: 1200,
  PERIOD_MS: 2200,
  OUT_OF_ORDER_MS: 2000,
} as const satisfies EnemyStats & Record<string, unknown>;

export const DRONE = {
  hp: 15,
  speed: 110,
  hurtRadius: 7,
  hurtOffsetY: 18,
  mass: 0.6,
  cost: 1.5,
  tickets: 2,
  superArmor: false,
  ORBIT_PX: 96,
  SHOT_TELEGRAPH_MS: 400,
  SHOT_SPEED: 180,
  SHOT_RADIUS: 2,
  SHOT_DAMAGE: 5,
  SHOT_PERIOD_MS: 2400,
  DIVE_TELEGRAPH_MS: 480,
  DIVE_DISTANCE: 120,
  DIVE_DURATION_MS: 300,
  DIVE_RADIUS: 10,
  DIVE_DAMAGE: 9,
  GROUNDED_MS: 700,
  GROUNDED_DAMAGE_TAKEN: 0.5,
  DIVE_COOLDOWN_MS: 5000,
  /** Scan : cône de 60°, 128 px ; le héros marqué subit +25 % de dégâts pendant 5 s. */
  SCAN_CONE_DEG: 60,
  SCAN_RANGE: 128,
  SCAN_MS: 1000,
  MARK_AFTER_MS: 300,
  MARK_MS: 5000,
  MARK_DAMAGE_TAKEN: 0.25,
  SCAN_COOLDOWN_MS: 7000,
  FLEE_BELOW: 48,
  FLEE_SPEED: 150,
} as const satisfies EnemyStats & Record<string, unknown>;

export const MANAGER = {
  hp: 220,
  speed: 60,
  hurtRadius: 13,
  hurtOffsetY: 16,
  mass: 0.5,
  cost: 8,
  tickets: 15,
  superArmor: true,
  KEEP_MIN: 120,
  KEEP_MAX: 180,
  /** Posture « Costume trois-pièces » : casse après 50 dégâts en 3 s. */
  POISE_DAMAGE: 50,
  POISE_WINDOW_MS: 3000,
  BREAK_MS: 1500,
  BREAK_DAMAGE_TAKEN: 0.25,
  /** Coup de tablette : arc de 120°, 40 px. */
  TABLET_RANGE: 36,
  TABLET_TELEGRAPH_MS: 700,
  TABLET_ARC_DEG: 120,
  TABLET_REACH: 40,
  TABLET_DAMAGE: 12,
  TABLET_KNOCKBACK: 40,
  TABLET_COOLDOWN_MS: 2000,
  /** Chronomètre : zone qui ralentit (40 %) et pique, posée sous le héros. */
  CHRONO_TELEGRAPH_MS: 800,
  CHRONO_RADIUS: 32,
  CHRONO_SLOW: 0.4,
  CHRONO_ZONE_MS: 3000,
  CHRONO_DAMAGE: 4,
  CHRONO_PERIOD_MS: 5000,
  /** Reporting : anneau qui s'étend jusqu'à 160 px. */
  REPORT_TELEGRAPH_MS: 1200,
  REPORT_RADIUS: 160,
  REPORT_EXPAND_MS: 800,
  REPORT_THICKNESS: 12,
  REPORT_DAMAGE: 14,
  REPORT_PERIOD_MS: 20000,
  REPORT_FIRST_AT_MS: 8000,
} as const satisfies EnemyStats & Record<string, unknown>;

export const AUDITEUR = {
  hp: 1400,
  speed: 50,
  hurtRadius: 28,
  hurtOffsetY: 30,
  mass: 0,
  cost: 0,
  tickets: 60,
  superArmor: true,
  SPEEDS: [50, 60, 75] as const,
  PATTERN_GAP_MS: [1600, 1300, 1100] as const,
  PHASE_AT: [0.6, 0.25] as const,
  PHASE_TRANSITION_MS: 1200,
  P3_SPEED_MULT: 1.2,
  SWEEP_TELEGRAPH_MS: 900,
  SWEEP_ARC_DEG: 180,
  SWEEP_RADIUS: 88,
  SWEEP_DAMAGE: 16,
  SWEEP_KNOCKBACK: 48,
  SWEEP_RECOVERY_MS: 500,
  CHRONO_COUNT: 3,
  CHRONO_TELEGRAPH_MS: 800,
  CHRONO_GAP_MS: 400,
  CHRONO_RADIUS: 32,
  CHRONO_DAMAGE: 6,
  BARRAGE_TELEGRAPH_MS: 800,
  BARRAGE_CYCLES: 4,
  BARRAGE_COUNT: 5,
  BARRAGE_SPREAD_DEG: 40,
  BARRAGE_SPEED: 150,
  BARRAGE_DAMAGE: 7,
  STAMP_TELEGRAPH_MS: 1100,
  STAMP_LOCK_MS: 300,
  STAMP_RADIUS: 48,
  STAMP_DAMAGE: 22,
  STAMP_WAVE_RADIUS: 96,
  STAMP_WAVE_DAMAGE: 10,
  /** Rames : télégraphe de 3 s sur la voie, 40 % de l'Énergie max au héros, 150 au boss. */
  TRAIN_TELEGRAPH_MS: 3000,
  TRAIN_PLAYER_DAMAGE_PCT: 0.4,
  TRAIN_BOSS_DAMAGE: 150,
  TRAIN_PERIOD_P2_MS: 14000,
  TRAIN_PERIOD_P3_MS: 10000,
  TRAIN_SPEED: 900,
  REINFORCE_COUNT: 2,
  REINFORCE_MAX_ALIVE: 4,
  REINFORCE_PERIOD_MS: 25000,
  /** Phase 3 : ruée laissant des lignes de KPI au sol. */
  KPI_TELEGRAPH_MS: 700,
  KPI_DISTANCE: 300,
  KPI_DURATION_MS: 500,
  KPI_DAMAGE: 16,
  KPI_TRAIL_MS: 3000,
  KPI_TRAIL_TICK_MS: 500,
  KPI_TRAIL_DAMAGE: 6,
} as const satisfies EnemyStats & Record<string, unknown>;

// ─── Ennemis majeurs et boss des biomes 2 et 3 (GDD § 7.8, § 7.10 ; game_designer.md § 11) ──────

/**
 * Élite majeur du biome 1 : le Furet putride (LORE § 6.8). Rapide et fuyant : morsure, bond, nuages de
 * puanteur (verts, sans dégâts : +Burnout et récupération bloquée), passage sous les quais puis
 * resurgissement télégraphié 700 ms. Le Sifflet le débusque.
 */
export const FURET = {
  hp: 200,
  speed: 120,
  hurtRadius: 12,
  hurtOffsetY: 10,
  mass: 0.7,
  cost: 8,
  tickets: 15,
  superArmor: false,
  /** Phase « Acculé » sous 30 % de PV. */
  FRENZY_AT: 0.3,
  FRENZY_SPEED_MULT: 1.25,
  KEEP_PX: 70,
  BITE_RANGE: 36,
  BITE_TELEGRAPH_MS: 700,
  BITE_ARC_DEG: 70,
  BITE_REACH: 36,
  BITE_DAMAGE: 9,
  BITE_KNOCKBACK: 20,
  BITE_RECOVERY_MS: 600,
  BITE_COOLDOWN_MS: 1600,
  POUNCE_MIN: 80,
  POUNCE_MAX: 160,
  POUNCE_TELEGRAPH_MS: 750,
  POUNCE_DISTANCE: 140,
  POUNCE_DURATION_MS: 350,
  POUNCE_LAND_RADIUS: 28,
  POUNCE_DAMAGE: 11,
  POUNCE_RECOVERY_MS: 900,
  POUNCE_RECOVERY_DAMAGE_TAKEN: 0.25,
  POUNCE_COOLDOWN_MS: 5000,
  /** Nuage de puanteur : vert, aucun dégât, +6 Burnout/s et récupération passive bloquée. */
  STINK_TELEGRAPH_MS: 800,
  STINK_RADIUS: 48,
  STINK_RADIUS_FRENZY: 64,
  STINK_LIFE_MS: 6000,
  STINK_DRIFT: 12,
  STINK_MAX: 3,
  STINK_BURNOUT_PER_S: 6,
  STINK_PERIOD_MS: 7000,
  STINK_FIRST_AT_MS: 2500,
  /** Sous les quais : plongée 600 ms, caché 1,5 à 3 s, resurgit sous le héros (télégraphe 700 ms). */
  BURROW_TELEGRAPH_MS: 600,
  BURROW_HIDDEN_MIN_MS: 1500,
  BURROW_HIDDEN_MAX_MS: 3000,
  BURROW_TRAIL_SPEED: 160,
  EMERGE_RADIUS: 32,
  EMERGE_TELEGRAPH_MS: 700,
  EMERGE_DAMAGE: 12,
  EMERGE_RECOVERY_MS: 800,
  BURROW_COOLDOWN_MS: 10000,
  BURROW_COOLDOWN_FRENZY_MS: 7000,
  BURROW_FIRST_AT_MS: 5000,
  /** Le Sifflet : étourdi 1,2 s (débusqué s'il est sous le quai), nuages dispersés (rayon + 24). */
  WHISTLE_STUN_MS: 1200,
  WHISTLE_CLEAR_BONUS: 24,
  /** « Bol d'air » à sa mort : nuages dissipés, −10 Burnout. */
  DEATH_BURNOUT: -10,
  /** Part du Furet dans les salles Élite du biome 1 (Nuit : 60 %). */
  ELITE_SHARE: 0.4,
  ELITE_SHARE_NIGHT: 0.6,
} as const satisfies EnemyStats & Record<string, unknown>;

/**
 * Élite majeur du biome 2 : le Fluidifieur (LORE § 7.2), régisseur de l'inauguration, Salle gardée de
 * la salle 8. Glissade en chaise à roulettes, changement de roulement (dalles qui s'ouvrent sur le
 * vide), classeur « Congé en cours de validation », puis (sous 50 %) organigramme et mutation d'office.
 * Faiblesse « Le Règlement » : 3 pages au vent ; les 3 attrapées, le Sifflet l'étourdit 4 s (×2).
 */
export const FLUIDIFIEUR = {
  hp: 480,
  speed: 70,
  hurtRadius: 14,
  hurtOffsetY: 18,
  mass: 0,
  cost: 0,
  tickets: 30,
  superArmor: true,
  PHASE_AT: 0.5,
  PHASE_TRANSITION_MS: 1200,
  PATTERN_GAP_MS: [1400, 1100] as const,
  KEEP_PX: 110,
  GLIDE_TELEGRAPH_MS: 900,
  GLIDE_DISTANCE: 220,
  GLIDE_WIDTH: 28,
  GLIDE_SPEED: 330,
  GLIDE_BOUNCES: 2,
  GLIDE_DAMAGE: 14,
  GLIDE_RECOVERY_MS: 900,
  /** Changement de roulement : damier de dalles (cases de 40 u) qui s'ouvrent sur le vide 4 s. */
  SLABS_TELEGRAPH_MS: 1500,
  SLABS_HALF: 20,
  SLABS_COUNT: 8,
  SLABS_OPEN_MS: 4000,
  SLABS_DAMAGE: 10,
  SLABS_COOLDOWN_MS: 9000,
  /** Classeur lent « Congé en cours de validation » : ralentit 2 s. */
  BINDER_TELEGRAPH_MS: 800,
  BINDER_SPEED: 70,
  BINDER_RADIUS: 9,
  BINDER_DAMAGE: 10,
  BINDER_SLOW: 0.4,
  BINDER_SLOW_MS: 2000,
  BINDER_COOLDOWN_MS: 7000,
  /** Mutation d'office (phase 2) : ligne magenta de 1 s, puis échange de positions. */
  SWAP_TELEGRAPH_MS: 1000,
  SWAP_WIDTH: 24,
  SWAP_DAMAGE: 10,
  SWAP_COOLDOWN_MS: 10000,
  /** Organigramme (phase 2) : 2 Consultants en renfort. */
  ORG_COUNT: 2,
  ORG_COOLDOWN_MS: 16000,
  ORG_MAX_ALIVE: 3,
  /** « Le Règlement » : pages au vent, attrapées au contact. */
  PAGES: 3,
  PAGE_RADIUS: 14,
  PAGE_DRIFT: 22,
  WHISTLE_STUN_MS: 600,
  REGLEMENT_STUN_MS: 4000,
  REGLEMENT_DAMAGE_TAKEN: 1,
} as const satisfies EnemyStats & Record<string, unknown>;

/**
 * Mini-boss du biome 3 : le Discosaure (LORE § 6.9), Salle gardée « Afterwork de transformation ».
 * Piste de danse (taches de lumière en orbite qui virent au magenta, se figent puis explosent),
 * piétinement et onde, charge (étourdi s'il percute un mur), coup de queue, lasers en phase 2 (coupés en
 * Réduction des mouvements). Dos (boule à facettes) ×1,5.
 */
export const DISCOSAURE = {
  hp: 560,
  speed: 70,
  hurtRadius: 22,
  hurtOffsetY: 24,
  mass: 0,
  cost: 0,
  tickets: 40,
  superArmor: true,
  BACK_ARC_DEG: 90,
  BACK_MULT: 1.5,
  PHASE_AT: 0.5,
  PHASE_TRANSITION_MS: 1200,
  PATTERN_GAP_MS: [1400, 1100] as const,
  /** Piste de danse : taches en orbite (contour), figées (remplissage magenta), puis explosion. */
  SPOTS_COUNT: 6,
  SPOTS_COUNT_P2: 10,
  SPOTS_RADIUS: 20,
  SPOTS_ORBIT_MIN: 64,
  SPOTS_ORBIT_MAX: 160,
  SPOTS_TURN_DEG_PER_S: 25,
  SPOTS_TURN_DEG_PER_S_P2: 40,
  SPOTS_ORBIT_MS: 800,
  SPOTS_TELEGRAPH_MS: 1400,
  SPOTS_DAMAGE: 12,
  SPOTS_PERIOD_MS: 9000,
  SPOTS_FIRST_AT_MS: 1500,
  TAIL_TELEGRAPH_MS: 800,
  TAIL_ARC_DEG: 180,
  TAIL_RADIUS: 72,
  TAIL_DAMAGE: 12,
  TAIL_KNOCKBACK: 48,
  TAIL_RECOVERY_MS: 700,
  STOMP_TELEGRAPH_MS: 900,
  STOMP_RADIUS: 56,
  STOMP_DAMAGE: 14,
  STOMP_WAVE_RADIUS: 140,
  STOMP_WAVE_EXPAND_MS: 700,
  STOMP_WAVE_THICKNESS: 12,
  STOMP_WAVE_DAMAGE: 8,
  STOMP_RECOVERY_MS: 600,
  CHARGE_TELEGRAPH_MS: 1000,
  CHARGE_DISTANCE: 240,
  CHARGE_DURATION_MS: 600,
  CHARGE_WIDTH: 40,
  CHARGE_DAMAGE: 14,
  DIZZY_MS: 1200,
  DIZZY_DAMAGE_TAKEN: 0.25,
  CHARGE_COOLDOWN_MS: 6000,
  LASER_TELEGRAPH_MS: 1000,
  LASER_COUNT: 4,
  LASER_LENGTH: 300,
  LASER_WIDTH: 8,
  LASER_TURN_DEG_PER_S: 30,
  LASER_DURATION_MS: 3000,
  LASER_DAMAGE: 6,
  LASER_TICK_MS: 600,
  LASER_COOLDOWN_MS: 12000,
  /** Escorte au seuil de 50 %. */
  ESCORT_COUNT: 3,
  WHISTLE_FREEZE_MS: 3000,
  PREAVIS_BLACKOUT_MS: 5000,
  STUN_WHISTLE_MS: 600,
  STUN_PREAVIS_MS: 1200,
} as const satisfies EnemyStats & Record<string, unknown>;

/**
 * Boss obligatoire du biome 2 : Elio Di Rupo, « l'Invité d'honneur » (GDD § 7.8, LORE § 7.5 ;
 * caricature autorisée, satire bon enfant : vaincu, jamais tué ; répliques fictives). PV fixes.
 */
export const DIRUPO = {
  hp: 2000,
  speed: 55,
  hurtRadius: 18,
  hurtOffsetY: 22,
  mass: 0,
  cost: 0,
  tickets: 60,
  superArmor: true,
  SPEEDS: [55, 60, 70] as const,
  PATTERN_GAP_MS: [1500, 1250, 1050] as const,
  PHASE_AT: [0.6, 0.25] as const,
  PHASE_TRANSITION_MS: 1500,
  /** Phase 3 : télégraphes ×0,85, jamais sous 800 ms. */
  P3_TELEGRAPH_MULT: 0.85,
  MIN_TELEGRAPH_MS: 800,
  KEEP_PX: 120,
  BOWTIE_TELEGRAPH_MS: 900,
  BOWTIE_OUT: 220,
  BOWTIE_SPEED: 260,
  BOWTIE_RADIUS: 8,
  BOWTIE_DAMAGE: 12,
  BOWTIE_RECOVERY_MS: 600,
  BOWTIE_COOLDOWN_MS: 6000,
  /** « Et j'ajouterai… » : un anneau par seconde pendant 4 s, avec une brèche de 40° qui tourne. */
  SPEECH_TELEGRAPH_MS: 1000,
  SPEECH_MS: 4000,
  SPEECH_RING_EVERY_MS: 1000,
  SPEECH_RING_MAX: 200,
  SPEECH_RING_EXPAND_MS: 1000,
  SPEECH_RING_THICKNESS: 12,
  SPEECH_GAP_DEG: 40,
  SPEECH_GAP_TURN_DEG_PER_S: 45,
  SPEECH_DAMAGE: 10,
  SPEECH_BACK_DAMAGE_TAKEN: 0.25,
  SPEECH_INTERRUPT_STUN_MS: 2000,
  SPEECH_COOLDOWN_MS: 14000,
  /** Promesses : 5 bulles qui éclatent (frappées avant : « promesse tenue »). */
  PROMISES: 5,
  PROMISE_TELEGRAPH_MS: 1500,
  PROMISE_RADIUS: 24,
  PROMISE_BURST_RADIUS: 40,
  PROMISE_DAMAGE: 14,
  PROMISE_KEPT_MOBILISATION: 5,
  PROMISE_KEPT_BURNOUT: -3,
  PROMISE_COOLDOWN_MS: 10000,
  /** Pluie de bulletins : 12 cercles dont 3 sous le héros. */
  BALLOTS: 12,
  BALLOTS_ON_HERO: 3,
  BALLOT_TELEGRAPH_MS: 800,
  BALLOT_RADIUS: 16,
  BALLOT_DAMAGE: 8,
  BALLOT_RECOVERY_MS: 700,
  BALLOT_COOLDOWN_MS: 8000,
  /** Motions de procédure (phase 2+) : 3 couloirs parallèles de 400 × 24. */
  MOTIONS_TELEGRAPH_MS: 1000,
  MOTION_LANES: 3,
  MOTION_LENGTH: 400,
  MOTION_WIDTH: 24,
  MOTION_SPACING: 56,
  MOTION_DAMAGE: 16,
  MOTION_RECOVERY_MS: 800,
  MOTION_COOLDOWN_MS: 9000,
  /** Ruban d'enceinte (phase 3) : se resserre jusqu'à 200 u en 20 s ; contact 8 dégâts et entrave. */
  RIBBON_TELEGRAPH_MS: 1200,
  RIBBON_START: 330,
  RIBBON_MIN: 200,
  RIBBON_SHRINK_MS: 20000,
  RIBBON_WIDTH: 10,
  RIBBON_DAMAGE: 8,
  RIBBON_SLOW: 0.5,
  RIBBON_SLOW_MS: 1000,
  RIBBON_HIT_GAP_MS: 700,
  /** Couper le ruban (coup final, dash-attaque, dash parfait) : étourdi 3 s, +25 %, relâché de 120 u. */
  RIBBON_CUT_STUN_MS: 3000,
  RIBBON_CUT_DAMAGE_TAKEN: 0.25,
  RIBBON_CUT_SLACK: 120,
  RIBBON_CUT_COOLDOWN_MS: 12000,
  /** Ciseaux d'inauguration (phase 3) : rectangle 240 × 24. */
  SCISSORS_TELEGRAPH_MS: 1100,
  SCISSORS_LENGTH: 240,
  SCISSORS_WIDTH: 24,
  SCISSORS_DAMAGE: 22,
  SCISSORS_RECOVERY_MS: 900,
  SCISSORS_COOLDOWN_MS: 7000,
  /** Préavis : « Concertation sociale », aucune attaque pendant 4 s, marqué Piquet (+15 %). */
  PREAVIS_TALKS_MS: 4000,
  PREAVIS_DAMAGE_TAKEN: 0.15,
} as const satisfies EnemyStats & Record<string, unknown>;

/**
 * Boss du biome 3 : Jean-Cul Lurcke (LORE § 7.3). **Version de travail** (placeholder cohérent,
 * en attendant la jauge de signature, les Preuves et la Salle du Conseil du GDD § 7.9) : phase 1
 * « Méga-Deck 2032 » (lignes de bullet points à trou, « Je vous mets en copie », piliers-graphiques),
 * phase 2 « Conseil d'Administration en visio » (tout plus vite, Reporting géant), coup final
 * « Mais concrètement, sur le terrain, ça donne quoi ? » sous 5 %.
 */
export const LURCKE = {
  hp: 1800,
  speed: 60,
  hurtRadius: 16,
  hurtOffsetY: 20,
  mass: 0,
  cost: 0,
  tickets: 80,
  superArmor: true,
  PHASE_AT: 0.5,
  PHASE_TRANSITION_MS: 1500,
  PATTERN_GAP_MS: [1500, 1150] as const,
  KEEP_PX: 140,
  /** Bullet points : lignes horizontales qui balaient la salle, un trou par ligne. */
  BULLETS_TELEGRAPH_MS: 1000,
  BULLET_LINES: 3,
  BULLET_SPACING: 72,
  BULLET_WIDTH: 16,
  BULLET_GAP: 80,
  BULLET_DAMAGE: 12,
  BULLET_COOLDOWN_MS: 7000,
  /** Piliers-graphiques : 3 cercles sous et autour du héros. */
  CHARTS: 3,
  CHART_TELEGRAPH_MS: 900,
  CHART_RADIUS: 28,
  CHART_DAMAGE: 14,
  CHART_COOLDOWN_MS: 6000,
  /** « Je vous mets en copie » : 2 Consultants. */
  COPY_COUNT: 2,
  COPY_MAX_ALIVE: 4,
  COPY_COOLDOWN_MS: 14000,
  /** Reporting géant (phase 2). */
  REPORT_TELEGRAPH_MS: 1200,
  REPORT_RADIUS: 260,
  REPORT_EXPAND_MS: 1200,
  REPORT_THICKNESS: 16,
  REPORT_DAMAGE: 16,
  REPORT_COOLDOWN_MS: 15000,
  /** Coup final : sous 5 %, il s'arrête, étourdi, et le prochain coup est critique. */
  FINAL_AT: 0.05,
  FINAL_STUN_MS: 6000,
} as const satisfies EnemyStats & Record<string, unknown>;

/** Environnements des biomes 2 et 3 (GDD § 3.1). */
export const ENVIRONMENT = {
  /** Vide de la Passerelle : héros −10 % d'Énergie max et retour au bord ; non-élites éliminés. */
  VOID_FALL_ENERGY_PCT: 0.1,
  VOID_FALL_INVULN_MS: 800,
  /** Rafales de vent (biome 2) : 2 s toutes les 6 à 8 s, annoncées 1 s avant. */
  WIND_PERIOD_MS: [6000, 8000] as const,
  WIND_WARN_MS: 1000,
  WIND_MS: 2000,
  WIND_PUSH: 34,
  /** Cloisons mobiles (biome 3) : un couloir balayé toutes les 10 s, télégraphe 1,5 s. */
  PARTITION_PERIOD_MS: 10000,
  PARTITION_TELEGRAPH_MS: 1500,
  PARTITION_DAMAGE: 10,
  PARTITION_SPEED: 420,
} as const;

export type EnemyKind =
  | 'consultant'
  | 'borne'
  | 'drone'
  | 'manager'
  | 'auditeur'
  | 'furet'
  | 'fluidifieur'
  | 'discosaure'
  | 'dirupo'
  | 'lurcke';

export const ENEMY_STATS: Readonly<Record<EnemyKind, EnemyStats>> = {
  consultant: CONSULTANT,
  borne: BORNE,
  drone: DRONE,
  manager: MANAGER,
  auditeur: AUDITEUR,
  furet: FURET,
  fluidifieur: FLUIDIFIEUR,
  discosaure: DISCOSAURE,
  dirupo: DIRUPO,
  lurcke: LURCKE,
};

export const ENEMY_NAMES: Readonly<Record<EnemyKind, string>> = {
  consultant: 'Consultant Junior',
  borne: 'Borne Automatique',
  drone: 'Drone Optimètre',
  manager: 'Manager KPI « Le Tableur »',
  auditeur: "L'Auditeur des Quais",
  furet: 'Le Furet putride',
  fluidifieur: 'Le Fluidifieur',
  discosaure: 'Le Discosaure',
  dirupo: "Elio Di Rupo, l'Invité d'honneur",
  lurcke: 'Jean-Cul Lurcke',
};

/** Élites et boss : étourdissements réduits, pas de chute dans le vide. */
export const HEAVY_KINDS: readonly EnemyKind[] = [
  'manager',
  'auditeur',
  'furet',
  'fluidifieur',
  'discosaure',
  'dirupo',
  'lurcke',
];

/** Boss de fin de biome (barre de boss, PV fixes). */
export const BOSS_KINDS: readonly EnemyKind[] = ['auditeur', 'dirupo', 'lurcke'];

// ─── Shift (run) ──────────────────────────────────────────────────────────────

export type ShiftId = 'matin' | 'apres-midi' | 'nuit';

export interface ShiftDef {
  readonly id: ShiftId;
  readonly label: string;
  readonly startHour: number;
  readonly hpMult: number;
  readonly damageMult: number;
  readonly speedMult: number;
  readonly floorMult: number;
  readonly psMult: number;
  readonly budgetMult: number;
  readonly extraDronesPerWave: number;
  /** Halo de lumière autour du héros (0 = pas d'obscurité). */
  readonly lightRadius: number;
}

export const SHIFTS: Readonly<Record<ShiftId, ShiftDef>> = {
  matin: {
    id: 'matin',
    label: 'Matin',
    startHour: 6,
    hpMult: 1,
    damageMult: 1,
    speedMult: 1,
    floorMult: 1,
    psMult: 1,
    budgetMult: 1,
    extraDronesPerWave: 1,
    lightRadius: 0,
  },
  'apres-midi': {
    id: 'apres-midi',
    label: 'Après-midi',
    startHour: 14,
    hpMult: 1.1,
    damageMult: 1,
    speedMult: 1,
    floorMult: 1,
    psMult: 1.15,
    budgetMult: 1,
    extraDronesPerWave: 0,
    lightRadius: 0,
  },
  nuit: {
    id: 'nuit',
    label: 'Nuit',
    startHour: 22,
    hpMult: 1,
    damageMult: 1.15,
    speedMult: 1.1,
    floorMult: 1.5,
    psMult: 1.35,
    budgetMult: 0.85,
    extraDronesPerWave: 0,
    lightRadius: 160,
  },
};

export const SHIFT = {
  /** Minutes ajoutées à l'horloge par salle franchie. */
  MINUTES_PER_ROOM: 30,
  /** LED du dash : minutes de « retard » affichées (gag, sans effet). */
  DASH_LED_MIN: 5,
  PERFECT_DASH_LED_MIN: 15,
  /** Biome 1 (MVP) : salles de combat avant la salle des pauses et le boss. */
  BIOME1_ROOMS: 8,
  /** Salles générées par biome (GDD § 3.1) : Quais & Voies, Passerelle, Hall & BAG. */
  BIOME_ROOMS: [8, 8, 9] as const,
  /** Salle gardée du biome 3 : garantie entre les positions 5 et 7 (35 % par porte avant la 7). */
  GARDEE_FIRST: 5,
  GARDEE_LAST: 7,
  GARDEE_CHANCE: 0.35,
  /** Salle Élite : au moins une entre les salles 5 et 7, au plus deux, jamais deux d'affilée. */
  ELITE_FIRST: 5,
  ELITE_LAST: 7,
  ELITE_CHANCE: 0.3,
  ELITE_FROM_ROOM: 4,
  /** Friterie : exactement une, entre les salles 3 et 6. */
  SHOP_FIRST: 3,
  SHOP_LAST: 6,
  /** Nombre de portes proposées à la sortie d'une salle (min, max). */
  DOORS: [2, 3] as const,
} as const;

export const SCALING = {
  HP_PER_ROOM: 0.08,
  DAMAGE_PER_ROOM: 0.05,
  SPEED_PER_ROOM: 0.01,
  SPEED_CAP: 1.15,
  /** Budget(r) = round((6 + 1,6 r) × M_type × M_roulement). */
  BUDGET_BASE: 6,
  BUDGET_PER_ROOM: 1.6,
  FIRST_ROOM_BUDGET: 0.75,
  ELITE_BUDGET: 1.6,
  TWO_WAVES_UNTIL_ROOM: 5,
  WAVE_SPLIT_2: [0.55, 0.45] as const,
  WAVE_SPLIT_3: [0.4, 0.35, 0.25] as const,
  NEXT_WAVE_WHEN_ALIVE_AT_MOST: 2,
  NEXT_WAVE_KILLED_FRACTION: 0.7,
  /** Composition du biome 1 : parts des archétypes. */
  SHARE_DRONE: 0.15,
  SHARE_BORNE: 0.25,
  /** Parts (drone, borne) par biome : drones dominants sur la Passerelle, Bornes dans le BAG. */
  SHARES_BY_BIOME: [
    { drone: 0.15, borne: 0.25 },
    { drone: 0.35, borne: 0.2 },
    { drone: 0.2, borne: 0.3 },
  ] as const,
  /** Salle gardée : escorte (budget ×0,6) aux seuils de PV de l'ennemi majeur. */
  GARDEE_ESCORT_BUDGET: 0.6,
  GARDEE_ESCORT_AT: [0.66, 0.33] as const,
} as const;

// ─── Récompenses et économie ──────────────────────────────────────────────────

export const REWARDS = {
  PS_PER_COMBAT_ROOM: 3,
  PS_ELITE_ROOM: 16,
  PS_REWARD: 8,
  PS_BOSS1: 25,
  PS_BOSS2: 40,
  PS_BOSS3: 60,
  GRAINS_BOSS2: 8,
  GRAINS_BOSS3: 12,
  /** Salle gardée : 20 PS et −15 Burnout. */
  PS_GARDEE: 20,
  BURNOUT_GARDEE: -15,
  PS_SHIFT_COMPLETE: 50,
  PS_PER_ROOM_REACHED_ON_DEATH: 2,
  GRAINS_REWARD: 3,
  GRAINS_BOSS1: 5,
  GRAIN_KILL_CHANCE: 0.03,
  GRAIN_ELITE_CHANCE: 0.3,
  GRAINS_VICTORY_MULT: 2,
  /** Gobelet trouvé quand le stock est plein : soin de 25 %. */
  COFFEE_OVERFLOW_HEAL: 0.25,
  TICKETS_REWARD: [40, 60] as const,
  /** Salle café / trésor : soin 25 % ou +1 Gobelet. */
  TRESOR_HEAL: 0.25,
} as const;

export type RewardKind = 'avantage' | 'gobelet' | 'tickets' | 'ps' | 'grains';

/** Récompenses annoncées sur les portes et leurs poids de tirage (sans les Réglages de clé, post-MVP). */
export const REWARD_WEIGHTS: Readonly<Record<RewardKind, number>> = {
  avantage: 40,
  tickets: 16,
  gobelet: 12,
  ps: 10,
  grains: 8,
};

/** Récompenses de porte une fois le loot branché (GDD § 3.8, lot Loot 1). */
export type LootRewardKind = RewardKind | 'dotation' | 'reglage';

/**
 * Poids des portes avec le loot (GDD § 3.8) : le loot se paie en moins de portes d'Avantage,
 * pas en Avantages plus faibles. Total 100. `REWARD_WEIGHTS` reste en vigueur tant que la porte
 * « Dotation » n'est pas branchée (version Phaser).
 */
export const REWARD_WEIGHTS_LOOT: Readonly<Record<LootRewardKind, number>> = {
  avantage: 34,
  dotation: 12,
  tickets: 14,
  reglage: 12,
  gobelet: 12,
  ps: 9,
  grains: 7,
};

/** Friterie de Raymonde (prix en Tickets). */
export const SHOP = {
  GOBELET: 60,
  CORNET: 80,
  CORNET_HEAL: 0.4,
  AVANTAGE: 120,
  /** Loot : 1 objet Homologué (stock 1). */
  EQUIPEMENT: 140,
  /** Wagon-Bar du Fantôme : 1 Patrimoine. */
  WAGON_BAR_PATRIMOINE: 300,
} as const;

/** Salle des pauses : « Pause réglementaire » ou « Formation continue ». */
export const REST = {
  HEAL_FRACTION: 0.4,
  BURNOUT: -50,
} as const;

// ─── Game feel ────────────────────────────────────────────────────────────────

export const FEEL = {
  HERO_HIT_HITSTOP_MS: 80,
  HERO_HIT_SHAKE_PX: 4,
  HERO_HIT_SHAKE_MS: 180,
  KILL_SHAKE_PX: 2,
  KILL_SHAKE_MS: 100,
  LAST_KILL_SLOWMO: 0.25,
  LAST_KILL_SLOWMO_MS: 450,
  LAST_KILL_SHAKE_PX: 3,
  LAST_KILL_SHAKE_MS: 150,
  ZOOM_PUNCH: 1.02,
  ZOOM_PUNCH_MS: 100,
  DAMAGE_TEXT_RISE_PX: 16,
  DAMAGE_TEXT_MS: 500,
  /** Intensité de shake Phaser = px / largeur logique. */
  SHAKE_PX_TO_INTENSITY: 1 / 640,
} as const;

export const INPUT = {
  BUFFER_MS: 150,
} as const;
