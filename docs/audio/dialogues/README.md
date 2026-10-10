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
| Jean-Cul Lurcke (boss final) | — | `MAZdzkb78f8SA7DNBT41` | 0 / 24 |

Les répliques de l'Invité d'honneur sont fictives.

## Lurcke : non produit

Les 24 appels pour Lurcke ont échoué avec l'erreur `402 paid_plan_required` : « Free users cannot use
library voices via the API ». La voix retenue (« Nico ») vient de la bibliothèque ElevenLabs, et un
compte gratuit ne peut pas l'utiliser via l'API. Ce n'est pas un problème de crédits. Pour débloquer :
passer à un abonnement payant ou choisir une voix du workspace. Il suffit ensuite de relancer
`--only 'vo.lurcke.*'` : le script ne regénère pas ce qui existe déjà.
(`vo.lurcke.boss.05`, déjà validé, est exclu de la sélection.)
