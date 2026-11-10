import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { drizzleEpisodeRepo, getDb } from '@/db/episodes-repo';
import { readSession, SESSION_COOKIE, authSecret } from '@/lib/auth';
import { getEpisodesList, postEpisodes, type ApiCtx } from '@/lib/api-episodes';

// Route wiring only: builds the drizzle repo and resolves the session user id,

const ctxFor = async (): Promise<ApiCtx> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const repo = drizzleEpisodeRepo(getDb());
  const userId = session ? await repo.userIdByEmail(session.email) : null;
  return { repo, userId };
};

export async function POST(req: NextRequest): Promise<Response> {
  return postEpisodes(await ctxFor(), req);
}

export async function GET(): Promise<Response> {
  return getEpisodesList(await ctxFor());
}
