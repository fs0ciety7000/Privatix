# Privatix

RPG 2D pixel-art au tour par tour, satirique, sur le rail belge. Un·e agent·e SNCB en horaires 3x8 à la gare de Mons rejoint l'OCC (Operation Coffee Center) pour empêcher la privatisation du rail.

**Stack** : Phaser 4.2 · TypeScript 5.9 strict · Vite 7 · Vitest 4 · déploiement Docker/nginx sur Coolify (`privatix.fs0ciety.org`).

```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
npm run build      # dist/
```

**État : jalon M1 jouable.** L'Acte I se joue en entier en exploration, dans des graphismes provisoires générés au démarrage. On y trouve la gare de Mons, la salle des pauses, le couloir technique et l'OCC (code 7-1-2), les dialogues et quêtes jusqu'à l'audit des quais, l'horloge 3x8 avec la Fatigue, et la sauvegarde à la Vieille Dame. Les combats sont simulés jusqu'au jalon M2.

Contrôles : ZQSD / WASD ou flèches pour se déplacer, Maj pour courir, E / Espace / Entrée pour interagir, Échap pour revenir au menu. Sur tactile : D-pad et bouton A. En développement : T avance d'une heure, N passe à l'acte suivant.

Documentation : [GDD](docs/GDD.md) · [Scénario et lore](docs/STORY_AND_LORE.md) · [Architecture](docs/ARCHITECTURE.md) · [Guide des assets](docs/ASSETS_GUIDE.md) · [Règles de contribution pour Claude](claude.md)
