import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CartesiaVoice, MockVoice } from '@what-if/engine/providers/voice';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleJobsRepo } from '@/db/jobs-repo';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getTts, postTts, type TtsCtx } from '@/lib/api-tts';
import { randomUUID } from 'node:crypto';

// Wiring: Cartesia when configured (CARTESIA_API_KEY), a mock voice otherwise so
// the whole beat→re-TTS loop runs offline. Audio bytes land in public/tts/.

type CFR = { params: Promise<{ id: string }> };

const ctxFor = async (episodeId: string): Promise<TtsCtx> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  const repo = drizzleEpisodeRepo(getDb());
  const userId = session ? await repo.userIdByEmail(session.email) : null;
  const apiKey = process.env.CARTESIA_API_KEY;
  const voice: TtsCtx['voice'] = apiKey ? new CartesiaVoice(apiKey) : new MockVoice();
  return {
    episodeRepo: repo,
    jobs: drizzleJobsRepo(getDb()),
    voice,
    saveAudio: async (bytes) => {
      const dir = join(process.cwd(), 'public', 'tts');
      await mkdir(dir, { recursive: true });
      const file = `${episodeId}-${randomUUID()}.mp3`;
      await writeFile(join(dir, file), bytes);
      return `/tts/${file}`;
    },
    userId,
  };
};

export async function POST(_req: NextRequest, { params }: CFR): Promise<Response> {
  return postTts(await ctxFor((await params).id), (await params).id);
}

export async function GET(_req: NextRequest, { params }: CFR): Promise<Response> {
  return getTts(await ctxFor((await params).id), (await params).id);
}
