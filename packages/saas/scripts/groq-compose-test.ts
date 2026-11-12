import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLlmProvider } from '@what-if/engine/providers/llm';
import { composeEpisode } from '@what-if/engine/compose';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const llm = getLlmProvider(env as NodeJS.ProcessEnv);
const t0 = Date.now();
composeEpisode({ topic: 'Et si le pain tombait du ciel tous les jours ?' }, llm).then(({ episode }) => {
  console.log(`OK en ${Math.round((Date.now() - t0) / 1000)} s — "${episode.title.join(' ')}" — ${episode.shots.length} shots — ${episode.script.length} beats — cast: ${episode.cast.join(', ')}`);
  console.log(episode.script.map((b) => `[${b.beat}] ${b.text}`).join('\n'));
}).catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message.slice(0, 400) : e);
  process.exit(1);
});
