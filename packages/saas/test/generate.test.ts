import { describe, expect, it } from 'vitest';
import { generateEpisode } from '../src/lib/generate-flow';
import { postGenerate } from '../src/lib/api-generate';
import { MockLlmProvider } from '@what-if/engine/providers/llm';
import { composeMockQueue } from '@what-if/engine/compose-mock';
import type { EpisodeRepo, EpisodeRow } from '../src/lib/episodes';

const epRepo = (): EpisodeRepo & { rows: Map<string, EpisodeRow> } => {
  const rows = new Map<string, EpisodeRow>();
  let n = 0;
  return {
    rows,
    async insert(input) {
      const row: EpisodeRow = {
        id: `ep${++n}`,
        userId: input.userId,
        slug: input.episode.slug,
        topic: input.episode.topic,
        status: 'draft',
        episode: input.episode,
        createdAt: n,
        updatedAt: n,
      };
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

const llm = (): MockLlmProvider => new MockLlmProvider(composeMockQueue());

describe('generateEpisode', () => {
  it('topic → compose → row stored, owned by the caller', async () => {
    const repo = epRepo();
    const res = await generateEpisode({ repo, userId: 'u1' }, llm(), { topic: 'Et si le pain tombait du ciel ?' });
    expect(res.status).toBe(201);
    if (res.status !== 201) return;
    expect(res.row.userId).toBe('u1');
    expect(res.row.episode.shots.length).toBeGreaterThan(3);
    expect([...repo.rows.values()]).toHaveLength(1);
  });

  it('a short topic is refused before any LLM call', async () => {
    const repo = epRepo();
    const res = await generateEpisode({ repo, userId: 'u1' }, llm(), { topic: 'court' });
    expect(res).toMatchObject({ status: 400, error: 'bad_topic' });
    expect(repo.rows.size).toBe(0);
  });

  it('no provider configured → 503', async () => {
    const res = await generateEpisode({ repo: epRepo(), userId: 'u1' }, null, { topic: 'Et si les chats parlaient enfin ?' });
    expect(res).toMatchObject({ status: 503, error: 'unconfigured' });
  });

  it('a broken LLM surfaces as 502 compose_failed', async () => {
    const bad = new MockLlmProvider(['pas du json', 'toujours pas', 'rien de bon', 'non', 'non plus']);
    const res = await generateEpisode({ repo: epRepo(), userId: 'u1' }, bad, { topic: 'Et si Internet s’arrêtait 24 heures ?' });
    expect(res.status).toBe(502);
  });
});

describe('POST /api/episodes/generate (pure HTTP layer)', () => {
  const req = (body: unknown): Request => new Request('http://x/api/episodes/generate', { method: 'POST', body: JSON.stringify(body) });

  it('201 for a signed-in user with a working provider', async () => {
    const res = await postGenerate({ repo: epRepo(), userId: 'u1', llm: llm() }, req({ topic: 'Et si le pain tombait du ciel ?' }));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string; title: string[] };
    expect(data.id).toBe('ep1');
    expect(data.title.join(' ')).toContain('PAIN');
  });

  it('401 / 400 / 503 paths', async () => {
    expect((await postGenerate({ repo: epRepo(), userId: null, llm: llm() }, req({ topic: 'Et si les chats parlaient enfin ?' }))).status).toBe(401);
    expect((await postGenerate({ repo: epRepo(), userId: 'u1', llm: llm() }, req({ tone: 'no topic' }))).status).toBe(400);
    expect((await postGenerate({ repo: epRepo(), userId: 'u1', llm: null }, req({ topic: 'Et si les chats parlaient enfin ?' }))).status).toBe(503);
  });
});
