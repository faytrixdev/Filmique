// compose-cli — one episode from a topic: script → science → storyboard → sound.
// Usage: npx tsx packages/engine/scripts/compose-cli.ts --topic "Et si ..." [--tone playful] [--secs 24] [--voice VOICE_ID] [--out out]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLlmProvider } from '../src/providers';
import { composeEpisode } from '../src/compose';
import { EpisodeJsonZ } from '../src/schema';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const topic = arg('topic');
if (!topic) {
  console.error('Usage: npx tsx packages/engine/scripts/compose-cli.ts --topic "Et si ..." [--tone playful] [--secs 24] [--voice ID] [--out out]');
  process.exit(1);
}

const input = {
  topic,
  tone: arg('tone'),
  durationS: arg('secs') ? Number(arg('secs')) : undefined,
  voiceId: arg('voice'),
};

const run = async () => {
  console.log(`compose: topic="${input.topic}" tone=${input.tone ?? 'default'} secs=${input.durationS ?? 24}`);
  const llm = getLlmProvider();
  console.log(`llm: ${llm.name}`);
  const { episode } = await composeEpisode(input, llm);
  const checked = EpisodeJsonZ.parse(episode);
  const outDir = resolve(process.cwd(), arg('out') ?? 'out', checked.slug);
  mkdirSync(outDir, { recursive: true });
  const file = `${outDir}/episode.json`;
  writeFileSync(file, JSON.stringify(checked, null, 1) + '\n');
  console.log(`wrote ${file}`);
  console.log(`  ${checked.shots.length} shots, ${checked.science.length} fait support(s), ${checked.sound.events.length} events`);
};

run().catch((e: unknown) => {
  console.error(`compose failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
