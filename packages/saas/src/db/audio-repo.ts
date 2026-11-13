import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { randomUUID } from 'node:crypto';
import { audioFiles } from './schema';

// Audio bytes live in Neon: Vercel's filesystem is read-only and files written
// at runtime are not served. Base64 in a text column keeps it dependency-free.

export const drizzleAudioStore = (db: NeonHttpDatabase) => ({
  async save(bytes: Uint8Array, episodeId?: string, mime = 'audio/mpeg'): Promise<string> {
    const id = randomUUID();
    await db.insert(audioFiles).values({
      id,
      episodeId: episodeId ?? null,
      mime,
      dataB64: Buffer.from(bytes).toString('base64'),
    });
    return id;
  },
  async get(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
    const rows = await db.select().from(audioFiles).where(eq(audioFiles.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return { mime: row.mime, bytes: new Uint8Array(Buffer.from(row.dataB64, 'base64')) };
  },
});
