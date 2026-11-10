import { desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { creditLedger } from './schema';
import type { CreditRepo, GrantInput, LedgerEntry } from '../lib/credits';

const rowOf = (r: typeof creditLedger.$inferSelect): LedgerEntry => ({
  id: r.id,
  userId: r.userId,
  deltaEurMicros: r.deltaEuroMicros,
  balanceAfterEurMicros: r.balanceAfterEuroMicros,
  reason: r.reason,
  jobId: r.jobId,
  createdAt: r.createdAt.getTime(),
});

export const drizzleCreditRepo = (db: NeonHttpDatabase): CreditRepo => ({
  /** Atomic single HTTP round trip: balance re-read LAST, insert gated on it. */
  async grant(input: GrantInput): Promise<LedgerEntry | null> {
    return db.transaction(async (tx) => {
      const rows = await tx.select({ delta: creditLedger.deltaEuroMicros }).from(creditLedger).where(eq(creditLedger.userId, input.userId));
      const balance = rows.reduce((sum, r) => sum + r.delta, 0);
      const after = balance + input.deltaEurMicros;
      if (after < 0) return null; // insufficient credits → no row
      const created = await tx
        .insert(creditLedger)
        .values({
          userId: input.userId,
          deltaEuroMicros: input.deltaEurMicros,
          balanceAfterEuroMicros: after,
          reason: input.reason,
          jobId: input.jobId ?? null,
        })
        .returning();
      return rowOf(created[0]);
    });
  },

  async balanceFor(userId) {
    const rows = await db.select({ delta: creditLedger.deltaEuroMicros }).from(creditLedger).where(eq(creditLedger.userId, userId));
    return rows.reduce((sum, r) => sum + r.delta, 0);
  },

  async historyFor(userId, limit) {
    const rows = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(limit);
    return rows.map(rowOf);
  },
});
