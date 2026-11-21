import { describe, expect, it } from 'vitest';
import { generateEpisode } from '../src/lib/generate-flow';
import { postGenerate } from '../src/lib/api-generate';
import { draftScriptFor, rewriteBeat } from '../src/lib/script-flow';
import { MockLlmProvider } from '@what-if/engine/providers/llm';
import { composeMockQueue, SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON, padScript } from '@what-if/engine/compose-mock';
import { scriptCharBudget } from '@what-if/engine/settings';
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

  it('a validated script skips the script draft and lands in the episode', async () => {
    const repo = epRepo();
    // Only science + storyboard are queued: a script draft would break the queue.
    const res = await generateEpisode({ repo, userId: 'u1' }, new MockLlmProvider([SCIENCE_JSON, STORYBOARD_JSON]), {
      topic: 'Et si le pain tombait du ciel ?',
      script: padScript(
        {
          title: ['LE PAIN', 'TOMBE'],
          script: [
            { beat: 'hook', text: 'Une averse éclate au-dessus de la ville.' },
            { beat: 'premise', text: 'Le pain pousse sur les toits depuis ce matin.' },
            { beat: 'twist', text: 'Il faudrait 1 000 averses pour nourrir un immeuble.' },
            { beat: 'question', text: 'Mairie? elle taxe le pain?' },
          ],
        },
        scriptCharBudget(24),
      ),
    });
    expect(res.status).toBe(201);
    if (res.status !== 201) return;
    expect(res.row.episode.script[0].text).toContain('averse');
    expect(res.row.episode.title.join(' ')).toContain('PAIN');
  });

  it('a script too short for the chosen duration is refused', async () => {
    const repo = epRepo();
    // 159 chars is a 10 s script: fine at 15 s, nowhere near a 60 s film.
    const res = await generateEpisode({ repo, userId: 'u1' }, llm(), {
      topic: 'Et si le pain tombait du ciel ?',
      settings: { durationS: 60 },
      script: {
        title: ['LE PAIN', 'TOMBE'],
        script: [
          { beat: 'hook', text: 'Une averse éclate au-dessus de la ville.' },
          { beat: 'premise', text: 'Le pain pousse sur les toits depuis ce matin.' },
          { beat: 'twist', text: 'Il faudrait 1 000 averses pour nourrir un immeuble.' },
          { beat: 'question', text: 'Mairie? elle taxe le pain?' },
        ],
      },
    });
    expect(res).toMatchObject({ status: 400, error: 'bad_script' });
    expect(repo.rows.size).toBe(0);
  });

  it('a malformed script is refused before any LLM call', async () => {
    const repo = epRepo();
    const res = await generateEpisode({ repo, userId: 'u1' }, llm(), {
      topic: 'Et si le pain tombait du ciel ?',
      script: { title: ['X'], script: [{ beat: 'hook' }] },
    });
    expect(res).toMatchObject({ status: 400, error: 'bad_script' });
    expect(repo.rows.size).toBe(0);
  });

  it('the settings are stored with the episode', async () => {
    const repo = epRepo();
    // 45 s widens the script budget: the canned draft must be padded to fit it.
    const queue = [JSON.stringify(padScript(JSON.parse(SCRIPT_JSON), scriptCharBudget(45))), SCIENCE_JSON, STORYBOARD_JSON];
    const res = await generateEpisode({ repo, userId: 'u1' }, new MockLlmProvider(queue), {
      topic: 'Et si le pain tombait du ciel ?',
      settings: { durationS: 45, world: 'urbain', tone: 'tense', narration: 'prof', rhythm: 'nerveux' },
    });
    expect(res.status).toBe(201);
    if (res.status !== 201) return;
    expect(res.row.episode.settings).toMatchObject({
      durationS: 45,
      world: 'urbain',
      tone: 'tense',
      narration: 'prof',
      rhythm: 'nerveux',
      format: '16:9',
    });
  });
});

describe('script-first flow', () => {
  it('draftScriptFor returns the beats alone, with no storyboard', async () => {
    const res = await draftScriptFor(new MockLlmProvider([SCRIPT_JSON]), { topic: 'Et si le pain tombait du ciel ?' });
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.script.script.length).toBeGreaterThanOrEqual(4);
    expect(res.script.title.join(' ')).toContain('PAIN');
  });

  it('draftScriptFor refuses a short topic and a missing provider', async () => {
    expect(await draftScriptFor(new MockLlmProvider([SCRIPT_JSON]), { topic: 'court' })).toMatchObject({ status: 400 });
    expect(await draftScriptFor(null, { topic: 'Et si les chats parlaient enfin ?' })).toMatchObject({ status: 503 });
  });

  it('rewriteBeat returns three variants of the beat', async () => {
    const llm = new MockLlmProvider([
      JSON.stringify({ variants: ['Plus court.', 'Plus incarné.', 'Plus tranchant.'] }),
    ]);
    const res = await rewriteBeat(llm, { text: 'Une averse éclate au-dessus de la ville.', topic: 'Et si le pain tombait du ciel ?' });
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.variants).toHaveLength(3);
  });

  it('rewriteBeat refuses an empty beat', async () => {
    expect(await rewriteBeat(llm(), { text: '' })).toMatchObject({ status: 400 });
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

  it('malformed settings are refused, missing settings fall back to the defaults', async () => {
    expect((await postGenerate({ repo: epRepo(), userId: 'u1', llm: llm() }, req({ topic: 'Et si le pain tombait du ciel ?', settings: { durationS: 'long' } }))).status).toBe(400);

    const repo = epRepo();
    const res = await postGenerate({ repo, userId: 'u1', llm: llm() }, req({ topic: 'Et si le pain tombait du ciel ?' }));
    expect(res.status).toBe(201);
    const row = [...repo.rows.values()][0];
    expect(row.episode.settings).toMatchObject({ durationS: 24, format: '16:9', world: 'maison' });
  });
});
