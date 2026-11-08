# What If Studio (SaaS) — Document de design

Date : 2026-11-08
Statut : validé avec le producteur (le studio `what-if-studio` reste la base technique)

## 1. Le produit

Un SaaS pour créateurs individuels / indépendants : **un sujet en ligne → un épisode animé fini (15-40 s), ré-éditable, exportable en vertical 9:16** (Shorts / TikTok / Reels).

Nom de travail : *What If Studio*.

### Parcours utilisateur

1. **Signup** email + magic link. Onboarding : niche, voix (catalogue de 6), ton (fun / sombre / pédagogique).
2. **Écran d'accueil** : champ "Et si … ?" + panneau de réglages → bouton Générer (coût en crédits affiché avant de cliquer).
3. **Génération (2-4 min, visible en direct)** : jobs étapes par étapes — script → science → storyboard → voix → son. Chaque étape asynchrone, retentative.
4. **Éditeur (le cœur)** : Player Remotion plein écran + panneau latéral 3 onglets :
   - *Script* : beats éditables, réalignement `words.json` automatique.
   - *Plans* : les shots éditables (note, durée `key`, set, réorganisation).
   - *Audio* : voix, musique, gains.
   Tout se répercute en direct dans le Player (JSON déterministe = preview gratuite).
5. **Export** : rendu Lambda → MP4 sur S3 → notification + lien de téléchargement.
6. **Bibliothèque** : épisodes (brouillon / généré / rendu), MP4 existants.

### Réglages de durée (pilote le pipeline)

- Curseur 15-40 s (défaut 25 s) → longueur script (~8-9 car./s), nombre de beats, nombre de shots, densité des cuts.
- Aussi : voix, ton, rythme de montage (posé ~20 cuts/min vs nerveux ~35+), accent du title, `tail`.
- Après génération : éditer un beat → re-TTS (débité) ; couper/shot/musique → gratuit (JSON).

### Hors périmètre MVP

Éditeur visuel de sets SVG, formats non-9:16, import de footage, multi-user, API publique.

## 2. Le moteur commun (l'actif réutilisé)

L'invariant : **un épisode = un dossier de JSON, zéro code par épisode.**

```
episode/
  episode.json     ← le cerveau éditable (JSONB versionné en DB)
  words.json       ← alignement mot-par-mot (recalculé après chaque edit du script)
  timeline.json    ← dérivé, reconstruit au build, jamais stocké
  voice/sfx/music  ← assets audio (S3 côté SaaS)
```

Règles :

1. **Zéro code par épisode** : les shots sont exprimés 100 % par `episode.json` via une **bibliothèque de ~20 archetypes de plans** (découverte, macro-insert, title-card, schematic-chiffre, retournement…) que le LLM sélectionne et paramètre. Le plus gros chantier d'adaptation.
2. **Studio et SaaS partagent le même package** `@what-if/engine` (monorepo : engine / studio / saas). Les nouveaux sets/archetypes naissent dans le studio, le SaaS les hérite.
3. **Le JSON passe la sécurité** : tout `episode.json` (LLM, édition, import) traverse un schéma Zod strict aligné sur les types du moteur.

Opération clé : `composeEpisode(subjectLine, preferences) → episode.json draft`.

## 3. Le pipeline de génération

Jobs séquentiels, chacun reprisable, dans une file de jobs :

| Étape | Moteur | Durée | Sortie |
|---|---|---|---|
| Script | LLM | ~10 s | beats (structure : ouvert à froid → prémisse → retournement chiffré → question menaçante), ~8-9 car./s |
| Science | LLM (inclus au script) | — | claim + justification du calcul + source (champ `science`) |
| Storyboard | LLM | ~20 s | 12-15 shots en remplissant les archetypes autorisés |
| Voix | **Cartesia Sonic** (TTS) | ~15 s | audio + `words.json` (timestamps word-level) |
| Son | catalogue | — | ~40 sfx génériques mappés par règles + 5-6 nappes musicales ; `events`/`repeats`/`levels` posés par règles |

Orchestration :

- Table `jobs` + workers file (Inngest ou BullMQ sur VM). Pas de cron : chaque étape déclenche la suivante.
- Idempotent : outputs versionnés, re-run ne re-facture pas.
- Budget plafonné et affiché avant action (`max_tokens`, longueur imposée).
- Fallbacks : script invalide → retry + correction ×2 ; Zod reject → re-prompt ×2 ; TTS → retry backoff ×3.

## 4. Infrastructure et données

- **Monorepo** pnpm : `engine` / `studio` / `saas`.
- **Web app** : Next.js (App Router) sur Vercel.
- **DB** : Postgres **Neon** — `users`, `plans`, `episodes` (JSONB versionné + table `episode_versions` par save), `jobs`, `credit_ledger`. Audio/MP4 sur S3 (liens signés expirants).
- **Rendu** : **Remotion Lambda**, déployé à chaque release ; `renderMediaOnLambda` par export (2-8 min / épisode). Le site n'a jamais de rendu lourd.
- **Sécurité** : tout JSON qui entre traverse le Zod du moteur ; le Lambda ne reçoit que des épisodes conformes.

Flux export : check crédits → job Lambda → MP4 + wav sur S3 → statut `rendered` + notif.

## 5. Voix et paiement

- **Voix : Cartesia Sonic** (déjà n°2 des arenas qualité, timestamps word + phonème, ~2× moins cher qu'ElevenLabs). Derrière une interface `VoiceProvider` pour pouvoir re-tester ElevenLabs plus tard sans toucher au pipeline.
- **Paiement : Whop** au lieu de Stripe :
  - Plans Whop sur une page produit, checkout embedded.
  - Gating par API (`hasAccess`) à chaque session — pattern SaaS officiel Whop.
  - Webhooks : `membership.activated` (signup + chaque renouvellement → re-grant crédits mensuels, idempotent), `payment.failed` → statut grace.
  - Portail facturation / retries / invoices : gérés par Whop, zéro code.
  - Frais : 2,7 % + 0,30 $ (+0,5 % Billing, +1,5 % cartes internationales). KYC Whop à régler au premier payout.

## 6. Crédits et offres

Coûts en crédits (calibrés sur l'ép réel million16 : ~414 crédits ElevenLabs pour 24 s, TTS Cartesia similaire) :

| Action | Crédits |
|---|---|
| Génération épisode (LLM + storyboard) | ~50 |
| Voix TTS | ~1 / caractère (≈ 380 pour 25 s) |
| Re-mix voix après edit | caractères réels |
| Export MP4 Lambda | ~200 / minute rendue |
| Édition (cuts, shots, musique) | 0 — illimité |

Épisode complet : ≈ 600-650 crédits.

| Offre | Prix | Crédits/mois |
|---|---|---|
| Découvert | 0 € | 1 500 offerts au signup (~2 épisodes), sans CB |
| Créateur | 19 € | 5 000 (≈ 7-8 épisodes) |
| Studio | 49 € | 14 000 (≈ 20 épisodes), voix premium, rendu prioritaire |

Règles : non-accumulables (reset mensuel au MVP), débit affiché avant chaque action, coûts réels trackés par épisode dans `jobs.cost_lines` (structure déjà utilisée par le studio).

## 7. Robustesse

- **Auth** : email + magic link. Un compte = un créateur.
- **Script LLM invalide** → Zod reject → retry ×2 → `failed` + remboursement crédits auto (étapes réussies réutilisables).
- **Cartesia down / quota** → backoff ×3 → `failed` + notif ; TTS débité seulement à l'audio reçu.
- **Rendu Lambda échoué** → retry manuel gratuit dans le dashboard (non re-facturé, log visible).
- **Crédits insuffisants** → check à l'entrée de chaque job coûteux, jamais en milieu de job.
- **Provider LLM** : un seul, configurable (Claude / Gemini), isolé.

Tests :

1. Canari hebdo déployé : `composeEpisode("test")` → Zod + Player + Lambda → alerte si échec.
2. **Golden suite** : les 3 épisodes du studio (rewind, copy-paste, million16) doivent builder à l'identique dans le moteur SaaS.
3. Banc de validation : 20 sujets générés d'affilée, taux de réussite script > 90 % avant ouverture.

## 8. Milestones de build

1. Monorepo + extraction `@what-if/engine` + schémas Zod (studio tourne toujours).
2. Bibliothèque d'archetypes ~20 plans (les shots des 3 épisodes deviennent data).
3. Job "generate" complet testé en CLI (script → storyboard → Cartesia → son).
4. Web app : auth + champ sujet + dashboard jobs.
5. Éditeur Player + 3 onglets.
6. Lambda rendering + exports S3.
7. Whop + crédits.
