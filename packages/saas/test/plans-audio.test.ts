import { describe, expect, it } from 'vitest';
import { clampKey, moveShot } from '../src/lib/editor-helpers';
import { MUSIC } from '@what-if/engine';

const shot = (id: string) => ({ id, size: 'wide', set: 'kitchen', key: 5 });

describe('plans helpers', () => {
  it('moveShot swaps neighbours and respects bounds', () => {
    const shots = [shot('S1'), shot('S2'), shot('S3')];
    expect(moveShot(shots, 0, 1).map((s) => s.id)).toEqual(['S2', 'S1', 'S3']);
    expect(moveShot(shots, 1, -1).map((s) => s.id)).toEqual(['S2', 'S1', 'S3']);
    expect(moveShot(shots, 2, 1).map((s) => s.id)).toEqual(['S1', 'S2', 'S3']);
    expect(moveShot(shots, 0, -1)).toBe(shots); // untouched beyond bounds
  });

  it('clampKey forces a positive int', () => {
    expect(clampKey(0)).toBe(1);
    expect(clampKey(-4)).toBe(1);
    expect(clampKey(12.6)).toBe(13);
    expect(clampKey(NaN)).toBe(1);
  });

  it('the music beds stay the deterministic trio', () => {
    expect(['playful', 'tense', 'warm'].every((t) => MUSIC[t])).toBe(true);
  });
});
