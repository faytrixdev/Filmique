// Credit ledger, append-only: every grant is a positive row, every debit a
// negative row; the balance AFTER each row is stored for audit. Debits must
// pass a re-validated balance (concurrency ref-guarded at the repo level), or
// the whole entry is refused → caller answers 'insufficient_credits'.

export type LedgerEntry = {
  id: string;
  userId: string;
  deltaEurMicros: number; // negative = spend, positive = top-up/refund
  balanceAfterEurMicros: number;
  reason: string;
  jobId: string | null;
  createdAt: number;
};

export type GrantInput = { userId: string; deltaEurMicros: number; reason: string; jobId?: string };

export interface CreditRepo {
  /** All-or-nothing: the transaction re-reads the balance then appends. Returns the entry, or null when refused. */
  grant(input: GrantInput): Promise<LedgerEntry | null>;
  balanceFor(userId: string): Promise<number>;
  historyFor(userId: string, limit: number): Promise<LedgerEntry[]>;
}

export const grantCredits = async (repo: CreditRepo, input: GrantInput): Promise<LedgerEntry | null> => repo.grant(input);

/** A charge pays for exactly one job; refusal returns false with no ledger row. */
export const chargeJob = async (repo: CreditRepo, userId: string, costEurMicros: number, jobId: string, reason = 'render'): Promise<boolean> =>
  (await repo.grant({ userId, deltaEurMicros: -costEurMicros, reason, jobId })) !== null;

export const refundJob = (repo: CreditRepo, userId: string, costEurMicros: number, jobId: string, reason = 'refund'): Promise<LedgerEntry | null> =>
  repo.grant({ userId, deltaEurMicros: costEurMicros, reason, jobId });

export const balanceOf = (repo: CreditRepo, userId: string): Promise<number> => repo.balanceFor(userId);

/** The gate the export flow consumes: debit on charge, refund on failure. */
export const creditGateFrom = (repo: CreditRepo) => ({
  charge: async (userId: string, costEurMicros: number, jobId: string): Promise<boolean> =>
    chargeJob(repo, userId, costEurMicros, jobId),
  refund: async (userId: string, costEurMicros: number, jobId: string): Promise<void> => {
    await refundJob(repo, userId, costEurMicros, jobId);
  },
});
