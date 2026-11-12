import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLlmProvider } from '@what-if/engine/providers/llm';
import { draftScript } from '@what-if/engine/compose';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const llm = getLlmProvider(env as NodeJS.ProcessEnv);
const t0 = Date.now();
draftScript({ topic: 'Et si le pain tombait du ciel tous les jours ?' }, llm).then((draft) => {
  const chars = draft.script.reduce((n, b) => n + b.text.length, 0);
  console.log(`OK en ${Math.round((Date.now() - t0) / 1000)} s — title: ${draft.title.join(' ')} — ${draft.script.length} beats — ${chars} car.`);
  console.log(draft.script.map((b) => `[${b.beat}] ${b.text}`).join('\n'));
}).catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
