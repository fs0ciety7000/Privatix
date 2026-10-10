# Crédits des assets

Chaque asset tiers ajouté dans `public/assets/` doit être listé ici (voir `docs/PIXEL_ART_GUIDE.md`, § achat sur itch.io).

| Fichier(s) | Auteur / source | Licence | Modifications |
|---|---|---|---|
| `public/assets/sprites/**`, `public/assets/tilesets/**`, `public/assets/fonts/font_dmg.png` | Originaux, générés par `tools/pixelart/` (ce dépôt) | Même licence que le projet | — |
| Sons et musique synthétisés de l'entrée 3D (`src/audio/`) | Originaux, synthétisés par code à l'exécution (Web Audio) | Même licence que le projet | — |
| `public/audio/music/**` (OST, 14 morceaux) | Générés pour le projet par IA musicale (prompts et plans de composition : `tools/elevenlabs/manifest.json`, détails : `docs/audio/ost/README.md`) ; filigrane inaudible SynthID | Selon les conditions du service de génération | Réencodés en WebM/Opus 96 kb/s, silences de tête et de queue retirés (`tools/audio/build-web-audio.mjs`) |
| `public/audio/vo/{leon,yasmina,invite,lurcke}/**` (dialogues VF, 74 répliques) | Générés pour le projet avec ElevenLabs (voix conçues par description ou de bibliothèque, aucun clonage ; détails : `docs/audio/dialogues/README.md`) ; répliques de l'Invité d'honneur fictives | Selon les conditions d'ElevenLabs | Réencodés en WebM/Opus 64 kb/s mono |
| `public/audio/vo/{marcel,josiane,bene}/**` (dialogues VF, 23 répliques, prise 1) | Générés pour le projet avec la synthèse vocale Gemini TTS (voix prédéfinies choisies à l'écoute, aucun clonage ; détails : `docs/audio/dialogues/README.md`) | Selon les conditions de Google | Réencodés en WebM/Opus 64 kb/s mono |

Aucun asset tiers pour l'instant. Polices de texte prévues : m6x11 ou Press Start 2P (SIL Open Font License), à créditer ici lors de l'intégration.
