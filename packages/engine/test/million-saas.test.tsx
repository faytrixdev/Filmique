import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildShotMap } from '../src/archetypes';
import { EpisodeJsonZ, WordsZ } from '../src/schema';
import { ShotFrame } from '../src/episode';
import { composeTimeline } from '../src/timeline';

// Task: million16 becomes pure data — the SAME episode json then drives the timeline
// (composeTimeline) and the visuals (buildShotMap), no bespoke shot code left.

const load = (slug: string) => ({
  ep: EpisodeJsonZ.parse(JSON.parse(readFileSync(resolve(__dirname, `fixtures/${slug}-episode.json`), 'utf8'))) as ReturnType<typeof EpisodeJsonZ.parse>,
  words: WordsZ.parse(JSON.parse(readFileSync(resolve(__dirname, `../../studio/src/episodes/${slug}/words.json`), 'utf8'))) as ReturnType<typeof WordsZ.parse>,
  golden: JSON.parse(readFileSync(resolve(__dirname, `../../studio/src/episodes/${slug}/timeline.json`), 'utf8')) as { total: number; shots: { id: string }[] },
});

describe('million16 as pure data (SaaS path)', () => {
  const { ep, words, golden } = load('million16');
  const map = buildShotMap(ep);

  it('binds an archetype for every shot', () => {
    expect(Object.keys(map).sort()).toEqual(ep.shots.map((s) => s.id).sort());
  });

  it('the bound shots all render across their duration', () => {
    const built = composeTimeline(ep, words);
    for (const s of built.shots) {
      for (const t of [0, Math.ceil(s.len / 2), s.len]) {
        const html = renderToStaticMarkup(
          React.createElement(ShotFrame, null as never, React.createElement(map[s.id], { t, len: s.len, f: t, ...s } as never)),
        );
        expect(html.length, `${s.id} @t=${t}`).toBeGreaterThan(500);
      }
    }
  });

  it('the episode timings stay identical to the golden', () => {
    const built = composeTimeline(ep, words);
    expect(built.total).toBe(golden.total);
    expect(built.shots.map((s) => s.id)).toEqual(golden.shots.map((s) => s.id));
  });
});
