import { ProjectSettingsZ } from '@what-if/engine/settings';
import { generateEpisode } from './generate-flow';
import type { EpisodeRepo } from './episodes';
import type { LlmProvider } from '@what-if/engine/providers/llm';

// Pure HTTP layer for POST /api/episodes/generate (compose from a topic, or from
// a script the wizard already validated).

export type GenerateApiCtx = { repo: EpisodeRepo; userId: string | null; llm: LlmProvider | null };

type Body = { topic?: string; tone?: string; settings?: unknown; script?: unknown };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const postGenerate = async (ctx: GenerateApiCtx, req: Request): Promise<Response> => {
  if (!ctx.userId) return json({ error: 'unauthorized' }, 401);
  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (typeof body?.topic !== 'string') return json({ error: 'bad_json' }, 400);

  // Missing settings = defaults; malformed settings = 400 (never a silent reset).
  const settings = ProjectSettingsZ.safeParse(body.settings ?? {});
  if (!settings.success) return json({ error: 'bad_json' }, 400);

  const res = await generateEpisode({ repo: ctx.repo, userId: ctx.userId }, ctx.llm, {
    topic: body.topic,
    tone: body.tone,
    settings: settings.data,
    script: body.script,
  });
  if (res.status === 201) {
    return json({ id: res.row.id, slug: res.row.slug, title: res.episode.title, status: res.row.status }, 201);
  }
  if (res.status === 400) return json({ error: res.error }, 400);
  return json({ error: res.error, ...(res.error === 'compose_failed' ? { note: res.note } : {}) }, res.status);
};
