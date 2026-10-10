# OST complète — Lyria

Générée le 2026-10-10 avec **Lyria** (Google, API Gemini, endpoint `interactions`) via
`node tools/elevenlabs/generate.mjs --type music --music-backend lyria`. Prompts et plans de composition :
`tools/elevenlabs/manifest.json`. Les extraits du lot d'écoute restent dans `docs/audio/samples/`.

- 14 morceaux × 2 prises + musique du trailer × 3 = **31 fichiers**, **50 min 04 s** au total, 54 Mo.
- Format : OGG Vorbis q5, normalisé à −16 LUFS (post-production de `generate.mjs`).
- Modèles : `lyria-3.5` (durée guidée par le prompt) ; `lyria-3-clip-preview` (30 s fixes) pour le
  morceau ≤ 30 s (`ost.13`). Pas de seed : résultats non déterministes, les prises diffèrent.
- **Coût estimé ≈ 2,40 $** (29 × 0,08 $ + 2 × 0,04 $). Une requête (`ost.03-occ-nuit`, prise 1) a d'abord
  été refusée par le filtre (`content_blocked`, « Request blocked for an unspecified policy reason ») ;
  relancée telle quelle, sans modification du prompt, elle est passée.
- Toutes les sorties portent le filigrane inaudible **SynthID**.
- Les durées obtenues s'écartent parfois de la cible du manifeste (± 15 s) : à vérifier pour les boucles.

| Asset | Titre | Usage | Prise | Durée | Modèle |
|---|---|---|---|---|---|
| `ost.01-prise-de-poste` | Prise de poste (thème titre) | Écran titre, menu principal | [t1](ost-01-prise-de-poste_t1.ogg) | 105,9 s | `lyria-3.5` |
| `ost.01-prise-de-poste` | Prise de poste (thème titre) | Écran titre, menu principal | [t2](ost-01-prise-de-poste_t2.ogg) | 94,2 s | `lyria-3.5` |
| `ost.02-occ-jour` | OCC — Service de jour | Hub (Centre Opérationnel), roulements Matin et Après-midi | [t1](ost-02-occ-jour_t1.ogg) | 122,9 s | `lyria-3.5` |
| `ost.02-occ-jour` | OCC — Service de jour | Hub (Centre Opérationnel), roulements Matin et Après-midi | [t2](ost-02-occ-jour_t2.ogg) | 121,3 s | `lyria-3.5` |
| `ost.03-occ-nuit` | OCC — Service de nuit | Hub, roulement Nuit | [t1](ost-03-occ-nuit_t1.ogg) | 117,5 s | `lyria-3.5` |
| `ost.03-occ-nuit` | OCC — Service de nuit | Hub, roulement Nuit | [t2](ost-03-occ-nuit_t2.ogg) | 117,5 s | `lyria-3.5` |
| `ost.04-quais-exploration` | Quais & Voies — Exploration | Biome 1, salles sans ennemis, Salle des pauses | [t1](ost-04-quais-exploration_t1.ogg) | 118,4 s | `lyria-3.5` |
| `ost.04-quais-exploration` | Quais & Voies — Exploration | Biome 1, salles sans ennemis, Salle des pauses | [t2](ost-04-quais-exploration_t2.ogg) | 115,6 s | `lyria-3.5` |
| `ost.05-quais-combat` | Quais & Voies — Combat (4 couches) | Biome 1, combat ; couches pilotées par combatIntensity() | [t1](ost-05-quais-combat_t1.ogg) | 114,5 s | `lyria-3.5` |
| `ost.05-quais-combat` | Quais & Voies — Combat (4 couches) | Biome 1, combat ; couches pilotées par combatIntensity() | [t2](ost-05-quais-combat_t2.ogg) | 97,1 s | `lyria-3.5` |
| `ost.06-passerelle` | La Passerelle — Le vent tourne (exploration + 4 couches) | Biome 2 (aube, vide, vent) ; exploration = S1 seul | [t1](ost-06-passerelle_t1.ogg) | 88,7 s | `lyria-3.5` |
| `ost.06-passerelle` | La Passerelle — Le vent tourne (exploration + 4 couches) | Biome 2 (aube, vide, vent) ; exploration = S1 seul | [t2](ost-06-passerelle_t2.ogg) | 100,5 s | `lyria-3.5` |
| `ost.07-hall-bag` | Hall & BAG — Terminus BAG (4 couches) | Biome 3 ; la musique d’ascenseur se déforme à chaque vague | [t1](ost-07-hall-bag_t1.ogg) | 98,6 s | `lyria-3.5` |
| `ost.07-hall-bag` | Hall & BAG — Terminus BAG (4 couches) | Biome 3 ; la musique d’ascenseur se déforme à chaque vague | [t2](ost-07-hall-bag_t2.ogg) | 94,6 s | `lyria-3.5` |
| `ost.08-boss-auditeur` | Boss — L’Auditeur des Quais | Boss 1, 3 phases (+4 BPM par phase en jeu) | [t1](ost-08-boss-auditeur_t1.ogg) | 91,7 s | `lyria-3.5` |
| `ost.08-boss-auditeur` | Boss — L’Auditeur des Quais | Boss 1, 3 phases (+4 BPM par phase en jeu) | [t2](ost-08-boss-auditeur_t2.ogg) | 83,6 s | `lyria-3.5` |
| `ost.09-boss-invite` | Boss — Duel oratoire (L’Invité d’honneur) | Boss 2, phases « Le Discours inaugural », « La Première Pierre », « Le Ruban » | [t1](ost-09-boss-invite_t1.ogg) | 92,1 s | `lyria-3.5` |
| `ost.09-boss-invite` | Boss — Duel oratoire (L’Invité d’honneur) | Boss 2, phases « Le Discours inaugural », « La Première Pierre », « Le Ruban » | [t2](ost-09-boss-invite_t2.ogg) | 81,4 s | `lyria-3.5` |
| `ost.10-boss-discosaure` | Boss — Discosaure (Afterwork) | Mini-boss du biome 3 ; les piétinements tombent sur la grosse caisse | [t1](ost-10-boss-discosaure_t1.ogg) | 91,9 s | `lyria-3.5` |
| `ost.10-boss-discosaure` | Boss — Discosaure (Afterwork) | Mini-boss du biome 3 ; les piétinements tombent sur la grosse caisse | [t2](ost-10-boss-discosaure_t2.ogg) | 94,7 s | `lyria-3.5` |
| `ost.11-boss-lurcke` | Boss final — Jean-Cul Lurcke « Méga-Deck 2032 » | Boss final, 3 phases ; silence total au coup final (géré par le jeu) | [t1](ost-11-boss-lurcke_t1.ogg) | 119,9 s | `lyria-3.5` |
| `ost.11-boss-lurcke` | Boss final — Jean-Cul Lurcke « Méga-Deck 2032 » | Boss final, 3 phases ; silence total au coup final (géré par le jeu) | [t2](ost-11-boss-lurcke_t2.ogg) | 121,1 s | `lyria-3.5` |
| `ost.12-departs-victoire` | Écran des départs — Shift tenu | Résultats, victoire (stinger 6 s puis boucle) | [t1](ost-12-departs-victoire_t1.ogg) | 62,8 s | `lyria-3.5` |
| `ost.12-departs-victoire` | Écran des départs — Shift tenu | Résultats, victoire (stinger 6 s puis boucle) | [t2](ost-12-departs-victoire_t2.ogg) | 61,3 s | `lyria-3.5` |
| `ost.13-departs-supprime` | Écran des départs — Supprimé | Résultats, défaite (tendre, jamais moqueur) | [t1](ost-13-departs-supprime_t1.ogg) | 26,9 s | `lyria-3-clip-preview` |
| `ost.13-departs-supprime` | Écran des départs — Supprimé | Résultats, défaite (tendre, jamais moqueur) | [t2](ost-13-departs-supprime_t2.ogg) | 29,4 s | `lyria-3-clip-preview` |
| `ost.14-le-7h12` | Le 7h12 (générique) | Générique de fin, épilogue quai 2 | [t1](ost-14-le-7h12_t1.ogg) | 180,1 s | `lyria-3.5` |
| `ost.14-le-7h12` | Le 7h12 (générique) | Générique de fin, épilogue quai 2 | [t2](ost-14-le-7h12_t2.ogg) | 179,1 s | `lyria-3.5` |
| `trailer.musique-60s` | Trailer « Le Shift » — musique 60 s |  | [t1](trailer-musique-60s_t1.ogg) | 61,9 s | `lyria-3.5` |
| `trailer.musique-60s` | Trailer « Le Shift » — musique 60 s |  | [t2](trailer-musique-60s_t2.ogg) | 60,0 s | `lyria-3.5` |
| `trailer.musique-60s` | Trailer « Le Shift » — musique 60 s |  | [t3](trailer-musique-60s_t3.ogg) | 58,7 s | `lyria-3.5` |

## Choix des prises

Validé par le porteur du projet le 2026-10-10 : prise 1 pour chaque morceau (les prises 2 et 3 restent ici comme alternatives).

| Asset | Prise retenue | Remarques |
|---|---|---|
| `ost.01-prise-de-poste` | t1 | Prise de poste (thème titre) |
| `ost.02-occ-jour` | t1 | OCC — Service de jour |
| `ost.03-occ-nuit` | t1 | OCC — Service de nuit |
| `ost.04-quais-exploration` | t1 | Quais & Voies — Exploration |
| `ost.05-quais-combat` | t1 | Quais & Voies — Combat |
| `ost.06-passerelle` | t1 | La Passerelle |
| `ost.07-hall-bag` | t1 | Hall & BAG |
| `ost.08-boss-auditeur` | t1 | Boss — L’Auditeur |
| `ost.09-boss-invite` | t1 | Boss — L’Invité d’honneur |
| `ost.10-boss-discosaure` | t1 | Boss — Discosaure |
| `ost.11-boss-lurcke` | t1 | Boss final — Lurcke |
| `ost.12-departs-victoire` | t1 | Départs — Shift tenu |
| `ost.13-departs-supprime` | t1 | Départs — Supprimé |
| `ost.14-le-7h12` | t1 | Le 7h12 (générique) |
| `trailer.musique-60s` | t1 | Trailer « Le Shift » |

## Trailer v2 (musique pure)

Généré le 2026-10-10 avec `node tools/trailer/lyria-music.mjs --takes 3` (modèle **`lyria-3.5`**, endpoint
`interactions`, 3 appels indépendants, pas de seed). Demande du porteur du projet : **musique seule**, sans
bruitage, sifflet, train, annonce, voix ni foley (la v1 `trailer-musique-60s_t*` en contenait, son plan les
demandait). Post-production : OGG Vorbis q5, 48 kHz, gain linéaire vers −14 LUFS + limiteur suréchantillonné,
crête vraie ≤ −1 dBTP. **Coût estimé ≈ 0,24 $** (3 × 0,08 $). Filigrane SynthID inaudible.

Prompt exact :

```text
Instrumental video-game trailer score, exactly 60 seconds, one continuous cinematic piece. Style: neon synthwave meets Belgian brass band and lo-fi jazz, playful but epic.
[0:00 - 0:08] Calm intro: warm Rhodes electric piano, F major 7th chords, 74 BPM, soft brushed drums, cozy night-shift mood.
[0:08 - 0:20] Build-up: switch to D minor, 100 BPM, pulsing analog synth bass, kick drum enters around 0:12, hi-hats around 0:16, rising tension toward a drop.
[0:20 - 0:34] Drop: full energetic combat groove in D minor at 104 BPM, marching snare, driving synth bass, bright neon synth arpeggio, punchy brass riff.
[0:34 - 0:41] Climax: E-flat phrygian, tempo pushing from 112 to 120 BPM, heavy low brass on the downbeats, timpani, biggest moment of the piece, ending on a sharp final hit at 0:41.
[0:41 - 0:45] Near silence: a single sustained low D note, very quiet.
[0:45 - 0:55] Resolution: slow tender Rhodes at 60 BPM, F major 7 resolving to D major, relieved and hopeful.
[0:55 - 1:00] Finale: short warm brass-band chord swelling then a clean held final D major chord, natural ending.
Instrumental music only. No sound effects, no foley, no whistles, no train or railway sounds, no announcements, no voices, no vocals, no lyrics, no spoken word, no crowd, no samples of real-world sounds. Clean professional mix.
```

Repères mesurés sur l'enveloppe RMS par demi-seconde (non écoutés au casque) :

| Prise | Durée | Montée | Drop (cible 20 s) | Coup / creux (cible 41–45 s) | Fin |
|---|---|---|---|---|---|
| [t1](trailer-musique-v2_t1.ogg) | 59,9 s | 13,0 s (saut net, +15 dB) | ≈ 20,5 s ; respiration 26–27,5 s | pas de coup à 41 s : plein régime jusqu'à ≈ 44,5 s | décrue douce 45–54 s, fondu, silence à ≈ 57,5 s |
| [t2](trailer-musique-v2_t2.ogg) | 64,7 s | 7,5 s (tôt) | coupure 30,0 s puis tutti à 30,5 s (tard) | creux 46–49,5 s | reprise tutti 49,5–61 s, fin à ≈ 62,5 s |
| [t3](trailer-musique-v2_t3.ogg) | 61,2 s | 12,5 s | ≈ 25,5 s (tard) ; cassure 32,5–33,5 s | vrai silence 43,5–46 s (≈ 2,5 s de retard) | reprise forte 46–58 s (pas le Rhodes tendre demandé), fondu 58,5–60,5 s |

Contrôle « bruitages » : aucune attaque isolée hors grille (les seules attaques fortes détectées sont les
entrées de section à 13,1 s, 7,7 s et 46,5 s) ; aucun son glissé type sifflet. Pics tonals étroits
repérés et vérifiés : t2 47–49 s (notes tenues F6/E6/B6 calées sur le tempérament, avec fondamentale à
l'octave inférieure : mélodie instrumentale) ; t1 55,5–56,6 s (petite arpège de sinusoïdes aiguës dans le
fondu, ≈ −40 dB) et t3 59–60 s (sinusoïde G6 tenue dans la queue, ≈ −55 dB) : très faibles, probablement
une résonance de synthé/cloche, à confirmer à l'écoute.

Lyria suit le style et l'arc général mais pas les horodatages à la seconde : **t1** est la plus proche du
montage (durée, montée, drop) ; il lui manque le coup sec à 41 s et le creux 41–45 s, à recréer au montage
(coupe + queue de réverbe) si besoin.
