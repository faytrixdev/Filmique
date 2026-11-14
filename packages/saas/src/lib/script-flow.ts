import { composeScript, rewriteBeatDraft, type ScriptDraft } from '@what-if/engine/compose';
import type { LlmProvider } from '@what-if/engine/providers/llm';
import { resolveSettings, type ProjectSettings } from '@what-if/engine/settings';

// Phase 1 of the script-first flow: the beats alone, before any mise en scène.
// Rewriting reuses the engine's LLM step machinery (retry with the Zod failure
// appended), so a malformed reply never costs the user their request.

export type ScriptApiResult =
  | { status: 200; script: ScriptDraft }
  | { status: 400; error: 'bad_topic' }
  | { status: 502; error: 'compose_failed'; note: string }
  | { status: 503; error: 'unconfigured' };

export const draftScriptFor = async (
  llm: LlmProvider | null,
  input: { topic: string; settings?: Partial<ProjectSettings> },
): Promise<ScriptApiResult> => {
  const topic = input.topic.trim();
  if (topic.length < 8) return { status: 400, error: 'bad_topic' };
  if (!llm) return { status: 503, error: 'unconfigured' };
  try {
    const script = await composeScript({ topic, settings: input.settings }, llm);
    return { status: 200, script };
  } catch (err) {
    return { status: 502, error: 'compose_failed', note: err instanceof Error ? err.message : String(err) };
  }
};

export type RewriteApiResult =
  | { status: 200; variants: string[] }
  | { status: 400; error: 'bad_text' }
  | { status: 502; error: 'compose_failed'; note: string }
  | { status: 503; error: 'unconfigured' };

export const rewriteBeat = async (
  llm: LlmProvider | null,
  input: { text: string; topic?: string; instruction?: string; settings?: Partial<ProjectSettings> },
): Promise<RewriteApiResult> => {
  const text = input.text.trim();
  if (text.length < 3) return { status: 400, error: 'bad_text' };
  if (!llm) return { status: 503, error: 'unconfigured' };
  const s = resolveSettings(input.settings);
  // One beat should stay a fraction of the film: cap it at a third of the script.
  const budget = Math.max(60, Math.round((s.durationS * 8.5) / 3));
  try {
    const draft = await rewriteBeatDraft(
      {
        text,
        topic: input.topic?.trim() || 'film court hypothétique',
        instruction: input.instruction?.trim() || 'libre',
        narration: s.narration,
        budget,
      },
      llm,
    );
    return { status: 200, variants: draft.variants };
  } catch (err) {
    return { status: 502, error: 'compose_failed', note: err instanceof Error ? err.message : String(err) };
  }
};
