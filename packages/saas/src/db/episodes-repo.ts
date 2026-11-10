import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { desc, eq } from 'drizzle-orm';
import { episodeVersions, episodes, users } from './schema';
import type { EpisodeJson } from '@what-if/engine/schema';
import type { EpisodeRepo, EpisodeRow } from '../lib/episodes';
import { getDb } from './index';

export { getDb };

const rowOf = (r: typeof episodes.$inferSelect): EpisodeRow => ({
  id: r.id,
  userId: r.userId,
  slug: r.slug,
  topic: r.topic,
  status: r.status,
  episode: r.episode as EpisodeJson,
  createdAt: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
});

export const drizzleEpisodeRepo = (db: NeonHttpDatabase): EpisodeRepo & { userIdByEmail(email: string): Promise<string | null> } => ({
  async userIdByEmail(email: string) {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return rows[0]?.id ?? null;
  },

  async insert({ userId, episode, status }) {
    const created = await db
      .insert(episodes)
      .values({ userId, slug: episode.slug, topic: episode.topic, episode, status: status ?? 'draft' })
      .returning();
    return rowOf(created[0]);
  },

  async byId(id) {
    const rows = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1);
    return rows[0] ? rowOf(rows[0]) : null;
  },

  async listFor(userId) {
    const rows = await db.select().from(episodes).where(eq(episodes.userId, userId)).orderBy(desc(episodes.updatedAt));
    return rows.map(rowOf);
  },

  async remove(id) {
    await db.delete(episodes).where(eq(episodes.id, id));
  },

  async snapshot(id, episode, at) {
    const rows = await db.select({ version: episodeVersions.version }).from(episodeVersions).where(eq(episodeVersions.episodeId, id));
    const version = rows.reduce((max, r) => Math.max(max, r.version), 0) + 1;
    await db.insert(episodeVersions).values({ episodeId: id, version, episode });
    await db.update(episodes).set({ episode, slug: episode.slug, topic: episode.topic, updatedAt: new Date(at) }).where(eq(episodes.id, id));
    return version;
  },
});
