// Companion of the export flow: runs `remotion lambda render` for one job, then
// POSTs the render callback (success or failure) so the SaaS job row settles.
// Never imported into the Next server — spawned detached as its own process.

import { execFileSync } from 'node:child_process';

const env = process.env;
const jobId = env.EXPORT_JOB_ID;
const propsFile = env.EXPORT_PROPS_FILE;
const serveUrl = env.EXPORT_SERVE_URL;
const region = env.EXPORT_REGION ?? 'eu-west-1';
const functionName = env.EXPORT_FUNCTION_NAME;
const outputUrl = env.EXPORT_OUTPUT_URL;
const callbackUrl = env.EXPORT_CALLBACK_URL;
const callbackSecret = env.EXPORT_CALLBACK_SECRET ?? '';
const outName = `${jobId}.mp4`;

if (!jobId || !propsFile || !serveUrl || !functionName || !outputUrl || !callbackUrl) {
  console.error('[lambda-render] missing env');
  process.exit(1);
}

const report = async (body) => {
  await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-export-token': callbackSecret },
    body: JSON.stringify(body),
  });
};

try {
  const videoUrl = `${outputUrl.replace(/\/$/, '')}/${outName}`;
  execFileSync(
    'npx',
    [
      'remotion',
      'lambda',
      'render',
      'saas-episode',
      serveUrl,
      '--function-name',
      functionName,
      '--region',
      region,
      '--props',
      propsFile,
      '--output-url',
      videoUrl,
      '--yes',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'], timeout: 45 * 60_000 },
  );
  await report({ jobId, ok: true, videoUrl });
} catch (error) {
  console.error('[lambda-render] failed:', error.message);
  await report({ jobId, ok: false, error: String(error.message ?? error).slice(0, 500) }).catch(() => {});
  process.exit(1);
}
