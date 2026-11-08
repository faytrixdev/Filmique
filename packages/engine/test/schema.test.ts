import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EpisodeJsonZ, WordsZ } from '../src/schema';

const fixture = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, `fixtures/${name}`), 'utf8')) as unknown;

const words = (slug: string) =>
  JSON.parse(readFileSync(resolve(__dirname, `../../studio/src/episodes/${slug}/words.json`), 'utf8')) as unknown;

describe('EpisodeJsonZ', () => {
  for (const slug of ['million16', 'rewind', 'copy-paste']) {
    it(`accepts the ${slug} episode verbatim`, () => {
      expect(() => EpisodeJsonZ.parse(fixture(`${slug}-episode.json`))).not.toThrow();
    });
    it(`accepts the ${slug} words verbatim`, () => {
      expect(() => WordsZ.parse(words(slug))).not.toThrow();
    });
  }

  it('rejects a shot without id', () => {
    const bad = fixture('million16-episode.json') as Record<string, unknown>;
    (bad.shots as unknown[])[0] = { size: 'wide', key: 18, set: 'kitchen' };
    expect(() => EpisodeJsonZ.parse(bad)).toThrow();
  });

  it('rejects an unknown fx kind', () => {
    const bad = fixture('million16-episode.json') as Record<string, unknown>;
    (bad.fx as unknown[])[0] = { at: 'S2+28', kind: 'explode' };
    expect(() => EpisodeJsonZ.parse(bad)).toThrow();
  });

  it('rejects a bad event anchor', () => {
    const bad = fixture('rewind-episode.json') as Record<string, unknown>;
    (bad.sound as Record<string, unknown>).events = [['x:5', 'clink', 0.25]];
    expect(() => EpisodeJsonZ.parse(bad)).toThrow();
  });
});
