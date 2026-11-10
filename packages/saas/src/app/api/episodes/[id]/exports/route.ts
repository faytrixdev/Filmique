import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleExportRepo } from '@/db/exports-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getExports, type ExportCtx } from '@/lib/export-flow';

const ctxFor = async (): Promise<ExportCtx> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const db = getDb();
  return {
    episodeRepo: drizzleEpisodeRepo(db),
    exports: drizzleExportRepo(db),
    render: null,
    gate: { charge: async () => true },
    userId: session ? (await drizzleEpisodeRepo(db).userIdByEmail(session.email)) ?? null : null,
  };
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return getExports(await ctxFor(), id);
}
