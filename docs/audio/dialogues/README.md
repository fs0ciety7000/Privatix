# Dialogues — 4 voix principales (ElevenLabs)

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
