# Brancher les fichiers ElevenLabs dans `src/audio`

> **État (2026-10-10)** : **OST (prises t1) et dialogues branchés** ; bruitages et ambiances enregistrés pas encore (§ 3, et les ambiances du § 4). Ce qui a changé par rapport au plan : OST lue en **streaming** (`HTMLAudioElement` + `MediaElementAudioSourceNode`, `src/audio/streamedMusic.ts`) et non décodée (≈ 46 Mo de PCM par morceau), `decodeAudioData` réservé aux voix et aux stingers < 10 s ; fichiers web dans `public/audio/music/` et `public/audio/vo/<voix>/` (WebM/Opus seul, pas de doublon OGG), index TypeScript généré `src/audio/assetIndex.ts` au lieu d'un `index.json` (`node tools/audio/build-web-audio.mjs`), pas de stems (mix complet : `combatIntensity` pilote un passe-bas et le gain du morceau, la synthèse ne joue pas par-dessus), pas de `playbackRate` par phase de boss. Détails, table contexte → morceau et poids : `docs/ARCHITECTURE.md` § 15.9 (« OST et dialogues enregistrés »). Le plan ci-dessous reste la référence pour les bruitages.

Objectif : jouer les échantillons produits par `generate.mjs` **à côté** de la synthèse actuelle, sans rien casser : si un fichier manque, n'est pas encore chargé ou ne se décode pas, le jeu **retombe sur la synthèse** (`SFX[id].render`, `MusicDirector`). Les principes de `docs/ARCHITECTURE.md` § 15.9 restent vrais : `src/audio` lit la sim sans la modifier, le routeur reste pur et testé.

## 1. Où mettre les fichiers

- Copier la sélection validée de `tools/elevenlabs/out/` vers `public/audio/` (servi tel quel par Vite) : `public/audio/sfx/<famille>/<id>_t<n>.ogg`, `public/audio/musique/…`, `public/audio/dialogues/<voix>/<réf>_t<n>.ogg`, `public/audio/ambiances/…`.
- Un **index** `public/audio/index.json` (écrit par un petit script de copie, à partir du manifeste et des prises retenues) : `{ sfx: { slam: ['sfx/combat-heros/slam_t1.ogg', …] }, music: { 'quais-combat': { layers: ['…S1.ogg', '…S2.ogg', '…S3.ogg', '…S4.ogg'], bpm: 100, bars: 40 } }, voice: { 'vo.marcel.hub.01': { file, subtitle, fictive } }, ambience: {…}, mode: { telegraph: 'synth', slam: 'layer', … } }`.
- Format : OGG Vorbis par défaut (lu partout sauf Safari ancien) ; WebM Opus en alternative (`--format both`), choisi à l'exécution par `canPlayType`.

## 2. `SampleBank` (nouveau, `src/audio/samples.ts`)

- `load(index, filter)` : `fetch` + `decodeAudioData` **paresseux**, par lot (hub et biome 1 au démarrage, biome suivant pendant la Salle des pauses), jamais avant le déverrouillage du contexte (`attachUnlock`). Erreurs avalées (`console.warn` en dev) : un échec laisse simplement l'entrée vide.
- `pick(id, rnd)` : une prise au hasard parmi celles **déjà décodées** (pas de répétition immédiate de la même prise), ou `null`.
- Plafond mémoire : décoder en mono pour les effets (`spatial`), stéréo pour la musique et les ambiances ; libérer les buffers du biome quitté.
- Testable en Vitest avec le `AudioContext` simulé de `tests/audio.test.ts` (décodage factice).

## 3. Effets : `AudioEngine.play` choisit sa source

Dans le chemin actuel `voix → panoramique → bus`, remplacer l'appel unique `def.render(...)` par :

```text
mode = index.mode[id] ?? 'replace'
buf  = bank.pick(id)
si buf et mode = 'replace' : BufferSource(buf, playbackRate 1 ± 2 %) → voix
si buf et mode = 'layer'   : BufferSource(buf) ET def.render(...) → voix
sinon (pas de buffer, ou mode = 'synth') : def.render(...)  ← le repli
```

Durée renvoyée = `buf.duration / playbackRate` (pour le pool de voix et `gapMs`). `max`, `gapMs`, `repetitive` et « Réduire les sons répétitifs » s'appliquent tels quels. `amount` (impact léger / lourd, explosion) : deux groupes de prises dans l'index (`impact` et `impact.heavy`), le routeur ne change pas.

## 4. Musique : `MusicDirector` à couches échantillonnées

- Nouveau mode interne par lieu : si l'index a les 4 stems d'un thème, `MusicDirector` crée 4 `AudioBufferSourceNode` **en boucle**, démarrés au même `when` (grille calée sur la mesure), branchés sur les 4 `GainNode` de couches **existants** (`layers.bass / kick / hats / arp`). `layerTargets()` et `updateLayers()` ne changent pas : les seuils 0,02 / 0,3 / 0,55 / 0,75 pilotent les stems comme ils pilotent la synthèse.
- Changement de mode (quai → combat → boss) : fondu croisé de 1 mesure, départ sur le prochain temps fort.
- Boss : une boucle par phase (même grille) ou `playbackRate` (≤ 1,08) pour les +4 BPM par phase.
- **Repli** : tant que les stems ne sont pas décodés, la synthèse joue (comportement actuel) ; quand ils arrivent, bascule au prochain début de mesure.
- Le hub (`ost.02` / `ost.03` selon le roulement) et les ambiances (`amb.*`) remplacent `hubStep` et le lit de `startQuai` / `startHubBed` ; les ponctuels (`amb1.*`) remplacent les événements aléatoires de `ambientEvents` / `hubEvents`, à la même cadence.

## 5. Voix

- Nouveau bus `voice` dans `createMixChain` (avant le compresseur), avec **ducking** de la musique (−4 dB, attaque 80 ms, relâchement 400 ms) et réglage « Voix » dans les options audio.
- Déclencheurs : l'événement `bossLine` de la sim (texte → référence via une table `texte → id` générée depuis le manifeste), les bulles du hub (`NPC_LINES`), la radio (nouveaux événements de la sim, ou déclenchés par `AudioDirector` à partir de `AudioProbe`). Règles du LORE § 8.4 : pas de radio pendant un télégraphe de boss, au plus une ligne radio toutes les 3 salles.
- **Sous-titres** : toujours affichés (texte du catalogue sans balises), étiquette `FICTIVE_TAG` pour l'Invité d'honneur.
- **Repli** : sans fichier, rien ne change (le texte s'affiche comme aujourd'hui, sans voix).

## 6. Tests et mesures

- `tests/audio.test.ts` : repli quand le buffer manque, mode `layer` (deux sources), `synth` (le télégraphe reste synthétisé), boucles de stems démarrées au même instant, ducking du bus voix.
- `tests/elevenlabsManifest.test.ts` (déjà là) : couverture des `SfxId`, lot d'écoute, répliques fictives.
- `tools/audio/render.mjs` : ajouter le rendu « échantillon » pour vérifier crêtes et sonie dans la chaîne réelle (aucun écrêtage, effets entre −31 et −6 dBFS).
- Mettre à jour `CREDITS.md` (sons et voix générés avec ElevenLabs, offre et licence) et `ARCHITECTURE.md` § 15.9 (la phrase « aucun fichier audio » devient « synthèse + échantillons facultatifs »).
