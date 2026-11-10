import { desc, eq, and } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { episodes, jobs } from './schema';
import type { ExportRepo, ExportRow } from '../lib/export-flow';
import type { TtsResult } from '../lib/api-tts';

/** Render jobs (kind='render') + the episode status flag, over the Neon DB. */
export const drizzleExportRepo = (db: NeonHttpDatabase): ExportRepo & { latestAudio(episodeId: string): Promise<string | null> } => {
  const rowOf = (j: typeof jobs.$inferSelect): ExportRow => ({
    id: j.id,
    episodeId: j.episodeId,
    userId: (j.spec as { userId?: string } | null)?.userId ?? '',
    status: j.status as ExportRow['status'],
    costEurMicros: j.costEurMicros ?? 0,
    videoUrl: (j.result as { videoUrl?: string } | null)?.videoUrl ?? null,
    error: j.error,
    createdAt: j.createdAt.getTime(),
  });

  return {
    async create({ episodeId, userId, costEurMicros }) {
      const created = await db
        .insert(jobs)
        .values({ episodeId, kind: 'render', status: 'queued', spec: { costEurMicros, userId }, costEurMicros })
        .returning();
      const row = rowOf(created[0]);
      return { ...row, userId };
    },
    async listFor(episodeId) {
      const rows = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.episodeId, episodeId), eq(jobs.kind, 'render')))
        .orderBy(desc(jobs.createdAt));
      return rows.map(rowOf);
    },
    async byId(id) {
      const rows = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.kind, 'render'))).limit(1);
      return rows[0] ? rowOf(rows[0]) : null;
    },
    async setResult(jobId, videoUrl, at) {
      const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
      if (!job) return null;
      const updated = await db
        .update(jobs)
        .set({ status: 'done', result: { videoUrl, at }, updatedAt: new Date(at) })
        .where(eq(jobs.id, jobId))
        .returning();
      await db.update(episodes).set({ status: 'rendered', updatedAt: new Date(at) }).where(eq(episodes.id, job.episodeId));
      return rowOf(updated[0]);
    },
    async setFailed(jobId, error, at) {
      const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
      if (!job) return null;
      const updated = await db
        .update(jobs)
        .set({ status: 'failed', error, updatedAt: new Date(at) })
        .where(eq(jobs.id, jobId))
        .returning();
      await db.update(episodes).set({ status: 'failed', updatedAt: new Date(at) }).where(eq(episodes.id, job.episodeId));
      return rowOf(updated[0]);
    },
    /** The last successful voice job's absolute audio URL, for Lambda input props. */
    async latestAudio(episodeId) {
      const rows = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.episodeId, episodeId), eq(jobs.kind, 'tts'), eq(jobs.status, 'done')))
        .orderBy(desc(jobs.createdAt))
        .limit(1);
      const result = rows[0]?.result as TtsResult | undefined;
      return result?.audioUrl ?? null;
    },
  };
};
