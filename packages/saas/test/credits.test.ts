import { describe, expect, it } from 'vitest';
import { balanceOf, chargeJob, creditGateFrom, grantCredits, refundJob, type CreditRepo, type GrantInput, type LedgerEntry } from '../src/lib/credits';
import { postExport, RENDER_COST_MICROS, type ExportCtx, type ExportRepo, type ExportRow } from '../src/lib/export-flow';
import type { EpisodeRepo, EpisodeRow } from '../src/lib/episodes';

const ep = (id: string, userId: string): EpisodeRow => ({
  id,
  userId,
  slug: 's',
  topic: 't',
  status: 'draft',
  episode: { id, slug: 's', topic: 't' } as EpisodeRow['episode'],
  createdAt: 0,
  updatedAt: 0,
});

const epRepo = (): EpisodeRepo => {
  const rows = new Map<string, EpisodeRow>([['ep1', ep('ep1', 'u1')]]);
  return {
    async insert(input) {
      const row: EpisodeRow = { ...ep(`ep${rows.size + 2}`, input.userId), episode: input.episode };
      rows.set(row.id, row);
      return row;
    },
    async byId(id) {
      return rows.get(id) ?? null;
    },
    async listFor(userId) {
      return [...rows.values()].filter((r) => r.userId === userId);
    },
    async remove(id) {
      rows.delete(id);
    },
    async snapshot(id, episode) {
      const row = rows.get(id);
      if (row) row.episode = episode;
      return 1;
    },
  };
};

/** Same ledger semantics as the drizzle repo: balance re-check inside the "transaction". */
const creditRepo = (seedMicros = 50_000): CreditRepo => {
  const ledger = new Map<string, LedgerEntry[]>();
  const balance = (userId: string): number =>
    seedMicros + (ledger.get(userId) ?? []).reduce((s, e) => s + e.deltaEurMicros, 0);
  let n = 0;
  return {
    async grant(input: GrantInput) {
      const after = balance(input.userId) + input.deltaEurMicros;
      if (after < 0) return null;
      const row: LedgerEntry = {
        id: `l${++n}`,
        userId: input.userId,
        deltaEurMicros: input.deltaEurMicros,
        balanceAfterEurMicros: after,
        reason: input.reason,
        jobId: input.jobId ?? null,
        createdAt: n,
      };
      ledger.set(input.userId, [...(ledger.get(input.userId) ?? []), row]);
      return row;
    },
    async balanceFor(userId) {
      return balance(userId);
    },
    async historyFor(userId, limit) {
      return (ledger.get(userId) ?? []).slice(-limit);
    },
  };
};

const exportRepo = (): ExportRepo & { rows: Map<string, ExportRow>; readonly episodeStatus: string } => {
  const rows = new Map<string, ExportRow>();
  const state = { episodeStatus: 'draft' };
  let n = 0;
  return {
    rows,
    get episodeStatus() {
      return state.episodeStatus;
    },
    async create({ episodeId, userId, costEurMicros }) {
      const row: ExportRow = { id: `job${++n}`, episodeId, userId, status: 'queued', costEurMicros, videoUrl: null, error: null, createdAt: n };
      rows.set(row.id, row);
      return row;
    },
    async listFor(episodeId) {
      return [...rows.values()].filter((r) => r.episodeId === episodeId).sort((a, b) => b.createdAt - a.createdAt);
    },
    async byId(id) {
      return rows.get(id) ?? null;
    },
    async setResult(jobId, videoUrl) {
      const row = rows.get(jobId);
      if (!row) return null;
      row.status = 'done';
      row.videoUrl = videoUrl;
      state.episodeStatus = 'rendered';
      return row;
    },
    async setFailed(jobId, error) {
      const row = rows.get(jobId);
      if (!row) return null;
      row.status = 'failed';
      row.error = error;
      state.episodeStatus = 'failed';
      return row;
    },
  };
};

describe('credit ledger', () => {
  it('a debit below zero is refused, leaving no row', async () => {
    const credits = creditRepo(10_000);
    expect(await chargeJob(credits, 'u1', 40_000, 'job1')).toBe(false);
    expect(await credits.historyFor('u1', 10)).toEqual([]);
    expect(await balanceOf(credits, 'u1')).toBe(10_000);
  });

  it('every row stores the balance after it, refunds included', async () => {
    const credits = creditRepo(40_000);
    expect(await chargeJob(credits, 'u1', 40_000, 'job1')).toBe(true); // balance hits 0
    expect(await chargeJob(credits, 'u1', 100, 'job2')).toBe(false); // next one bounces

    const refund = await refundJob(credits, 'u1', 40_000, 'job1');
    expect(refund).not.toBeNull();
    const history = await credits.historyFor('u1', 10);
    expect(history.map((e) => e.balanceAfterEurMicros)).toEqual([0, 40_000]);
    expect(await balanceOf(credits, 'u1')).toBe(40_000);
  });

  it('users have separate balances', async () => {
    const credits = creditRepo(1_000);
    await grantCredits(credits, { userId: 'u2', deltaEurMicros: 9_000, reason: 'topup' });
    expect(await balanceOf(credits, 'u1')).toBe(1_000);
    expect(await balanceOf(credits, 'u2')).toBe(10_000);
  });

  it('the gate debits on charge and refunds on failure', async () => {
    const credits = creditRepo(40_000);
    const gate = creditGateFrom(credits);
    expect(await gate.charge('u1', RENDER_COST_MICROS, 'jobR')).toBe(true);
    expect(await balanceOf(credits, 'u1')).toBe(0);
    await gate.refund('u1', RENDER_COST_MICROS, 'jobR');
    expect(await balanceOf(credits, 'u1')).toBe(40_000);
  });
});

describe('export flow uses the ledger', () => {
  it('a poor user gets 402 insufficient_credits, with no charge taken', async () => {
    const credits = creditRepo(10_000); // below RENDER_COST_MICROS
    const ctx: ExportCtx = {
      episodeRepo: epRepo(),
      exports: exportRepo(),
      render: {
        async startRender() {
          throw new Error('must not be reached');
        },
      },
      gate: creditGateFrom(credits),
      userId: 'u1',
    };
    const res = await postExport(ctx, 'ep1');
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toBe('insufficient_credits');
    expect(await balanceOf(credits, 'u1')).toBe(10_000);
    const [job] = [...(ctx.exports as ReturnType<typeof exportRepo>).rows.values()];
    expect(job.status).toBe('failed');
    expect(job.error).toBe('insufficient_credits');
  });

  it('a rich user is charged, and an adapter failure refunds him', async () => {
    const credits = creditRepo(40_000);
    const crashing = async (): Promise<void> => {
      throw new Error('boom');
    };
    const ctx: ExportCtx = {
      episodeRepo: epRepo(),
      exports: exportRepo(),
      render: { startRender: crashing },
      gate: creditGateFrom(credits),
      userId: 'u1',
    };
    expect((await postExport(ctx, 'ep1')).status).toBe(502);
    expect(await balanceOf(credits, 'u1')).toBe(40_000); // charge + refund cancel out
  });
});
