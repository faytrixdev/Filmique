import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { githubActionsRender } from '../src/lib/render-adapter';

const ep = JSON.parse(readFileSync(join(__dirname, '..', '..', 'engine', 'test', 'fixtures', 'rewind-episode.json'), 'utf8'));
const jobId = `adapter-${Date.now()}`;
const render = githubActionsRender();
if (!render) throw new Error('adapter non configure');
render.startRender({ jobId, episode: ep }).then(() => {
  console.log(`DISPATCH OK — jobId: ${jobId}`);
}).catch((e) => {
  console.error('DISPATCH FAIL', e);
  process.exit(1);
});
