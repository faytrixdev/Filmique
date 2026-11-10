import { describe, expect, it } from 'vitest';
import { postTts, getTts, type TtsCtx, type TtsJobsRepo } from '../src/lib/api-tts';
import type { EpisodeRepo, EpisodeRow } from '../src/lib/episodes';
import type { VoiceProvider } from '@what-if/engine/providers/voice';
import type { Words } from '@what-if/engine/schema';
import { stitchBeats } from '../src/lib/tts-flow';
import { EpisodeJsonZ } from '@what-if/engine/schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ep1: Words = [
  { w: 'Et', s: 0, e: 0.5, p: '' },
  { w: 'si', s: 0.5, e: 0.9, p: '' },
];
const ep2: Words = [{ w: 'on', s: 0, e: 0.4, p: '' }];

const fakeVoice = (): VoiceProvider & { calls: string[] } => {
  const calls: string[] = [];
  let i = 0;
  return {
    calls,
    async synthesize(text: string) {
      calls.push(text);
      const words = [ep1, ep2][++i % 2];
      return { audio: new Uint8Array([1, 2, 3]), words: words as Words };
    },
  };
};

const fakeRepo = (episodeJson: unknown): EpisodeRepo => {
  const row: EpisodeRow = {
    id: 'ep1',
    userId: 'u1',
    slug: 'demo',
    topic: 'demo',
    status: 'draft',
    episode: episodeJson as EpisodeRow['episode'],
    createdAt: 0,
    updatedAt: 0,
  };
  return {
    async insert(input) {
      return { ...row, id: 'ep2', episode: input.episode, userId: input.userId };
    },
    async byId(id) {
      return id === 'ep1' ? row : null;
    },
    async listFor(userId) {
      return userId === row.userId ? [row] : [];
    },
    async remove() {},
    async snapshot(id, episode) {
      return id === 'ep1' ? ((row.episode = episode), 1) : 1;
    },
  };
};

const fixture = (): unknown => EpisodeJsonZ.parse(JSON.parse(readFileSync(join(__dirname, '..', '..', 'engine', 'test', 'fixtures', 'rewind-episode.json'), 'utf8')));

const setup = () => {
  const voice = fakeVoice();
  const stored: Uint8Array[] = [];
  const recorded: { kind: string; status: string }[] = [];
  const jobs: TtsJobsRepo = {
    async recordDone() {
      recorded.push({ kind: 'tts', status: 'done' });
      return 'job1';
    },
    async recordFailed() {
      recorded.push({ kind: 'tts', status: 'failed' });
      return 'job2';
    },
    async latestDone() {
      return null;
    },
  };
  const ctx: TtsCtx = {
    voice,
    episodeRepo: fakeRepo(fixture()),
    jobs,
    saveAudio: async (bytes) => {
      stored.push(bytes);
      return `/tts/fake-${stored.length}.mp3`;
    },
    userId: 'u1',
  };
  return { ctx, jobs, voice, recorded, stored };
};

describe('tts flow (pure HTTP layer)', () => {
  it('synthesizes one call per beat and stitches the whole track', async () => {
    const { ctx, voice, recorded, stored } = setup();
    const res = await postTts(ctx, 'ep1');
    const body = (await res.json()) as { audioUrl: string; words: Words; offsets: number[]; voiceId: string };
    expect(res.status).toBe(200);

    const ep = fixture() as { script: { text: string }[] };
    expect(voice.calls).toEqual(ep.script.map((b) => b.text.trim()));
    expect(stored).toHaveLength(1);
    expect(stored[0].length).toBe(ep.script.length * 3);
    expect(recorded).toEqual([{ kind: 'tts', status: 'done' }]);

    const perBeat: Words[] = Array.from({ length: ep.script.length }, (_, i) => (i % 2 === 0 ? ep2 : ep1) as Words);
    const gap = 0.25;
    const { words: expectedWords, offsets: expectedOffsets } = stitchBeats(perBeat, gap);
    expect(body.offsets).toEqual(expectedOffsets);
    expect(body.words).toEqual(expectedWords);
    expect(body.audioUrl.startsWith('/tts/fake-')).toBe(true);
    expect(body.voiceId).toBe(((fixture() as { voice?: { id: string } }).voice?.id ?? 'default') as string);
  });

  it('GET latest returns null before any job, and both routes guard owner/session', async () => {
    const { ctx } = setup();
    expect(((await (await getTts(ctx, 'ep1')).json()) as { tts: unknown }).tts).toBeNull();

    const anon: TtsCtx = { ...ctx, userId: null };
    expect((await postTts(anon, 'ep1')).status).toBe(401);
    expect((await getTts(anon, 'ep1')).status).toBe(401);

    const foreign: TtsCtx = { ...ctx, userId: 'u2' };
    expect((await postTts(foreign, 'ep1')).status).toBe(404);
    expect((await getTts(foreign, 'ep1')).status).toBe(404);

    expect((await postTts(ctx, 'nope')).status).toBe(404);
  });

  it('a failing provider records the job failure and answers 502', async () => {
    const { ctx, recorded, voice } = setup();
    voice.synthesize = async () => {
      throw new Error('provider down');
    };
    const res = await postTts(ctx, 'ep1');
    expect(res.status).toBe(502);
    expect(recorded).toEqual([{ kind: 'tts', status: 'failed' }]);
  });
});
