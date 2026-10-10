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
