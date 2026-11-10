import { createEpisode, deleteEpisode, getEpisode, listEpisodes, NotFoundError, SchemaError, saveEpisode, type EpisodeRepo } from './episodes';

// Pure HTTP layer: routes wire (repo, session) and delegate here so the full
// request/response behavior is testable without a database.

export type ApiCtx = { repo: EpisodeRepo; userId: string | null };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const ApiError = { unauth: () => json({ error: 'unauthorized' }, 401), notFound: () => json({ error: 'not_found' }, 404), badJson: () => json({ error: 'bad_json' }, 400) };

const gateToResponse = (e: unknown): Response | null => {
  if (!(e instanceof SchemaError)) return null;
  return json({ error: 'schema', issues: e.issues }, 400);
};

const readBody = async (req: Request): Promise<unknown | null> => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

/** POST /api/episodes — body is the EpisodeJson itself (comes fresh from composeEpisode). */
export const postEpisodes = async (ctx: ApiCtx, req: Request): Promise<Response> => {
  if (!ctx.userId) return ApiError.unauth();
  const body = await readBody(req);
  if (body === null) return ApiError.badJson();
  try {
    const row = await createEpisode(ctx.repo, ctx.userId, body);
    return json(
      {
        id: row.id,
        slug: row.slug,
        topic: row.topic,
        status: row.status,
        createdAt: row.createdAt,
        episode: row.episode,
      },
      201,
    );
  } catch (e) {
    return gateToResponse(e) ?? json({ error: 'internal', message: String(e) }, 500);
  }
};

/** GET /api/episodes — the caller's episodes, newest first. */
export const getEpisodesList = async (ctx: ApiCtx): Promise<Response> => {
  if (!ctx.userId) return ApiError.unauth();
  const rows = await listEpisodes(ctx.repo, ctx.userId);
  return json(rows.map(({ id, slug, topic, status, createdAt, updatedAt }) => ({ id, slug, topic, status, createdAt, updatedAt })));
};

/** GET /api/episodes/:id */
export const getEpisodeById = async (ctx: ApiCtx, id: string): Promise<Response> => {
  if (!ctx.userId) return ApiError.unauth();
  const row = await getEpisode(ctx.repo, ctx.userId, id);
  return row ? json(row) : ApiError.notFound();
};

/** PUT /api/episodes/:id — body is the (edited) EpisodeJson; every save snapshots. */
export const putEpisode = async (ctx: ApiCtx, id: string, req: Request): Promise<Response> => {
  if (!ctx.userId) return ApiError.unauth();
  const body = await readBody(req);
  if (body === null) return ApiError.badJson();
  try {
    const row = await saveEpisode(ctx.repo, ctx.userId, id, body);
    return json({ id: row.id, versionNote: 'snapshot saved', episode: row.episode, updatedAt: row.updatedAt });
  } catch (e) {
    if (e instanceof NotFoundError) return ApiError.notFound();
    return gateToResponse(e) ?? json({ error: 'internal', message: String(e) }, 500);
  }
};

/** DELETE /api/episodes/:id */
export const deleteEpisodeById = async (ctx: ApiCtx, id: string): Promise<Response> => {
  if (!ctx.userId) return ApiError.unauth();
  try {
    await deleteEpisode(ctx.repo, ctx.userId, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof NotFoundError) return ApiError.notFound();
    return json({ error: 'internal', message: String(e) }, 500);
  }
};
