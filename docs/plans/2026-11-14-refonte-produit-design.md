# Filmique — refonte produit (design)

Date : 2026-11-14
Statut : approuvé pour implémentation (lot L1)

## Problème

Le parcours actuel jette la moitié des intentions de l'utilisateur. Le formulaire n'envoie que
`topic` ; `durationS` et `tone` sont acceptés par le moteur mais jamais transmis ; le script est
produit, mis en scène et stocké en un seul appel opaque, sans étape de relecture. L'utilisateur
subit un film puis corrige dans l'éditeur.

Le visuel, lui, ne varie presque pas : 7 décors à palette unique, 7 personnages, aucune contrainte
de variété dans le prompt, `episode.accent` déclaré mais jamais rendu.

## Cap

Des films « et si » courts, social-first. Le vertical est un format de première classe, pas un
recadrage. La variété visuelle est un critère produit : deux épisodes consécutifs doivent se
distinguer.

## Parcours cible

1. **Nouveau projet** — le sujet, plus « Surprends-moi ».
2. **Réglages** — une page, groupée, valeurs par défaut déjà bonnes, rien d'obligatoire.
   Format, durée, monde visuel, voix, ton, sous-titres, rythme de montage.
3. **Script** — 4 à 12 beats avec durée estimée et total face à la cible. Par beat : éditer,
   reformuler (3 variantes IA), raccourcir, rallonger, supprimer, déplacer. Global : ajouter,
   régénérer. Budget de caractères affiché en direct (`durée × 8,5`). **Valider** verrouille le
   texte et débloque la génération.
4. **Récap** — tout ce qui a été choisi, durée estimée, nombre de plans, coût du rendu (0,04 €).
   Chaque ligne ramène à l'étape concernée.
5. **Studio** — l'éditeur actuel, inchangé dans sa logique, qui reçoit un épisode conforme.

## Contrat de données

Un objet `ProjectSettings` unique, validé par Zod, **stocké dans l'épisode** (`episode.settings`)
— donc dans la colonne `jsonb` existante, sans migration.

```
format      16:9 | 9:16 | 1:1          (défaut 16:9)
durationS   15 | 24 | 30 | 45 | 60     (défaut 24)
tone        playful | tense | warm     (défaut playful)  → prompt + musique
narration   conteur | prof | pote      (défaut conteur)  → prompt
rhythm      pose | standard | nerveux  (défaut standard) → durées de plan
world       urbain | maison | ecole | cosmos (défaut maison) → décors autorisés
captions    none | bloc | mot | karaoke (défaut none)
voiceId     uuid optionnel
```

`resolveSettings(episode)` fusionne les défauts pour les épisodes existants.

## Lots

| Lot | Contenu | Effort |
|---|---|---|
| **L1** | `ProjectSettings` + compose en deux temps (script / mise en scène) + assistant 4 écrans + API script/rewrite | 5-7 j |
| L2 | Identité (palette, heure, grade, accent) + casting étendu | 4-6 j |
| L3 | Caméra (push-in, parallaxe, whip pan, zoom-through, match cut) | 3-5 j |
| L4 | Sous-titres (4 styles, safe-areas) | 4-6 j |
| L5 | Formats (3 compositions, recomposition caméra, pas de crop) | 6-10 j |
| L6 | Décors : bureau, rue | 4 j |

L1 améliore l'expérience de bout en bout sans toucher au rendu. Les options non encore rendues
(format, sous-titres) sont **visibles mais désactivées avec la mention « bientôt »** — jamais
factices.

## L1 — détail d'implémentation

Moteur :
- `settings.ts` : schéma, défauts, `NARRATION_BRIEF`, `WORLD_SETS`, `RHYTHM`, `resolveSettings`.
- `schema.ts` : `EpisodeJsonZ.settings` optionnel.
- `compose.ts` : `composeScript` (1 appel LLM) et `composeFromScript` (science + storyboard +
  sound) ; `composeEpisode` devient leur composition, rétrocompatible.
- `prompts/script.ts` : le style de narration s'ajoute au brief de ton.
- `prompts/storyboard.ts` : le monde restreint la liste des décors.
- `adaptStoryboard` : le rythme multiplie les durées de plan (posé ×1,15, nerveux ×0,8).

SaaS :
- `lib/script-flow.ts` : `draftScriptFor` et `rewriteBeat` (3 variantes, une seule requête).
- `lib/generate-flow.ts` : accepte `settings` et un `script` validé.
- `lib/api-generate.ts` : lit `settings` et `script`.
- `POST /api/episodes/script` et `POST /api/episodes/rewrite`.
- `/app/new` : assistant client 4 étapes ; le tableau de bord pointe dessus.

## Hors périmètre, assumé

Pas de style photo/3D/anime, pas de génération d'images, pas de musique originale, pas d'avatars.

## Risques

- Reformulation = appels LLM (quota Groq 8 000 TPM) → une requête par reformulation, variantes
  en cache côté client.
- Régénérer le script après validation invalide la mise en scène → l'UI force une revalidation.
- Trois formats = 3× le coût de test de rendu (lot L5 seulement).

## Critères de succès

- Un épisode généré sans jamais ouvrir l'éditeur.
- Deux épisodes consécutifs visuellement distincts (L2).
- Script validé sans réécriture manuelle dans plus de la moitié des cas.
