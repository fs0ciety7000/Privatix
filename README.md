# Privatix

Hack 'n' Slash / Roguelite 2D en vue de dessus, satirique, sur le rail belge. Un cheminot en 3x8, armé d'une clé à tire-fond, défend la gare de Mons contre les consultants et les automates de la mégacorporation **Privatix**. Chaque run est un **Shift** ; à chaque échec, retour à l'**OCC** (Operation Coffee Center), sous la passerelle, pour dépenser ses **Points de Syndicalisme** et reprendre son poste.

**Stack** : Phaser 4.2 (Arcade Physics) · TypeScript 5.9 strict · Vite 7 · Vitest 4 · sprites originaux générés par `tools/pixelart/` · déploiement Docker/nginx sur Coolify (`privatix.fs0ciety.org`).

```bash
npm ci
npm run dev        # http://localhost:5173  (?debug : corps Arcade · ?cheat : raccourcis de test)
npm run check      # typecheck + lint + tests
npm run build      # dist/
npm run assets     # régénère les sprites et tilesets (Python 3 + Pillow + NumPy)
```

## Contrôles

| Action | Clavier + souris | Manette | Tactile |
|---|---|---|---|
| Se déplacer | ZQSD / WASD / flèches | stick gauche | joystick (moitié gauche) |
| Viser | souris | stick droit | aide à la visée automatique |
| Frappe (combo 3 coups) | clic gauche (ou J) | X | FRAPPE |
| Dash « Retard SNCB » (2 charges, i-frames) | Espace / Maj | A / RB | DASH |
| Coup de sifflet (maintenir : Préavis de grève) | clic droit / F | B | SIFFLET |
| Boire un Gobelet | R | Y | CAFÉ |
| Interagir | E / Entrée | LB | E |
| Pause | Échap / P | Menu | — |

## État : bac à sable jouable (MVP, biome 1)

- **Boucle complète** : menu → OCC → Shift de 10 salles (8 salles au choix des portes, Salle des pauses, boss) → écran des départs → OCC. Les PS et les Grains sont sauvegardés.
- **Combat** : combo 12/12/30 avec startup, active et recovery, enchaînement et annulation par dash ; dash avec i-frames, dash parfait (+15 min, ralenti) et dash-attaque ; Coup de sifflet et Préavis de grève (jauge de Mobilisation) ; Gobelets ; **Burnout** (paliers, plancher 3x8, Pétage de plombs, Arrêt maladie). Hitstop, secousses, flashs, particules, nombres de dégâts.
- **Ennemis** : Consultant Junior (diaporama et ruée « Quick win »), Borne Automatique (salves, blindage frontal), Drone Optimètre (orbite, tirs, scan qui marque, piqué), élite Manager KPI (posture, Chronomètre, Reporting), boss **L'Auditeur des Quais** en 3 phases (barrière, chronomètres, barrage, « Contrôle ! », rames, renforts, lignes de KPI).
- **Progression** : 17 Avantages acquis de 7 collègues (3 raretés), Friterie de Raymonde, machine à café, Salle des pauses ; Tableau des revendications (10 améliorations permanentes), choix du roulement Matin / Après-midi / Nuit.
- **Pas encore fait** (voir `docs/GDD.md`, § Périmètre) : salles Événement, Réglages de clé, Motions communes, Preuves, Tasses et Souvenirs, Montages de Kevin, laser de la Borne, bouclier d'alignement du Manager, halo de nuit, audio, biomes 2 et 3.

## Documentation

[GDD](docs/GDD.md) · [Lore](docs/LORE.md) · [Architecture](docs/ARCHITECTURE.md) · [Guide pixel art et achat d'assets](docs/PIXEL_ART_GUIDE.md) · [Règles de travail pour Claude](claude.md) · [Crédits](CREDITS.md)

L'ancienne version RPG au tour par tour (jalon M2) est conservée dans l'historique git, au commit `11e9f0e`.
