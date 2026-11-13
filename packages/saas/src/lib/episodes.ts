import { EpisodeJsonZ, type EpisodeJson } from '@what-if/engine/schema';

// Episode storage domain: every write passes the engine Zod gate. The repo
// interface keeps the service DB-free for tests (drizzle repo lives in ./db).

/** Props coercion on every gated write: drifted LLM props (string numbers,
 * invented enums, nulls) are salvaged against the archetype's Zod, unsalvageable
 * keys fall back to schema defaults. Repairing an old episode is then just a
 * save in the editor.
 *
 * The archetype registry pulls Remotion (client-only), so it is imported
 * dynamically: a static import here breaks Next's page-data collection. */
const coerceShotProps = async (episode: EpisodeJson): Promise<EpisodeJson> => {
  const { ARCHETYPES } = await import('@what-if/engine/archetypes');
  const { coerceProps } = await import('@what-if/engine/compose');
  return {
    ...episode,
    shots: episode.shots.map((s) => {
      if (!s.archetype) return s;
      const A = ARCHETYPES[s.archetype] ?? ARCHETYPES.wideRoom;
      const coerced = coerceProps(A.PropsZ as never, (s.archetypeProps ?? {}) as Record<string, unknown>);
      return coerced ? { ...s, archetypeProps: coerced } : { ...s, archetypeProps: undefined };
    }),
  };
};

export type EpisodeRow = {
  id: string;
  userId: string;
  slug: string;
  topic: string;
  status: string;
  episode: EpisodeJson;
  createdAt: number;
  updatedAt: number;
};

export interface EpisodeRepo {
  insert(input: { userId: string; episode: EpisodeJson; status?: string }): Promise<EpisodeRow>;
  byId(id: string): Promise<EpisodeRow | null>;
  listFor(userId: string): Promise<EpisodeRow[]>;
  remove(id: string): Promise<void>;
  /** Persists a new episode_version snapshot and bumps the active row; returns the version number. */
  snapshot(id: string, episode: EpisodeJson, at: number): Promise<number>;
}

export type SchemaIssue = { path: string; message: string };

export class SchemaError extends Error {
  constructor(public issues: SchemaIssue[]) {
    super(`episode schema: ${issues.length} issue(s)`);
  }
}

  export const gateEpisode = async (data: unknown): Promise<EpisodeJson> => {
  const res = EpisodeJsonZ.safeParse(data);
  if (!res.success) {
    throw new SchemaError(res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return coerceShotProps(res.data);
  };

const owned = (row: EpisodeRow | null, userId: string): EpisodeRow | null => (row && row.userId === userId ? row : null);

export const createEpisode = async (repo: EpisodeRepo, userId: string, data: unknown): Promise<EpisodeRow> =>
  repo.insert({ userId, episode: await gateEpisode(data) });

export const listEpisodes = (repo: EpisodeRepo, userId: string): Promise<EpisodeRow[]> => repo.listFor(userId);

export const getEpisode = async (repo: EpisodeRepo, userId: string, id: string): Promise<EpisodeRow | null> =>
  owned(await repo.byId(id), userId);

/** PUT /api/episodes/:id — gate, then immutable snapshot + active-row bump. */
export const saveEpisode = async (
  repo: EpisodeRepo,
  userId: string,
  id: string,
  data: unknown,
  at = Date.now(),
): Promise<EpisodeRow> => {
  const row = owned(await repo.byId(id), userId);
  if (!row) throw new NotFoundError();
  const episode = await gateEpisode(data);
  await repo.snapshot(id, episode, at);
  return { ...row, episode, updatedAt: at };
};

export class NotFoundError extends Error {}

export const deleteEpisode = async (repo: EpisodeRepo, userId: string, id: string): Promise<void> => {
  const row = owned(await repo.byId(id), userId);
  if (!row) throw new NotFoundError();
  await repo.remove(id);
};
