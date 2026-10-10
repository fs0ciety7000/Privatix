# Dialogues — voix principales (ElevenLabs) et secondaires (Gemini TTS)

Répliques générées à partir du script validé par le porteur du projet
(`docs/audio/SCRIPT_DIALOGUES_A_VALIDER.md`), via `tools/elevenlabs/generate.mjs`.

- Modèle : `eleven_v3` (text-to-speech), sortie OGG
- Prises : 1 par réplique (pas de sélection entre variantes)
- Date de génération : 2026-10-10
- Crédits estimés : ≈ 2 604 consommés (58 répliques) sur ≈ 4 274 prévus (82 répliques)

| Voix | Dossier | voice_id | Répliques produites |
|---|---|---|---|
| Léon (héros) | `leon/` | `Ql8Hq7echfwTF90Fec6K` | 23 / 23 |
| Yasmina | `yasmina/` | `ROy6nWoXjRMqzkdFdAkB` | 15 / 15 |
| Invité d'honneur | `invite/` | `BHaCuTcypMPA9jhksYPX` | 20 / 20 |
| Jean-Cul Lurcke (boss final) | `lurcke/` | `MAZdzkb78f8SA7DNBT41` | 19 / 25 |

Les répliques de l'Invité d'honneur sont fictives.

## Lurcke : produit via le connecteur ElevenLabs

Les répliques de Lurcke (voix « Nico », bibliothèque) ont été produites via le connecteur ElevenLabs, car
l'API directe refuse les voix de bibliothèque sur l'offre gratuite (402 `paid_plan_required`), pas le connecteur.
19 répliques sur 25 (boss.05 validée incluse), ≈ 1 442 crédits consommés (somme des `price.credits` relevés).
Manquantes : boss.10, 15, 16, 17, 18 et 20 (génération en échec : « Free Tier access has been disabled »,
activité inhabituelle détectée sur le compte). À relancer une fois le compte rétabli.

## Marcel, Josiane et Béné : Gemini TTS

Voix choisies par le porteur du projet à l'écoute des essais (`docs/audio/samples/gemini/README.md`),
enregistrées dans le catalogue (`geminiVoiceId`, `tools/elevenlabs/catalogue/voices.mjs`). Production via
`node tools/elevenlabs/generate.mjs --tts-backend gemini --only 'vo.marcel.*,vo.josiane.*,vo.bene.*' --takes 2`.

- Fournisseur : Gemini TTS (API Gemini), modèle `gemini-3.8-flash-tts`, sortie OGG (−18 LUFS)
- Prises : 2 par réplique (`_t1`, `_t2`, à départager à l'écoute ; pas de seed, chaque prise diffère)
- Date de génération : 2026-10-10
- Coût : ≈ 218 s d'audio produites (46 fichiers), ≈ 0,05 $ (0,00225 $ / 10 s ; estimation `--dry-run` : 209 s, 0,047 $)

| Voix | Dossier | voice_id (variante retenue) | Répliques produites |
|---|---|---|---|
| Marcel « Pépé Rail » Lhoir | `marcel/` | `voice_jwjfxi0g20l6` (variante 2) | 10 / 10 × 2 prises |
| Josiane Delhaye | `josiane/` | `voice_fekejacozsb7` (variante 2) | 7 / 7 × 2 prises |
| Bénédicte « Béné » Wautier | `bene/` | `voice_k4b4wmmwy1d8` (variante 1) | 6 / 6 × 2 prises |

Aucun échec définitif : quelques `429` (quota de débit) réessayés automatiquement par `generate.mjs`.
