import type { NextRequest } from 'next/server';
import { ProjectSettingsZ } from '@what-if/engine/settings';
import { json, llmOrNull, readJson, sessionUserId } from '@/lib/api-ctx';
import { rewriteBeat } from '@/lib/script-flow';

// POST /api/episodes/rewrite — three variants of one beat, nothing else.

export async function POST(req: NextRequest): Promise<Response> {
  const userId = await sessionUserId();
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const body = await readJson(req);
  if (!body || typeof body.text !== 'string') return json({ error: 'bad_json' }, 400);
  const settings = ProjectSettingsZ.safeParse(body.settings ?? {});
  if (!settings.success) return json({ error: 'bad_json' }, 400);

  const res = await rewriteBeat(llmOrNull(), {
    text: body.text,
    topic: typeof body.topic === 'string' ? body.topic : undefined,
    instruction: typeof body.instruction === 'string' ? body.instruction : undefined,
    settings: settings.data,
  });
  if (res.status === 200) return json({ variants: res.variants }, 200);
  if (res.status === 400) return json({ error: res.error }, 400);
  if (res.status === 503) return json({ error: res.error }, 503);
  return json({ error: res.error, note: res.note }, 502);
}
