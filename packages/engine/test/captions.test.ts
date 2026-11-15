import { describe, expect, it } from 'vitest';
import { captionAt, captionLines } from '../src/captions';
import { coverTransform, focalOf, WORLD_H, WORLD_W } from '../src/episode';
import { FORMAT_DIMS } from '../src/settings';
import type { Words } from '../src/schema';

const words = (list: [string, number, number, string?][]): Words =>
  list.map(([w, s, e, p]) => ({ w, s, e, ...(p ? { p } : {}) }));

describe('formats (the window over the 1920x1080 staging)', () => {
  it('16:9 fills the canvas exactly, no crop', () => {
    const [w, h] = FORMAT_DIMS['16:9'];
    expect(coverTransform(w, h)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('9:16 and 1:1 crop the sides, never squash the picture', () => {
    for (const format of ['9:16', '1:1'] as const) {
      const [w, h] = FORMAT_DIMS[format];
      const c = coverTransform(w, h);
      expect(c.scale).toBeCloseTo(Math.max(w / WORLD_W, h / WORLD_H), 6);
      expect(WORLD_W * c.scale).toBeGreaterThanOrEqual(w - 1e-6);
      expect(WORLD_H * c.scale).toBeGreaterThanOrEqual(h - 1e-6);
      expect(c.x).toBeLessThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(0);
      expect(Math.abs(c.x * 2 + WORLD_W * c.scale - w)).toBeLessThan(1e-6);
    }
  });

  it('the focal point pans the crop without changing the zoom', () => {
    const [w, h] = FORMAT_DIMS['9:16'];
    const left = coverTransform(w, h, 0.28);
    const right = coverTransform(w, h, 0.72);
    expect(left.scale).toBe(right.scale);
    expect(left.x).toBeGreaterThan(right.x); // a negative offset: less negative = further right
    expect(focalOf('gauche')).toBe(0.28);
    expect(focalOf('droite')).toBe(0.72);
    expect(focalOf(undefined)).toBe(0.5);
  });
});

describe('captions (grouped on the voice word track)', () => {
  const fps = 30;
  const track = words([
    ['Le', 0, 0.3],
    ['pain', 0.3, 0.6],
    ['tombe', 0.6, 0.9],
    ['du', 0.9, 1.1],
    ['ciel', 1.1, 1.4, '.'],
    ['Et', 1.6, 1.8],
    ['personne', 1.8, 2.3],
    ['ne', 2.3, 2.5],
    ['le', 2.5, 2.6],
    ['rattrape', 2.6, 3.2, '.'],
  ]);

  it('cuts a new line at the end of a sentence', () => {
    const lines = captionLines(track, { fps });
    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.w).join(' ')).toBe('Le pain tombe du ciel');
    expect(lines[1].words.map((w) => w.w).join(' ')).toBe('Et personne ne le rattrape');
  });

  it('maps word times to frames and holds each line briefly', () => {
    const [first] = captionLines(track, { fps });
    expect(first.a).toBe(0);
    expect(first.words[1].sf).toBe(9);
    expect(first.b).toBeGreaterThan(Math.round(1.4 * fps));
  });

  it('wraps on the character budget when a sentence runs long', () => {
    const long = words(Array.from({ length: 12 }, (_, i) => ['mot' + i, i * 0.3, i * 0.3 + 0.3] as [string, number, number]));
    const lines = captionLines(long, { fps, maxChars: 20 });
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      const chars = line.words.reduce((n, w) => n + w.w.length + 1, 0);
      expect(chars).toBeLessThanOrEqual(20 + 7); // the last word may push past the budget
    }
  });

  it('reports the word being spoken at a frame', () => {
    const lines = captionLines(track, { fps });
    expect(captionAt(lines, 0)?.index).toBe(0);
    expect(captionAt(lines, 20)?.index).toBe(2); // frame 20 = 0.66 s -> "tombe"
    expect(captionAt(lines, 70)?.index).toBe(2); // second line, "ne"
    expect(captionAt(lines, 10 * fps)).toBeNull();
  });
});
