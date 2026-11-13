import { z } from 'zod';
import { extractJson, type LlmProvider } from './providers';
import { LlmRateLimitError } from './providers/llm';
import { EpisodeJsonZ, FxZ, PowerZ, EditZ, ScriptBeatZ, ScienceZ, ShotZ, VoiceZ, type EpisodeJson } from './schema';
import { scriptPrompt } from './prompts/script';
import { sciencePrompt } from './prompts/science';
import { storyboardPrompt } from './prompts/storyboard';
import { DIRECTOR_SYSTEM } from './prompts/system';
import { soundRules } from './sound/rules';

// composeEpisode: the four knobs in one call —
//   1. draftScript      (LLM)   the hook → premise → numbered twist → looming question
//   2. draftScience     (LLM)   every quoted figure gets a working + a public source
//   3. draftStoryboard  (LLM)   shots bounded to the archetype registry, then
//                               deterministically adapted to the requested duration
//   4. draftSound       (code)  events/repeats/levels from the storyboard + catalogue
// Each LLM step retries on its own: the base prompt is re-sent with the exact Zod error
// appended, so a malformed reply costs one round-trip, never the episode.

const MAX_STEP_ATTEMPTS = 4;

export type ComposeInput = {
  topic: string;
  tone?: string;
  durationS?: number;
  voiceId?: string;
  id?: string;
  slug?: string;
};

export type EpisodeDraft = { episode: EpisodeJson };

export const ScriptDraftZ = z.object({
  title: z.array(z.string().min(1)).min(1).max(2),
  accent: z.string().optional(),
  power: PowerZ.optional(),
  script: z.array(ScriptBeatZ).min(4).max(12),
});
export type ScriptDraft = z.infer<typeof ScriptDraftZ>;

export const ScienceDraftObjZ = z.object({ science: z.array(ScienceZ).max(8) });
export const ScienceDraftZ = ScienceDraftObjZ.transform((d) => d.science);
export type ScienceDraft = z.infer<typeof ScienceDraftZ>;

export const StoryboardDraftZ = z.object({
  cast: z.array(z.string()).default([]),
  shots: z.array(ShotZ).min(4).max(20),
  edit: z.array(EditZ).default([]),
  fx: z.array(FxZ).default([]),
  tail: z.number().min(0.4).max(4).default(1.2),
});
export type StoryboardDraft = z.infer<typeof StoryboardDraftZ>;

// Deterministic tightening: each retry cools the temperature so the model
// trades creativity for constraint adherence exactly when it must comply.
const retryTemperature = (attempt: number): number => [0.8, 0.5, 0.3, 0.2][attempt] ?? 0.2;

/** Runs one LLM step: re-asks with the exact Zod failure appended, up to 4 attempts. */
export const draftStep = async <T>(llm: LlmProvider, zod: z.ZodType<T>, basePrompt: () => string): Promise<T> => {
  let prompt = basePrompt();
  let lastErr = '';
  // Rate limits are a pacing problem, not a quality problem: wait out the
  // provider's retry-after instead of spending a quality attempt on it.
  let rateWaits = 0;
  for (let i = 0; i < MAX_STEP_ATTEMPTS; i++) {
    let parsed: unknown;
    try {
      parsed = extractJson(await llm.generateText(prompt, { system: DIRECTOR_SYSTEM, json: true, temperature: retryTemperature(i) }));
    } catch (e) {
      if (e instanceof LlmRateLimitError && rateWaits < 3) {
        rateWaits++;
        await new Promise((r) => setTimeout(r, Math.min(20, e.retryAfterS) * 1000));
        i--; // the wait is not a failed generation
        continue;
      }
      // Surface the real failure (HTTP 401 key, 404 model, 429 quota, bad JSON…)
      // instead of mislabeling everything "réponse non JSON".
      lastErr = e instanceof Error ? e.message.slice(0, 300) : String(e);
      prompt = askAgain(basePrompt(), lastErr);
      continue;
    }
    const check = zod.safeParse(parsed);
    if (check.success) return check.data;
    lastErr = JSON.stringify(check.error.issues.slice(0, 6)).slice(0, 400);
    prompt = askAgain(basePrompt(), lastErr);
  }
  throw new Error(`compose step failed after ${MAX_STEP_ATTEMPTS} attempts: ${lastErr}`);
};

const askAgain = (base: string, err: string) =>
  `${base}\n\nCORRECTIF — ta réponse précédente a été rejetée : ${err}\nRenvoie UN objet JSON qui passe ce critère exactement.`;

// ---------- step implementations ----------

const scriptChars = (sc: ScriptDraft) => sc.script.reduce((n, b) => n + b.text.length, 0);

export const draftScript = async (input: ComposeInput, llm: LlmProvider): Promise<ScriptDraft> => {
  // Length belongs to the validated schema, not a post-check: a too-short or
  // too-long draft re-enters the retry loop with the exact char budget instead
  // of killing the whole compose.
  const secs = input.durationS ?? 24;
  const target = Math.round(secs * 8.5);
  const zod = ScriptDraftZ.refine((sc) => {
    const chars = scriptChars(sc);
    return chars >= target * 0.65 && chars <= target * 1.4;
  }, { message: `script length must total ~${target} chars (${Math.round(target * 0.65)}-${Math.round(target * 1.4)}), écris plus court` });
  return draftStep(llm, zod, () => scriptPrompt(input).prompt);
};

export const draftScience = async (script: ScriptDraft, llm: LlmProvider): Promise<ScienceDraft> => {
  // The digits check lives in the validated schema: an empty science with
  // quoted figures re-enters the retry loop instead of killing the compose.
  const digits = script.script.some((b) => /\d/.test(b.text));
  const zod = digits
    ? ScienceDraftObjZ.refine((d) => d.science.length > 0, {
        message: 'science is mandatory: le script cite des chiffres, donne chacun une affirmation + une source publique',
      })
    : ScienceDraftObjZ;
  const d = await draftStep(llm, zod, () => sciencePrompt(script.script).prompt);
  return d.science;
};

export const draftStoryboard = async (input: ComposeInput, script: ScriptDraft, science: ScienceDraft, llm: LlmProvider): Promise<StoryboardDraft> => {
  const { ARCHETYPES } = await import('./archetypes/index');
  const sb = await draftStep(llm, StoryboardDraftZ, () =>
    storyboardPrompt({ topic: input.topic, title: script.title, script: script.script, science, durationS: input.durationS, ARCHETYPES }).prompt,
  );
  return adaptStoryboard(sb, input.durationS);
};

// ---------- deterministic adaptation (the SaaS ceiling: zero Zod surprises out) ----------

let castOk: string[] | null = null;
const validCast = async (): Promise<string[]> => {
  if (castOk) return castOk;
  const { LOOKS } = await import('./rig');
  castOk = Object.keys(LOOKS);
  return castOk;
};

export const adaptStoryboard = async (sb: StoryboardDraft, durationS?: number): Promise<StoryboardDraft> => {
  const fps = 30;
  const allowed = await validCast();
  const { ARCHETYPES } = await import('./archetypes/index');
  const shots = sb.shots.map((s, i) => ({
    ...s,
    id: `S${i + 1}`,
    key: Math.min(80, Math.max(8, Math.round(s.key))),
    set: s.set.toLowerCase(),
    // unknown archetype: keep the shot, drop the binding (the registry gate would refuse)
    archetype: s.archetype && ARCHETYPES[s.archetype] ? s.archetype : undefined,
  }));
  // duration adaptation: scale the shot keys toward durationS without touching the order
  if (durationS && durationS > 3) {
    const target = Math.round(durationS * fps) - Math.round(sb.tail * fps);
    const sum = shots.reduce((n, s) => n + s.key, 0);
    const ratio = target / sum;
    if (ratio >= 0.55 && ratio <= 1.8 && Math.abs(sum - target) / target > 0.05) {
      let re = 0;
      for (const s of shots) {
        s.key = Math.min(80, Math.max(8, Math.round(s.key * ratio)));
        re += s.key;
      }
      // nudge the last shot to land on the target as close as rounds allow
      const diff = target - re;
      if (diff !== 0) {
        const last = shots[shots.length - 1];
        last.key = Math.min(80, Math.max(8, last.key + diff));
      }
    }
  }
  const ids = new Set(shots.map((s) => s.id));
  return {
    cast: sb.cast.filter((c) => allowed.includes(c)),
    shots,
    edit: sb.edit.filter((e) => ids.has(e.shot)),
    fx: sb.fx.filter((fx) => fx != null),
    tail: sb.tail,
  };
};

const slugify = (topic: string): string =>
  topic
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'episode';

// ---------- sound (deterministic, from the storyboard + clip catalogue) ----------

export const draftSound = (sb: StoryboardDraft, tone?: string): EpisodeJson['sound'] =>
  soundRules({ shots: sb.shots, edit: sb.edit, fx: sb.fx, tone, tailS: sb.tail }) as EpisodeJson['sound'];

// ---------- whole pipeline ----------

export const composeEpisode = async (input: ComposeInput, llm: LlmProvider): Promise<EpisodeDraft> => {
  const script = await draftScript(input, llm);
  const science = await draftScience(script, llm);
  const sb = await draftStoryboard(input, script, science, llm);

  const episode = EpisodeJsonZ.parse({
    id: input.id ?? 'Draft',
    slug: input.slug ?? slugify(input.topic),
    topic: input.topic,
    title: script.title,
    accent: script.accent,
    power: script.power,
    script: script.script,
    science,
    voice: input.voiceId
      ? VoiceZ.parse({ id: input.voiceId, model: 'cartesia-sonic-2', settings: { stability: 0.5, similarity_boost: 0.75 } })
      : undefined,
    cast: sb.cast.length ? sb.cast : ['pipHood'],
    shots: sb.shots,
    edit: sb.edit,
    tail: sb.tail,
    fx: sb.fx,
    sound: draftSound(sb, input.tone),
  });
  return { episode };
};
