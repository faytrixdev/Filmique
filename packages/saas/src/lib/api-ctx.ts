import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getLlmProvider } from '@what-if/engine/providers/llm';

// Shared plumbing for the episode API routes: who is calling, and is an LLM
// configured. A provider misconfiguration degrades to 503, never a 500.

export const sessionUserId = async (): Promise<string | null> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  return session ? await drizzleEpisodeRepo(getDb()).userIdByEmail(session.email) : null;
};

export const llmOrNull = () => {
  try {
    return getLlmProvider();
  } catch {
    return null;
  }
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const readJson = async (req: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
