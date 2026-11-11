import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Canary / bench core (pure): topic pool, per-step outcome counting, report shape.
// The report reuses the studio report.json vocabulary (episode/seconds/segments/cost_lines)
// so both pipelines can be diffed side by side.

export type StepName = 'compose' | 'schema' | 'render';

export type StepRecord = {
  topic: string;
  slug?: string;
  step: StepName | 'done';
  note: string; // error message, or 'ok'
};

export type BenchReport = {
  generatedAt: string;
  total: number;
  ok: number;
  failed: number;
  successRate: number; // 0..1, the > 0.9 target lives in the CLI
  steps: Record<StepName, number>; // failures per step
  runs: Array<{
    topic: string;
    slug?: string;
    ok: boolean;
    failedAt?: StepName;
    note: string;
    seconds?: number; // episode duration, when compose+schema passed
    segments?: number; // script beats, idem
  }>;
};

export const loadTopics = (file = join(process.cwd(), 'topics.json')): string[] => {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(raw) || raw.some((t) => typeof t !== 'string')) {
    throw new Error(`invalid topics file: ${file}`);
  }
  return raw as string[];
};

/** Canary = one random topic; bench = every topic, in a stable shuffled order. */
export const pickTopics = (all: string[], count: number, seed = Date.now()): string[] => {
  let s = seed % 2147483647;
  const rand = (): number => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  const shuffled = [...all].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.max(1, Math.min(count, all.length)));
};

export const buildReport = (records: StepRecord[]): BenchReport => {
  const runs = new Map<string, { topic: string; slug?: string; ok: boolean; failedAt?: StepName; note: string; seconds?: number; segments?: number }>();
  for (const r of records) {
    const run = runs.get(r.topic) ?? { topic: r.topic, slug: r.slug, ok: false, note: '' };
    if (r.step === 'done') {
      run.ok = true;
      run.note = 'ok';
      run.seconds = Number(r.note) || undefined;
    } else if (!run.ok) {
      run.failedAt = r.step;
      run.note = r.note;
      run.slug = r.slug ?? run.slug;
    }
    runs.set(r.topic, run);
  }
  const list = [...runs.values()];
  const steps = { compose: 0, schema: 0, render: 0 };
  for (const run of list) if (run.failedAt) steps[run.failedAt] += 1;
  const ok = list.filter((r) => r.ok).length;
  return {
    generatedAt: new Date().toISOString(),
    total: list.length,
    ok,
    failed: list.length - ok,
    successRate: list.length === 0 ? 0 : ok / list.length,
    steps,
    runs: list,
  };
};
