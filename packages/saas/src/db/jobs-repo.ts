import { desc, eq, and } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { jobs } from './schema';
import type { Words } from '@what-if/engine/schema';

export type TtsResult = { audioUrl: string; words: Words; offsets: number[]; voiceId: string };

/** TTS job audit trail over the shared jobs table (kind 'tts'). */
export const drizzleJobsRepo = (db: NeonHttpDatabase) => ({
  async recordDone(episodeId: string, spec: { voiceId: string; text: string }, value: TtsResult): Promise<string> {
    const rows = await db
      .insert(jobs)
      .values({ episodeId, kind: 'tts', status: 'done', spec, result: value, costEurMicros: 0 })
      .returning({ id: jobs.id });
    return rows[0].id;
  },
  async recordFailed(episodeId: string, spec: { voiceId: string; text: string }, error: string): Promise<string> {
    const rows = await db
      .insert(jobs)
      .values({ episodeId, kind: 'tts', status: 'failed', spec, error })
      .returning({ id: jobs.id });
    return rows[0].id;
  },
  async latestDone(episodeId: string): Promise<TtsResult | null> {
    const rows = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.episodeId, episodeId), eq(jobs.kind, 'tts'), eq(jobs.status, 'done')))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    return (rows[0]?.result as TtsResult | undefined) ?? null;
  },
});
