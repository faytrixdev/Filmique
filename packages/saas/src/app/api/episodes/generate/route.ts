import type { NextRequest } from 'next/server';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { postGenerate } from '@/lib/api-generate';
import { getLlmProvider } from '@what-if/engine/providers/llm';

// POST /api/episodes/generate — topic → composeEpisode → stored episode row.

export async function POST(req: NextRequest): Promise<Response> {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const userId = session ? await drizzleEpisodeRepo(getDb()).userIdByEmail(session.email) : null;
  // Any provider misconfiguration (missing key, unknown name) degrades to 503, never a 500.
  const llm = (() => {
    try {
      return getLlmProvider();
    } catch {
      return null;
    }
  })();
  return postGenerate({ repo: drizzleEpisodeRepo(getDb()), userId, llm }, req);
}
