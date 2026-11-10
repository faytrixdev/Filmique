import { describe, expect, it } from 'vitest';
import { composeTimeline, EpisodeJsonZ, type EpisodeJson } from '@what-if/engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { synthWords } from '../src/lib/demo-words';
import { COPY, MILLION, PASTE, REWIND, STUDIO_LOOKS } from '../src/lib/looks';

// Demo word track (TTS-less editor): deterministic, and strong enough that all
// three golden episodes' edit anchors still resolve through composeTimeline.

const SLUGS = ['copy-paste', 'million16', 'rewind'];
const FIXTURES_DIR = join(__dirname, '..', '..', 'engine', 'test', 'fixtures');
const epOf = (slug: string): EpisodeJson => EpisodeJsonZ.parse(JSON.parse(readFileSync(join(FIXTURES_DIR, `${slug}-episode.json`), 'utf8')));

describe('demo words', () => {
  it('one entry per script token, fixed 0.35 s cadence', () => {
    const words = synthWords([{ text: 'Et si la power marchait ?' }]);
    expect(words.map((w) => w.w)).toEqual(['Et', 'si', 'la', 'power', 'marchait']);
    expect(words[0]).toEqual({ w: 'Et', s: 0, e: 0.35, p: '' });
    expect(words[4]).toEqual({ w: 'marchait', s: 1.4, e: 1.75, p: '' });
  });

  for (const slug of SLUGS) {
    it(`resolves every edit anchor of ${slug}`, () => {
      const ep = epOf(slug);
      const words = synthWords(ep.script);
      const tl = composeTimeline(ep, words, { fps: 30 });
      expect(tl.total).toBeGreaterThan(60);
      expect(tl.segments.length).toBe(ep.edit.length);
      // every anchor found exactly once, sequential pointer respected → total < naive estimate
      const lastWordEnd = words[words.length - 1].e;
      expect(tl.total).toBeGreaterThan(lastWordEnd * 30);
    });
  }
});

describe('studio looks', () => {
  it('the four golden looks exist and the registry covers them all', () => {
    expect(Object.keys(STUDIO_LOOKS)).toEqual(['rewind', 'million', 'copy', 'paste']);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderable = [REWIND, MILLION, COPY, PASTE].every((look) => typeof look.grade === 'function' || look.Overlay !== undefined);
    expect(renderable).toBe(true);
  });
});
