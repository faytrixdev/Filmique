import type { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleExportRepo } from '@/db/exports-repo';
import { postExportCallback, type ExportCtx } from '@/lib/export-flow';

// Render-final callback from the render Lambda. Guarded by a shared secret
// header so only our function can flip a job to done / failed.

const ctxFor = (): ExportCtx => {
  const db = getDb();
  return {
    episodeRepo: drizzleEpisodeRepo(db),
    exports: drizzleExportRepo(db),
    render: null,
    gate: { charge: async () => true },
    userId: null,
  };
};

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.EXPORT_CALLBACK_SECRET;
  const authorized = secret !== undefined && req.headers.get('x-export-token') === secret;
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  return postExportCallback(ctxFor(), payload, authorized ?? false);
}
