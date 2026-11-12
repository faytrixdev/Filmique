import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleExportRepo } from '@/db/exports-repo';
import { drizzleCreditRepo } from '@/db/credits-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { creditGateFrom } from '@/lib/credits';
import { postExport, setAudioLookup, type ExportCtx } from '@/lib/export-flow';
import { cloudrunRender, lambdaRender } from '@/lib/render-adapter';

const ctxFor = async (): Promise<ExportCtx> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const db = getDb();
  const episodeRepo = drizzleEpisodeRepo(db);
  const userId = session ? await episodeRepo.userIdByEmail(session.email) : null;
  const exports = drizzleExportRepo(db);
  setAudioLookup((episodeId) => exports.latestAudio(episodeId));
  // backend by env: AWS Lambda first, then GCP Cloud Run, else null (503 render_unconfigured)
  const render = lambdaRender() ?? cloudrunRender();
  return { episodeRepo, exports, render, gate: creditGateFrom(drizzleCreditRepo(db)), userId };
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return postExport(await ctxFor(), id);
}
