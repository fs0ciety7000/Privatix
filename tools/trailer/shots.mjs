// Plans du trailer (scratchpad SCRIPT.md, § 3.3). Chaque plan part d'une page neuve à graine fixe :
// `t.skip(n)` avance sans dessiner (mise en place), `t.rec(n, { i: action })` enregistre n images et
// joue `action` juste avant l'image i. Les durées sont en images à 60 i/s ; le montage
// (`edit.mjs`) choisit le point d'entrée de chaque plan.

const UP = -Math.PI / 2;

/** Entre en Shift, salle 1 du biome voulu, sans vagues ni dégâts pour le héros. */
async function arena(t, biome = 0, god = true) {
  await t.api('start');
  await t.skip(20);
  if (biome > 0) {
    await t.api('biome', biome);
    await t.skip(40);
  }
  await t.api('waves', false);
  await t.api('cheat', 'K');
  if (god) {
    await t.api('cheat', 'G');
    await t.api('untouchable', true);
  }
  await t.skip(30);
  return t.api('arena');
}

/** Héros au centre horizontal, à `fy` de la hauteur de la salle. */
async function place(t, a, fy = 0.72, dx = 0) {
  await t.api('teleport', a.w / 2 + dx, a.h * fy);
}

/**
 * Salle de boss (`gardee` : salle gardée) du biome voulu, vagues actives (le directeur fait entrer le
 * boss), héros intouchable. Attend que le boss soit là et renvoie `{ a, boss }`.
 */
async function bossRoom(t, biome, kind, gardee = false) {
  await t.api('start');
  await t.skip(20);
  await t.api('cheat', 'G');
  await t.api('untouchable', true);
  if (biome > 0) {
    await t.api('biome', biome);
    await t.skip(40);
  }
  await t.api('cheat', 'K');
  await t.skip(10);
  await t.api(gardee ? 'gardee' : 'cheat', ...(gardee ? [] : ['B']));
  let boss = null;
  for (let i = 0; i < 80 && !boss; i += 1) {
    await t.skip(10);
    boss = (await t.api('enemies')).find((e) => e.kind === kind) ?? null;
  }
  if (!boss) throw new Error(`${kind} absent`);
  const a = await t.api('arena');
  t.log(kind, JSON.stringify(boss), JSON.stringify(a), JSON.stringify(await t.api('hero')));
  return { a, boss };
}

/** Entre dans la salle du boss et la filme dès l'entrée (intro, bandeau, première attaque). */
async function bossEntrance(t, biome, kind, fy, frames, attack, attackAt) {
  await t.api('start');
  await t.skip(20);
  await t.api('cheat', 'G');
  await t.api('untouchable', true);
  await t.api('biome', biome);
  await t.skip(40);
  await t.api('cheat', 'K');
  await t.skip(10);
  await t.api('cheat', 'B');
  for (let i = 0; i < 60; i += 1) {
    await t.skip(2);
    if ((await t.api('state')).roomType === 'boss') break;
  }
  const a = await t.api('arena');
  await place(t, a, fy);
  await t.api('aim', UP);
  await t.rec(frames, {
    [attackAt]: async () => {
      const b = (await t.api('enemies')).find((e) => e.kind === kind);
      if (b) await t.api('attack', b.id, attack);
      else t.log(`${kind} absent à l'image ${String(attackAt)}`);
    },
  });
}

const press = (t, what) => () => t.api('press', what);
const combo = (t, at, step = 14) => ({
  [at]: press(t, 'attack'),
  [at + step]: press(t, 'attack'),
  [at + 2 * step]: press(t, 'attack'),
});

export const SHOTS = {
  // 4 — Quai 2 de nuit : trois consultants surgissent devant le héros.
  s04: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.6);
      await t.api('aim', UP);
      await t.skip(30);
      await t.rec(150, {
        8: async () => {
          await t.api('spawn', 'consultant', -70, -50);
          await t.api('spawn', 'consultant', 0, -62);
          await t.api('spawn', 'consultant', 70, -50);
        },
        40: () => t.api('move', 0, -0.6),
        50: () => t.api('release'),
      });
    },
  },
  // 5 — Combo complet à la clé à tire-fond sur le consultant central.
  s05: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.56);
      await t.api('aim', UP);
      await t.api('spawn', 'consultant', -80, -70);
      await t.api('spawn', 'consultant', 0, -48);
      await t.api('spawn', 'consultant', 80, -70);
      await t.skip(70);
      await t.rec(140, combo(t, 12, 14));
    },
  },
  // 6 — Une Borne crache une salve de tickets ; le coup 3 les détruit.
  s06: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.56);
      await t.api('aim', UP);
      const id = await t.api('spawn', 'borne', 0, -72);
      await t.skip(60);
      await t.rec(140, {
        4: () => t.api('attack', id, 'salve'),
        ...combo(t, 40, 13),
      });
    },
  },
  // 7 — Café en plein combat (sans god mode : le héros est entamé, le soin se lit).
  s07: {
    run: async (t) => {
      const a = await arena(t, 0, false);
      await place(t, a, 0.55);
      await t.api('aim', UP);
      const l = await t.api('spawn', 'consultant', -40, -36);
      await t.api('spawn', 'consultant', 46, -30);
      await t.skip(10);
      await t.api('attack', l, 'quickwin');
      await t.skip(70);
      await t.rec(130, { 20: press(t, 'coffee') });
    },
  },
  // 8 — Dash parfait à travers le piqué d'un drone : rémanences, ralenti, « +15 min ».
  s08: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.58);
      await t.api('aim', UP);
      const id = await t.api('spawn', 'drone', 30, -66);
      await t.skip(60);
      await t.rec(150, {
        4: () => t.api('attack', id, 'dive'),
        [Number(process.env.DASH_AT ?? 40)]: async () => {
          await t.api('move', 0, -1);
          await t.api('press', 'dash');
        },
        [Number(process.env.DASH_AT ?? 40) + 14]: () => t.api('release'),
      });
    },
  },
  // 9 — Coup de sifflet : onde de choc, cinq consultants en grève.
  s09: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.52);
      await t.api('mobilisation', 60);
      for (let i = 0; i < 5; i += 1) {
        const ang = UP + ((i - 2) * Math.PI) / 3.2;
        await t.api('spawn', 'consultant', Math.cos(ang) * 62, Math.sin(ang) * 62);
      }
      await t.skip(60);
      await t.rec(130, { 12: press(t, 'special') });
    },
  },
  // 10 — Dernier kill de la salle : ralenti natif (fanfare de salle nettoyée), confettis, carillon.
  s10: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.56);
      await t.api('aim', UP);
      await t.api('spawn', 'consultant', 0, -46);
      await t.skip(70);
      let cleared = false;
      await t.rec(170, combo(t, 10, 14), async (i) => {
        if (cleared || i < 30) return;
        if ((await t.api('enemies')).every((e) => e.hp <= 0)) {
          cleared = true;
          await t.api('clearRoom');
        }
      });
    },
  },
  // 11 — Drop Patrimoine : faisceau cuivre, mini ralenti, carillon.
  s11: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.6);
      await t.api('aim', UP);
      await t.skip(30);
      await t.rec(130, { 10: () => t.api('lootDrop', 'wagon-bar', 0, -52) });
    },
  },
  // 12 — Le héros équipe la pièce et frappe avec.
  s12: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.56);
      await t.api('aim', UP);
      await t.api('lootDrop', 'wagon-bar', 0, -40);
      await t.skip(200);
      await t.api('lootGoto');
      await t.skip(4);
      t.log(JSON.stringify((await t.api('loot')).ground));
      await t.rec(130, {
        4: async () => t.log('équipé', await t.api('lootAct', 'equip')),
        24: () => t.api('spawn', 'consultant', 0, -44),
        ...combo(t, 40, 14),
      });
      t.log(JSON.stringify((await t.api('loot')).pieces));
    },
  },
  // 13 — Le Furet putride surgit et lâche sa puanteur.
  s13: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.6);
      await t.api('aim', UP);
      const id = await t.api('spawn', 'furet', 0, -72);
      await t.skip(50);
      await t.rec(140, {
        2: () => t.api('attack', id, 'burrow'),
        70: () => t.api('attack', id, 'stink'),
      });
    },
  },
  // 14 — Il bondit ; le héros le traverse en dash et frappe.
  s14: {
    run: async (t) => {
      const a = await arena(t);
      await place(t, a, 0.6);
      await t.api('aim', UP);
      const id = await t.api('spawn', 'furet', 0, -70);
      await t.skip(60);
      const at = Number(process.env.POUNCE_DASH ?? 30);
      await t.rec(110, {
        2: () => t.api('attack', id, 'pounce'),
        [at]: async () => {
          await t.api('move', 0, -1);
          await t.api('press', 'dash');
        },
        [at + 10]: async () => {
          await t.api('release');
          await t.api('aim', Math.PI / 2);
          await t.api('press', 'attack');
        },
        [at + 24]: () => t.api('press', 'attack'),
        [at + 38]: () => t.api('press', 'attack'),
      });
    },
  },
  // 15 — Elio Di Rupo sur son estrade : intro, « Je serai bref. ».
  s15: {
    run: (t) => bossEntrance(t, 1, 'dirupo', 0.84, 320, 'speech', 200),
  },
  // 16 — Phase « Le Ruban » : les ciseaux géants tranchent ; dash entre les lames.
  s16: {
    run: async (t) => {
      const { a, boss: b } = await bossRoom(t, 1, 'dirupo');
      await place(t, a, 0.75);
      await t.skip(200);
      await t.api('hurt', b.id, 0.3);
      await t.skip(150);
      const at = Number(process.env.SCISSORS_DASH ?? 40);
      await t.rec(130, {
        2: () => t.api('attack', b.id, 'scissors'),
        [at]: async () => {
          await t.api('move', 1, 0);
          await t.api('press', 'dash');
        },
        [at + 14]: () => t.api('release'),
      });
    },
  },
  // 17 — Défaite digne : la plaque se dévoile, il tend les ciseaux.
  s17: {
    run: async (t) => {
      const { a, boss: b } = await bossRoom(t, 1, 'dirupo');
      await place(t, a, 0.75);
      await t.skip(200);
      await t.api('hurt', b.id, 0.01);
      await t.skip(30);
      const e = (await t.api('enemies')).find((x) => x.kind === 'dirupo');
      await t.api('teleport', e.x, e.y + 50);
      await t.api('aim', UP);
      await t.skip(2);
      await t.rec(260, combo(t, 4, 14));
    },
  },
  // 18 — Le Discosaure sur sa piste : il piétine en rythme.
  s18: {
    run: async (t) => {
      const { a, boss: b } = await bossRoom(t, 2, 'discosaure', true);
      await place(t, a, 0.84);
      await t.api('aim', UP);
      await t.skip(120);
      await t.rec(130, { 4: () => t.api('attack', b.id, 'stomp') });
    },
  },
  // 19 — Lasers et spots : le héros slalome en deux dashs.
  s19: {
    run: async (t) => {
      const { a, boss: b } = await bossRoom(t, 2, 'discosaure', true);
      await place(t, a, 0.76);
      await t.skip(120);
      await t.rec(110, {
        2: () => t.api('attack', b.id, 'lasers'),
        30: async () => {
          await t.api('move', -0.7, -0.7);
          await t.api('press', 'dash');
        },
        44: async () => {
          await t.api('move', 0.7, -0.7);
          await t.api('press', 'dash');
        },
        60: () => t.api('release'),
      });
    },
  },
  // 20 — On casse la boule : la salle s'éteint (passage « Boule en surchauffe »).
  s20: {
    run: async (t) => {
      const { a, boss: b } = await bossRoom(t, 2, 'discosaure', true);
      await place(t, a, 0.8);
      await t.skip(120);
      const e = (await t.api('enemies')).find((x) => x.kind === 'discosaure');
      await t.api('teleport', e.x, e.y - 50);
      await t.api('aim', Math.PI / 2);
      await t.skip(2);
      await t.rec(110, {
        ...combo(t, 4, 14),
        34: () => t.api('hurt', b.id, 0.45),
      });
    },
  },
  // 21 — Jean-Cul Lurcke dans son bureau : intro, barre de PV, bullet points.
  s21: {
    run: (t) => bossEntrance(t, 2, 'vanderslide', 0.84, 330, 'bullets', 210),
  },
  // 22 à 24d — Le combat final d'une traite (copie, phase 2, Préavis, reporting, coup final, défaite).
  s22: {
    run: async (t) => {
      const { a, boss: b } = await bossRoom(t, 2, 'vanderslide');
      await place(t, a, 0.78);
      await t.api('aim', UP);
      await t.skip(200);
      const near = async () => {
        const e = (await t.api('enemies')).find((x) => x.kind === 'vanderslide');
        await t.api('teleport', e.x, e.y + 46);
        await t.api('aim', UP);
      };
      // 22 : « Je vous mets en copie » — deux consultants, balayés d'un coup 3.
      await t.rec(100, {
        2: () => t.api('attack', b.id, 'copy'),
        ...combo(t, 50, 13),
      });
      // 23 : phase 2.
      await t.api('cheat', 'K');
      await t.rec(90, { 4: () => t.api('hurt', b.id, 0.49) });
      // 24a : Préavis de grève (maintien du sifflet).
      await t.api('mobilisation', 100);
      await t.rec(100, {
        4: () => t.page.keyboard.down('KeyF'),
        48: () => t.page.keyboard.up('KeyF'),
      });
      // 24b : Reporting géant, traversé en dash.
      await t.rec(110, {
        2: () => t.api('attack', b.id, 'report'),
        40: async () => {
          await t.api('move', 0, -1);
          await t.api('press', 'dash');
        },
        54: () => t.api('release'),
      });
      // 24c : sous 5 % — la question, le silence, un seul coup.
      await near();
      await t.rec(200, {
        4: () => t.api('hurt', b.id, 0.04),
        ...combo(t, 96, 14),
      });
      // 24d : à genoux, « … je n'ai pas de slide pour ça. »
      await t.rec(260);
    },
  },
  // 25 — Écran des départs : « À l'heure — Shift tenu ».
  s25: {
    run: async (t) => {
      const { boss: b } = await bossRoom(t, 2, 'vanderslide');
      await t.skip(200);
      await t.api('hurt', b.id, 0.04);
      await t.skip(30);
      for (let i = 0; i < 6; i += 1) {
        const e = (await t.api('enemies')).find((x) => x.kind === 'vanderslide');
        if (!e) break;
        await t.api('teleport', e.x, e.y + 46);
        await t.api('aim', UP);
        await t.api('press', 'attack');
        await t.skip(14);
      }
      for (let i = 0; i < 80; i += 1) {
        if ((await t.api('state')).phase === 'results') break;
        await t.skip(30);
      }
      await t.skip(30);
      await t.rec(240);
    },
  },
  // 1 — OCC de nuit : le héros entre par le bas et marche vers la Vieille Dame.
  s01: {
    run: async (t) => {
      await t.api('hubEnter');
      await t.api('hubShift', 'nuit');
      await t.skip(40);
      await t.api('hubGoto', 'vieille-dame');
      const h = await t.api('hero');
      await t.api('teleport', h.x, h.y + 140);
      await t.skip(60);
      await t.rec(220, { 6: () => t.api('move', 0, -1), 160: () => t.api('release') });
    },
  },
  // 2 — Devant la Vieille Dame : on se sert un café.
  s02: {
    run: async (t) => {
      await t.api('hubEnter');
      await t.api('hubShift', 'nuit');
      await t.skip(40);
      await t.api('hubGoto', 'vieille-dame');
      await t.api('aim', UP);
      await t.skip(60);
      await t.rec(180, { 20: press(t, 'interact') });
    },
  },
  // 3 — Vers la porte de départ.
  s03: {
    run: async (t) => {
      await t.api('hubEnter');
      await t.api('hubShift', 'nuit');
      await t.skip(40);
      await t.api('hubDoor', 'depart');
      const h = await t.api('hero');
      await t.api('teleport', h.x, h.y + 90);
      await t.skip(60);
      await t.rec(180, { 6: () => t.api('move', 0, -1) });
    },
  },
  // 26 — Retour à l'OCC : Fatou, les collègues.
  s26: {
    run: async (t) => {
      await t.api('hubEnter');
      await t.api('hubShift', 'matin');
      await t.skip(40);
      await t.api('hubGoto', 'fatou');
      await t.api('aim', UP);
      await t.skip(60);
      await t.rec(220, { 20: press(t, 'interact') });
    },
  },
  // 27 — Dernier café à la Vieille Dame, roulement du matin.
  s27: {
    run: async (t) => {
      await t.api('hubEnter');
      await t.api('hubShift', 'matin');
      await t.skip(40);
      await t.api('hubGoto', 'vieille-dame');
      const h = await t.api('hero');
      await t.api('teleport', h.x, h.y + 60);
      await t.skip(60);
      await t.rec(240, {
        4: () => t.api('move', 0, -1),
        40: () => t.api('release'),
        70: press(t, 'interact'),
      });
    },
  },
};
