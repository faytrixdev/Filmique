import { describe, expect, it } from 'vitest';
import { buildReport, pickTopics, type StepRecord } from '../src/lib/bench';

const topics = ['a', 'b', 'c', 'd', 'e'];

describe('topic picking', () => {
  it('a fixed seed returns a stable, size-bounded selection', () => {
    const first = pickTopics(topics, 3, 42);
    const again = pickTopics(topics, 3, 42);
    expect(again).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
  });

  it('asking for more than the pool caps at the pool', () => {
    expect(pickTopics(topics, 99, 7)).toHaveLength(5);
  });
});

describe('bench report', () => {
  const records: StepRecord[] = [
    { topic: 'a', slug: 'slug-a', step: 'compose', note: 'boom' },
    { topic: 'b', slug: 'slug-b', step: 'schema', note: 'shots: too small' },
    { topic: 'c', slug: 'slug-c', step: 'render', note: 'no chrome' },
    { topic: 'd', slug: 'slug-d', step: 'done', note: '24' },
  ];

  it('counts one failure per run, attributed to its first failed step', () => {
    const report = buildReport(records);
    expect(report.total).toBe(4);
    expect(report.ok).toBe(1);
    expect(report.failed).toBe(3);
    expect(report.successRate).toBeCloseTo(0.25);
    expect(report.steps).toEqual({ compose: 1, schema: 1, render: 1 });
    expect(report.runs.find((r) => r.topic === 'b')).toMatchObject({ failedAt: 'schema', slug: 'slug-b' });
    expect(report.runs.find((r) => r.topic === 'd')).toMatchObject({ ok: true, seconds: 24 });
  });

  it('an empty run list yields a zeroed report', () => {
    const report = buildReport([]);
    expect(report).toMatchObject({ total: 0, ok: 0, successRate: 0 });
  });
});
