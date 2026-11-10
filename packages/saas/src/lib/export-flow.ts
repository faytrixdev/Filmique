import type { EpisodeJson } from '@what-if/engine/schema';
import { getEpisode, type EpisodeRepo } from './episodes';

// Export (render) flow, provider-free: the caller's ownership check, the credit
// gate, the render adapter (Lambda) and the export store are all injected, so
// the whole POST/GET/callback behavior runs in tests without AWS or a database.

export type ExportRow = {
  id: string;
  episodeId: string;
  userId: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'refunded';
  costEurMicros: number;
  videoUrl: string | null;
  error: string | null;
  createdAt: number;
};

export interface ExportRepo {
  /** Creates the 'render' job row (status queued) before the adapter call. */
  create(input: { episodeId: string; userId: string; costEurMicros: number }): Promise<ExportRow>;
  listFor(episodeId: string): Promise<ExportRow[]>;
  byId(id: string): Promise<ExportRow | null>;
  /** Success callback: stores the video url and flags the episode rendered. */
  setResult(jobId: string, videoUrl: string, at: number): Promise<ExportRow | null>;
  /** Failure callback: stores the error and flags the episode failed. */
  setFailed(jobId: string, error: string, at: number): Promise<ExportRow | null>;
}

/** Renders the 'saas-episode' Lambda composition; returns only once accepted. */
export interface RenderAdapter {
  startRender(input: { jobId: string; episode: EpisodeJson; audioUrl?: string }): Promise<void>;
}

/** Task 16 keeps the grants append-only; the gate debits, and refunds on failure. */
export interface CreditGate {
  charge(userId: string, costEurMicros: number, jobId: string): Promise<boolean>;
  refund?(userId: string, costEurMicros: number, jobId: string): Promise<void>;
}

export type ExportCtx = {
  episodeRepo: EpisodeRepo;
  exports: ExportRepo;
  render: RenderAdapter | null; // null = service unconfigured in this env
  gate: CreditGate;
  userId: string | null;
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const RENDER_COST_MICROS = 40_000; // display value only while the ledger (Task 15) is unbuilt

/** POST /api/episodes/:id/export — charge, then hand the citation to Lambda. */
export const postExport = async (ctx: ExportCtx, episodeId: string): Promise<Response> => {
  if (!ctx.userId) return json({ error: 'unauthorized' }, 401);
  if (!ctx.render) return json({ error: 'render_unconfigured' }, 503);
  const row = await getEpisode(ctx.episodeRepo, ctx.userId, episodeId);
  if (!row) return json({ error: 'not_found' }, 404);

  const job = await ctx.exports.create({ episodeId, userId: ctx.userId, costEurMicros: RENDER_COST_MICROS });
  const paid = await ctx.gate.charge(ctx.userId, RENDER_COST_MICROS, job.id);
  if (!paid) {
    await ctx.exports.setFailed(job.id, 'insufficient_credits', Date.now());
    return json({ error: 'insufficient_credits', jobId: job.id }, 402);
  }
  try {
    const audioUrl = await lastAudioUrl(episodeId);
    await ctx.render.startRender({ jobId: job.id, episode: row.episode as EpisodeJson, audioUrl });
    return json({ jobId: job.id, status: 'queued', costEurMicros: RENDER_COST_MICROS }, 202);
  } catch (e) {
    await ctx.gate.refund?.(ctx.userId, RENDER_COST_MICROS, job.id);
    await ctx.exports.setFailed(job.id, String(e instanceof Error ? e.message : e), Date.now());
    return json({ error: 'render_failed' }, 502);
  }
};

/** The last successful voice pass feeds the Lambda's input props (set by the routes). */
type LastAudioFn = (episodeId: string) => Promise<string | null>;
let lastAudio: LastAudioFn = async () => null;
export const setAudioLookup = (fn: LastAudioFn): void => {
  lastAudio = fn;
};
const lastAudioUrl = async (episodeId: string): Promise<string | undefined> => (await lastAudio(episodeId)) ?? undefined;

/** GET /api/episodes/:id/exports — newest recurring first. */
export const getExports = async (ctx: ExportCtx, episodeId: string): Promise<Response> => {
  if (!ctx.userId) return json({ error: 'unauthorized' }, 401);
  const row = await getEpisode(ctx.episodeRepo, ctx.userId, episodeId);
  if (!row) return json({ error: 'not_found' }, 404);
  return json(await ctx.exports.listFor(episodeId));
};

export type ExportCallback = { jobId: string; ok: boolean; videoUrl?: string; error?: string };

/** POST /api/exports/lambda — the render Lambda's final callback (secret-guarded). */
export const postExportCallback = async (ctx: ExportCtx, payload: unknown, isAuthorized: boolean): Promise<Response> => {
  if (!isAuthorized) return json({ error: 'unauthorized' }, 403);
  const p = payload as Partial<ExportCallback> | null;
  if (!p || typeof p.jobId !== 'string' || typeof p.ok !== 'boolean') return json({ error: 'bad_payload' }, 400);
  if (p.ok && p.videoUrl) {
    const updated = await ctx.exports.setResult(p.jobId, p.videoUrl, Date.now());
    return updated ? json({ status: 'rendered', videoUrl: updated.videoUrl }) : json({ error: 'unknown_job' }, 404);
  }
  const updated = await ctx.exports.setFailed(p.jobId, p.error ?? 'render failed', Date.now());
  if (updated) await ctx.gate.refund?.(updated.userId, updated.costEurMicros, updated.id);
  return updated ? json({ status: 'failed' }) : json({ error: 'unknown_job' }, 404);
};
