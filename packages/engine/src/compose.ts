import { z } from 'zod';
import { extractJson, type LlmProvider } from './providers';
import { LlmRateLimitError } from './providers/llm';
import { EpisodeJsonZ, FxZ, PowerZ, EditZ, ScriptBeatZ, ScienceZ, ShotZ, VoiceZ, type EpisodeJson } from './schema';
import { scriptPrompt, rewritePrompt } from './prompts/script';
import { sciencePrompt } from './prompts/science';
import { storyboardPrompt } from './prompts/storyboard';
import { DIRECTOR_SYSTEM } from './prompts/system';
import { soundRules } from './sound/rules';
import { resolveSettings, scriptCharBudget, SCRIPT_CHAR_MAX, SCRIPT_CHAR_MIN, type Narration, type ProjectSettings } from './settings';
import { bindVisuals, pairBeats, demandedWords, normalize, shotText } from './visuals';
import { coerceProps } from './props-coerce';

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
  settings?: Partial<ProjectSettings>;
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

export const StoryboardDraftZ = z.object({  cast: z.array(z.string()).default([]),
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
  const s = resolveSettings(input.settings);
  const secs = input.durationS ?? s.durationS;
  const target = scriptCharBudget(secs);
  // The retry loop feeds this message back verbatim to the model: it must say
  // where the draft stands and which way to move, not just restate the window.
  const zod = ScriptDraftZ.superRefine((sc, ctx) => {
    const chars = scriptChars(sc);
    const min = Math.round(target * SCRIPT_CHAR_MIN);
    const max = Math.round(target * SCRIPT_CHAR_MAX);
    if (chars < min || chars > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          chars < min
            ? `script trop court : ${chars} caractères, il en faut ${min}-${max} pour ${secs} s — allonge chaque beat ou ajoute un beat (${min - chars} caractères manquants)`
            : `script trop long : ${chars} caractères, maximum ${max} pour ${secs} s — raccourcis chaque beat (${chars - max} caractères en trop)`,
      });
    }
  });
  return draftStep(llm, zod, () =>
    scriptPrompt({ topic: input.topic, tone: input.tone ?? s.tone, durationS: secs, narration: s.narration }).prompt,
  );
};

// One beat, three variants: same retry loop, same JSON discipline as compose.
export const RewriteDraftZ = z.object({ variants: z.array(z.string().min(1).max(400)).min(1).max(3) });
export type RewriteDraft = z.infer<typeof RewriteDraftZ>;

export const rewriteBeatDraft = (
  input: { text: string; topic: string; instruction?: string; narration?: Narration; budget: number },
  llm: LlmProvider,
): Promise<RewriteDraft> => draftStep(llm, RewriteDraftZ, () => rewritePrompt(input));

export const draftScience = async (script: ScriptDraft, llm: LlmProvider): Promise<ScienceDraft> => {  // The digits check lives in the validated schema: an empty science with
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
  const { LOOKS } = await import('./rig');
  const s = resolveSettings(input.settings);
  const secs = input.durationS ?? s.durationS;
  const sb = await draftStep(llm, StoryboardDraftZ, () =>
    storyboardPrompt({
      topic: input.topic,
      title: script.title,
      script: script.script,
      science,
      durationS: secs,
      world: s.world,
      rhythm: s.rhythm,
      cast: Object.keys(LOOKS),
      format: s.format,
      ARCHETYPES,
    }).prompt,
  );
  const adapted = await adaptStoryboard(sb, secs);
  const bound = await bindVisuals(adapted.shots, script.script, adapted.edit, llm);
  if (process.env.HF_BIND_DEBUG) {
    console.log('[bind] repaired', bound.repaired, 'still missing', JSON.stringify(bound.stillMissing));
  }
  if (bound.repaired > 0) {
    adapted.shots = adapted.shots.map((shot) => {
      const fix = bound.fixes[shot.id];
      if (!fix) return shot;
      return { ...shot, archetype: fix.archetype, archetypeProps: fix.props };
    });
  }
  adapted.shots = hardenStoryboard(adapted.shots, script.title, script.script);
  return adapted;
};

/** The rules the model breaks most often, enforced by the engine: a title always
 * has two lines and closes the film, a free scene always shows something named
 * after its beat, a schematic keeps its centre short. */
export const hardenStoryboard = (shots: StoryboardDraft['shots'], title: string[], beats: { beat: string; text: string }[]): StoryboardDraft['shots'] => {
  const pairs = pairBeats(shots, beats, []);
  const hardened = shots.map((shot) => {
    const props = (shot.archetypeProps ?? {}) as Record<string, unknown>;
    const beatText = pairs.get(shot.id) ?? '';
    const wanted = demandedWords(beatText);
    const noun = wanted[0]?.toUpperCase() ?? '';
    if (shot.archetype === 'titleReveal') {
      const lines = Array.isArray(props.lines) ? (props.lines as string[]) : [];
      const first = (lines[0] ?? '').trim() || title[0] || '';
      const second = (lines[1] ?? '').trim() || title[1] || title[0] || '';
      if (first === lines[0] && second === lines[1]) return shot;
      return { ...shot, archetypeProps: { ...props, lines: [first, second] } };
    }
    if (shot.archetype === 'schematicClaim') {
      // `center` lives inside a 130 px circle: a whole sentence there bleeds across the frame. Keep the short token, demote the sentence to the legend.
      const center = typeof props.center === 'string' ? props.center.trim() : '';
      const value = typeof props.value === 'string' ? props.value.trim() : '';
      if (center.length > 9) {
        const words = center.split(/\s+/).filter(Boolean);
        const token = words.find((w) => /\d/.test(w)) ?? words[0] ?? '';
        return { ...shot, archetypeProps: { ...props, center: token, value: value || center } };
      }
      return shot;
    }
    if (shot.archetype === 'scene' || shot.archetype === 'present') {
      // the beat's noun has to reach the picture: a caption covers it, otherwise the
      // object's label must name it (a model often labels an object with a verb)
      const shown = normalize(shotText(props).join(' '));
      const covers = wanted.length === 0 || wanted.some((w) => shown.includes(w));
      if (shot.archetype === 'scene') {
        const objects = Array.isArray(props.objects) ? (props.objects as Record<string, unknown>[]) : [];
        if (objects.length === 0) {
          if (typeof props.caption === 'string' && props.caption.trim().length > 0) return shot;
          return { ...shot, archetypeProps: { ...props, objects: [{ kind: 'ticket', label: noun, x: 0.72, y: 0.55, s: 1, rot: 0, at: 2, anim: 'pop' }] } };
        }
        if (covers || !noun) return shot;
        const first = objects[0] ?? {};
        const next = { ...first, label: noun };
        return { ...shot, archetypeProps: { ...props, objects: [next, ...objects.slice(1)] } };
      }
      const object = props.object as Record<string, unknown> | undefined;
      const caption = typeof props.caption === 'string' ? props.caption : '';
      if (!object || (typeof object.label === 'string' ? object.label.trim().length === 0 : true)) {
        if (caption.trim().length > 0) return shot;
        return { ...shot, archetypeProps: { ...props, object: { ...(object ?? {}), kind: 'ticket', label: noun, x: 0.62, y: 0.55, s: 1, rot: 0, at: 2, anim: 'pop' } } };
      }
      if (covers || !noun) return shot;
      return { ...shot, archetypeProps: { ...props, object: { ...object, label: noun } } };
    }
    return shot;
  });
  // the title is the signature: whatever the model ordered, it lands on the last shot
  const last = hardened.map((s) => s.archetype).lastIndexOf('titleReveal');
  if (last >= 0 && last < hardened.length - 1) {
    const [titleShot] = hardened.splice(last, 1);
    hardened.push(titleShot);
  }
  return hardened;
};

// ---------- deterministic adaptation (the SaaS ceiling: zero Zod surprises out) ----------

let castOk: string[] | null = null;
const validCast = async (): Promise<string[]> => {
  if (castOk) return castOk;
  const { LOOKS } = await import('./rig');
  castOk = Object.keys(LOOKS);
  return castOk;
};

// LLM-written archetype props drift (numbers as strings, invented enum values,
// nulls, single lines): one coercion round per Zod issue batch, then strip the
// props — the archetype keeps rendering with schema defaults, never black.
export { coerceProps } from './props-coerce';

// archetypes whose picture is only text: with nothing written they render an empty plate
const TEXT_ONLY = new Set(['schematicClaim', 'schematicBar']);

export const adaptStoryboard = async (sb: StoryboardDraft, durationS?: number): Promise<StoryboardDraft> => {
  const fps = 30;
  const allowed = await validCast();
  const { ARCHETYPES } = await import('./archetypes/index');
  const { SCENE_SETS } = await import('./archetypes/scene');
  const shots = sb.shots.map((s, i) => {
    // unknown archetype names fall back to the generic scene — never an unbound black segment
    const { archetypeProps: rawProps, ...rest } = s;
    let arch = s.archetype ? (ARCHETYPES[s.archetype] ? s.archetype : 'scene') : undefined;
    let props = rawProps ?? undefined;
    if (arch) {
      const coerced = coerceProps(ARCHETYPES[arch].PropsZ, props ?? {});
      if (coerced) {
        props = coerced;
      } else if (!ARCHETYPES[arch].PropsZ.safeParse({}).success) {
        // the archetype cannot render without the props it missed: the generic
        // scene shows the beat instead of an empty prop
        arch = 'scene';
        props = undefined;
      } else {
        props = undefined;
      }
      // a chart with no text at all is a dead frame: the generic scene shows the beat instead
      if (arch && TEXT_ONLY.has(arch) && !shotText(props as Record<string, unknown> | undefined).some((t) => t.trim().length > 0)) {
        arch = 'scene';
        props = undefined;
      }
      if (arch === 'scene' || arch === 'present') {
        const wanted = String(s.set ?? '').toLowerCase();
        if (SCENE_SETS.includes(wanted as (typeof SCENE_SETS)[number])) {
          props = { ...(props ?? {}), set: wanted };
        }
      }
    }
    return {
      ...rest,
      id: `S${i + 1}`,
      key: Math.min(80, Math.max(8, Math.round(s.key))),
      set: s.set.toLowerCase(),
      archetype: arch,
      ...(props !== undefined ? { archetypeProps: props } : {}),
    };
  });
  // duration adaptation: the model writes storyboard keys in its own units, so the plan is
  // always rescaled to fill the requested duration. Each shot keeps its weight, clamped to
  // a legible minimum and a maximum, and the rounding drift is spread over the longest shots.
  if (durationS && durationS > 3 && shots.length > 0) {
    const MIN_KEY = 14;
    const target = Math.round(durationS * fps) - Math.round(sb.tail * fps);
    // A sparse long film (4-6 beats at 60 s) needs shots longer than the usual
    // 8 s cap to fill the plan: cap at the average when that is higher, so the
    // sound clock (built from the keys) always reaches the requested duration.
    const MAX_KEY = Math.max(240, Math.ceil(target / shots.length));
    const sum = shots.reduce((n, s) => n + s.key, 0);
    if (sum > 0 && target > MIN_KEY * shots.length && Math.abs(sum - target) / target > 0.02) {
      const ratio = target / sum;
      for (const s of shots) s.key = Math.min(MAX_KEY, Math.max(MIN_KEY, Math.round(s.key * ratio)));
      for (let pass = 0; pass < 4; pass++) {
        const diff = target - shots.reduce((n, s) => n + s.key, 0);
        if (diff === 0) break;
        const step = diff > 0 ? 1 : -1;
        let left = Math.abs(diff);
        const order = [...shots].sort((a, b) => (step > 0 ? b.key - a.key : a.key - b.key));
        while (left > 0) {
          let moved = false;
          for (const s of order) {
            const next = s.key + step;
            if (left === 0) break;
            if (next < MIN_KEY || next > MAX_KEY) continue;
            s.key = next;
            left -= 1;
            moved = true;
          }
          if (!moved) break;
        }
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

/** Phase 1 of the script-first flow: the script alone, before any mise en scène. */
export const composeScript = (input: ComposeInput, llm: LlmProvider): Promise<ScriptDraft> =>
  draftScript(input, llm);

/** Phase 2: a validated script becomes a full episode (science → shots → sound). */
export const composeFromScript = async (input: ComposeInput, script: ScriptDraft, llm: LlmProvider): Promise<EpisodeDraft> => {
  // Top-level durationS (compose-cli --secs) is part of the settings contract:
  // persist it, or the episode records 24 s while the prompts said 60.
  const s = resolveSettings({ ...input.settings, ...(input.durationS ? { durationS: input.durationS } : {}) });
  const voiceId = input.voiceId ?? s.voiceId;
  const science = await draftScience(script, llm);
  const sb = await draftStoryboard(input, script, science, llm);

  const episode = EpisodeJsonZ.parse({
    id: input.id ?? 'Draft',
    slug: input.slug ?? slugify(input.topic),
    topic: input.topic,
    title: script.title,
    accent: script.accent,
    power: script.power,
    settings: s,
    script: script.script,
    science,
    voice: voiceId
      ? VoiceZ.parse({ id: voiceId, model: 'cartesia-sonic-2', settings: { stability: 0.5, similarity_boost: 0.75 } })
      : undefined,
    cast: sb.cast.length ? sb.cast : ['pipHood'],
    shots: sb.shots,
    edit: sb.edit,
    tail: sb.tail,
    fx: sb.fx,
    sound: draftSound(sb, input.tone ?? s.tone),
  });
  return { episode };
};

export const composeEpisode = async (input: ComposeInput, llm: LlmProvider): Promise<EpisodeDraft> =>
  composeFromScript(input, await composeScript(input, llm), llm);
