import { generateEpisode } from './generate-flow';
import type { EpisodeRepo } from './episodes';
import type { LlmProvider } from '@what-if/engine/providers/llm';

// Pure HTTP layer for POST /api/episodes/generate (compose from a topic).

export type GenerateApiCtx = { repo: EpisodeRepo; userId: string | null; llm: LlmProvider | null };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const postGenerate = async (ctx: GenerateApiCtx, req: Request): Promise<Response> => {
  if (!ctx.userId) return json({ error: 'unauthorized' }, 401);
  let body: { topic?: string; tone?: string } | null = null;
  try {
    body = (await req.json()) as { topic?: string; tone?: string };
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (typeof body?.topic !== 'string') return json({ error: 'bad_json' }, 400);
  const res = await generateEpisode({ repo: ctx.repo, userId: ctx.userId }, ctx.llm, { topic: body.topic, tone: body.tone });
  if (res.status === 201) {
    return json({ id: res.row.id, slug: res.row.slug, title: res.episode.title, status: res.row.status }, 201);
  }
  return json({ error: res.error, ...(res.error === 'compose_failed' ? { note: res.note } : {}) }, res.status);
};
