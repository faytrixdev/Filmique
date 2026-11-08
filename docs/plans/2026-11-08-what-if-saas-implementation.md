# What If Studio (SaaS) — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformer le pipeline `what-if-studio` en SaaS self-service : monorepo (engine / studio / saas), bibliothèque d'archetypes 100 % data-driven, génération LLM → Cartesia → catalogue son, éditeur `@remotion/player`, rendu Remotion Lambda, offres et crédits par Whop.

**Architecture:** Un épisode = un JSON (`episode.json` + `words.json` dérivés, timeline recalculée, jamais stockée). Le package `@what-if/engine` est partagé entre le studio (créatif) et le SaaS (next app). Tout JSON entrant passe par un schéma Zod strict avant DB, éditeur ou Lambda.

**Tech Stack:** TypeScript, React 19, Remotion 4, pnpm workspaces, Next.js (App Router/Vercel), Neon Postgres, S3, Remotion Lambda, Inngest (jobs), Cartesia (TTS), Whop (paiement), Vitest (golden suite).

**Références du design:** `docs/plans/2026-11-08-what-if-saas-design.md` (validé le 2026-11-08).

---

## État des lieux constaté (à lire avant de commencer)

- `what-if-studio/src/engine/` : moteur complet existant (`episode.tsx` : `Timeline`, `Episode`, `Board`, `defineEpisode`, `ShotMap`, `LookDef`). Les shots sont des fonctions `(t, len, f) => SVG`.
- `src/episodes/<slug>/` : chaque épisode = `episode.json` (script beats, shots, edit, sound, fx), `timeline.json` (dérivé), `words.json` (mots + timings {w,s,e,p}), `shots.tsx` (**code bespoke par épisode — 628 lignes pour million16**), `index.tsx` (look + wiring).
- `Root.tsx` enregistre `EPISODES` via `defineEpisode`.
- ⚠️ Le script qui produit `timeline.json` depuis `words.json` + `edit` (le « plan.py » mentionné dans `episode.tsx`) **n'est pas dans le repo** — la Task 4 le reconstruit en TS et le valide sur les 3 épisodes.
- Conventions : pas de commentaires inutiles, composants courts, `clamp`/`lerp` et les easings déjà dans `engine/anim.ts`.
- Le repo `mes-animations` n'est pas un repo git à ce jour.

---

## Milestone 0 — Repo & Monorepo

### Task 0: Git + squelette pnpm

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json` (racine), `.gitignore` (racine)
- Move: `what-if/what-if-studio` → `packages/studio`

**Step 1:** Init git et ignore les hors-périmètre.

```bash
cd C:\Users\PC\Documents\mes-animations
git init
git add docs
git commit -m "docs: what-if saas design + implementation plan"
```

**Step 2:** Créer `pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

Racine `package.json`:

```json
{
  "name": "what-if",
  "private": true,
  "scripts": { "typecheck": "pnpm -r typecheck", "test": "pnpm -r test" },
  "devDependencies": { "typescript": "5.8.2" }
}
```

**Step 3:** Déplacer le studio :

```bash
mkdir packages
Move-Item what-if\what-if-studio packages\studio
```

`.gitignore` racine : `node_modules/`, `out/`, `*.log`, `.env`. Le dossier `what-if/` vidé peut être supprimé.

**Step 4:** Le typecheck doit passer inchangé.

Run: `pnpm -C packages/studio typecheck`
Expected: exit 0.

**Step 5:** Commit `chore: pnpm monorepo, studio moved to packages/studio`.

### Task 1: Extraction `@what-if/engine`

**Files:**
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`
- Move: `packages/studio/src/engine/*` → `packages/engine/src/*`
- Modify: tous les imports `../engine` dans `packages/studio/src` → `@what-if/engine`

**Step 1:** `packages/engine/package.json` :

```json
{
  "name": "@what-if/engine",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "peerDependencies": { "react": "19.0.0", "remotion": "4.0.530" },
  "devDependencies": { "@types/react": "19.0.0", "react": "19.0.0", "remotion": "4.0.530", "typescript": "5.8.2", "vitest": "^3" }
}
```

**Step 2:** Déplacer le moteur :

```bash
mkdir packages\engine\src
Move-Item packages\studio\src\engine\* packages\engine\src\
```

`packages/studio/src/index.ts` remplace `import './engine/fonts'` par l'import équivalent depuis `@what-if/engine` (le module `fonts.ts` reste dans engine, il est re-exporté par `index.ts`).

**Step 3:** Réécrire les imports du studio :

Run: `rg -l "from '\.\./engine|from '\.\./\.\./engine'?" packages/studio/src` → remplacer chacune par `from '@what-if/engine'`. Ajouter `"@what-if/engine": "workspace:*"` dans `packages/studio/package.json`.

**Step 4:** Vérifier :

Run: `pnpm -r typecheck && pnpm -C packages/studio studio` (ouvrir http://localhost:3430)
Expected: typecheck 0, studio affiche les 3 épisodes + Cast.

**Step 5:** Commit `refactor: extract @what-if/engine package`.

---

## Milestone 1 — Contrats de données (Zod) & timeline builder

### Task 2: Schémas Zod du moteur

**Files:**
- Create: `packages/engine/src/schema.ts` (EpisodeJson, Words, Sound, Fx…), re-export dans `src/index.ts`
- Test: `packages/engine/test/schema.test.ts`

**Step 1: Écrire le test (failing)**

```ts
import { describe, expect, it } from 'vitest';
import { EpisodeJsonZ, WordsZ } from '../src/schema';
import million from './fixtures/million16-episode.json';

describe('EpisodeJsonZ', () => {
  it('accepts the million16 episode verbatim', () => {
    expect(() => EpisodeJsonZ.parse(million)).not.toThrow();
  });
  it('rejects a shot without id', () => {
    const bad = structuredClone(million) as { shots: unknown[] };
    bad.shots[0] = { size: 'wide', key: 18 };
    expect(() => EpisodeJsonZ.parse(bad)).toThrow();
  });
});
```

Copier les 3 `episode.json` des épisodes dans `packages/engine/test/fixtures/`.

**Step 2:** Run `pnpm -C packages/engine test` → expected FAIL (schema.ts n'existe pas).

**Step 3: Implémenter** `schema.ts` — les structures exactes existantes (observées dans million16) :

```ts
import { z } from 'zod';

export const ScriptBeatZ = z.object({ beat: z.string(), text: z.string() });
export const ScienceZ = z.object({ claim: z.string(), working: z.string(), source: z.string() });
export const ShotZ = z.object({
  id: z.string().regex(/^S\d+$/),
  size: z.string(),
  set: z.string(),
  key: z.number().int().positive(),
  note: z.string().optional(),
  archetype: z.string().optional(),     // introduit en M2
  archetypeProps: z.record(z.unknown()).optional(), // idem
});
export const EditZ = z.object({ shot: z.string(), at: z.string(), look: z.string().optional() });
export const FxZ = z.discriminatedUnion('kind', [
  z.object({ at: z.string(), kind: z.literal('flash'), color: z.string().optional(), o: z.number().optional() }),
  z.object({ at: z.string(), kind: z.literal('shake'), len: z.number().optional(), amp: z.number().optional() }),
]);
export const SoundZ = z.object({
  clips: z.record(z.tuple([z.string(), z.number()])),
  events: z.array(z.tuple([z.string(), z.string(), z.number()]).rest(z.union([z.string(), z.number()]))),
  repeats: z.array(z.object({ at: z.string(), clip: z.string(), n: z.number(), every: z.number(), gain: z.tuple([z.number(), z.number()]), pitch: z.tuple([z.number(), z.number()]).optional() })),
  music: z.object({ clip: z.string(), until: z.string(), reverse_looks: z.array(z.string()).optional() }),
  levels: z.object({ sfx_lu: z.number(), music_lu: z.number() }),
});
export const EpisodeJsonZ = z.object({
  id: z.string(), slug: z.string(), topic: z.string(),
  title: z.array(z.string().min(1)).min(1).max(2),
  accent: z.string().optional(),
  power: z.object({ word: z.string(), rule: z.string(), look: z.string() }),
  script: z.array(ScriptBeatZ),
  science: z.array(ScienceZ).default([]),
  cast: z.array(z.string()).default([]),
  shots: z.array(ShotZ).min(2),
  edit: z.array(EditZ),
  tail: z.number().default(1.2),
  sound: SoundZ,
  fx: z.array(FxZ).default([]),
});
export const WordZ = z.object({ w: z.string(), s: z.number(), e: z.number(), p: z.string() });
export const WordsZ = z.array(WordZ);
```

⚠️ Faire passer les 3 fixtures **verbatim** — ajuster les schémas à la réalité (variétés de `events` entre episodes, `level` etc.), pas l'inverse. Les épisodes `rewind`/`copy-paste` doivent passer aussi.

**Step 4:** Run tests → PASS. **Step 5:** Commit `feat(engine): zod contracts for episode/words/sound/fx`.

### Task 3: Timeline builder (reconstituer le « plan.py » perdu)

**Files:**
- Create: `packages/engine/src/timeline.ts` — `composeTimeline(ep: EpisodeJson, words: Words): Timeline`
- Test: `packages/engine/test/timeline.test.ts` — **golden : compare le résultat à `timeline.json` des 3 épisodes** (fixtures).

**Step 1: Test (failing)** : pour chaque épisode, `composeTimeline(ep, words)` doit produire un objet structurellement égal au `timeline.json` actuel (deep equal après parse, tolérance 1e-6 sur les temps, fx/at résolus en frames).

**Step 2:** Run → FAIL (module manquant).

**Step 3: Implémentation** — règles déduites du moteur (`engine/episode.tsx` : segments contigus `[a, b)`, clocks `t0..t1`, `look` porté par l'edit, `line` = fenêtre de mots) :

1. Résoudre chaque `edit.at` en moment de parole via `words.json` (`#n` = énième occurrence du mot, casse ignorée ; prefix `s:` = secondes, `f:` = frames).
2. `a` = frame du début du mot ancre (`word.s × fps`, arrondi), `b` = frame de fin du dernier mot avant l'ancre suivante + marge.
3. Shot : `t1 = b − a` (un plan lit systématiquement son clock de 0 à b−a sauf mention contraire), `len = b − a`.
4. Dernier segment : étendre jusqu'à `total = (durée voisin + tail) * fps`.
5. `fx.f` : résoudre les ancres `S2+28` → `seg(S2).a + 28`.
6. `title`/`total`/`audio` dérivés du episode.json.

⚠️ C'est la task la plus délicate : le builder doit coïncider champ par champ avec les golden. Les divergences → corriger les règles, pas les golden. Consigner chaque règle découverte dans un doc `packages/engine/src/timeline.md` court.

**Step 4:** Run tests → 3 PASS golden. **Step 5:** Commit `feat(engine): composeTimeline - the lost plan.py, golden-validated`.

---

## Milestone 2 — Archetypes (zéro code par episode)

### Task 4: Catalogue d'archetypes

**Files:**
- Create: `packages/engine/src/archetypes/index.tsx` — 15-20 composants typés `ShotProps + Props <Arch>`
- Create: `packages/engine/src/archetypes/registry.ts` — `ARCHETYPES: Record<string, { Component, PropsZ: z.ZodType }>`
- Modify: `ShotZ` (schema.ts) pour exiger `archetype` (clé de `ARCHETYPES`) + `archetypeProps` validés par le `PropsZ` de l'archetype, en mode SaaS (le studio garde ses shots bespoke).
- Test: `packages/engine/test/archetypes.test.ts` (props Zod) + renders smoke (render un frame via `@remotion/renderer` dans vitest).

**Step 1: Cartographier les plans existants** (lire les 3 `shots.tsx`) et choisir **20 archetypes**. Base déduite des épisodes :

| # | Archetype | Exemple rév. |
|---|---|---|
| 1 | `wideDiscovery` — plan large qui pose le lieu + le personnage | S1 million16 |
| 2 | `phoneBalance` — macro-insert d'un écran de téléphone animé | S2, S8, S9 |
| 3 | `heroReaction` — un perso réagit (joie/inquiet), bras/yeux animés | S3, S10 |
| 4 | `objectOffer` — un objet clé (console, cake) sur surface + tag PAYÉ | S4 |
| 5 | `coinsFall` — des pièces/des trucs tombent du plafond sur un lieu | S6 |
| 6 | `pileGrows` — empilement qui grossit, compteur visible | S5, S7 |
| 7 | `titleCard` — carte titre sur lieu, 2-4 lignes max | S11 |
| 8 | `schematicCenter` — chiffre au centre + fléchés labels | S12 |
| 9 | `schematicBar` — barre qui descend/hausse + % | S13 |
| 10 | `closeUpFace` — gros plan visage + lumière qui change | S14 |
| 11 | `arrivalThreat` — silhouette avance vers caméra, ciel change | S15 |
| 12-20 | ceux dérivés de rewind + copy-paste (à cartographier au début de la task) | |

Chaque archetype est paramétré par le LLM via des props typées simples (labels, chiffres — les textes restent en français), sans laisser de strings SVG libres à part label/value.

**Step 2: Test schema + props Zod** → FAIL → implémente → PASS. 

**Step 3: Valider par l'image** — rendre 1 frame de chaque archetype sur ses sets autorisés et comparer visuellement (stills :

```bash
npx remotion render src/index.ts <Composition> --frames=0,1 out/atlas.png
```

— ou un composition `Atlas` qui grille tous les archetypes). Commit `feat(engine): archetype catalog + atlas`.

### Task 5: Migrer un épisode (million16) en archetypes

**Files:**
- Modify: `packages/engine/test/fixtures/million16-episode.json` — ajouter aux 15 shots leurs `archetype` / `archetypeProps` (écrits à la main à partir de shots.tsx).
- Keep: le studio million16 **inchangé** (bespoke) ; le SaaS construit le SaaS Episode via les archetypes.
- Test: `packages/engine/test/million-saas.test.ts` — la version archetype rend les mêmes stats calculées (total frames, segments count) et des stills comparables (tolérance visuelle, pas pixel-perfect).

**Step 1:** Écrire le mapping en data : annoter les 15 shots avec archetype + props (à partir du code shots.tsx) — **c'est le fruit de la task, pas un automatisme** ; chaque prop reprend la valeur concrète du code bespoke.

**Step 2:** Vérifier dans le studio une composition `Million16SaaS` (une composition qui mappe les archetypes) — les cuts tombent aux mêmes frames.

**Step 3:** Commit `feat(engine): million16 data-driven via archetypes`.

---

## Milestone 3 — Pipeline de génération (CLI first)

### Task 6: Providers (LLM, Cartesia) — interfaces + adapters

**Files:**
- Create: `packages/engine/src/providers/llm.ts` (`generateText(prompt, opts): Promise<string>`), impl choisi par `.env` (`LLM_PROVIDER=gemini|anthropic`)
- Create: `packages/engine/src/providers/voice.ts` — `VoiceProvider` :

```ts
export interface VoiceProvider {
  synthesize(text: string, voiceId: string): Promise<{ audio: Uint8Array; words: Words }>;
}
export class CartesiaVoice implements VoiceProvider { /* POST /tts/bytes + timestamps word-level */ }
```

- Test: `packages/engine/test/providers.test.ts` — mock HTTP (nock/msw), parse words & timing contract.

**Step 1:** Test contract parse words → FAIL. **Step 2:** Impl → PASS. **Step 3:** Script réel contre Cartesia (une voix FR du studio) et vérifier audio jouable + words alignés :

```bash
pnpm -C packages/engine tsx scripts/voice-e2e.ts "Seize ans. Ton téléphone affiche un million." > out/voice-test.wav
```

**Step 4:** Commit `feat(engine): llm + cartesia voice providers`.

### Task 7: composeEpisode (script → science → storyboard → sound)

**Files:**
- Create: `packages/engine/src/compose.ts` — `composeEpisode(input: { topic, tone, durationS, voiceId, … }): Promise<EpisodeDraft>` à 4 sous-étapes exportables (`draftScript`, `draftScience`, `draftStoryboard`, `draftSound`) **isolées** (retry/adaptation par étape).
- Create: `packages/engine/src/prompts/*.ts` — prompts versionnés sous forme de fonctions (repris de la structure dramatique éprouvée : ouvert à froid → prémisse → retournement chiffré → question menaçante ; contrainte ≈ 8-9 car./s ; beats numérotés ; `science` obligatoire pour tout fait chiffré).
- Create: `packages/engine/src/sound/rules.ts` — les règles `events/repeats/levels` (title card → boom ; look million → chime+sparkle ; flash → etc.), proposées depuis le `storyboard`, SFX choisis dans un catalogue `sound/clips.json` (~40 clips préétablis du projet, à regrouper).
- Test: `packages/engine/test/compose.test.ts` — chaque étape : fixture LLM mockée → sort un JSON passant Zod (goldens des sous-étapes).
- CLI: `packages/engine/scripts/compose-cli.ts` — génère un épisode complet d'un sujet et l'écrit dans `out/<slug>/episode.json` prêt à jouer.

**Step 1:** Test étape script → FAIL → impl → PASS (répéter par étape).
**Step 2:** E2E manuel : 5 sujets d'affilée (rapide check humain : structure, science, shots cohérents, aucun échec Zod).
**Step 3:** Commit `feat(engine): composeEpisode pipeline (script/science/storyboard/sound)`.

### Task 8: Job runner local (base partagée pour le SaaS)

**Files:**
- Create: `packages/jobs/package.json`, `src/runner.ts` — un runner minimal : une étape = `{ id, run, cost }`, séquencée, output versionné à `out/<jobId>/step-<name>.json`, idempotent (skip si STEP_DONE), remonte les step-status.
- Test: `packages/jobs/test/runner.test.ts` — retries, idempotence, pas de re-facturation au re-run, remboursement à l'échec.

**Step 1:** Test → FAIL → impl → PASS. **Step 2:** Compose un épisode complet à travers le runner. **Step 3:** Commit `feat(jobs): step runner with retries + idempotency`.

---

## Milestone 4 — Web app (auth, épisodes, dashboard)

### Task 9: Squelette Next.js + Neon

**Files:**
- Create: `packages/saas` (App Router), `src/db/schema.ts` (Drizzle) : `users`, `episodes`, `episode_versions`, `jobs`, `credit_ledger`
- `.env.local`: `DATABASE_URL` (Neon), secrets providers.

**Step 1:** Init :

```bash
pnpm create next-app@latest packages/saas --ts --app --eslint --no-tailwind
pnpm -C packages/saas add drizzle-orm @neondatabase/serverless zod @remotion/player remotion
```

(Préférez `drizzle-kit push` sur une branche dev Neon.)

**Step 2:** Vérifier : `pnpm -C packages/saas dev`, page d'accueil s'affiche sur :3000. **Step 3:** Commit `feat(saas): next app + neon drizzle schema`.

### Task 10: Auth magic link + gating basic

**Files:**
- Create: `packages/saas/src/lib/auth.ts` (cookie session signé + table `magic_links`)
- Pages: `/login`, `/app` (dashboard protégé)

**Step 1:** Test unitaire du flux de token (génération/expir/réutilisation). **Step 2:** Impl. **Step 3:** Test manuel : clic mail → session → `/app`. **Step 4:** Commit `feat(saas): magic-link auth`.

### Task 11: Épisodes : espace de stockage CRUD + versions

**Files:**
- API routes: `POST /api/episodes` (créer draft depuis un composeEpisode, facturation crédits), `GET /api/episodes/:id`, `PUT /api/episodes/:id` (save → snapshot dans `episode_versions`), `DELETE`.
- Passer chaque save par `EpisodeJsonZ.parse()` avant DB — invalide = 400 `{error: 'schema', issues[]}`.

**Step 1:** Test API Vitest (supertest/fetch vs Next handler) → golden round-trip des 3 épisodes studio (les fixtures passent par l'API). **Step 2:** Commit `feat(saas): episodes CRUD + versioning + zod gate`.

---

## Milestone 5 — Éditeur

### Task 12: Player + onglet Script

**Files:**
- Create: `packages/saas/src/app/episodes/[id]/Editor.tsx` — `<Player>` (`@remotion/player`) à gauche, panneau droit.
- Le Player joue la composition SaaS construite par les archetypes, au format du moteur (1920×1080) ; le vrai 9:16 est rendu par Lambda (crop post-render au MVP).
- Onglet Script : chaque beat éditable ; à la sauvegarde → re-TTS via Cartesia → `words.json` réaligné → `composeTimeline` recalculé → le Player le montre instantanément.
- Test manuel : éditer un beat → les cuts glissent → le re-TTS se déclenche.

**Step 1:** Player readonly + episode golden displayed. **Step 2:** Beat edit + re-TTS flow. **Step 3:** Commit `feat(saas): editor player + script tab`.

### Task 13: Onglets Plans & Audio

**Files:** Modify Editor — Plans (shots reorder, key slides, set picker, archetype props fixes), Audio (voice picker, music, gains).

**Steps:** render/list shots → drag reorder (save via Version) → play from this point. Change `key` (durée) slides the following cut. Audio tab: pick voice → POST re-TTS once. Commit.

---

## Milestone 6 — Rendu Lambda + S3

### Task 14: Deploy Lambda + export flow

**Files:**
- Create: `packages/saas/lambda/` (composition wrapper : `SaaSEpisode({ episodeJson, … })` qui lit les assets audio depuis des URLs S3 signées).
- Routes: `POST /api/episodes/:id/export` (check crédits → `renderMediaOnLambda`), `GET /api/episodes/:id/exports`.
- Callback : fin de render Lambda → `episodes.status = 'rendered'` → lien S3 signé.

**Step 1:** Deploy Function depuis le studio (local first):

```bash
npx remotion lambda functions deploy --region=eu-west-1
```

**Step 2:** Poster un épisode golden → render → télécharger le MP4 → lecture. **Step 3:** Commit `feat(saas): lambda export flow`.

---

## Milestone 7 — Whop + crédits

### Task 15: Crédit ledger + packs de prix

**Files:**
- Modify: `credit_ledger` — chaque débit/gain est une ligne `{ user_id, delta, reason, job_id, at }` ; solde recalculé dans une transaction.
- UI: affichage du solde + coût affiché avant génération/export.

**Step 1:** Ledger tests (concurrent debit no-go → `'insufficient_credits'`). **Step 2:** Commit `feat(saas): credit ledger`.

### Task 16: Whop checkout + webhooks

**Files:**
- Create: `packages/saas/src/app/api/webhooks/whop/route.ts` — `unwrapWebhook` signé, `membership.activated` → map `whop_user_id` + grant mensuel (idempotent par `webhook-id`), `payment.failed` → grace statut.
- Pages: `/pricing` (plans Whop embed) + gating middleware (`hasAccess`).

**Steps:** Test webhook signature offline (fixture payload + secret) → wire → Whop test card flow → re-grant à deuxième renewal. Commit `feat(saas): whop checkout + credits grants`.

---

## Milestone 8 — Qualité avant ouverture

### Task 17: Canari hebdo

- Action GitHub hebdo : tirer un sujet au hasard dans une liste → compose → Zod → render d'1 frame → échec = alerte.
**Commit** `ci: weekly canari`.

### Task 18: Banc de 20 sujets + taux de réussite

- CLI sur 20 sujets listés → compter les échecs par étape → écrire `out/report.json` (même structure que le `report.json` du studio). Itérer jusqu'à plus de 90 % de réussite.

### Task 19: Golden-suite CI

- `pnpm -r test` en CI sur chaque push (engine goldens + API round-trips + archetypes smoke).

---

## Ordre des Milestones (si priorités à temps)

M0 → M1 → M2 → M3 (le pipeline est testable en CLI, indépendant du web) → M4 → M5 → M6 → M7 → M8. M2 et M3 peuvent s'alterner : écrire 2-3 archetypes d'abord (pour que le storyboard ait quelque chose à remplir), donc **démarrer M2 avant M3**.
