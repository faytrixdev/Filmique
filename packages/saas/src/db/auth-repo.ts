import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { magicLinks, users } from './schema';
import type { MagicRepo, StoredLink } from '../lib/auth';

export const drizzleMagicRepo = (db: NeonHttpDatabase): MagicRepo => ({
  async save(link) {
    await db.insert(magicLinks).values({ email: link.email, token: link.tokenHash, expiresAt: new Date(link.expiresAt) });
  },
  async byTokenHash(tokenHash: string): Promise<StoredLink | null> {
    const rows = await db.select().from(magicLinks).where(eq(magicLinks.token, tokenHash)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return { email: row.email, tokenHash: row.token, expiresAt: row.expiresAt.getTime(), usedAt: row.usedAt ? row.usedAt.getTime() : null };
  },
  async markUsed(tokenHash: string, usedAt: number) {
    await db.update(magicLinks).set({ usedAt: new Date(usedAt) }).where(eq(magicLinks.token, tokenHash));
  },
  async upsertUser(email: string) {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return existing[0];
    const created = await db.insert(users).values({ email }).returning();
    return created[0];
  },
});
