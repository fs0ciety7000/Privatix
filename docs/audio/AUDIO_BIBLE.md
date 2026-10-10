# PRIVATIX — Bible sonore (OST, bruitages, doublage VF, ambiances, trailer)

> **Rôle** : direction audio (sound design, composition, doublage) · **Statut** : v1 de pré-production, à valider par le porteur du projet avant la production complète.
> **Sources** : `docs/LORE.md` (personnages, répliques, ton, garde-fous du § 1.4), `docs/GDD.md` (§ 5 combat, § 6 Burnout, § 9 bis loot, § 12 accessibilité), `docs/DESIGN_SYSTEM.md` (« Néon & Ballast »), `docs/ARCHITECTURE.md` § 15.9 (moteur audio), `src/audio/` (`router.ts`, `sfx.ts`, `music.ts`), répliques du jeu (`src/sim/hub/stations.ts`, `src/sim/biomes.ts`, `src/sim/enemies/`), script du trailer « Le Shift » (§ 5 Bande-son) et `tools/trailer/audio.mjs`.
> **Production** : ElevenLabs (API REST v1), piloté par `tools/elevenlabs/generate.mjs` et `tools/elevenlabs/manifest.json`. Endpoints et modèles vérifiés sur la documentation officielle le **9 octobre 2026** (§ 8).
> **Source unique** : les listes de ce document (sections marquées `AUTO`) sont générées depuis `tools/elevenlabs/catalogue/` par `node tools/elevenlabs/build-manifest.mjs`, qui écrit aussi le manifeste. On modifie le catalogue, jamais les tableaux à la main.

---

## 1. Direction sonore

### 1.1 Identité : « Néon & Ballast », à l'oreille

Le jeu se passe **la nuit, dans une gare**, et raconte des gens qui tiennent un service public. Le son doit faire entendre les deux mondes qui s'affrontent à l'image (orange héros contre turquoise et magenta Privatix) :

| Monde | À l'image | À l'oreille |
|---|---|---|
| **Le rail, les cheminots** | Bleu et blanc SNCB, orange des gilets, lumière tungstène de l'OCC | **Métal honnête et chaleur acoustique** : rail, ballast, clé à tire-fond, sifflet à bille, carillon de gare à 3 notes, Rhodes, contrebasse, **harmonie municipale** (cornets, bugles, tuba, caisse claire de défilé : la fanfare de la ducasse, la Wallonie qui joue ensemble). |
| **Privatix, le conseil** | Néons magenta et turquoise, écrans, moquette grise | **Électronique propre et creuse** : bips de badge, notifications de visio, musique d'ascenseur, synthés de keynote, voix de gare synthétique trop polie. |
| **La gare de nuit** | Brouillard, sodium, caténaires | **Le lit sonore** : bourdon grave, néon qui grésille à 100 Hz, rames au loin, « clac-clac » des joints de rail, vent sur la passerelle. |
| **Le hub (OCC)** | Pupitres, mur synoptique, la Vieille Dame (cafetière de 1987) | **La chaleur** : radio de bureau qui crachote, cafetière qui gargouille, Rhodes à 74 BPM, voix des collègues proches du micro. |

**Phrase directrice** : *le monde est absurde, les personnages ne le sont pas* (LORE § 1.3). La musique et les bruitages ne font jamais de « gag » sonore gratuit (pas de klaxon de cirque, pas de bruit de pet sauf le Furet, qui est un égout) ; l'humour vient du **contraste** (une fanfare de ducasse contre un consultant, un chronomètre comme métronome de boss, une musique d'ascenseur qui craque).

### 1.2 Motifs récurrents

1. **Le carillon de gare à 3 notes** (`chime`) : l'annonce de chaque salle. C'est la **cellule mélodique de toute l'OST** (thème titre, victoire, générique, défaite désaccordée).
2. **Le BONG du coup 3 sur le rail** (`slam`) : la signature de combat. GDD § 1 : « Un testeur reconnaît les yeux fermés (au son) un coup 3 qui touche. »
3. **Le sifflet à bille** (`whistle`) : la solidarité qui s'organise (Coup de sifflet, Préavis, Rudy).
4. **La Vieille Dame qui gargouille** : le foyer. On l'entend dans le hub, dans le trailer, dans le générique.
5. **La grille du hub** (Fa maj7 – Mi m7 – Ré m7 – Do maj7) et le **ré mineur** du combat, qui **résout en ré majeur** à la victoire (trailer 0:49, générique).

### 1.3 Règles (non négociables)

- **Magenta = danger, à l'oreille aussi.** Tout télégraphe (windup ennemi, zone qui s'arme) déclenche le **bip montant** `telegraph` : une signature **unique, toujours identique**, plus grave pour les boss et les zones (`amount`). Aucun autre son du jeu n'emprunte ce profil (deux notes montantes, timbre sinus). La synthèse reste la référence pour ce son (§ 4) ; un échantillon ElevenLabs ne peut que l'épaissir, jamais le remplacer ni le masquer. Le bip passe **au-dessus** de la musique (le mixeur la duck de −3 dB pendant 300 ms, à prévoir à l'intégration).
- **Pas de pics, pas de strident** (accessibilité, ARCHITECTURE § 15.9) : rien d'utile au-dessus de **9 kHz** (passe-bas systématique), sifflet sous **3,4 kHz**, attaques ≥ 2 ms, crête de tout effet ≤ **−6 dBFS** avant la chaîne de mixage (le limiteur du jeu est à −3 dB). Le seul son autorisé à −1 dBTP est l'**impact final du trailer**.
- **Sonie cible** : dialogues −18 LUFS, musique −16 LUFS (puis trim du bus musique à 0,55), ambiances −30 LUFS, effets normalisés en crête (−6 à −14 dBFS selon la famille), trailer −14 LUFS intégrés.
- **Répétition** : chaque son fréquent a **3 à 6 prises** ; le moteur tire au hasard et varie la hauteur de ±2 % (comme la synthèse actuelle). L'option « Réduire les sons répétitifs » s'applique aux échantillons comme à la synthèse.
- **Lisibilité du combat** : en combat, priorité télégraphe > voix de boss > coups du héros > impacts > musique > ambiance. Pas de réplique radio pendant un télégraphe de boss (LORE § 8.4).
- **Réduction des mouvements** : coupe aussi les « flashs sonores » associés (crépitement de néon, stroboscope de la boule à facettes) ; les échantillons de ces sons ont une variante douce.
- **Sous-titres** : chaque réplique enregistrée a son sous-titre (texte du catalogue, sans les balises entre crochets) ; l'Invité d'honneur garde l'étiquette **« réplique fictive »** (`FICTIVE_TAG`).

### 1.4 Garde-fous du doublage

**Décisions du porteur du projet (9 octobre 2026)** :

| Personnage | Voix arrêtée | `voice_id` | Remarque |
|---|---|---|---|
| Léon (héros) | Voice Design, sauvegardée (« voix1 ») | `Ql8Hq7echfwTF90Fec6K` | à renommer « Privatix — Léon » dès que l'API est disponible |
| Yasmina (RTS, radio OCC) | Voice Design, sauvegardée (« femme ») | `ROy6nWoXjRMqzkdFdAkB` | à renommer « Privatix — Yasmina » |
| L'Invité d'honneur (Elio Di Rupo, caricature) | Voice Design, sauvegardée | `BHaCuTcypMPA9jhksYPX` | voix de personnage, répliques fictives |
| Jean-Cul Lurcke | **voix de bibliothèque « Nico »** (professionnelle, français parisien, ton souriant et rassurant de pub) | `MAZdzkb78f8SA7DNBT41` | l'aperçu Voice Design `bxoUpaJveyHUDkK06idZ` était validé mais non sauvegardable (workspace à 3/3 voix) ; réplique de référence validée (`lurcke.boss.05`) |

- **Diction validée** : `eleven_v3`, graphie normale (« Mons » est bien prononcé) : **aucune substitution phonétique, aucune balise IPA** ; on garde les balises d'émotion v3 (`[warmly]`, `[smiling]`, `[chuckles]`…).
- **Les autres voix** (Léa, Marcel, Fatou, Rudy, voix de gare, Auditeur, etc.) restent **à concevoir** : le workspace est plein (3/3 voix personnalisées). Il faut une montée d'offre ou des voix de bibliothèque choisies à l'écoute ; d'ici là, `generate.mjs` ignore leurs répliques et ne produit, au plus, que des aperçus de Voice Design.
- **Clé d'API** : lue uniquement dans la variable d'environnement `ELEVENLABS_API_KEY`, jamais écrite dans le dépôt. La musique (OST, trailer) passe exclusivement par l'API Music avec cette clé (le connecteur restreint n'en génère pas).
- **Aucune production en lot** sans la validation finale, par le porteur du projet, des listes de répliques et des prompts de ce document.

- **Aucune voix réelle, aucun clonage** : toutes les voix sont créées par **Voice Design** (description textuelle), jamais par Voice Cloning ni avec une référence audio.
- **L'Invité d'honneur** (caricature autorisée d'Elio Di Rupo, LORE § 1.4 et § 7.5) est une **voix de personnage** : orateur de cérémonie générique. Le prompt ne contient ni son nom ni « sounds like » ; on ne reproduit **ni sa voix, ni son accent, ni son âge vocal**. Toutes ses répliques sont **inventées pour le jeu**, signalées *(réplique fictive)*, sans citation réelle, sans parti, logo ni slogan, sans humiliation ; sa défaite lui laisse une sortie digne. Repli prévu (LORE) : « Le Bourgmestre au nœud papillon », même voix.
- **Accent** : belge francophone de la région de Mons, **léger**, chez les cheminots (Marcel un peu plus marqué, Raymonde franche) ; neutre chez Privatix (les consultants parlent « français de séminaire »). Jamais de cliché d'origine, d'âge ou de genre (LORE § 1.4) ; Fatou et Yasmina ont l'accent de leurs collègues.
- **Belgicismes** au texte, avec parcimonie (« fieu », « savoir », « septante ») ; les nombres sont **écrits en lettres** dans les textes TTS (« sept heures douze ») pour fixer la prononciation.
- **Vaincus, pas morts** : aucun râle d'agonie ; les ennemis « partent en réunion » (`kill` = petit « pouf » comique).

---

## 2. Architecture : synthèse + échantillons

Les effets sont **synthétisés** (Web Audio) ; l'**OST (prises t1) et les dialogues** sont branchés depuis `public/audio/` (chargement par biome, synthèse en repli ; table contexte → morceau, poids et choix : `docs/ARCHITECTURE.md` § 15.9). La production ElevenLabs **s'ajoute** sans rien casser :

- **Chargeur d'échantillons à côté de la synthèse**, avec **repli sur la synthèse** si un fichier manque ou n'est pas encore chargé (plan détaillé : `tools/elevenlabs/integrate.md`).
- Chaque bruitage a un mode : **`replace`** (l'échantillon remplace la synthèse quand il est chargé), **`layer`** (il s'ajoute à la synthèse, ex. le BONG du `slam`), **`synth`** (la synthèse reste prioritaire ; l'échantillon est une option : `telegraph`, `uiHover`).
- La **musique** garde la logique de `MusicDirector` : un mode par lieu (`hub`, `quai`, `combat`, `boss`) et, en combat, **4 couches** dont le gain suit `combatIntensity()` (seuils 0,02 / 0,3 / 0,55 / 0,75). Les stems de l'OST se rangent dans ces 4 couches, bouclées en phase (même longueur, départ synchronisé sur l'horloge Web Audio).
- Les **voix** passent par un nouveau bus `voice` (ducking de la musique de −4 dB pendant une réplique).
- **Poids** : OGG Vorbis q5 (≈ 160 kb/s) ou WebM Opus 96 kb/s ; chargement par biome (le hub et le biome 1 d'abord), la synthèse couvre l'attente.

---

## 3. OST

Quatorze morceaux. Les thèmes de combat et de boss sont produits **en mix complet** à tempo et tonalité fixes, puis **séparés en stems** (`POST /v1/music/stem-separation`, réponse ZIP) et rangés dans les 4 couches du jeu. Si la séparation ne donne pas de couches propres, l'hypothèse B est de générer chaque couche séparément avec le **même plan de composition** et des styles négatifs (« no drums », « drums only »…), puis de recaler à l'oreille : plus coûteux, moins fiable, à tenter seulement sur un thème.

**Courbe d'intensité commune des combats** : 0,02 → S1 (basse, nappe) dès qu'un ennemi est en vie ; 0,3 → S2 (grosse caisse, caisse claire) ; 0,55 → S3 (charleston, percussions métal) ; 0,75 → S4 (arpège, cuivres). En boss, l'intensité ne descend pas sous 0,6 (S1 à S3 toujours là) et le tempo prend **+4 BPM par phase** (à reproduire par trois boucles, une par phase, ou par `playbackRate` ≤ 1,08).

<!-- AUTO:music -->

| # | Titre | Usage | Durée | Tempo | Tonalité | Instrumentation | Courbe d’intensité | Boucle |
|---|---|---|---|---|---|---|---|---|
| 1 | **Prise de poste (thème titre)** | Écran titre, menu principal | 1:35 | 92 | ré mineur → ré majeur | Piano électrique (Rhodes), harmonie municipale (cornets, bugles, tuba), caisse claire brossée, nappe de synthé néon, carillon de gare 3 notes en motif | Rhodes seul et carillon (0–20 s), entrée de la fanfare en sourdine (20–50 s), tutti chaleureux en ré majeur (50–80 s), retour au Rhodes (80–95 s) | non (intro) ; mesures 9–40 bouclables |
| 2 | **OCC — Service de jour** (extrait d’écoute 20 s) | Hub (Centre Opérationnel), roulements Matin et Après-midi | 2:00 | 74 | Fa maj7 – Mi m7 – Ré m7 – Do maj7 (grille du jeu) | Rhodes avec trémolo, contrebasse, batterie aux balais, vibraphone, petite radio filtrée qui joue une mélodie en arrière-plan | Plate et chaleureuse (intensité 2/10), respirations toutes les 8 mesures | oui |
| 3 | **OCC — Service de nuit** | Hub, roulement Nuit | 2:00 | 66 | même grille, voicings plus ouverts | Rhodes plus clairsemé, trompette avec sourdine harmon, contrebasse, bourdonnement de néon, cafetière lointaine | Intensité 1/10, très aéré | oui |
| 4 | **Quais & Voies — Exploration** | Biome 1, salles sans ennemis, Salle des pauses | 2:00 | 100 | ré mineur (bourdon de ré) | Bourdon grave, guitare baryton en trémolo, percussions de rail lointaines, nappe de néon, piano préparé | Intensité 3/10, tension sourde | oui |
| 5 | **Quais & Voies — Combat (4 couches)** (extrait d’écoute 20 s) | Biome 1, combat ; couches pilotées par combatIntensity() | 1:36 | 100 | ré mineur (Ré m – Si♭ – Fa – Do, grille du jeu) | S1 basse synthé + contrebasse ; S2 grosse caisse et caisse claire de fanfare ; S3 charleston, percussions de rail et de clé ; S4 arpège synthé néon + cuivres en riff | Pilotée par le jeu : S1 dès 0,02, S2 à 0,3, S3 à 0,55, S4 à 0,75 | oui (40 mesures exactes) |
| 6 | **La Passerelle — Le vent tourne (exploration + 4 couches)** | Biome 2 (aube, vide, vent) ; exploration = S1 seul | 1:36 | 88 | la mineur (dorien) | S1 nappe de cordes aériennes et vent ; S2 timbales et toms feutrés ; S3 ostinato de cordes en pizzicato et cloches tubulaires ; S4 cor et trompette | Le biome le plus silencieux : S1 presque seul en exploration, montée par couches en combat | oui |
| 7 | **Hall & BAG — Terminus BAG (4 couches)** | Biome 3 ; la musique d’ascenseur se déforme à chaque vague | 1:36 | 104 | mi mineur | S1 bossa d’ascenseur (Rhodes, flûte, guitare nylon) ; S2 batterie électronique ; S3 basse synthé saturée ; S4 lead synthwave agressif | Couche S1 seule = ascenseur poli ; S4 = l’ascenseur a craqué | oui |
| 8 | **Boss — L’Auditeur des Quais** | Boss 1, 3 phases (+4 BPM par phase en jeu) | 1:30 | 112 | mi♭ phrygien (le mode du boss du jeu) | Chronomètre comme métronome, cuivres graves sur le premier temps, timbales, cordes en staccato, basse synthé, alarme de quai | Phase 1 rigide ; phase 2 rames (accents de cuivres) ; phase 3 tout s’emballe (le tic-tac déraille) | oui (une boucle par phase, même grille) |
| 9 | **Boss — Duel oratoire (L’Invité d’honneur)** | Boss 2, phases « Le Discours inaugural », « La Première Pierre », « Le Ruban » | 1:30 | 96 | si♭ majeur pompeux → si♭ mineur au Ruban | Harmonie municipale de cérémonie, orgue de salle des fêtes, applaudissements rythmiques, caisse claire de défilé, glockenspiel | Marche protocolaire (P1), timbales des premières pierres (P2), accélération en mineur, ciseaux = coups de cymbale (P3) | oui |
| 10 | **Boss — Discosaure (Afterwork)** | Mini-boss du biome 3 ; les piétinements tombent sur la grosse caisse | 1:30 | 120 | la mineur | Four-on-the-floor, basse disco en octaves, cordes disco, clavinet, cloche à vache, filtre passe-bas en phase 2 « Boule en surchauffe » | Disco de séminaire (P1), filtre et montée en surchauffe (P2) ; coupure nette quand la boule casse | oui |
| 11 | **Boss final — Jean-Cul Lurcke « Méga-Deck 2032 »** | Boss final, 3 phases ; silence total au coup final (géré par le jeu) | 2:00 | 116 | do mineur | P1 musique de keynote « start-up » (ukulélé, claps, glockenspiel) qui se corrompt ; P2 visio (musique d’attente, glitchs, bourdon) ; P3 photocopieuse industrielle (rythme mécanique, chœur sans paroles, orchestre) | Montée continue jusqu’au silence final | oui (une boucle par phase) |
| 12 | **Écran des départs — Shift tenu** | Résultats, victoire (stinger 6 s puis boucle) | 0:40 | 84 | ré majeur | Fanfare brève, Rhodes, carillon de gare 3 notes, contrebasse | Stinger triomphal puis boucle tranquille | boucle après 6 s |
| 13 | **Écran des départs — Supprimé** | Résultats, défaite (tendre, jamais moqueur) | 0:20 | 70 | ré mineur | Cuivres en sourdine, carillon légèrement désaccordé, Rhodes | Descente douce, finit sur une note tenue d’espoir | non |
| 14 | **Le 7h12 (générique)** | Générique de fin, épilogue quai 2 | 3:00 | 80 | ré majeur | Piano, harmonie municipale, cordes, chœur fredonné sans paroles (bouches fermées), reprise du thème titre et du carillon | Piano seul → harmonie → tutti → piano seul ; finit sur le carillon | non |

**Stems des morceaux à couches** (mix complet généré, puis séparé par `POST /v1/music/stem-separation`) :

- Quais & Voies — Combat (4 couches) : S1 basse · S2 grosse caisse / caisse claire · S3 charleston / percussions métal · S4 arpège / cuivres
- La Passerelle — Le vent tourne (exploration + 4 couches) : S1 nappe / vent · S2 timbales / toms · S3 ostinato / cloches · S4 cuivres
- Hall & BAG — Terminus BAG (4 couches) : S1 bossa ascenseur · S2 batterie électro · S3 basse saturée · S4 lead synthwave
- Boss — L’Auditeur des Quais : S1 basse / tic-tac · S2 percussions · S3 cordes staccato · S4 cuivres graves
- Boss — Duel oratoire (L’Invité d’honneur) : S1 orgue / basse · S2 caisse de défilé · S3 applaudissements / glockenspiel · S4 cuivres
- Boss — Discosaure (Afterwork) : S1 basse octaves · S2 four-on-the-floor · S3 cordes / clavinet · S4 cloche / lead
- Boss final — Jean-Cul Lurcke « Méga-Deck 2032 » : S1 bourdon / basse · S2 rythme mécanique · S3 keynote / attente · S4 orchestre / chœur

**Prompts (EN)** :

- `ost.01-prise-de-poste` : Warm cinematic indie game title theme, 92 BPM, D minor resolving to D major. Opens with a mellow Rhodes electric piano and a three-note railway station chime motif, then a Belgian municipal brass band (cornets, flugelhorns, tuba) enters softly with brushed snare, building to a warm, proud, slightly melancholic full brass statement, under a subtle neon synth pad. Feels like a night shift at a small train station, tender and resilient, gentle humour. Instrumental only, no vocals, no lyrics, no spoken word.
- `ost.02-occ-jour` : Cozy lo-fi jazz loop for a railway operations break room, 74 BPM, chord progression Fmaj7 - Em7 - Dm7 - Cmaj7. Rhodes electric piano with gentle tremolo, upright bass, brushed drums, soft vibraphone, and a faint melody from a tiny filtered office radio in the background. Warm, unhurried, friendly, the smell of old coffee. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.03-occ-nuit` : Late-night lo-fi jazz loop, 66 BPM, chord progression Fmaj7 - Em7 - Dm7 - Cmaj7 with open voicings. Sparse Rhodes, muted harmon trumpet playing a lonely melody, upright bass, very soft brushes, faint neon hum texture. Sleepy, intimate, 3 a.m. night shift in a small control room. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.04-quais-exploration` : Dark ambient exploration loop for a deserted train platform at night, 100 BPM pulse, D minor drone. Low sawtooth drone, tremolo baritone guitar, distant metallic rail percussion, buzzing neon texture, sparse prepared piano notes, foggy and suspenseful but not scary. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.05-quais-combat` : Driving action game combat music, 100 BPM, D minor, chord loop Dm - Bb - F - C. Pulsing synth bass doubled by upright bass, punchy kick and marching snare like a brass band drummer, tight hi-hats and metallic railway percussion (rails, wrench hits), bright neon synth arpeggio and a short brass riff on top. Energetic, rhythmic, gritty, satirical but serious, clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.06-passerelle` : Airy cinematic action music for a vast glass footbridge at dawn, 88 BPM, A dorian. Wide high string pads with wind texture, soft timpani and felt toms, pizzicato string ostinato with tubular bells, and a noble French horn and trumpet melody on top. Cold, beautiful, vertiginous, hopeful. Clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.07-hall-bag` : Corporate elevator bossa nova that mutates into aggressive synthwave, 104 BPM, E minor. Polite Rhodes, flute and nylon guitar bossa groove, layered with an electronic drum machine, a distorted synth bass and an aggressive retro synthwave lead. Satirical open-space office menace. Clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.08-boss-auditeur` : Tense boss battle music, 112 BPM, E-flat phrygian. A ticking stopwatch as the metronome, heavy low brass hits on every downbeat, timpani, staccato strings, pulsing synth bass, and an occasional railway platform alarm tone. Rigid, bureaucratic, obsessive, menacing in a satirical way. Clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.09-boss-invite` : Pompous comedic ceremony boss battle music, 96 BPM, B-flat major turning to B-flat minor. A small-town municipal brass band playing a grand inauguration march, village hall organ, rhythmic polite applause, parade snare drum and glockenspiel, swelling into an urgent, playful duel. Good-natured satire of a ribbon-cutting ceremony, original melody, no national or political anthem. Clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar. *Satire bon enfant de la cérémonie : aucune musique politique, aucun hymne réel (ni national, ni de parti), aucune citation mélodique reconnaissable.*
- `ost.10-boss-discosaure` : Cheesy corporate afterwork disco boss music, 120 BPM, A minor. Four-on-the-floor kick, octave disco bass, lush disco strings, funky clavinet, cowbell, seventies dance floor energy that feels slightly absurd and menacing, with filter sweeps building tension. Every quarter note kick must be strong and clear. Clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word. Steady tempo throughout, clean loopable ending that returns to the opening bar.
- `ost.11-boss-lurcke` : Epic satirical final boss music, 116 BPM, C minor. Starts as an upbeat corporate startup keynote jingle (ukulele, hand claps, glockenspiel) that gets corrupted by glitchy video-call hold music and deep drones, then becomes a relentless industrial orchestral piece driven by the mechanical rhythm of a giant photocopier, with a wordless choir. Absurd, grand and threatening. Clear separated instruments for stem separation. Instrumental only, no vocals, no lyrics, no spoken word.
- `ost.12-departs-victoire` : Short warm victory theme for a results screen, 84 BPM, D major. A proud short brass band fanfare and three-note station chime, then settles into a calm Rhodes and upright bass loop. Relief, pride, coffee after a long shift. Instrumental only, no vocals, no lyrics, no spoken word.
- `ost.13-departs-supprime` : Short gentle defeat theme for a results screen, 70 BPM, D minor. Muted brass, a slightly detuned three-note station chime and soft Rhodes, tender and wry rather than tragic, ending on a hopeful held chord. Instrumental only, no vocals, no lyrics, no spoken word.
- `ost.14-le-7h12` : Heartfelt end credits theme, 80 BPM, D major. Solo piano reprising a warm brass-band melody, joined by a Belgian municipal brass band, strings and a wordless humming choir, growing into a moving tutti, then back to solo piano ending on a three-note railway station chime. Solidarity, dawn on platform 2, the 7:12 train arriving on time. No lyrics, humming only.

<!-- /AUTO:music -->

---

## 4. Bruitages (SFX)

Un prompt par événement sonore du jeu (les **75 `SfxId`** de `src/audio/sfx.ts`, déclenchés par `src/audio/router.ts`). Les prompts sont en anglais (meilleure adhérence du modèle), l'intention en français. Durées : plancher de l'API à 0,5 s, on recoupe le silence en post (`silenceremove`). Les prises sont tirées au hasard en jeu.

**Bruitages validés par le porteur du projet** (9 octobre 2026, `eleven_text_to_sound_v2`, `prompt_influence` 0,3 ; prises retenues, non régénérées : statut `validé` dans le manifeste) : `impact` (clé sur consultant, generation_id `05SgcLEGWcxffUllIZIY`), `whistle` (sifflet du chef de gare, `XiZBo4tizTqdt2Cipyqa`), `dash` (dash + frein pneumatique, `SkTygjpDBCFwPVG6e7Zh`), `loot4` (drop Patrimoine, `Uu6mU4EptZKYtyOv1G5Z`). Leurs prompts **font référence pour le style** de tous les autres : matière concrète nommée, « close-mic, dry, no reverb », durée et fin propre dites dans le prompt ; `prompt_influence` 0,3 partout (0,6 pour le télégraphe, dont la signature doit être suivie à la lettre).

**Le premier lot d'écoute** : `slam` (signature de combat), `coffeeSip` (identité du hub), `telegraph` (règle du danger), `train` (environnement).

<!-- AUTO:sfx -->

#### Combat du héros (clé à tire-fond)

Traitement commun : HPF 60 Hz, LPF 9 kHz, compression 3:1 rapide, pan spatial.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `swing1` | Coup 1 « Serrage » : souffle montant de la clé lourde | Heavy steel railway wrench swung fast through the air, short rising whoosh | 0.5 s | 4 | Bas-médium gardé, aigus doux |
| `swing2` | Coup 2 « Desserrage » : souffle descendant | Heavy steel wrench backhand swing, short falling whoosh with slight metal rattle | 0.5 s | 4 | Idem, pan légèrement opposé au coup 1 |
| `swing3` | Coup 3 « Tire-fond » : élan lourd, plus long | Very heavy iron track wrench overhead swing, deep powerful whoosh building up | 0.6 s | 4 | Grave renforcé (+2 dB à 120 Hz) |
| `swingDash` | Attaque de correspondance (estoc après dash) | Fast forward thrust with a steel bar, sharp air cut | 0.5 s | 3 | Court, transitoire net |
| `slam` | Coup 3 au sol : BONG métal sur rail, signature du jeu | Heavy iron wrench slamming onto a steel railway rail, deep resonant metallic BONG with ballast gravel scatter | 1.5 s | 6 | Le son-signature : crête −4 dBFS, queue de 1 s, pas d’aigu strident · **écoute**, couche sur la synthèse |
| `impact` | Impact de la clé sur une cible (léger / lourd) | Heavy steel wrench striking a laptop and a padded suit, punchy metallic clang with a short papery crunch, close-mic, dry, no reverb | 0.5 s | 6 | Deux familles de prises : légères et lourdes (amount) · **validé** (generation_id `05SgcLEGWcxffUllIZIY`) |
| `crit` | Critique : éclat brillant au-dessus de l’impact | Bright metallic ring accent on a critical hit, short sparkle, not harsh | 0.5 s | 3 | LPF 7 kHz : brillant sans siffler |
| `dash` | Dash « Retard » : souffle + crissement de frein doux | Quick whoosh of a fast dodge followed by a short hiss of train air brakes releasing, snappy, half a second, close | 0.5 s | 4 | Crissement filtré passe-bas 3 kHz · **validé** (generation_id `SkTygjpDBCFwPVG6e7Zh`) |
| `perfectDash` | Dash parfait : carillon « +15 min » | Short two-note railway station chime, bright and rewarding, slow-motion feel | 0.8 s | 3 | Centre, pas de pan |
| `whistle` | Coup de sifflet du chef de gare | Sharp station master's pea whistle, one piercing blast with a trill, slight echo of a large train station hall at night | 0.8 s | 3 | Passe-bas 3,4 kHz (accessibilité), crête −8 dBFS · **validé** (generation_id `XiZBo4tizTqdt2Cipyqa`) |
| `preavis` | Préavis de grève : long sifflet puis clameur qui gonfle | Long railway guard whistle followed by a swelling crowd of workers cheering, megaphone feel | 2.5 s | 3 | Clameur sans mots intelligibles, LPF 6 kHz |

#### Impacts, matières et KO

Traitement commun : HPF 60 Hz, LPF 9 kHz, compression 3:1, pan spatial.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `hitPaper` | Consultant : liasse de papier qui vole | Stack of office papers struck and scattering, crisp paper flutter | 0.5 s | 4 | Atténuer 4–6 kHz (−3 dB) : le papier est naturellement brillant |
| `hitLaptop` | Coup lourd / Manager : portable qui claque et bipe | Laptop lid slammed shut by a hit with a short error beep, plastic crack | 0.6 s | 3 | Bip court, jamais au-dessus de 2 kHz |
| `hitMetal` | Borne automatique / Discosaure : carcasse de tôle | Wrench hitting a hollow sheet-metal ticket kiosk, boomy metallic clang | 0.6 s | 3 | Grave résonant |
| `hitDrone` | Drone : coque plastique + moteur qui hoquette | Small plastic drone hit, hollow plastic knock and stuttering electric motor | 0.6 s | 3 | Moteur filtré |
| `hitBoss` | Boss : costume épais et dossier | Heavy blow on a thick wool suit and a ring binder, muffled thump with paper slap | 0.6 s | 4 | Grave, sans aigu |
| `kill` | Ennemi vaincu « part en réunion » : pouf comique | Comic soft deflating poof with a tiny office chair squeak, cartoonish but subtle | 0.6 s | 4 | Jamais violent, jamais organique |
| `lastKill` | Dernier ennemi de la salle : carillon « ding-dong » de gare | Classic two-tone railway station announcement chime ding-dong, warm | 1.2 s | 3 | Centre ; carillon de référence du jeu |
| `wallSlam` | Ennemi plaqué contre un mur / quai | Body slammed against a concrete platform wall, dull heavy thud | 0.5 s | 3 | Grave mat |
| `explosion` | Explosion (Borne, objets) : souffle sourd sans débris tranchants | Muffled cartoon explosion of a ticket machine, puff of smoke and scattering paper tickets, no sharp debris | 1.5 s | 3 | Compression douce, LPF 6 kHz |
| `spawn` | Apparition d’un ennemi : glissement de badge | Quick corporate badge swipe beep and soft whoosh arrival | 0.5 s | 3 | Discret, −10 dB sous les coups |

#### Café, dégâts, Burnout, fin de Shift

Traitement commun : HPF 50 Hz, LPF 9 kHz, centre (non spatial).

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `coffeeCup` | Gobelet sorti : plastique creux | Plastic coffee cup pulled from a dispenser, hollow plastic click | 0.5 s | 3 | Centre |
| `coffeeSip` | Gorgée : deux glouglous et une aspiration, puis « ah » | Someone taking a hot sip of coffee from a plastic cup, two gulps and a satisfied breath, no words | 1.2 s | 4 | Centre, intime, proche du micro · **écoute** |
| `hurt` | Le héros encaisse | Dull body impact with cloth rustle, short | 0.5 s | 4 | Le grognement vient de la voix du héros (dialogues) |
| `burnoutUp` | Palier de Burnout : tension qui monte | Rising tense electrical hum swell with a heartbeat, short | 1.5 s | 2 | Nappe grave, pas de sifflement |
| `meltdown` | Pétage de plombs : bourdonnement, crépitements, plomb qui saute | Overloaded electrical fuse box buzzing and crackling, then a fuse blowing with a pop and power down | 2.5 s | 2 | Crête −8 dBFS, crépitements LPF 7 kHz |
| `death` | Fin de Shift : « wah wah waaah » tendre, pas moqueur | Sad muted trombone wah wah waah, gentle and tender, short | 2 s | 3 | Tendre : le joueur ne doit pas se sentir moqué |
| `victory` | Shift tenu : fanfare de cuivres brève | Short triumphant brass band fanfare sting, municipal brass band, warm | 2.5 s | 3 | Ré majeur si possible (cohérent avec l’OST) |

#### Ennemis : télégraphes et attaques

Traitement commun : HPF 60 Hz, LPF 9 kHz, pan spatial.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `telegraph` | Télégraphe : bip montant (même code que le magenta) | Short rising electronic warning beep, two notes ascending, clean sine-like tone | 0.5 s | 3 | RÈGLE : la synthèse du jeu reste la référence (hauteur fixe, grave pour boss et zones). L’échantillon ne doit jamais masquer le bip. · **écoute**, synthèse prioritaire |
| `ticketFire` | Borne : imprimante à tickets + éjection | Thermal ticket printer printing fast then ejecting a paper ticket | 0.8 s | 3 | Médium |
| `ticketTear` | Ticket détruit par la clé : déchirure | Paper ticket torn in half quickly | 0.5 s | 3 | Court |
| `ticketThud` | Ticket qui s’écrase sur un mur | Small paper ticket hitting a wall with a soft tap | 0.5 s | 2 | Très discret |
| `droneShot` | Drone : tir de « laser qualité » | Small drone firing a soft laser zap, toy-like | 0.5 s | 3 | LPF 6 kHz |
| `droneDive` | Drone : piqué | Small quadcopter drone diving fast with rising motor whine | 0.8 s | 3 | Whine filtré |
| `droneScan` | Drone / spots du Discosaure : balayage de scan | Electronic scanning sweep, soft rising and falling synth tone | 1 s | 2 | Doux |
| `chrono` | Manager KPI : chronomètre tic-tac puis « ding » | Mechanical stopwatch ticking four times then a small bell ding | 1.5 s | 2 | Le tic-tac doit être lisible en combat |
| `tablet` | Tablette : swipe et tap | Tablet screen swipe and double tap | 0.5 s | 2 | Discret |
| `report` | Reporting : « ding-dong » de réunion visio | Video conference join notification chime, corporate two-tone | 0.8 s | 2 | Centre |
| `enemyMelee` | Coup de diaporama : glissement + clac de projecteur | Slide projector advancing a slide with a clack, swoosh | 0.5 s | 3 | Médium |
| `rush` | Quick win : ruée | Fast footsteps dash on hard floor with a whoosh | 0.6 s | 3 | Pas courts |
| `kpi` | Graphiques KPI : barres qui jaillissent | Rising bar chart pop, three quick ascending digital blips | 0.6 s | 3 | Blips graves (pas de cri aigu) |
| `kpiZap` | Laser / ligne KPI : zap | Electric laser line zap, short buzzy sweep | 0.6 s | 3 | LPF 6 kHz |

#### Boss et ennemis majeurs

Traitement commun : HPF 40 Hz, LPF 9 kHz, réverbération de salle courte, pan spatial.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `bossSweep` | Auditeur / Discosaure : balayage large | Large heavy object swept in a wide arc, deep whoosh | 0.8 s | 3 | Grave |
| `bossBarrier` | Auditeur : barrières de quai qui s’entrechoquent | Metal crowd-control barriers clanging together | 1 s | 3 | Métal mat, pas strident |
| `bossStamp` | Auditeur / Discosaure : tampon « Contrôle ! » | Giant rubber stamp slammed on a desk, deep thud and rubber slap | 0.8 s | 3 | Grave, sub léger |
| `bossLand` | Atterrissage lourd / émergence du Furet | Heavy landing on a concrete railway platform, deep thump with gravel | 0.8 s | 3 | Sub contrôlé (HPF 40 Hz) |
| `bossPhase` | Changement de phase : annonce de quai distordue + corne grave | Distorted railway station PA chime followed by a deep low horn blast, ominous | 2 s | 2 | Centre ; crête −6 dBFS |
| `ribbonSnip` | Ciseaux d’inauguration : deux claquements secs | Giant ceremonial scissors cutting a ribbon, two crisp metallic snips | 0.6 s | 3 | Clairs mais LPF 8 kHz |
| `stinkPuff` | Furet putride : bouffée de puanteur | Low muffled gassy puff from a trash bag, comic and soft | 0.8 s | 3 | Grave étouffé |
| `discoShimmer` | Boule à facettes : scintillement cristallin doux | Soft glittering mirror ball shimmer, gentle chimes | 1.5 s | 2 | LPF 8 kHz, jamais strident (accessibilité) |
| `fanfare` | Fanfare d’inauguration : accord de cuivres doux | Short polite brass band chord for a ribbon-cutting ceremony, warm | 2 s | 2 | Centre |

#### Zones, rames, portes et annonces

Traitement commun : HPF 40 Hz, LPF 9 kHz, pan spatial.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `hazardThud` | Zone qui frappe / piétinement | Heavy dull ground impact thud | 0.5 s | 3 | Grave |
| `ringPulse` | Onde de choc annulaire | Expanding shockwave pulse, deep whoomp with air ripple | 0.8 s | 3 | Sub contrôlé |
| `train` | Rame qui traverse la voie : grondement, essieux, avertisseur deux tons | Passenger train rushing through a station at speed, rumble, wheel clacks over rail joints and a two-tone horn | 3 s | 3 | Pan qui balaie de gauche à droite en post ; crête −6 dBFS · **écoute** |
| `chime` | Annonce de gare : carillon à 3 notes (sans voix) | Three-note railway station announcement chime, warm and clear | 1.5 s | 3 | Centre ; motif mélodique repris par l’OST |
| `doorUnlock` | Salle nettoyée : verrou qui saute et deux notes de récompense | Heavy door lock unlatching followed by two bright reward notes | 1 s | 3 | Centre |
| `doorTaken` | Porte franchie : porte de service qui s’ouvre | Industrial service door opening with a pneumatic hiss | 0.8 s | 2 | Centre |

#### Ramassages, choix et loot

Traitement commun : HPF 80 Hz, LPF 9 kHz, pan spatial léger.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `pickupTickets` | Tickets ramassés | Picking up a handful of paper tickets with a small coin-like jingle | 0.5 s | 3 | Court |
| `pickupPs` | Points de Syndicalisme : tampon + note chaude | Rubber stamp thump followed by a warm short reward note | 0.6 s | 2 | Chaud |
| `pickupGrains` | Grains de café | Coffee beans poured into a small tin, rattle | 0.6 s | 2 | Médium |
| `pickupGobelet` | Gobelet ramassé | Plastic cup picked up with a liquid slosh | 0.5 s | 2 | Court |
| `pickupCornet` | Cornet de frites (Friterie) | Paper cone of fries crinkling | 0.5 s | 2 | Court |
| `pickupAvantage` | Avantage acquis : radio qui grésille + accord | Walkie-talkie squelch followed by a bright short reward chord | 1 s | 2 | Centre |
| `choice` | Fenêtre de choix d’Avantage | Soft card-shuffle whoosh with a gentle magical shimmer | 0.8 s | 2 | Bus UI, centre |
| `loot0` | Loot Réformé : clinquant modeste | Small cheap metal item dropping on concrete, dull clink | 0.5 s | 2 | Le plus grave et le plus mat |
| `loot1` | Loot Réglementaire | Metal tool dropping on concrete with a clean clink | 0.6 s | 2 | +2 demi-tons |
| `loot2` | Loot Homologué : tintement brillant | Quality tool dropping with a bright bell-like ping | 0.8 s | 2 | +4 demi-tons |
| `loot3` | Loot Hors-série : carillon + scintillement | Rare item drop, glassy chime with soft sparkle | 1.2 s | 2 | +7 demi-tons |
| `loot4` | Loot Patrimoine : carillon cuivré, faisceau | Video game loot drop sting for a legendary item: a heavy brass object lands on concrete with a solid thud, followed by a short warm bell shimmer and a soft reverse-cymbal tail; retro train-station atmosphere, slightly dusty, 1.5 seconds, clean ending | 1.5 s | 3 | Le son le plus « riche » du loot ; crête −6 dBFS · **validé** (generation_id `Uu6mU4EptZKYtyOv1G5Z`) |
| `lootEquip` | Équiper : sangle + mousqueton | Leather strap buckle and metal carabiner click | 0.6 s | 2 | Centre |
| `lootBag` | Mettre au sac : tissu + zip | Fabric rustle and short zipper close | 0.6 s | 2 | Centre |
| `lootScrap` | Ferraille : pièces dans un bac | Scrap metal pieces dropped into a metal bin | 0.8 s | 2 | Médium |

#### Interface

Traitement commun : HPF 120 Hz, LPF 8 kHz, bus UI, centre, très bas.

| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |
|---|---|---|---|---|---|
| `uiHover` | Survol | Very soft tiny UI tick | 0.5 s | 2 | La synthèse reste la référence · synthèse prioritaire |
| `uiClick` | Clic | Soft clicky button press like a vintage railway switch | 0.5 s | 2 | Interrupteur de pupitre |
| `uiOpen` | Ouverture de menu | Soft whoosh with two gentle ascending notes | 0.6 s | 2 | Centre |

<!-- /AUTO:sfx -->

---

## 5. Dialogues (VF)

### 5.1 Direction de doublage

- **Modèle** : `eleven_v3` (balises d'émotion entre crochets : `[sighs]`, `[laughs]`, `[whispers]`, `[shouting]`, `[beat]`…), `language_code: fr`. `eleven_v4` (sorti depuis, plus fidèle mais sans curseur Style) est l'alternative à tester sur le lot d'écoute (`--tts-model eleven_v4`). `eleven_multilingual_v2` en repli (les balises sont alors retirées automatiquement).
- **Stabilité** (`eleven_v3` : 0 Creative, 0,5 Natural, 1 Robust) : 0 pour les efforts et les cris, 0,5 pour le jeu, 1 pour la voix de gare. Similarity 0,75, speaker boost actif.
- **Prises** : 2 par réplique (4 pour les efforts et les répliques clés), graines différentes ; on choisit à l'écoute.
- **Post** : normalisation −18 LUFS, coupe des silences ; **radio** (passe-bande 300–3 400 Hz, légère saturation, compression) pour les lignes en run ; **haut-parleur de quai** (filtre + écho de hall) pour la voix de gare ; **visio** pour Hubert ; **réverbération** de wagon (Fantôme) et d'estrade (Invité d'honneur) ; −3 demi-tons et chorus pour le Discosaure.
- **Barks** ≤ 8 mots (lisibles en 1,5 s) ; un tic par scène et par personnage au maximum.
- **Les répliques du jeu sont reprises mot pour mot** (`src : jeu`), celles du lore aussi (`lore`) ; les nouvelles (`nouveau`) respectent le même ton et sont à valider par le porteur du projet (en particulier : barks des héros, radio de Yasmina, annonces de gare, barks de boss).

### 5.2 Fiches de voix et répliques

<!-- AUTO:voices -->

#### Léon (héros) — voix clé
- **État** : **validée et sauvegardée** (`voice_id` `Ql8Hq7echfwTF90Fec6K`, nom actuel dans le workspace « voix1 », à renommer « Privatix — … »).
- **Âge** : 35 ans · **Timbre** : baryton clair, un peu voilé par les nuits · **Accent** : belge wallon léger (Mons) · **Débit** : lent, phrases courtes · **Émotion** : ironie sèche, fatigue tenue, jamais de tirade
- **Direction** : Le héros parle peu. Les efforts sont courts et nets, pas de cri de film d’action : un cheminot qui force sur un tire-fond.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Male, 35 years old. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Warm light baritone, slightly husky from years of night shifts. Speaks in short, dry, understated sentences with deadpan irony; tired but steady and kind. Close-miked studio recording, clean, no reverb. »
- **Texte d’aperçu** : « Mons, quatre heures quarante-sept, quai deux. Le train de sept heures douze est supprimé. Motif : optimisation. Bon. Je prends la clé de mon grand-père, je finis mon café, et on va leur demander, poliment, ce que ça donne, concrètement, sur le terrain. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `leon.effort.coup1` | coup 1, Serrage | [short effort grunt] Hm ! | effort bref, expiration (coup 1, Serrage) | nouveau |
| `leon.effort.coup2` | coup 2, Desserrage | [effort grunt] Hah ! | effort bref, un peu plus appuyé (coup 2, Desserrage) | nouveau |
| `leon.effort.coup3` **écoute** | coup 3 | [strained grunt] Hnnh… HA ! | effort lourd, on force sur le tire-fond (coup 3) | nouveau |
| `leon.effort.dash` | dash « Retard » | [quick exhale] Hup ! | souffle court (dash « Retard ») | nouveau |
| `leon.effort.sifflet` | Coup de sifflet | [deep breath] Tout le monde… dehors ! | inspiration puis voix projetée (Coup de sifflet) | nouveau |
| `leon.effort.preavis` | Préavis de grève | [shouting] Préavis déposé ! | cri de rassemblement, pas de rage (Préavis de grève) | nouveau |
| `leon.douleur.legere` | dégâts légers | [pained grunt] Ah… | douleur brève (dégâts légers) | nouveau |
| `leon.douleur.lourde` | gros coup | [pained gasp] Aïe… ça, c’était pas au planning. | douleur + ironie (gros coup) | nouveau |
| `leon.ko` | mort | [exhausted sigh] … Fin de service. | tombe, épuisé, pas tragique (mort) | nouveau |
| `leon.cafe` | Gobelet | [sips] [satisfied exhale] Ah. Voilà. | gorgée et soulagement (Gobelet) | nouveau |
| `leon.soupir` | réplique canonique | [long sigh] … | soupir de fin de pause (réplique canonique) | lore |
| `leon.bark.debut` | entrée en run | Bon. On y va. | sobre, prise de poste (entrée en run) | nouveau |
| `leon.bark.salle` | salle nettoyée | Salle tenue. | satisfaction retenue (salle nettoyée) | nouveau |
| `leon.bark.energie` | bark.energie | [tired] Faut que je boive un café. | Énergie < 30 % | nouveau |
| `leon.bark.burnout` | bark.burnout | [through gritted teeth] Je suis en pause, là. | Burnout palier 3 | nouveau |
| `leon.bark.petage` | une seule fois | [shouting] Ça suffit ! | Pétage de plombs (une seule fois) | nouveau |
| `leon.bark.loot` | bark.loot | Ça, c’est du patrimoine. | loot Patrimoine au sol, émerveillement discret | nouveau |
| `leon.bark.dashparfait` | bark.dashparfait | [dry] Retard indépendant de ma volonté. | premier dash parfait | nouveau |
| `leon.bark.consultant` | Consultant | Votre titre de transport, s’il vous plaît. | pince-sans-rire (Consultant) | nouveau |
| `leon.boss.signature` | intro Lurcke | On vient arrêter la signature. | calme, déterminé (intro Lurcke) | lore |
| `leon.boss.article47` | Fluidifieur | Article quarante-sept, alinéa trois : préavis de sept jours. | lu au règlement, triomphe sec (Fluidifieur) | jeu |
| `leon.boss.preuve` | Lurcke phase 2 | Ceci a été présenté au comité. Ceci n’a jamais été montré au terrain. | Preuve activée, fermeté (Lurcke phase 2) | lore |
| `leon.boss.question` **écoute** | boss.question | [quietly] Mais concrètement… sur le terrain, ça donne quoi ? | LA question finale : calme, presque doux, silence autour | jeu |
#### Léa (héroïne) — voix clé
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 33 ans · **Timbre** : mezzo grave, légèrement rauque · **Accent** : belge wallon léger (Mons) · **Débit** : lent, phrases courtes · **Émotion** : ironie sèche, fatigue tenue
- **Direction** : Même texte que Léon, même retenue. Les efforts sont brefs, sur l’expiration.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Female, 33 years old. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Low mezzo voice with a slight rasp, calm and grounded. Short, dry, understated sentences with deadpan irony; tired but warm and determined. Close-miked studio recording, clean, no reverb. »
- **Texte d’aperçu** : « Mons, quatre heures quarante-sept, quai deux. Le train de sept heures douze est supprimé. Motif : optimisation. Bon. Je prends la clé de mon grand-père, je finis mon café, et on va leur demander, poliment, ce que ça donne, concrètement, sur le terrain. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `lea.effort.coup1` | coup 1, Serrage | [short effort grunt] Hm ! | effort bref, expiration (coup 1, Serrage) | nouveau |
| `lea.effort.coup2` | coup 2, Desserrage | [effort grunt] Hah ! | effort bref, un peu plus appuyé (coup 2, Desserrage) | nouveau |
| `lea.effort.coup3` **écoute** | coup 3 | [strained grunt] Hnnh… HA ! | effort lourd, on force sur le tire-fond (coup 3) | nouveau |
| `lea.effort.dash` | dash « Retard » | [quick exhale] Hup ! | souffle court (dash « Retard ») | nouveau |
| `lea.effort.sifflet` | Coup de sifflet | [deep breath] Tout le monde… dehors ! | inspiration puis voix projetée (Coup de sifflet) | nouveau |
| `lea.effort.preavis` | Préavis de grève | [shouting] Préavis déposé ! | cri de rassemblement, pas de rage (Préavis de grève) | nouveau |
| `lea.douleur.legere` | dégâts légers | [pained grunt] Ah… | douleur brève (dégâts légers) | nouveau |
| `lea.douleur.lourde` | gros coup | [pained gasp] Aïe… ça, c’était pas au planning. | douleur + ironie (gros coup) | nouveau |
| `lea.ko` | mort | [exhausted sigh] … Fin de service. | tombe, épuisé, pas tragique (mort) | nouveau |
| `lea.cafe` | Gobelet | [sips] [satisfied exhale] Ah. Voilà. | gorgée et soulagement (Gobelet) | nouveau |
| `lea.soupir` | réplique canonique | [long sigh] … | soupir de fin de pause (réplique canonique) | lore |
| `lea.bark.debut` | entrée en run | Bon. On y va. | sobre, prise de poste (entrée en run) | nouveau |
| `lea.bark.salle` | salle nettoyée | Salle tenue. | satisfaction retenue (salle nettoyée) | nouveau |
| `lea.bark.energie` | bark.energie | [tired] Faut que je boive un café. | Énergie < 30 % | nouveau |
| `lea.bark.burnout` | bark.burnout | [through gritted teeth] Je suis en pause, là. | Burnout palier 3 | nouveau |
| `lea.bark.petage` | une seule fois | [shouting] Ça suffit ! | Pétage de plombs (une seule fois) | nouveau |
| `lea.bark.loot` | bark.loot | Ça, c’est du patrimoine. | loot Patrimoine au sol, émerveillement discret | nouveau |
| `lea.bark.dashparfait` | bark.dashparfait | [dry] Retard indépendant de ma volonté. | premier dash parfait | nouveau |
| `lea.bark.consultant` | Consultant | Votre titre de transport, s’il vous plaît. | pince-sans-rire (Consultant) | nouveau |
| `lea.boss.signature` | intro Lurcke | On vient arrêter la signature. | calme, déterminé (intro Lurcke) | lore |
| `lea.boss.article47` | Fluidifieur | Article quarante-sept, alinéa trois : préavis de sept jours. | lu au règlement, triomphe sec (Fluidifieur) | jeu |
| `lea.boss.preuve` | Lurcke phase 2 | Ceci a été présenté au comité. Ceci n’a jamais été montré au terrain. | Preuve activée, fermeté (Lurcke phase 2) | lore |
| `lea.boss.question` **écoute** | boss.question | [quietly] Mais concrètement… sur le terrain, ça donne quoi ? | LA question finale : calme, presque doux, silence autour | jeu |
#### Marcel « Pépé Rail » Lhoir — voix clé
- **État** : **arrêtée sur Gemini TTS** (`voice_id` `voice_jwjfxi0g20l6`, backend `--tts-backend gemini`) ; répliques produites, essai d’écoute dans `docs/audio/samples/gemini/`.
- **Âge** : 72 ans · **Timbre** : grave, rocailleux, chaud · **Accent** : wallon un peu plus marqué que les autres (génération 1970) · **Débit** : posé, raconte, laisse traîner la fin des phrases · **Émotion** : bourru, tendre en secret
- **Direction** : Mentor qui a tout vu. « De mon temps… » est dit avec un sourire, pas avec amertume. Une seule fois par scène.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Elderly man, 72 years old, retired train driver. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural, slightly stronger regional colour than younger characters. Deep, gravelly, warm voice; gruff but tender. Unhurried storytelling pace, lets sentence endings trail off with a smile. Studio recording, clean. »
- **Texte d’aperçu** : « De mon temps, le retard, on l’appelait l’aventure. Maintenant, ils l’appellent un KPI. Ça va, fieu ? T’as eu une aventure courte. Allez, une tasse et on y retourne. Tant qu’ils reprogramment, on existe. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `marcel.hub.01` **écoute** | OCC, générique | De mon temps, le retard, on l’appelait l’aventure. [chuckles] Maintenant, ils l’appellent un KPI. | bourru, amusé | jeu |
| `marcel.hub.02` | OCC, générique (Tableau) | Le Tableau des revendications, fieu. Chaque PS, c’est un acquis. | fier, didactique | jeu |
| `marcel.hub.03` **écoute** | OCC, après une mort | Ça va, fieu ? T’as eu une aventure courte. [warmly] Allez, une tasse et on y retourne. | tendresse bourrue | jeu |
| `marcel.hub.04` | OCC, après une victoire | Ils ont reprogrammé ? Bien. Tant qu’ils reprogramment, on existe. | satisfaction grave | jeu |
| `marcel.hub.05` | OCC, mort par un Consultant (runCount ≤ 3) | Battu par un gamin en baskets blanches ? De mon temps, ils avaient au moins des chaussures. | taquin | lore |
| `marcel.hub.06` | OCC, jauge de signature pleine | Il a signé ? … Non. Regarde l’écran : reprogrammé. Le Sondage est de notre côté, fieu. Pour l’instant. | soulagement teinté d’inquiétude | lore |
| `marcel.radio.01` | Radio, défaite de l’Invité d’honneur | De mon temps, on inaugurait les gares. Pas leur vente. | grave, radio | lore, radio |
| `marcel.hub.07` | OCC, serment (relation 3) | [softly] Tant que je respire, la porte s’ouvre. | serment, ému, retenu | lore |
| `marcel.radio.02` | Radio, Avantage D’antan proposé | De mon temps, on frappait d’abord. Tiens. | bark radio | nouveau, radio |
| `marcel.hub.08` | OCC, accueil au retour (remplissage) | Assieds-toi deux minutes. Le Sondage attendra. Il attend toujours. | bienveillant | nouveau |
#### Fatou Ndiaye — voix clé
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 44 ans · **Timbre** : médium doux, rond · **Accent** : belge francophone neutre, très léger · **Débit** : mesuré, précis, souriant · **Émotion** : douce et scientifique ; terrifiante de calme quand on saute la pause légale
- **Direction** : La conscience de l’OCC. Chaque chiffre est dit avec soin. L’humour est dans la précision, jamais dans la voix. Aucun cliché d’origine.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Woman, 44 years old, occupational health and safety advisor. Native Belgian French speaker, very light accent. Soft, round, warm mid-range voice; measured, precise and gently amused delivery, like a caring nurse reading statistics. Studio recording, clean. »
- **Texte d’aperçu** : « Ton Burnout de fin de Shift était à quatre-vingt-sept. Je l’ai noté. En rouge. Avec un cœur, pour adoucir. Arrêt de travail de zéro jour. Bienvenue. Hydrate-toi. Au café, de préférence. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `fatou.hub.01` | OCC, générique | Hydrate-toi. Au café, de préférence. | douce, souriante | jeu |
| `fatou.hub.02` **écoute** | OCC, générique (statistiques) | Ton Burnout de fin de Shift était à quatre-vingt-sept. Je l’ai noté. En rouge. Avec un cœur, pour adoucir. | précise, tendre | jeu |
| `fatou.hub.03` **écoute** | OCC, après une mort | Arrêt de travail de zéro jour. Bienvenue. Tu avais deux Gobelets pleins, je précise. | calme reproche | jeu |
| `fatou.hub.04` | OCC, après une victoire | Quatorze heures de service sans pause réglementaire. Bravo. Je fais un signalement. | fierté administrative | jeu |
| `fatou.radio.01` | Radio, premier Pétage de plombs | [calmly] Ton Burnout est à cent. Respire. Frappe. Mais respire. On en parle à l’OCC. | calme absolu dans le chaos | lore, radio |
| `fatou.hub.05` | OCC, mort en Pétage de plombs | Tu as pété un plomb et tu en as perdu huit d’Énergie max. Le corps note tout, même quand le roulement oublie. | sérieux bienveillant | lore |
| `fatou.hub.06` | OCC, serment (relation 3) | Personne ne tombe sans que je le sache. | serment | lore |
| `fatou.radio.02` | Radio, Avantage Prévention proposé | Un bouclier. Ce n’est pas négociable. | bark radio | nouveau, radio |
| `fatou.radio.03` | Radio, Énergie basse | Ton Énergie baisse. Un Gobelet. Maintenant. | ferme, douce | nouveau, radio |
#### Kevin « Kéké » Lambot
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 31 ans · **Timbre** : ténor léger, un peu nasal · **Accent** : wallon léger · **Débit** : rapide, s’emballe sur la technique · **Émotion** : gentil comme un pain, fier de ses rapports
- **Direction** : Le bricoleur au grand cœur. « C’est pas nous, c’est l’autre boîte » est un réflexe, pas une excuse.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Young man, 31 years old, overhead-line technician. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Light, slightly nasal tenor; friendly and eager, speaks fast when excited about tools and technical details, endearingly earnest. Studio recording, clean. »
- **Texte d’aperçu** : « Ta clé, je la touche pas : c’est la DPD. Mais elle grince. Comme moi. Tombé sur les voies ? C’est pas nous, c’est l’autre boîte. Enfin… là, c’est un peu toi. Tu lui as coupé le courant ? Proprement ? Je note ça dans un rapport. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `kevin.hub.01` | OCC, générique | Ta clé, je la touche pas : c’est la DPD. Mais elle grince. Comme moi. | gentil | jeu |
| `kevin.hub.02` | OCC, générique (tic) | C’est pas nous, c’est l’autre boîte. | réflexe, haussement d’épaules | jeu |
| `kevin.hub.03` | OCC, après une mort | Tombé sur les voies ? C’est pas nous, c’est l’autre boîte. [beat] Enfin… là, c’est un peu toi. | embarras sympathique | jeu |
| `kevin.hub.04` | OCC, après une victoire | Tu lui as coupé le courant ? Proprement ? [excited] Je note ça dans un rapport. | fierté | jeu |
| `kevin.hub.05` | OCC, serment (relation 3) | Ce soir, il y a plus d’autre boîte. | serment, ému | lore |
| `kevin.radio.01` | Radio, Avantage Caténaire proposé | Quinze mille volts, livrés. C’est nous, cette fois. | bark radio | nouveau, radio |
#### Bénédicte « Béné » Wautier
- **État** : **arrêtée sur Gemini TTS** (`voice_id` `voice_k4b4wmmwy1d8`, backend `--tts-backend gemini`) ; répliques produites, essai d’écoute dans `docs/audio/samples/gemini/`.
- **Âge** : 56 ans · **Timbre** : médium sec, net · **Accent** : belge wallon léger · **Débit** : régulier, comme un tampon · **Émotion** : pince-sans-rire absolu, ne s’énerve jamais
- **Direction** : La guichetière qui a survécu à quatre réformes tarifaires. Chaque blague est livrée à plat.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Woman, 56 years old, veteran ticket-office clerk. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Dry, crisp mid-range voice; perfectly deadpan, even and rhythmic delivery like a rubber stamp, a hint of tired amusement she never shows. Studio recording, clean. »
- **Texte d’aperçu** : « Le Règlement, page trois cent douze : un consultant n’a pas de titre de transport. Je dis ça, je dis rien. J’ai archivé ta victoire. Classement : rare. Sous-classement : à renouveler. Numéro suivant ! »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `bene.hub.01` | OCC, générique | Le Règlement, page trois cent douze : un consultant n’a pas de titre de transport. Je dis ça, je dis rien. | pince-sans-rire | jeu |
| `bene.hub.02` | OCC, générique (tic) | Numéro suivant ! | tampon | jeu |
| `bene.hub.03` | OCC, après une mort (Borne) | Elle t’a imprimé, la borne ? On ne négocie pas avec ces machines-là. Numéro suivant ! | sec | jeu |
| `bene.hub.04` | OCC, après une victoire | J’ai archivé ta victoire. Classement : rare. Sous-classement : à renouveler. | administratif | jeu |
| `bene.hub.05` | OCC, serment (relation 3) | Tant que j’ai un tampon, il y a un guichet. | serment | lore |
| `bene.radio.01` | Radio, Avantage Guichet proposé | File d’attente ouverte. Ils patienteront. | bark radio | nouveau, radio |
#### Yasmina Benali (régulation, radio) — voix clé
- **État** : **validée et sauvegardée** (`voice_id` `ROy6nWoXjRMqzkdFdAkB`, nom actuel dans le workspace « femme », à renommer « Privatix — … »).
- **Âge** : 38 ans · **Timbre** : alto posé, articulé · **Accent** : belge francophone neutre · **Débit** : calme olympien, pas une syllabe de trop · **Émotion** : stratège, tendresse cachée sous le code
- **Direction** : C’est LA voix de la radio en run. Ne hausse jamais le ton (« Si je crie, des trains se percutent »). Enregistrer propre ; le filtre radio est ajouté en post.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Woman, 38 years old, railway traffic controller. Native Belgian French speaker, light neutral accent. Calm, low alto voice, crisp articulation, unflappable radio-operator composure; dry humour hidden under procedure. Studio recording, clean, close mic. »
- **Texte d’aperçu** : « Roulement de nuit. Moins de monde, plus de cadres. Je te mets le biome un en orange. Incident voyageur sur ta ligne. Toi. Je te mets en voie d’attente, le temps de te recoller. Quand je dis départ, tout le monde part. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `yasmina.hub.01` | OCC, générique (roulement) | Roulement de nuit. Moins de monde, plus de cadres. Je te mets le biome un en orange. | stratège posée | jeu |
| `yasmina.hub.02` | OCC, après une mort | Incident voyageur sur ta ligne. Toi. Je te mets en voie d’attente, le temps de te recoller. | humour sec | jeu |
| `yasmina.hub.03` | OCC, après une victoire | L’Auditeur est en voie d’attente. Définitive, j’espère. | satisfaction contenue | jeu |
| `yasmina.radio.01` **écoute** | Radio, premier dash parfait | Retard indépendant de ta volonté. Quinze minutes. Joli. Je l’inscris au registre des excuses. | complice, radio | lore, radio |
| `yasmina.radio.02` **écoute** | Radio, début de Shift | Départ autorisé. Voie libre jusqu’au quai trois. | procédure, radio | nouveau, radio |
| `yasmina.radio.03` | Radio, entrée biome 2 | Passerelle. Vent de face. Ne regarde pas en bas. | radio | nouveau, radio |
| `yasmina.radio.04` | Radio, entrée biome 3 | Hall et BAG. À partir d’ici, plus de réseau. Sauf moi. | radio | nouveau, radio |
| `yasmina.radio.05` | Radio, salle de boss en approche | Signal fermé devant. Le boss t’attend. Je reste en ligne. | radio, tension | nouveau, radio |
| `yasmina.radio.06` | Radio, Préavis disponible | Mobilisation à cent. Tu peux déposer ton préavis. | radio | nouveau, radio |
| `yasmina.radio.07` | Radio, Gobelets épuisés | Plus de Gobelets. Je te trouve une salle café. | radio | nouveau, radio |
| `yasmina.radio.08` | Radio, Shift tenu | Shift tenu. Je te mets tout le réseau en vert. | radio, chaleur | lore, radio |
| `yasmina.hub.04` | OCC, serment (relation 3) | Quand je dis départ, tout le monde part. | serment | lore |
#### Josiane Delhaye
- **État** : **arrêtée sur Gemini TTS** (`voice_id` `voice_fekejacozsb7`, backend `--tts-backend gemini`) ; répliques produites, essai d’écoute dans `docs/audio/samples/gemini/`.
- **Âge** : 58 ans · **Timbre** : médium chaud, voix qui porte · **Accent** : wallon léger · **Débit** : franc, sans détour · **Émotion** : maternelle et inflexible
- **Direction** : A expulsé un sanglier d’un train « avec politesse ». Autorité douce, chaleur sous la fermeté.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Woman, 58 years old, train conductor with 28 years of service. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Warm, projecting mid-range voice; motherly but firm and unflinching, straightforward, quick to tease. Studio recording, clean. »
- **Texte d’aperçu** : « Le consultant, tu lui as demandé son titre de transport ? Non ? Ben voilà. Tu ne m’appelles jamais, à la radio. Ça, c’est pas dans le règlement, mais c’est dans le cœur. Mon sanglier de deux mille neuf était plus coriace. Mais bravo, hein. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `josiane.hub.01` | OCC, service (Vestiaire) | Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement. | ferme | jeu |
| `josiane.hub.02` | OCC, générique (mannequin) | Le mannequin, là. Tape dedans, il ne porte pas plainte. | maternelle, taquine | jeu |
| `josiane.hub.03` | OCC, après une mort | Tu ne m’appelles jamais, à la radio. Ça, c’est pas dans le règlement, mais c’est dans le cœur. | reproche tendre | jeu |
| `josiane.hub.04` | OCC, après une victoire | Mon sanglier de deux mille neuf était plus coriace. Mais bravo, hein. | fierté pudique | jeu |
| `josiane.radio.01` | Radio, intro de Lurcke | Ces quatorze-là, ils ont un nom. | sèche, radio | lore, radio |
| `josiane.hub.05` | OCC, serment (relation 3) | Je contrôle les billets. Ce soir, je contrôle un contrat. | serment | lore |
| `josiane.radio.02` | Radio, Avantage Contrôle des titres proposé | Titre non valable. Renvoie-leur. | bark radio | nouveau, radio |
#### Rudy Courtois (chef de quai, annonces) — voix clé
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 46 ans · **Timbre** : baryton projeté, voix d’annonceur · **Accent** : belge wallon léger · **Débit** : théâtral, ménage ses effets · **Émotion** : ponctuel jusqu’à l’obsession, ému en vert
- **Direction** : « Attention, attention… » avant chaque phrase importante. Sa voix est aussi, en lore, la voix synthétique de la gare (achetée en 2014) : la voix « gare » en dérive.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 46 years old, railway platform chief and station announcer. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Projected, theatrical baritone with announcer diction; pompous in a lovable way, savours dramatic pauses, punctual to the point of obsession. Studio recording, clean. »
- **Texte d’aperçu** : « Attention, attention… le Sondage propose jeudi. Le traiteur ne peut pas jeudi. On est tranquilles. Shift tenu, à l’heure, voie un. Je l’ai affiché. En vert. J’ai pleuré un peu. En vert aussi. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `rudy.hub.01` **écoute** | OCC, générique (tic) | Attention, attention… le Sondage propose jeudi. Le traiteur ne peut pas jeudi. On est tranquilles. | théâtral | jeu |
| `rudy.hub.02` | OCC, générique | Un coup de sifflet bien placé, ça vaut tous les diaporamas. | fier | jeu |
| `rudy.hub.03` | OCC, après une mort (rame) | Attention, attention… on ne traverse pas les voies. Même pour frapper un consultant. [beat] Surtout pour frapper un consultant. | solennel puis complice | jeu |
| `rudy.hub.04` **écoute** | OCC, après une victoire | Shift tenu, à l’heure, voie un. Je l’ai affiché. En vert. [voice cracks] J’ai pleuré un peu. En vert aussi. | ému, théâtral | jeu |
| `rudy.radio.01` | Radio, intro du Fluidifieur | Attention, attention… il a le classeur. Méfie-toi du classeur. | radio, alarme | lore, radio |
| `rudy.radio.02` | Radio, intro de l’Invité d’honneur | Attention, attention… il a quarante pages. Prévois des Gobelets. | radio | lore, radio |
| `rudy.boss.01` | Écran des départs, retard cumulé ≥ 3 h | Attention, attention… retard cumulé : trois heures douze. Nous vous prions de nous excuser pour la gêne occasionnée. | annonce | lore |
| `rudy.hub.05` | OCC, serment (relation 3) | La prochaine fois que ma voix annonce un train, il viendra. | serment | lore |
| `rudy.boss.02` | Épilogue, quai 2, 7 h 12 (sa vraie voix) | [deep breath] Attention, attention… le train de sept heures douze entre en gare, voie deux. [beat] Il est à l’heure. | émotion retenue, la plus belle annonce de sa vie | nouveau |
| `rudy.radio.03` | Radio, Avantage Coup de sifflet proposé | Fermeture des portes ! Attention au départ ! | bark radio | nouveau, radio |
#### Voix de la gare (annonces synthétiques Privatix) — voix clé
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : sans âge (synthèse de la voix de Rudy, version « Expérience Quai ») · **Timbre** : baryton lisse, trop poli · **Accent** : neutre, aseptisé · **Débit** : régulier, souriant, inhumain par sa constance · **Émotion** : aucune ; sourire commercial
- **Direction** : Annonces de gare : toujours claires quand elles portent une information de jeu, souvent coupées ou absurdes en fond. Traitement « haut-parleur de quai » en post (filtre + écho de hall).
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, mid 40s, corporate railway station public-address voice. Native French speaker, neutral polished accent. Smooth, overly polite baritone with a fixed commercial smile, perfectly even pacing, slightly uncanny in its constancy. Clean studio recording. »
- **Texte d’aperçu** : « Mesdames et messieurs, le train de sept heures douze à destination de… est supprimé. Motif : optimisation. Privatix Rail Solutions vous remercie de votre compréhension. Votre quai, votre expérience. Le stationnement sur le quai est facturé à la minute. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `gare.annonce.01` **écoute** | Quai, fond sonore (coupée, canonique) | Le train de sept heures douze à destination de… | annonce coupée net | lore |
| `gare.annonce.02` **écoute** | Prologue, écran des départs | Mesdames et messieurs, le train de sept heures douze est supprimé. Motif : optimisation. | sourire commercial | nouveau |
| `gare.annonce.03` | Quai, fond sonore | Votre quai, votre expérience. Le stationnement est facturé à la minute. | publicité | nouveau |
| `gare.annonce.04` | Quai, fond sonore | Privatix Rail Solutions vous remercie de votre compréhension. Et de votre patience. Surtout de votre patience. | publicité | nouveau |
| `gare.annonce.05` | Quai, fond sonore | En raison d’une optimisation, le quai deux est temporairement remplacé par le quai deux. | absurde | nouveau |
| `gare.annonce.06` | Quai, fond sonore | Les voyageurs sont priés de ne pas utiliser le banc du quai deux. Il est réservé. | absurde | nouveau |
| `gare.annonce.07` | Passerelle, fond sonore | La passerelle est fermée pour cérémonie. Merci de patienter dans le vent. | publicité | nouveau |
| `gare.annonce.08` | Passerelle, fond sonore | L’escalator numéro trois est en service. Aujourd’hui. | absurde | nouveau |
| `gare.annonce.09` | Hall, fond sonore | Bienvenue au Corner Expérience Voyageur. Un conseiller virtuel va vous répondre dans… quarante-sept minutes. | publicité | nouveau |
| `gare.annonce.10` | Hall, fond sonore | Le guichet est fermé. Pour toute réclamation, merci de remplir le Sondage. | publicité | nouveau |
| `gare.annonce.11` | Retour à l’OCC, Sondage | Le Sondage vous informe que la signature est reportée. Une nouvelle date vous sera proposée à la fin de votre service. | administratif | nouveau |
| `gare.annonce.12` | Écran des départs, défaite | Shift trente-sept : supprimé. Cause : Consultant Junior. | neutre, cruel par neutralité | lore |
| `gare.annonce.13` | Écran des départs, victoire | Shift tenu. À l’heure. | surprise involontaire | nouveau |
| `gare.annonce.14` | Furet putride, collier (jeu) | Tri en cours. Veuillez patienter. | voix de collier synthétique | jeu |
| `gare.annonce.15` | Furet putride, défaite (jeu) | Tri… suspendu… | collier qui s’éteint | jeu |
#### Jean-Michel « Jean-Mi » Dufrasne
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 42 ans · **Timbre** : médium légèrement voilé · **Accent** : wallon léger · **Débit** : affable, un peu trop rapide quand il ment · **Émotion** : drôle, serviable, épuisé ; culpabilité sous la surface
- **Direction** : La taupe traitée avec compassion. Jamais un méchant : un homme fatigué qui veut ses jeudis.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 42 years old, assistant station master and café barista. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Friendly, slightly veiled mid-range voice; helpful and funny but exhausted, talks a little too fast when uneasy. Studio recording, clean. »
- **Texte d’aperçu** : « Franchement, faut être réaliste… tu crois vraiment qu’on va gagner ? Bon. Double expresso quand même. Encore les consultants ? Ils savaient où t’attendre, hein. Bizarre. T’as gagné. Moi, j’ai juste servi le café. Mais je l’ai servi ici. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `jeanmi.hub.01` | OCC, générique (Shift ≥ 6, avant révélation) | Franchement, faut être réaliste… tu crois vraiment qu’on va gagner ? [sighs] Bon. Double expresso quand même. | affable, las | lore |
| `jeanmi.hub.02` | OCC, après une mort (avant révélation) | Encore les consultants ? Ils savaient où t’attendre, hein. [nervously] Bizarre. | gêné | lore |
| `jeanmi.hub.03` | OCC, après une victoire (racheté) | T’as gagné. Moi, j’ai juste servi le café. Mais je l’ai servi ici. C’est déjà ça. | sincère | lore |
| `jeanmi.hub.04` | OCC, serment (relation 3) | Faut être réaliste : je reste. | serment, soulagé | lore |
#### Le Fantôme du Wagon-Bar
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : indéfinissable (serveur de 1996) · **Timbre** : ténor velouté, un peu lointain · **Accent** : belge, diction de grand service · **Débit** : lent, élégant, vouvoie tout le monde · **Émotion** : mélancolique et courtois
- **Direction** : Légère réverbération de wagon en post. Il ne dit jamais s’il est vraiment un fantôme.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Elderly man of indeterminate age, old-fashioned dining-car waiter. Belgian French speaker with formal, elegant diction. Velvety, slightly distant tenor; melancholic, courteous and gently witty, addresses everyone formally. Studio recording, clean. »
- **Texte d’aperçu** : « Et pour monsieur-dame, ce sera ? Votre grand-père prenait un café noir et un croque sans fromage. Il disait que le fromage, c’était pour les jours de grève. Ce soir, la maison offre. Et la maison, ce soir, c’est vous. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `fantome.hub.01` | Wagon-Bar, générique | Votre grand-père prenait un café noir et un croque sans fromage. Il disait que le fromage, c’était pour les jours de grève. | mélancolique | lore |
| `fantome.hub.02` | Wagon-Bar, après une mort | Et pour monsieur-dame, ce sera ? Un remontant ? La maison n’existe plus, donc c’est gratuit. | courtois | lore |
| `fantome.hub.03` | Wagon-Bar, après une victoire | Ce soir, la maison offre. Et la maison, ce soir, c’est vous. | ému | lore |
#### Raymonde (la Friterie)
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 61 ans · **Timbre** : alto chaleureux, gouailleur · **Accent** : wallon franc (le plus marqué du casting, sans caricature) · **Débit** : rapide, cash · **Émotion** : chaleureuse, mémoire d’éléphant
- **Direction** : « Chéri » à chaque client. La seule à avoir droit à « dikkenek ».
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Woman, 61 years old, owner of a mobile chip shop. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural, with a frank, colourful regional tone. Warm, husky alto, quick and cheeky delivery, motherly street-vendor charm. Studio recording, clean. »
- **Texte d’aperçu** : « Les costumes mangent trois frites et demandent un justificatif. Le justificatif, c’est la frite, chéri. Te revoilà ? T’as une mine de bus de substitution. Tiens, une fricadelle, c’est pour la maison. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `raymonde.hub.01` | Friterie, générique | Les costumes mangent trois frites et demandent un justificatif. Le justificatif, c’est la frite, chéri. | gouailleuse | lore |
| `raymonde.hub.02` | Friterie, après une mort | Te revoilà ? T’as une mine de bus de substitution. Tiens, une fricadelle, c’est pour la maison. | chaleureuse | lore |
| `raymonde.hub.03` | Friterie, tic | Avec ou sans vérité, la sauce, chéri ? | malicieuse | lore |
#### L’Auditeur des Quais (boss 1) — voix clé
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 52 ans · **Timbre** : ténor sec, légèrement nasal · **Accent** : français « de bureau », neutre · **Débit** : métronomique, chaque syllabe au chronomètre · **Émotion** : zèle froid ; panique en phase 3
- **Direction** : Il ne regarde jamais l’heure qu’il est, seulement l’heure qu’il devrait être. Phase 3 : le métronome déraille. Défaite : la première phrase humaine.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 52 years old, obsessive corporate performance auditor. Native French speaker, neutral office accent. Dry, slightly nasal tenor, clipped metronomic delivery as if timing every syllable with a stopwatch; cold zeal that can crack into panic. Studio recording, clean. »
- **Texte d’aperçu** : « Vous avez mis quatre minutes douze pour arriver jusqu’ici. Je le note. Le standard est de quarante-sept secondes. Le standard est un objectif. L’objectif est un standard. Soupir non conforme. Audit bienveillant : début. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `auditeur.boss.01` **écoute** | Intro | [clicks tongue] Vous avez mis quatre minutes douze pour arriver jusqu’ici. Je le note. | zèle froid | jeu |
| `auditeur.boss.02` | Intro (suite) | Le standard est de quarante-sept secondes. Le standard est un objectif. L’objectif est un standard. | métronomique | lore |
| `auditeur.boss.03` | Intro (fin, après le soupir du héros) | Soupir non conforme. Audit bienveillant : début. | sec | lore |
| `auditeur.boss.04` | Phase 1 | Restez dans le cercle, c’est pour la mesure. | courtois glacial | lore |
| `auditeur.boss.05` | Phase 1 | Ce bouclier est un indicateur de confiance. | satisfait | lore |
| `auditeur.boss.06` **écoute** | Phase 2 (rame, télégraphe parlé) | Voie trois, passage dans trois… deux… un. | compte à rebours net | lore |
| `auditeur.boss.07` | Phase 2 | Ce train ne s’arrête pas. Il est rentable. | fier | lore |
| `auditeur.boss.08` | Phase 3 | [panicking] Tout est en retard ! Même moi ! | panique | lore |
| `auditeur.boss.09` | Phase 3 | [shouting] Accélérez ! Le chrono ! LE CHRONO ! | panique, cri | lore |
| `auditeur.boss.10` | Défaite | [long pause] … Le train de sept heures douze… il existe encore ? | la première phrase humaine, doux | jeu |
| `auditeur.boss.11` | Victoire sur le joueur | Shift interrompu. Taux de réussite : zéro. C’est un chiffre très propre. | satisfaction | lore |
| `auditeur.boss.12` | Bark, dégâts reçus | Écart constaté ! | outré | nouveau |
| `auditeur.boss.13` | Bark, tampon | Contrôle ! | sec | nouveau |
#### Le Fluidifieur (élite majeur, biome 2)
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 34 ans · **Timbre** : médium clair, souriant · **Accent** : français neutre, franglais de start-up · **Débit** : rapide, enjoué, glisse sur les mots · **Émotion** : enthousiasme RH ; ne déteste personne, il fluidifie
- **Direction** : Le sourire s’entend. Les mots anglais sont prononcés « à l’anglaise de séminaire ».
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 34 years old, upbeat HR reorganisation consultant. Native French speaker, neutral accent, peppers speech with corporate English buzzwords. Bright, smiling mid-range voice, fast and slippery delivery, relentlessly positive. Studio recording, clean. »
- **Texte d’aperçu** : « Ah ! Vous êtes en C ? Non non, vous êtes en S. Depuis ce matin. Ce n’est pas un changement, c’est une opportunité de changement. Mutation d’office ! C’est pour votre carrière ! L’organigramme, c’est moi. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `fluidifieur.boss.01` | Intro | Ah ! Vous êtes en C ? Non non, vous êtes en S. Depuis ce matin. | enjoué | jeu |
| `fluidifieur.boss.02` | Intro (suite) | Ce n’est pas un changement, c’est une opportunité de changement. | souriant | lore |
| `fluidifieur.boss.03` | Phase 1 | Votre samedi est « en cours de validation ». | léger | lore |
| `fluidifieur.boss.04` | Phase 1 | Je vous mets sur une dalle plus… aérée. | perfide souriant | lore |
| `fluidifieur.boss.05` | Phase 2 | Mutation d’office ! C’est pour votre carrière ! | triomphe | jeu |
| `fluidifieur.boss.06` | Phase 2 | L’organigramme, c’est moi. Et vous, vous êtes une case. | arrogant | jeu |
| `fluidifieur.boss.07` | Changement de roulement | Changement de roulement ! | annonce joyeuse | jeu |
| `fluidifieur.boss.08` | Article 47 lu par le héros | [shocked] Il y a un alinéa trois ?! | stupeur | jeu |
| `fluidifieur.boss.09` | Défaite | … Sept jours ? Personne ne lit jamais l’alinéa trois. | abattu | jeu |
| `fluidifieur.boss.10` | Défaite (sortie) | Bon. Je préviens l’Invité d’honneur qu’il y a un… imprévu. | résigné | lore |
| `fluidifieur.boss.11` | Victoire sur le joueur | Voilà. Vous êtes en repos. Un repos non prévu, mais le planning s’adaptera. | satisfait | lore |
#### L’Invité d’honneur (boss 2, caricature autorisée) — voix clé
- **État** : **validée et sauvegardée** (`voice_id` `BHaCuTcypMPA9jhksYPX`, nom actuel dans le workspace « Invité d’honneur », à renommer « Privatix — … »).
- **Âge** : septuagénaire · **Timbre** : voix de PERSONNAGE : orateur de cérémonie, médium chaleureux, sonore · **Accent** : belge francophone standard ; ne PAS reproduire l’accent ni la voix de la personne réelle · **Débit** : ample, solennel, ménage les effets d’estrade · **Émotion** : bonhomie protocolaire, sincère quand il dit « Mons mérite mieux ! »
- **Direction** : Satire bon enfant de la POSTURE (discours, rubans, inaugurations), jamais de la voix, de l’âge ou de l’accent. Toutes les répliques sont fictives, étiquetées « réplique fictive ». Aucun clonage, aucune référence audio. Sortie digne à la défaite.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man in his seventies, a fictional ceremonial guest of honour at a ribbon-cutting. Standard Belgian French speaker. Warm, resonant, sonorous mid-range voice of a seasoned public speaker; grand, courteous, slightly pompous podium delivery with long rhetorical pauses, good-natured and dignified. Original character voice, not based on any real person. Studio recording, clean. »
- **Texte d’aperçu** : « Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange. Nous sommes ici pour inaugurer l’avenir. Et l’avenir, je le dis souvent, ça s’inaugure. Je serai bref. Permettez-moi une parenthèse. Elle durera le temps qu’il faudra. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `invite.boss.01` **écoute** | Intro | [taps microphone] Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange. *(réplique fictive)* | orateur chaleureux | jeu |
| `invite.boss.02` | Intro (suite) | Nous sommes ici pour inaugurer l’avenir. Et l’avenir, je le dis souvent, ça s’inaugure. *(réplique fictive)* | emphase | lore |
| `invite.boss.03` | Intro (après le soupir du héros) | Je vois que l’émotion vous gagne. Page deux. *(réplique fictive)* | bonhomie | lore |
| `invite.boss.04` **écoute** | Phase 1 « Le Discours inaugural » | Je serai bref. *(réplique fictive)* | promesse (qu’il ne tiendra pas) | jeu |
| `invite.boss.05` | Phase 1 | Permettez-moi une parenthèse. Elle durera le temps qu’il faudra. *(réplique fictive)* | ample | jeu |
| `invite.boss.06` | Onde de discours (télégraphe parlé) | Et j’ajouterai… *(réplique fictive)* | relance oratoire | jeu |
| `invite.boss.07` | Phase 2 « La Première Pierre » | Cette pierre est la première d’une longue série. *(réplique fictive)* | solennel | lore |
| `invite.boss.08` | Phase 2 | Les travaux commenceront… bientôt. C’est un engagement. *(réplique fictive)* | solennel | lore |
| `invite.boss.09` | Phase 3 « Le Ruban » | Un ruban, c’est une promesse. Celle-là, je la coupe. *(réplique fictive)* | ferme | lore |
| `invite.boss.10` | Phase 3 | Mons mérite mieux ! *(réplique fictive)* | sincère, élan | lore |
| `invite.boss.11` | Rappel au Règlement | Une concertation ? Excellente idée. Je note… je note. *(réplique fictive)* | pris de court, aimable | jeu |
| `invite.boss.12` | Défaite (lecture de la plaque) | [long pause] … On m’avait parlé d’une inauguration. *(réplique fictive)* | surpris, digne | jeu |
| `invite.boss.13` | Défaite | Je n’inaugure pas une vente à la découpe. *(réplique fictive)* | digne, ferme | jeu |
| `invite.boss.14` | Défaite (sortie) | Il doit bien y avoir, quelque part dans cette ville, quelque chose qui ouvre. *(réplique fictive)* | nostalgie, sortie digne | lore |
| `invite.boss.15` | Victoire sur le joueur | Je déclare ce Shift… clos. Applaudissez, applaudissez. Et rendez-vous à la prochaine inauguration. *(réplique fictive)* | protocolaire | lore |
| `invite.boss.16` | Défaites suivantes (2e) | Encore vous ? Je n’avais prévu qu’un seul ruban. *(réplique fictive)* | surpris | lore |
| `invite.boss.17` | Défaites suivantes (3e) | J’ai raccourci le discours. Trente-neuf pages. *(réplique fictive)* | fier | lore |
| `invite.boss.18` | Défaites suivantes (4e) | Vous savez, à Mons, on inaugure même les reports. *(réplique fictive)* | malicieux | lore |
| `invite.boss.19` | Bark, la claque applaudit | Merci, merci… gardez-en pour la fin. *(réplique fictive)* | bonhomie | nouveau |
| `invite.boss.20` | Bark, coup des ciseaux | Je coupe ! *(réplique fictive)* | élan | nouveau |
#### Le Discosaure (mini-boss, biome 3)
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : dinosaure de l’afterwork · **Timbre** : basse ronde, grasse · **Accent** : animateur de soirée d’entreprise · **Débit** : scandé, sur le tempo · **Émotion** : euphorie de séminaire, puis désarroi quand la musique s’arrête
- **Direction** : Voix humaine passée en post dans un léger pitch −3 demi-tons + chorus (micro de DJ).
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 50 years old, corporate afterwork party host. Native French speaker. Big, round, greasy bass voice, rhythmic hype-man delivery locked to a beat, cheesy seventies disco energy. Studio recording, clean. »
- **Texte d’aperçu** : « On a toujours fait comme ça. Et ça a toujours marché. Pour nous. Restructurez avec moi ! Un, deux, un, deux ! Tout le monde sur la piste, la réorganisation, c’est maintenant ! … La musique… s’est arrêtée ? »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `discosaure.boss.01` | Intro (salle gardée) | On a toujours fait comme ça. Et ça a toujours marché. Pour nous. | animateur gras | jeu |
| `discosaure.boss.02` | Phase 2 | Restructurez avec moi ! Un, deux, un, deux ! | scandé sur le tempo | jeu |
| `discosaure.boss.03` | Défaite | … La musique… s’est arrêtée ? | désarroi | jeu |
| `discosaure.boss.04` | Bark, piétinement | Sur le temps ! | scandé | nouveau |
#### Jean-Cul Lurcke (boss final) — voix clé
- **État** : **arrêtée** : voix de bibliothèque (`voice_id` `MAZdzkb78f8SA7DNBT41`, « Nico (bibliothèque ElevenLabs, fr-parisien) ») ; le prompt Voice Design ci-dessous reste la référence de jeu, il n’est pas à produire.
- **Âge** : 41 ans · **Timbre** : baryton léger de keynote, trop placé · **Accent** : français parisien (voix de bibliothèque « Nico »), franglais de direction · **Débit** : rapide, ne laisse jamais de silence (il en a peur) · **Émotion** : assurance de conférence, nervosité dessous ; se brise au coup final
- **Direction** : N’a jamais pris le train. Parle tout le temps. Le « … Concrètement ? » final est la seule vraie pause de sa vie : laisser le silence exister.
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 41 years old, corporate transformation director giving a keynote. Native French speaker, neutral accent, lots of corporate English jargon. Polished, over-projected light baritone; fast, confident salesman delivery that never leaves a silence, with nervous energy underneath that can crack. Studio recording, clean. »
- **Texte d’aperçu** : « Ah. L’équipe terrain. Entrez. Un café ? La machine fait quarante-sept recettes. Personne ne sait l’allumer. Arrêter ? On ne fait que libérer le marché. Je lance la présentation. Quatre cent douze slides. Il n’y a pas de pause prévue. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `lurcke.boss.01` **écoute** | Intro (premier combat) | Ah. L’équipe terrain. Entrez. Un café ? La machine fait quarante-sept recettes. Personne ne sait l’allumer. | keynote | lore |
| `lurcke.boss.02` | Intro (suite) | Arrêter ? On ne fait que libérer le marché. Et pour un sept heures douze qui transporte quatorze personnes ? Quatorze ! Ce n’est même pas un chiffre significatif. | condescendant | lore |
| `lurcke.boss.03` | Intro (fin) | Pas dans le tableur. Je lance la présentation. Quatre cent douze slides. Il n’y a pas de pause prévue. | assuré | lore |
| `lurcke.boss.04` | Réplique à Fatou | C’est agile. | sûr de lui | lore |
| `lurcke.boss.05` **validée** | Bark, le héros entre dans le bureau (réplique de référence validée) | [smiling] Léon, Léon, Léon… Je ne libéralise pas un réseau avec un incident voyageur en cours, ça fait mauvais genre dans le reporting. [chuckles] Posez cette clé, on va faire un petit atelier. | souriant, rassurant de pub, condescendant | nouveau |
| `lurcke.boss.06` | Intro alternative 1 | Encore vous ? J’ai pourtant envoyé un Sondage. | agacé | lore |
| `lurcke.boss.07` | Intro alternative 2 | Cette fois, j’ai prévu une pause. Pour moi. | fier | lore |
| `lurcke.boss.08` | Intro alternative 3 | J’ai benchmarké votre clé. Au Japon, ils utilisent des tablettes. | pédant | lore |
| `lurcke.boss.09` | Intro alternative 4 (après 5 victoires) | [hoarse] Je n’ai plus de slides. J’ai fait les quatre cent douze. Il ne reste que moi. | voix cassée | lore |
| `lurcke.boss.10` | Phase 1 « Méga-Deck 2032 » | Slide un sur quatre cent douze. Restez concentrés, c’est la plus courte. | keynote | lore |
| `lurcke.boss.11` | Phase 1 | Benchmark international ! Au Japon, ça marche ! | enthousiaste | lore |
| `lurcke.boss.12` **écoute** | Phase 1 (copie) | Je vous mets en copie. Et vous. Et vous. | satisfait | jeu |
| `lurcke.boss.13` | Phase 1 | Slide trois cents : le réseau, en lots. C’est plus lisible, non ? | vendeur | lore |
| `lurcke.boss.14` | Phase 2 « Conseil en visio » | Mesdames et messieurs du Conseil, vous m’entendez ? [beat] … Vous êtes en mute. | gêne | jeu |
| `lurcke.boss.15` | Phase 2 | Article premier : le personnel est un actif variable. Article deux : l’article premier n’est pas négociable ! | emballé | lore |
| `lurcke.boss.16` | Preuve activée | [stunned] Slide quarante-sept : ce n’est pas la mienne… | étourdi | lore |
| `lurcke.boss.17` | Phase 3 « L’Optimiseur Absolu » | Si je ne peux pas vous convaincre, je vais vous dupliquer. | menace | lore |
| `lurcke.boss.18` | Phase 3 | Recto. Verso. Recto. Verso. Sans pause. | mécanique | lore |
| `lurcke.boss.19` | Phase 3 | [shouting] Le seul train rentable, c’est celui qui ne part pas ! | délire | lore |
| `lurcke.boss.20` | Coup final | [long silence] … Concrètement ? Concrètement… [long pause] je n’ai pas de slide pour ça. | effondrement, laisser le silence | jeu |
| `lurcke.boss.21` | Défaite (fin mitigée) | Bon. Soyons adultes. Une phase pilote. Une seule ligne. | négocie, à genoux | jeu |
| `lurcke.boss.22` | Défaite (vraie fin) | [quietly] Mon oreillette… n’a plus de réseau. | perdu | lore |
| `lurcke.boss.23` | Victoire sur le joueur | Le planning est validé. Le diaporama est validé. Même le traiteur est validé ! | triomphe | lore |
| `lurcke.boss.24` | Victoire sur le joueur (stylo levé) | … Ah. On me signale un conflit d’agenda. On reprogramme. | déconfit | lore |
| `lurcke.boss.25` | Jauge de signature pleine | Félicitations, le marché est ouvert. Votre poste aussi. Votre badge vous sera envoyé par Sondage. | cynique jovial | lore |
#### Hubert Rentabilis (PDG, visio, jamais combattu)
- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.
- **Âge** : 60 ans · **Timbre** : basse feutrée · **Accent** : neutre, très posé · **Débit** : lent, chaque mot pèse · **Émotion** : calme absolu ; il évalue
- **Direction** : Caméra éteinte : traitement « visio » en post (bande passante réduite, légère compression).
- **Prompt Voice Design** (`eleven_ttv_v3`) : « Man, 60 years old, chief executive heard only through a video call. Native French speaker, neutral accent. Low, soft, velvety bass voice, very slow and calm, every word weighed; quietly menacing politeness of someone who has never waited for a train. Studio recording, clean. »
- **Texte d’aperçu** : « Jean-Cul, on vous entend mal. On vous voit mal. On vous évalue bien. Proposez-leur une phase pilote. Les gens adorent les pilotes. Nous allons créer une commission. Elle réfléchira à pourquoi vous échouez. »

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `hubert.boss.01` | Phase 2 de Lurcke | Jean-Cul, on vous entend mal. On vous voit mal. On vous évalue bien. | calme menaçant | lore |
| `hubert.boss.02` | Reprogrammation 1 | … Bon. On reprogramme. Envoyez un Sondage. | las | lore |
| `hubert.boss.03` | Reprogrammation 2 | Jean-Cul, je vous rappelle que votre prime est indexée sur ce contrat. Pas sur votre dignité. | froid | lore |
| `hubert.boss.04` | Reprogrammation 3 | Proposez-leur une phase pilote. Les gens adorent les pilotes. | détaché | lore |
| `hubert.boss.05` | Reprogrammation 4 | Nous allons créer une commission. Elle réfléchira à pourquoi vous échouez. | glacial | lore |
| `hubert.boss.06` | Reprogrammation 5 | Je commence à trouver ce dossier… peu scalable. | menace | lore |
| `hubert.boss.07` | Reprogrammation 6 | La prochaine date est définitive. | sentence | lore |
| `hubert.boss.08` | Vraie fin | Bon. Signez sans lui. | tranchant | lore |
| `hubert.boss.09` | Vraie fin (déconnexion) | … On en reparlera au prochain plan stratégique. | retraite polie | lore |
#### Voix off du trailer (option B, à valider)
- **Âge** : — · **Timbre** : reprend la voix de Yasmina (radio), diégétique · **Accent** : belge francophone neutre · **Débit** : calme, trois phrases · **Émotion** : complicité
- **Direction** : Proposition : pas de voix off « bande-annonce » ; trois phrases de Yasmina à la radio, comme si elle briefait le joueur. Utilise la voix `yasmina`.
- **Voix** : reprend `yasmina`.

| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |
|---|---|---|---|---|
| `yasmina.trailer.01` | Trailer 0:01 (sous C1, option B) | OCC à tous les agents. Six heures. Le rail est à vendre. | radio, posé | nouveau, radio |
| `yasmina.trailer.02` | Trailer 0:09 (sous C2, option B) | Ils ont un plan. [beat] On a un café. | radio, complice | nouveau, radio |
| `yasmina.trailer.03` | Trailer 0:49 (sous C6, option B) | Shift tenu. [softly] Un train, ça se fait à plusieurs. | radio, tendresse | nouveau, radio |
<!-- /AUTO:voices -->

---

## 6. Ambiances

Boucles de 30 s (`loop: true`, sans raccord audible) sur le bus `ambience`, à −30 LUFS, en couche **sous** le lit synthétique actuel (bourdon de quai, néon) que l'on garde : il porte la tonalité de la musique. Les ponctuels remplacent ou doublent les événements aléatoires de `music.ts` (`ambientEvents`, `hubEvents`).

<!-- AUTO:ambiances -->

| Réf. | Lieu | Prompt (EN) | Durée | Prises |
|---|---|---|---|---|
| `amb.quai-nuit` | Quai de nuit (biome 1, roulement Nuit) | Empty railway platform at night, low electrical hum of sodium lamps, buzzing neon tube, distant train rumble, faint gravel ballast and dripping water, light wind, no voices, seamless loop | 30 s, boucle | 2 |
| `amb.quai-matin` | Quai au matin (brouillard, drones) | Foggy railway platform at dawn, cold air, distant commuter murmurs without words, far drone propellers, birds, seamless loop | 30 s, boucle | 1 |
| `amb.hall` | Hall historique (biome 3, RDC) | Large historic train station hall, big reverberant space, distant footsteps, wooden benches creaking, muffled departures board clicks, no intelligible voices, seamless loop | 30 s, boucle | 2 |
| `amb.passerelle` | Passerelle en hauteur (biome 2) | High glass and steel footbridge above railway tracks at dawn, strong whistling wind, cables creaking, trains passing far below, pigeons cooing, seamless loop | 30 s, boucle | 2 |
| `amb.cour-bag` | Cour intérieure du BAG (hub, extérieur) | Inner courtyard of an office building at night, distant city traffic, ventilation units humming, a pigeon, rain drips from gutters, seamless loop | 30 s, boucle | 1 |
| `amb.occ` | Salle des opérations (OCC) : radio, cafetière | Small cozy railway operations control room at night, quiet radio chatter with unintelligible words, old coffee machine gurgling and hissing, computer fans, clock ticking, seamless loop | 30 s, boucle | 2 |
| `amb.poubelles` | Coin poubelles (antre du Furet) | Back alley trash corner at night, buzzing flies, plastic bags rustling in the wind, dripping pipe, distant rat squeaks, seamless loop | 30 s, boucle | 1 |
| `amb.open-space` | Open-space du BAG (biome 3, étages) | Empty corporate open-plan office at night, air conditioning hum, printer warming up, fluorescent lights buzzing, elevator ding far away, seamless loop | 30 s, boucle | 1 |
| `amb.salle-conseil` | Salle du Conseil (arène finale) | Large boardroom, deep ventilation drone, video conference speaker hiss, giant photocopier idling, tense, seamless loop | 30 s, boucle | 1 |

**Ponctuels d’ambiance** (déclenchés au hasard, comme `ambientEvents` et `hubEvents` de `music.ts`) :

| Réf. | Son | Prompt (EN) | Durée | Prises |
|---|---|---|---|---|
| `amb1.cafetiere` | La Vieille Dame (cafetière de 1987) gargouille | Old 1980s filter coffee machine gurgling and bubbling then hissing steam | 4 s | 3 |
| `amb1.radio` | Radio de bureau qui crachote | Office two-way radio squelch and short static crackle, no words | 1.5 s | 3 |
| `amb1.rame-lointaine` | Rame qui passe au loin | Distant freight train passing far away, low rumble and rail joint clacks fading | 8 s | 2 |
| `amb1.clac-rail` | Joint de rail « clac-clac » | Two pairs of distant train wheel clacks over a rail joint | 1.5 s | 2 |
| `amb1.pigeon` | Matricule 4412 (pigeon) | Single pigeon cooing and fluttering wings | 2 s | 2 |
| `amb1.neon` | Néon qui grésille | Fluorescent neon tube flickering and buzzing briefly | 1.5 s | 3 |
| `amb1.escalator` | Escalator qui redémarre (un jour sur trois) | Old escalator motor starting with a groan and steady mechanical rattle | 4 s | 1 |

<!-- /AUTO:ambiances -->

---

## 7. Trailer « Le Shift » (60 s)

La bande-son actuelle (`tools/trailer/audio.mjs`) est entièrement synthétisée par le moteur du jeu et respecte déjà la courbe du script (§ 5.1), le silence de 40,4 à 41,4 s et le mastering (−14 LUFS, −1 dBTP). ElevenLabs sert à **l'orchestrer** : on garde sa chronologie (`cues.json`) et on remplace la musique et les effets clés.

**Voix off** : le script dit « pas de voix off ». Je propose deux options au porteur du projet :

- **Option A (script actuel)** : aucune voix ; la radio reste un grésillement sans mots.
- **Option B (recommandée si le trailer tourne sans le son des cartons)** : trois phrases **diégétiques** de Yasmina à la radio, sous les cartons, avec le filtre radio. Elles doublent le texte à l'écran sans le répéter mot pour mot et gardent le ton de la radio du jeu :
  - 0:01, sous C1 : « OCC à tous les agents. Six heures. Le rail est à vendre. »
  - 0:09, sous C2 : « Ils ont un plan. *[temps]* On a un café. »
  - 0:49, sous C6 : « Shift tenu. *[doucement]* Un train, ça se fait à plusieurs. »

  Coût : environ 150 caractères. Rien sur l'Invité d'honneur (aucune voix ne lui prête de propos dans le trailer) ni sur Lurcke (ses sous-titres natifs suffisent).

<!-- AUTO:trailer -->

**Musique 60 s** (`trailer.musique-60s`, plan de composition `music_v2`, 3 prises) :

| TC | Section | Styles (EN) |
|---|---|---|
| 0:00–0:08 | [Prise de poste] | cozy lo-fi jazz, Rhodes electric piano, filtered office radio melody, 74 BPM, F major 7th chords, warm, quiet ; sans : drums, vocals |
| 0:08–0:20 | [Premier train supprimé] {railway whistle at start} | D minor, 100 BPM, deep drone, pulsing synth bass, kick drum enters at 4 seconds, hi-hats enter at 8 seconds, building tension toward a drop ; sans : vocals |
| 0:20–0:34 | [Le drop] | D minor, 104 BPM, full energetic combat groove, marching snare, neon synth arpeggio, brass riff, last 4 seconds four-on-the-floor disco kick at 110 BPM ; sans : vocals |
| 0:34–0:41.4 | [Boss final] {abrupt stop at the end} | E-flat phrygian, 112 to 120 BPM accelerating, heavy low brass on downbeats, timpani, climax, ends with an abrupt hard stop ; sans : vocals, fade out |
| 0:41.4–0:45 | [Après le coup] | low D drone only, reverb tail, calm after impact ; sans : drums, vocals, melody |
| 0:45–0:55 | [Fin de service] | slow Rhodes electric piano, 60 BPM, F major 7 resolving to D major at 4 seconds, tender, relieved ; sans : drums, vocals |
| 0:55–1:00 | [Carte de fin] {short brass fanfare at 2 seconds} | D major, short warm municipal brass band fanfare, held final chord, clean ending ; sans : vocals, long fade |

**Effets propres au trailer** :

| Réf. | TC | Intention | Prompt (EN) | Durée | Prises |
|---|---|---|---|---|---|
| `trailer.larsen` | 0:25.6 | Larsen de micro (intro de l’Invité d’honneur) | Short microphone feedback squeal on a ceremony PA system, quickly controlled, not painful | 1.2 s | 3 |
| `trailer.impact-final` | 0:41.4 | Impact final, le son le plus fort du film (après 1 s de silence) | Massive cinematic impact: heavy iron wrench hit on steel with a deep sub boom and a long metallic reverb tail | 3 s | 4 |
| `trailer.riser` | 0:17.6 | Montée vers le drop | Short tension riser, rising filtered noise and synth swell, ends abruptly | 2.4 s | 2 |
| `trailer.subdrop` | 0:20.0 | Sub drop sous le drop de Patrimoine | Deep cinematic sub bass drop, clean | 1.5 s | 2 |
| `trailer.neon` | 0:55.0 | Néon PRIVATIX qui s’allume (3 coupures) | Neon sign flickering on with three electric buzzes then a steady hum | 1.2 s | 3 |
| `trailer.boule-cassee` | 0:33.6 | Boule à facettes cassée, la salle s’éteint | Mirror ball shattering softly followed by a power-down whoom and darkness | 1.5 s | 3 |

**Effets du jeu à régénérer en priorité pour le trailer** : `whistle`, `slam`, `perfectDash`, `lastKill`, `loot4`, `ribbonSnip`, `discoShimmer`, `bossPhase`, `preavis`, `chime`, `fanfare`, `coffeeSip`, `hitBoss`, `crit`.

<!-- /AUTO:trailer -->

---

## 8. Production avec ElevenLabs

### 8.1 Endpoints et modèles (vérifiés le 9 octobre 2026)

Vérification faite sur la documentation officielle (`https://elevenlabs.io/docs/api-reference/…`, versions `.md`) et la page de tarifs de l'API. Base : `https://api.elevenlabs.io`, en-tête `xi-api-key`.

| Usage | Endpoint | Modèle(s) | Paramètres utilisés |
|---|---|---|---|
| Voice Design | `POST /v1/text-to-voice/design` (3 aperçus en base64) puis `POST /v1/text-to-voice` (enregistre l'aperçu choisi, rend un `voice_id`) | `eleven_ttv_v3` (ou `eleven_multilingual_ttv_v2`) | `voice_description`, `text` (100 à 1 000 caractères), `loudness`, `guidance_scale`, `seed` |
| Text to Speech | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` | `eleven_v3` (défaut ici), `eleven_v4`, `eleven_multilingual_v2` | `text`, `model_id`, `language_code`, `voice_settings` (`stability`, `similarity_boost`, `style`, `use_speaker_boost`, `speed`), `seed` |
| Sound Effects | `POST /v1/sound-generation` | `eleven_text_to_sound_v2` | `text`, `duration_seconds` (0,5 à 30), `prompt_influence` (0 à 1), `loop` |
| Music | `POST /v1/music` | `music_v2` (défaut ici), `music_v1` (défaut de l'API pendant la transition), `music_v2_5` | `prompt` + `music_length_ms` (3 s à 10 min) + `force_instrumental`, **ou** `composition_plan` (v2 : `chunks` avec `text`, `duration_ms`, `positive_styles`, `negative_styles` ; v1 : `sections`) |
| Stems | `POST /v1/music/stem-separation` (multipart, réponse ZIP) | — | `file` |

**Hypothèses documentées** : (1) si `music_v2` refuse un `composition_plan`, `generate.mjs` réessaie avec le repli `music_v1` + prompt simple de 60 s (champ `fallback` du manifeste) ; (2) les noms de fichiers du ZIP de stems ne sont pas documentés : le script les extrait tels quels, le rangement dans les 4 couches se fait à l'écoute ; (3) le coût de Voice Design n'est pas publié : estimé comme le texte d'aperçu.

### 8.2 Volume et coût

<!-- AUTO:counts -->

| Type | Assets | dont lot d’écoute |
|---|---|---|
| voice-design | 19 | 10 |
| tts | 216 | 20 |
| sfx | 97 | 4 |
| music | 17 | 2 |
| stem-split | 7 | 0 |
| **Total** | **356** | **36** |

<!-- /AUTO:counts -->

Estimation (`node tools/elevenlabs/generate.mjs --dry-run`, tarifs « pay as you go » de l'API relevés le 9 octobre 2026, hors promotions : TTS 0,08 $ / 1 000 caractères, effets 0,12 $ / min, musique 0,15 $ / min ; crédits : 1 par caractère, 40 par seconde d'effet ; Voice Design non publié, estimé comme ses textes d'aperçu) :

| Lot | Appels | TTS | Voice Design | Bruitages | Musique | Crédits (hors musique) | Coût estimé |
|---|---|---|---|---|---|---|---|
| **Lot d'écoute** (`--samples`, tel que défini) | 40 | 1 401 car. (20 répliques, 1 prise) | 10 voix, 6 714 car. | 12,4 s (4 sons × 2 prises) | 40 s (2 × 20 s) | ≈ 8 600 | ≈ 0,80 $ |
| **Lot d'écoute faisable aujourd'hui** (4 voix arrêtées) | 24 | 474 car. (8 répliques) | aperçus seuls (6 voix) | 12,4 s | 40 s | ≈ 4 900 | ≈ 0,50 $ |
| **Production possible avec les 4 voix arrêtées** | 477 | 8 947 car. (82 répliques, 169 prises) | aperçus des 15 autres voix (facultatif, 9 696 car.) | 646 s (93 sons et ambiances, hors 4 validés) | 49,4 min (14 morceaux × 2 prises + trailer × 3) + 7 séparations | ≈ 34 800 (≈ 44 500 avec les aperçus) | ≈ 10,20 $ + stems |
| **Production complète** (toutes les voix conçues) | 760 | 24 870 car. (215 répliques) | 19 voix, 12 507 car. | 646 s | 49,4 min | ≈ 63 200 | ≈ 11,70 $ + stems |

Le budget réel dépend surtout de l'**offre** : la production complète demande 15 voix personnalisées de plus (le workspace est à 3/3 ; offre Creator ou supérieure, ou voix de bibliothèque) et la licence commerciale de la musique demande au moins l'offre Starter. Les rejets à l'écoute (prises supplémentaires) sont à prévoir : compter **×2** sur les dialogues et la musique.

### 8.3 Ordre de production et validations

0. **État au 9 octobre 2026** : 4 voix arrêtées (§ 1.4), 4 bruitages validés (§ 4), une réplique de Lurcke validée. La clé d'API arrive dans une prochaine session. **Rien n'est produit en lot avant la validation finale des listes de répliques et des prompts par le porteur du projet.**
1. **Lot d'écoute** (`--samples`) : 10 voix clés (Voice Design, 3 aperçus chacune), 2 répliques par voix clé, 4 bruitages (2 prises), 2 extraits musicaux de 20 s. → **Validation du porteur du projet** : choix des aperçus de voix (`--pick marcel=2`, puis `--create-voices` quand un emplacement est libre), direction musicale, grain des bruitages.
2. **Voix secondaires** et toutes les répliques (2 prises) → sélection des prises.
3. **Bruitages** par famille (combat d'abord : c'est le pilier « chaque coup se sent ») → écoute en jeu avec le chargeur.
4. **OST** : thèmes de combat (mix + stems) et hub, puis boss, puis titre, résultats, générique.
5. **Ambiances**, puis **trailer** (musique 60 s en 3 prises, effets, voix off si l'option B est retenue).
6. Mise à jour de `CREDITS.md` (sons générés avec ElevenLabs, licence commerciale de l'offre utilisée) et de `ARCHITECTURE.md` § 15.9.

---

## 9. Lot témoin (sans clé d'API)

En attendant la clé, `node tools/elevenlabs/temoins.mjs <dossier>` rend avec **le moteur du jeu** (synthèse Web Audio, `src/audio/offline.ts`) deux extraits musicaux de 20 s réglés selon les fiches OST (hub OCC de jour ; Quais & Voies combat qui ouvre ses 4 couches toutes les 5 s) et les 4 bruitages du lot d'écoute, en OGG. Ce sont des **témoins synthétiques** de la direction (tempos, tonalités, courbe d'intensité, motifs), **pas** des rendus ElevenLabs.
