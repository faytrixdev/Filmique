import { EpisodeJsonZ, type EpisodeJson } from '@what-if/engine/schema';
import { composeEpisode } from '@what-if/engine/compose';
import type { LlmProvider } from '@what-if/engine/providers/llm';
import type { EpisodeRepo, EpisodeRow } from './episodes';

// New episode: topic → compose → Zod gate → stored row. Pure, then a thin route.

export type GenerateResult =
  | { status: 201; row: EpisodeRow; episode: EpisodeJson }
  | { status: 400; error: 'bad_topic' }
  | { status: 502; error: 'compose_failed'; note: string }
  | { status: 503; error: 'unconfigured' };

export const generateEpisode = async (
  deps: { repo: EpisodeRepo; userId: string },
  llm: LlmProvider | null, // null = no provider configured
  input: { topic: string; tone?: string },
): Promise<GenerateResult> => {
  const topic = input.topic.trim();
  if (topic.length < 8) return { status: 400, error: 'bad_topic' };
  if (!llm) return { status: 503, error: 'unconfigured' };

  let episode: EpisodeJson;
  try {
    ({ episode } = await composeEpisode(
      { topic, tone: input.tone, id: `ep_${Date.now()}`, slug: undefined },
      llm,
    ));
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
