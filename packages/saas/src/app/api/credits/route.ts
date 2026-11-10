import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleCreditRepo } from '@/db/credits-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { balanceOf } from '@/lib/credits';

/** GET /api/credits — the caller's balance and its 20 last ledger rows. */
export async function GET(): Promise<Response> {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  if (!session) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const userId = await drizzleEpisodeRepo(db).userIdByEmail(session.email);
  if (!userId) return Response.json({ balance: 0, history: [] });
  const repo = drizzleCreditRepo(db);
  const [balance, history] = await Promise.all([balanceOf(repo, userId), repo.historyFor(userId, 20)]);
  return Response.json({ balance, history });
}
