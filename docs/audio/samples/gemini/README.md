# Essais de voix — Gemini TTS (Marcel, Josiane, Béné)

Générés le 2026-10-10 avec **Gemini TTS** (Google, API Gemini, modèle `gemini-3.8-flash-tts`) via
`tools/elevenlabs/generate.mjs --tts-backend gemini --takes 1 --variants "…"` (voir
`tools/elevenlabs/README.md`, section « Voix avec Gemini TTS »). Lot d'**essai** : 3 propositions de voix par
personnage (même description de base, tirée du champ `design` de `catalogue/voices.mjs`, plus une phrase de
variation de timbre), chacune disant la même réplique. Rien n'est encore retenu.

Format : OGG Vorbis q5, 48 kHz, normalisé à −18 LUFS (mesuré : −17,4 à −19,5 LUFS), silences coupés.
Les `voice_id` sont stockés dans le projet Google (`store: true`) et dans `tools/elevenlabs/out/state/voices.json`.

## Marcel « Pépé Rail » Lhoir

- Réplique (`vo.marcel.hub.01`, texte du manifeste) : « De mon temps, le retard, on l’appelait l’aventure. [chuckles] Maintenant, ils l’appellent un KPI. »
- Texte envoyé : « De mon temps, le retard, on l’appelait l’aventure. Maintenant, ils l’appellent un KPI. » · style : `amused, with a soft chuckle` (balise `[chuckles]` convertie)
- Description de base envoyée (`prompted.input`, suivie de la variation) : « Elderly man, 72 years old, retired train driver. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural, slightly stronger regional colour than younger characters. Deep, gravelly, warm voice; gruff but tender. Unhurried storytelling pace, lets sentence endings trail off with a smile. Studio recording, clean. »
- `gender` : `male` · `language_code` : `fr-BE`

| Fichier | voice_id | Variation ajoutée à la description |
|---|---|---|
| `marcel-1.ogg` | `voice_25gsxf5ftas6` | « Variation: a deeper, darker timbre. » |
| `marcel-2.ogg` | `voice_jwjfxi0g20l6` | « Variation: a clearer, slightly higher and less gravelly timbre. » |
| `marcel-3.ogg` | `voice_g2h9vy4cyuio` | « Variation: a raspier, older-sounding timbre. » |

## Josiane

- Réplique (`vo.josiane.hub.01`, texte du manifeste) : « Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement. »
- Texte envoyé : « Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement. » · style : `ferme` (champ `emo`, pas de balise)
- Description de base envoyée (`prompted.input`, suivie de la variation) : « Woman, 58 years old, train conductor with 28 years of service. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Warm, projecting mid-range voice; motherly but firm and unflinching, straightforward, quick to tease. Studio recording, clean. »
- `gender` : `female` · `language_code` : `fr-FR` (voir plus bas)

| Fichier | voice_id | Variation ajoutée à la description |
|---|---|---|
| `josiane-1.ogg` | `voice_06fzzryl3mpk` | « Variation: a deeper, darker timbre. » |
| `josiane-2.ogg` | `voice_fekejacozsb7` | « Variation: a lighter, brighter timbre. » |
| `josiane-3.ogg` | `voice_12p7gllgduge` | « Variation: a raspier, older-sounding timbre. » |

## Béné

- Réplique (`vo.bene.hub.01`, texte du manifeste) : « Le Règlement, page trois cent douze : un consultant n’a pas de titre de transport. Je dis ça, je dis rien. »
- Texte envoyé : « Le Règlement, page trois cent douze : un consultant n’a pas de titre de transport. Je dis ça, je dis rien. » · style : `pince-sans-rire` (champ `emo`, pas de balise)
- Description de base envoyée (`prompted.input`, suivie de la variation) : « Woman, 56 years old, veteran ticket-office clerk. Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural. Dry, crisp mid-range voice; perfectly deadpan, even and rhythmic delivery like a rubber stamp, a hint of tired amusement she never shows. Studio recording, clean. »
- `gender` : `female` · `language_code` : `fr-BE`

| Fichier | voice_id | Variation ajoutée à la description |
|---|---|---|
| `bene-1.ogg` | `voice_k4b4wmmwy1d8` | « Variation: a deeper, darker timbre. » |
| `bene-2.ogg` | `voice_cvpykb7d0evp` | « Variation: a lighter, brighter timbre. » |
| `bene-3.ogg` | `voice_o09px2fdw0zz` | « Variation: a raspier, older-sounding timbre. » |

## Notes

- **Josiane en `fr-FR`** : la première création a reçu `400` « Generated voice prompt was flagged by safety
  policies. » ; le script l'a prise à tort pour un refus de `fr-BE` et a basculé en `fr-FR` (le nouvel
  essai est passé). Corrigé depuis : seul un message d'erreur sur la langue déclenche le repli. Marcel et Béné
  sont en `fr-BE`, accepté par l'API. L'accent reste porté par la description.
- **Marcel 2** : « Variation: a lighter, brighter timbre. » a échoué cinq fois (`500` « Voice synthesis
  service failed to process the request. »), probablement parce qu'elle contredit « deep, gravelly » ;
  reformulée « clearer, slightly higher and less gravelly ».
- Échantillons de conception renvoyés par `/voices` (14 à 71 s) : `tools/elevenlabs/out/voices/<voix>/gemini_apercu_<n>.wav`
  (non versionnés).
- **Coût estimé** (0,00225 $ par 10 s d'audio produit, tarif 2026) : 9 répliques = 68,6 s ≈ 0,015 $ ;
  9 échantillons de conception = 291,4 s ≈ 0,066 $ s'ils sont facturés comme une sortie. Total ≈ 0,08 $ au
  plus (≈ 0,16 $ au tarif 2027).
