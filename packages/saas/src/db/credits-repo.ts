import { desc, eq, sql } from 'drizzle-orm';
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

type ReturnedRow = {
  id: string;
  user_id: string;
  delta_eur_micros: number;
  balance_after_eur_micros: number;
  reason: string;
  job_id: string | null;
  created_at: string | Date;
};

export const drizzleCreditRepo = (db: NeonHttpDatabase): CreditRepo => ({
  /** The neon-http driver supports no transactions, so the whole check-and-insert
   * lives in ONE conditional INSERT..SELECT..RETURNING statement: the balance is
   * summed in-statement and the row only lands when the spend keeps it >= 0. */
  async grant(input: GrantInput): Promise<LedgerEntry | null> {
    const res = await db.execute(sql`
      INSERT INTO credit_ledger (user_id, job_id, delta_eur_micros, balance_after_eur_micros, reason)
      SELECT
        ${input.userId}::uuid,
        ${input.jobId ?? null}::uuid,
        ${input.deltaEurMicros}::int,
        COALESCE((SELECT SUM(delta_eur_micros) FROM credit_ledger WHERE user_id = ${input.userId}::uuid), 0) + ${input.deltaEurMicros}::int,
        ${input.reason}
      WHERE COALESCE((SELECT SUM(delta_eur_micros) FROM credit_ledger WHERE user_id = ${input.userId}::uuid), 0) + ${input.deltaEurMicros}::int >= 0
      RETURNING id, user_id, delta_eur_micros, balance_after_eur_micros, reason, job_id, created_at
    `);
    const rows = ((res as { rows?: unknown[] }).rows ?? []) as ReturnedRow[];
    const r = rows[0];
    if (!r) return null; // insufficient credits → no row
    return {
      id: r.id,
      userId: r.user_id,
      deltaEurMicros: r.delta_eur_micros,
      balanceAfterEurMicros: r.balance_after_eur_micros,
      reason: r.reason,
      jobId: r.job_id,
      createdAt: r.created_at instanceof Date ? r.created_at.getTime() : new Date(r.created_at).getTime(),
    };
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
