import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { users, webhooks } from './schema';
import { drizzleCreditRepo } from './credits-repo';
import { MONTHLY_GRANT_MICROS, type CreditGrantRepo, type WhopUserMap, type WhopWebhookRepo } from '../lib/whop';

export const drizzleWhopUserMap = (db: NeonHttpDatabase): WhopUserMap => ({
  /** The local user for a Whop member id; a bare row is created when unknown. */
  userByWhopId: async (whopUserId: string) => {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.whopUserId, whopUserId)).limit(1);
    if (rows[0]) return rows[0].id;
    const created = await db.insert(users).values({ email: `${whopUserId}@whop.invited`, whopUserId }).returning({ id: users.id });
    return created[0].id;
  },
});

export const drizzleWhopWebhookRepo = (db: NeonHttpDatabase): WhopWebhookRepo => ({
  seen: async (id: string) => (await db.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.id, id)).limit(1)).length > 0,
  markSeen: async (id: string, event: string) => {
    await db.insert(webhooks).values({ id, event }).onConflictDoNothing();
  },
});

export const drizzleCreditGrantRepo = (db: NeonHttpDatabase): CreditGrantRepo => ({
  grant: async (userId: string, reason: string) => {
    const repo = drizzleCreditRepo(db);
    const after = await repo.grant({ userId, deltaEurMicros: MONTHLY_GRANT_MICROS, reason });
    return after;
  },
});
