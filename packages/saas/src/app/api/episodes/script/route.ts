import type { NextRequest } from 'next/server';
import { ProjectSettingsZ } from '@what-if/engine/settings';
import { json, llmOrNull, readJson, sessionUserId } from '@/lib/api-ctx';
import { draftScriptFor } from '@/lib/script-flow';

// POST /api/episodes/script — phase 1: the beats, no mise en scène yet.

export async function POST(req: NextRequest): Promise<Response> {
  const userId = await sessionUserId();
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const body = await readJson(req);
  if (!body || typeof body.topic !== 'string') return json({ error: 'bad_json' }, 400);
  const settings = ProjectSettingsZ.safeParse(body.settings ?? {});
  if (!settings.success) return json({ error: 'bad_json' }, 400);

  const res = await draftScriptFor(llmOrNull(), { topic: body.topic, settings: settings.data });
  if (res.status === 200) return json({ script: res.script }, 200);
  if (res.status === 400) return json({ error: res.error }, 400);
  if (res.status === 503) return json({ error: res.error }, 503);
  return json({ error: res.error, note: res.note }, 502);
}
