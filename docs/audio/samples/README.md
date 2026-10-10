# Lot d'écoute musical — Lyria

Générés le 2026-10-10 avec **Lyria** (Google, API Gemini, endpoint `interactions`) via
`tools/elevenlabs/generate.mjs --music-backend lyria`. Prompts : `tools/elevenlabs/manifest.json`.

| Fichier | Asset | Modèle | Durée | Prompt (résumé) |
|---|---|---|---|---|
| `lyria-ost-02-occ-jour.ogg` | `ost.02-occ-jour.extrait` | `lyria-3-clip-preview` | 30,8 s | Lo-fi jazz de salle de pause, 74 BPM, Fmaj7–Em7–Dm7–Cmaj7, Rhodes, contrebasse, balais, radio filtrée |
| `lyria-ost-05-quais-combat.ogg` | `ost.05-quais-combat.extrait` | `lyria-3-clip-preview` | 30,8 s | Combat, 100 BPM, ré mineur Dm–Bb–F–C, basse synthé, caisse claire de fanfare, percussions ferroviaires, arpège néon, riff de cuivres |
| `lyria-trailer-musique-60s.ogg` | `trailer.musique-60s` (prise 1) | `lyria-3.5` | 59,5 s | Plan en sections horodatées : prise de poste lo-fi → montée en ré mineur → drop combat → kick disco final |

- Extraits demandés à 20 s : le modèle clip produit toujours 30 s.
- Coût estimé : 2 × 0,04 $ + 0,08 $ ≈ 0,16 $. Pas de seed : résultats non déterministes.
- Toutes les sorties portent le filigrane inaudible **SynthID**. Format : OGG Vorbis q5, normalisé à −16 LUFS.
