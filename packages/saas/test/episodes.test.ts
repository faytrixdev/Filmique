import { describe, expect, it } from 'vitest';
import { deleteEpisodeById, getEpisodeById, getEpisodesList, postEpisodes, putEpisode, type ApiCtx } from '../src/lib/api-episodes';
import { gateEpisode, NotFoundError, SchemaError, type EpisodeRepo, type EpisodeRow } from '../src/lib/episodes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Golden round-trip: the three studio episodes flow through the POST/GET/PUT/
// DELETE HTTP layer into the gate's canonical form and back out unchanged —
// every re-read must byte-match gateEpisode(fixture), never drift further away.

const SLUGS = ['copy-paste', 'million16', 'rewind'];
const FIXTURES_DIR = join(__dirname, '..', '..', 'engine', 'test', 'fixtures');
const fixtureOf = (slug: string): Record<string, unknown> => JSON.parse(readFileSync(join(FIXTURES_DIR, `${slug}-episode.json`), 'utf8'));

/** Same-shape in-memory repo: insert/snapshot/list/remove with uuid-ish ids. */
const fakeRepo = (): EpisodeRepo & { counters: number } => {
  const rows = new Map<string, EpisodeRow>();
  const versions = new Map<string, number>();
  let counters = 0;
  return {
    counters,
    async insert({ userId, episode, status }) {
      const id = `ep_${++counters}`;
      const now = 1_700_000_000_000 + counters;
      const row: EpisodeRow = { id, userId, slug: episode.slug, topic: episode.topic, status: status ?? 'draft', episode, createdAt: now, updatedAt: now };
      rows.set(id, row);
      return row;
    },
    async byId(id) {
      return rows.get(id) ?? null;
    },
    async listFor(userId) {
      return [...rows.values()].filter((r) => r.userId === userId).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async remove(id) {
      rows.delete(id);
    },
    async snapshot(id, episode, at) {
      const row = rows.get(id);
      if (!row) throw new NotFoundError();
      const version = (versions.get(id) ?? 0) + 1;
      versions.set(id, version);
      rows.set(id, { ...row, episode, updatedAt: at });
      return version;
    },
  };
};

const ctx = (userId: string | null): ApiCtx => ({ repo: fakeRepo(), userId });
const req = (body: unknown): Request =>
  new Request('http://x/api/episodes', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('episodes API (pure HTTP layer)', () => {
  describe('golden round-trip of the three studio episodes', () => {
    for (const slug of SLUGS) {
      it(`stores, edits, snapshots and re-reads ${slug} unchanged`, async () => {
        const c = ctx('u1');
        const gated = gateEpisode(structuredClone(fixtureOf(slug))); // canonical form
        const created = await postEpisodes(c, req(fixtureOf(slug)));
        expect(created.status).toBe(201);
        const createdBody = (await created.json()) as { id: string; slug: string; status: string };
        expect(createdBody.slug).toBe(gated.slug);
        expect(createdBody.status).toBe('draft');

        const row = (await (await getEpisodeById(c, createdBody.id)).json()) as { episode: Record<string, unknown> };
        expect(row.episode).toEqual(gated); // stabilized once by the gate

        const edited = structuredClone(gated);
        (edited.title as string[])[0] = `${slug} édité`;
        const saved = await putEpisode(c, createdBody.id, req(edited));
        expect(saved.status).toBe(200);
        const reread = (await (await getEpisodeById(c, createdBody.id)).json()) as { episode: Record<string, unknown> };
        expect(reread.episode).toEqual(edited); // exactly what (gated) the editor sent

        // unauthenticated callers read nothing
        expect((await getEpisodeById(ctx(null), createdBody.id)).status).toBe(401);

        const gone = await deleteEpisodeById(c, createdBody.id);
        expect(gone.status).toBe(204);
        expect((await getEpisodeById(c, createdBody.id)).status).toBe(404);
      });
    }
  });

  it('other users get a 404, and lists are per-user and newest-first', async () => {
    const c = ctx('u1');
    const id1 = ((await (await postEpisodes(c, req(fixtureOf('million16')))).json()) as { id: string }).id;
    const id2 = ((await (await postEpisodes(c, req(fixtureOf('rewind')))).json()) as { id: string }).id;

    const other = ctx('u2');
    expect((await getEpisodeById(other, id1)).status).toBe(404);
    expect((await deleteEpisodeById(other, id1)).status).toBe(404);

    const list = (await (await getEpisodesList(c)).json()) as { id: string; status: string }[];
    expect(list.map((e) => e.id)).toEqual([id2, id1]); // newest first
    expect(list[0].status).toBe('draft');
  });

  it('empty list comes back as []', async () => {
    expect(await getEpisodesList(ctx('u1')).then((r) => r.json())).toEqual([]);
  });

  describe('zod gate → 400 { error: schema, issues[] }', () => {
    it('rejects a broken episode on POST with issue paths', async () => {
      const c = ctx('u1');
      const broken = { ...fixtureOf('million16'), shots: '' } as unknown; // shots must be an array of >= 2
      const res = await postEpisodes(c, req(broken));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; issues: { path: string }[] };
      expect(body.error).toBe('schema');
      expect(body.issues.some((i) => i.path.startsWith('shots'))).toBe(true);
    });

    it('rejects a bad PUT on an existing episode', async () => {
      const c = ctx('u1');
      const { id } = (await (await postEpisodes(c, req(fixtureOf('rewind')))).json()) as { id: string };
      const res = await putEpisode(c, id, req({ nope: true }));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('schema');
    });

    it('service-level gate carries structured issues', () => {
      try {
        gateEpisode({ id: 'x' });
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SchemaError);
        const err = e as SchemaError;
        expect(err.issues.length).toBeGreaterThan(1);
        expect(err.issues[0]).toEqual({ path: expect.any(String), message: expect.any(String) });
      }
    });
  });

  it('malformed JSON posts 400 bad_json', async () => {
    const bad = new Request('http://x', { method: 'POST', body: 'not json' });
    expect((await postEpisodes(ctx('u1'), bad)).status).toBe(400);
  });
});
