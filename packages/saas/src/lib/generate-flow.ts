import { EpisodeJsonZ, type EpisodeJson } from '@what-if/engine/schema';
import { composeEpisode, composeFromScript, ScriptDraftZ, type ScriptDraft } from '@what-if/engine/compose';
import type { LlmProvider } from '@what-if/engine/providers/llm';
import type { ProjectSettings } from '@what-if/engine/settings';
import type { EpisodeRepo, EpisodeRow } from './episodes';

// New episode: topic (→ script) → compose → Zod gate → stored row. When the
// wizard already validated a script, phase 1 is skipped: the user's beats are
// the source of truth and only science + storyboard + sound are composed.

export type GenerateResult =
  | { status: 201; row: EpisodeRow; episode: EpisodeJson }
  | { status: 400; error: 'bad_topic' | 'bad_script' }
  | { status: 502; error: 'compose_failed'; note: string }
  | { status: 503; error: 'unconfigured' };

export const generateEpisode = async (
  deps: { repo: EpisodeRepo; userId: string },
  llm: LlmProvider | null, // null = no provider configured
  input: { topic: string; tone?: string; settings?: Partial<ProjectSettings>; script?: unknown },
): Promise<GenerateResult> => {
  const topic = input.topic.trim();
  if (topic.length < 8) return { status: 400, error: 'bad_topic' };
  if (!llm) return { status: 503, error: 'unconfigured' };

  let script: ScriptDraft | null = null;
  if (input.script !== undefined) {
    const checkedScript = ScriptDraftZ.safeParse(input.script);
    if (!checkedScript.success) return { status: 400, error: 'bad_script' };
    script = checkedScript.data;
  }

  let episode: EpisodeJson;
  try {
    const composeInput = {
      topic,
      tone: input.tone,
      settings: input.settings,
      id: `ep_${Date.now()}`,
      slug: undefined,
    };
    ({ episode } = script
      ? await composeFromScript(composeInput, script, llm)
      : await composeEpisode(composeInput, llm));
  } catch (err) {
    return { status: 502, error: 'compose_failed', note: err instanceof Error ? err.message : String(err) };
  }

  const checked = EpisodeJsonZ.safeParse(episode);
  if (!checked.success) {
    return { status: 502, error: 'compose_failed', note: 'schema gate rejected the draft' };
  }

  const row = await deps.repo.insert({ userId: deps.userId, episode: checked.data });
  return { status: 201, row, episode: checked.data };
};
