import { describe, expect, it } from 'vitest';
import { getExports, postExport, postExportCallback, RENDER_COST_MICROS, setAudioLookup, type ExportCtx, type ExportRepo, type ExportRow, type RenderAdapter, type CreditGate } from '../src/lib/export-flow';
import type { EpisodeRepo, EpisodeRow } from '../src/lib/episodes';
import { EpisodeJsonZ } from '@what-if/engine/schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixture = () =>
  EpisodeJsonZ.parse(JSON.parse(readFileSync(join(__dirname, '..', '..', 'engine', 'test', 'fixtures', 'rewind-episode.json'), 'utf8')));

const epRepo = (): EpisodeRepo => {
  const row: EpisodeRow = { id: 'ep1', userId: 'u1', slug: 'rewind', topic: 't', status: 'draft', episode: fixture() as EpisodeRow['episode'], createdAt: 0, updatedAt: 0 };
  return {
    async insert(input) {
      return { ...row, id: 'new', userId: input.userId, episode: input.episode };
    },
    async byId(id) {
      return id === 'ep1' ? row : null;
    },
    async listFor() {
      return [row];
    },
    async remove() {},
    async snapshot(_id, episode) {
      row.episode = episode;
      return 1;
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
    async setResult(jobId, videoUrl, _at) {
      const row = rows.get(jobId);
      if (!row) return null;
      row.status = 'done';
      row.videoUrl = videoUrl;
      state.episodeStatus = 'rendered';
      return row;
    },
    async setFailed(jobId, error, _at) {
      const row = rows.get(jobId);
      if (!row) return null;
      row.status = 'failed';
      row.error = error;
      state.episodeStatus = 'failed';
      return row;
    },
  };
};

const adapter = (): RenderAdapter & { started: { jobId: string; audioUrl?: string }[] } => {
  const started: { jobId: string; audioUrl?: string }[] = [];
  return {
    started,
    async startRender(input) {
      if (input.jobId === 'jobBoo') throw new Error('boom');
      started.push({ jobId: input.jobId, audioUrl: input.audioUrl });
    },
  };
};

const setup = (opts: { gate?: CreditGate; userId?: string | null } = {}) => {
  const repo = exportRepo();
  const render = adapter();
  const ctx: ExportCtx = {
    episodeRepo: epRepo(),
    exports: repo,
    render,
    gate: opts.gate ?? { charge: async () => true },
    userId: 'userId' in opts ? opts.userId ?? null : 'u1',
  };
  return { ctx, repo, render };
};

describe('export flow (pure HTTP layer)', () => {
  it('POST export charges, hands off to Lambda and queues a job (202)', async () => {
    setAudioLookup(async () => '/tts/real.mp3');
    const { ctx, repo, render } = setup();
    const res = await postExport(ctx, 'ep1');
    expect(res.status).toBe(202);
    const body = (await res.json()) as { jobId: string; costEurMicros: number };
    expect(body.costEurMicros).toBe(RENDER_COST_MICROS);
    expect(render.started).toEqual([{ jobId: body.jobId, audioUrl: '/tts/real.mp3' }]);
    expect((await repo.byId(body.jobId))?.status).toBe('queued');
  });

  it('unpaid users still can, but the credit gate bounces with 402 and marks the job failed', async () => {
    setAudioLookup(async () => null);
    const { ctx, repo, render } = setup({ gate: { charge: async () => false } });
    const res = await postExport(ctx, 'ep1');
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toBe('insufficient_credits');
    expect(render.started).toEqual([]);
    const failed = [...repo.rows.values()];
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe('failed');
    expect(failed[0].error).toBe('insufficient_credits');
  });

  it('an adapter crash marks the job failed and answers 502', async () => {
    const { ctx, repo, render } = setup();
    render.startRender = async () => {
      throw new Error('boom');
    };
    const res = await postExport(ctx, 'ep1');
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('render_failed');
    const failed = [...repo.rows.values()][0];
    expect(failed.status).toBe('failed');
    expect(failed.error).toContain('boom');
  });

  it('without a configured renderer the route answers 503', async () => {
    const { ctx } = setup();
    ctx.render = null;
    expect((await postExport(ctx, 'ep1')).status).toBe(503);
  });

  it('GET exports lists newest first, guards 401/404', async () => {
    setAudioLookup(async () => null);
    const { ctx, repo } = setup();
    await postExport(ctx, 'ep1');
    await postExport(ctx, 'ep1');
    const list = (await (await getExports(ctx, 'ep1')).json()) as ExportRow[];
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('job2');
    expect((await getExports({ ...ctx, userId: null }, 'ep1')).status).toBe(401);
    expect((await getExports(ctx, 'nope')).status).toBe(404);
    expect([...repo.rows.keys()].sort()).toEqual(['job1', 'job2']);
  });

  describe('render callback', () => {
    it('marks done + flags the episode rendered', async () => {
      const { ctx, repo } = setup();
      await postExport(ctx, 'ep1');
      const jobId = [...repo.rows.keys()][0];
      const res = await postExportCallback(ctx, { jobId, ok: true, videoUrl: 'https://s3/x.mp4' }, true);
      expect(res.status).toBe(200);
      expect(repo.episodeStatus).toBe('rendered');
      expect((await repo.byId(jobId))?.videoUrl).toBe('https://s3/x.mp4');
    });

    it('marks failed + flags the episode failed', async () => {
      const { ctx, repo } = setup();
      await postExport(ctx, 'ep1');
      const jobId = [...repo.rows.keys()][0];
      await postExportCallback(ctx, { jobId, ok: false, error: 'timeout' }, true);
      expect(repo.episodeStatus).toBe('failed');
    });

    it('refuses tampered tokens and malformed payloads', async () => {
      const { ctx, repo } = setup();
      expect((await postExportCallback(ctx, { jobId: 'x', ok: true, videoUrl: 'v' }, false)).status).toBe(403);
      expect((await postExportCallback(ctx, null, true)).status).toBe(400);
      expect((await postExportCallback(ctx, { jobId: 12 }, true)).status).toBe(400);
      expect((await postExportCallback(ctx, { jobId: 'missing', ok: true, videoUrl: 'v' }, true)).status).toBe(404);
      expect(repo.episodeStatus).toBe('draft'); // nothing flipped
    });
  });
});
