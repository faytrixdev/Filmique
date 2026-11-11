import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { composeEpisode } from '@what-if/engine';
import { EpisodeJsonZ } from '@what-if/engine/schema';
import { composeTimeline } from '@what-if/engine/timeline';
import { MockLlmProvider, getLlmProvider } from '@what-if/engine/providers/llm';
import { composeMockQueue } from '@what-if/engine/compose-mock';
import { buildReport, loadTopics, pickTopics, type StepRecord } from '../src/lib/bench';
import { synthWords } from '../src/lib/demo-words';

// Canary / bench CLI — Task 17 + 18.
//   node canary.mjs                       → 1 random topic, compose + schema gate
//   node canary.mjs --mode bench          → every topic from topics.json
//   node canary.mjs --render              → also render one still (needs @remotion/bundler + renderer)
// Writes out/report.json (studio-compatible keys) and exits 1 when success rate < 0.9 in bench mode.

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (name: string): boolean => process.argv.includes(`--${name}`);

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, arg('out') ?? 'out');
const fps = 30;

const renderStillSafe = async (slug: string, episodeJson: unknown): Promise<void> => {
  const { bundle } = await import('@remotion/bundler');
  const { renderStill, selectComposition } = await import('@remotion/renderer');
  const entry = join(root, 'lambda', 'index.tsx');
  const serveUrl = await bundle({ entryPoint: entry, onProgress: () => undefined });
  const inputProps = { episodeJson, tts: undefined };
  const composition = await selectComposition({
    serveUrl,
    id: 'saas-episode',
    inputProps,
  });
  mkdirSync(join(outDir, slug), { recursive: true });
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame: 0,
    output: join(outDir, slug, 'still.png'),
    overwrite: true,
  });
};

/** LLM: real provider from env, or the canned queue so the canary runs with zero secrets. */
const makeLlm = () => {
  const choice = (process.env.LLM_PROVIDER ?? 'mock').toLowerCase();
  if (choice === 'mock') return new MockLlmProvider(composeMockQueue());
  return getLlmProvider();
};

const runTopic = async (topic: string, records: StepRecord[]): Promise<void> => {
  try {
    const llm = makeLlm();
    const { episode } = await composeEpisode({ topic }, llm);
    let checked: unknown;
    try {
      checked = EpisodeJsonZ.parse(episode);
    } catch (err) {
      records.push({ topic, step: 'schema', note: err instanceof Error ? err.message : String(err) });
      return;
    }
    const ep = checked as { slug: string; script: unknown[] };
    if (has('render')) {
      try {
        await renderStillSafe(ep.slug, checked);
      } catch (err) {
        records.push({ topic, slug: ep.slug, step: 'render', note: err instanceof Error ? err.message : String(err) });
        return;
      }
    }
    const timeline = composeTimeline(checked as never, synthWords((checked as { script: { text: string }[] }).script));
    const seconds = Math.round((timeline.total / fps) * 10) / 10;
    records.push({ topic, slug: ep.slug, step: 'done', note: String(seconds) });
  } catch (err) {
    records.push({ topic, step: 'compose', note: err instanceof Error ? err.message : String(err) });
  }
};

const main = async (): Promise<void> => {
  const bench = arg('mode') === 'bench';
  const topics = loadTopics(join(root, 'topics.json'));
  const chosen = bench ? pickTopics(topics, topics.length, 1) : pickTopics(topics, 1);
  const records: StepRecord[] = [];
  for (const topic of chosen) {
    await runTopic(topic, records);
  }
  const report = buildReport(records);
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, 'report.json');
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(`[canary] ${report.ok}/${report.total} ok → ${file}`);
  if (bench ? report.successRate < 0.9 : report.ok === 0) process.exitCode = 1;
};

void main();
