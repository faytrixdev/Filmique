import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { drizzleEpisodeRepo, getDb } from '@/db/episodes-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { deleteEpisodeById, getEpisodeById, putEpisode, type ApiCtx } from '@/lib/api-episodes';

// Route wiring only: resolves the session user from the cookie over the drizzle
// repo, then delegates to the pure HTTP layer in ./lib/api-episodes.

const ctxFor = async (): Promise<ApiCtx> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const repo = drizzleEpisodeRepo(getDb());
  const userId = session ? await repo.userIdByEmail(session.email) : null;
  return { repo, userId };
};

type CFR = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: CFR): Promise<Response> {
  return getEpisodeById(await ctxFor(), (await params).id);
}

export async function PUT(req: NextRequest, { params }: CFR): Promise<Response> {
  return putEpisode(await ctxFor(), (await params).id, req);
}

export async function DELETE(_req: NextRequest, { params }: CFR): Promise<Response> {
  return deleteEpisodeById(await ctxFor(), (await params).id);
}
