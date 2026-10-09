# Privatix

RPG 2D pixel-art au tour par tour, satirique, sur le rail belge. Un·e agent·e SNCB en horaires 3x8 à la gare de Mons rejoint l'OCC (Operation Coffee Center) pour empêcher la privatisation du rail.

**Stack** : Phaser 3.90 · TypeScript 5.9 strict · Vite 7 · Vitest 4 · déploiement Docker/nginx sur Coolify (`privatix.fs0ciety.org`).

```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
npm run build      # dist/
```

Documentation : [GDD](docs/GDD.md) · [Scénario et lore](docs/STORY_AND_LORE.md) · [Architecture](docs/ARCHITECTURE.md) · [Guide des assets](docs/ASSETS_GUIDE.md) · [Règles de contribution pour Claude](claude.md)
