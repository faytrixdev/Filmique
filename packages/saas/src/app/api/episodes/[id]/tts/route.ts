import type { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { CartesiaVoice, MockVoice } from '@what-if/engine/providers/voice';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleJobsRepo } from '@/db/jobs-repo';
import { drizzleAudioStore } from '@/db/audio-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getTts, postTts, type TtsCtx } from '@/lib/api-tts';

// Wiring: Cartesia when configured (CARTESIA_API_KEY), a mock voice otherwise so
// the whole beat-re-TTS loop runs offline. Audio bytes go to Neon and are
// served by /api/tts/[id] (Vercel's filesystem is read-only).

type CFR = { params: Promise<{ id: string }> };

const origin = async (): Promise<string> => {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host') ?? 'filmique.vercel.app';
  return `${proto}://${host}`;
};

const ctxFor = async (episodeId: string): Promise<TtsCtx> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const repo = drizzleEpisodeRepo(getDb());
  const userId = session ? await repo.userIdByEmail(session.email) : null;
  const apiKey = process.env.CARTESIA_API_KEY;
  const voice: TtsCtx['voice'] = apiKey ? new CartesiaVoice(apiKey) : new MockVoice();
  const audio = drizzleAudioStore(getDb());
  return {
    episodeRepo: repo,
    jobs: drizzleJobsRepo(getDb()),
    voice,
    saveAudio: async (bytes, mime) => `${await origin()}/api/tts/${await audio.save(bytes, episodeId, mime)}`,
    userId,
  };
};

export async function POST(_req: NextRequest, { params }: CFR): Promise<Response> {
  return postTts(await ctxFor((await params).id), (await params).id);
}

export async function GET(_req: NextRequest, { params }: CFR): Promise<Response> {
  return getTts(await ctxFor((await params).id), (await params).id);
}
