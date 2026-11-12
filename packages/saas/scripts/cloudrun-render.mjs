// Companion of the export flow (GCP Cloud Run backend): runs `remotion cloudrun render`
// for one job, then POSTs the render callback so the SaaS job row settles.
// Output URL is deterministic: --render-id-override <jobId> + --out-name in a known bucket,
// so the public https://storage.googleapis.com/<bucket>/renders/<jobId>/video.mp4 is known upfront.

import { execFileSync } from 'node:child_process';

const env = process.env;
const jobId = env.EXPORT_JOB_ID;
const propsFile = env.EXPORT_PROPS_FILE;
const serveUrl = env.EXPORT_SERVE_URL;
const region = env.EXPORT_REGION ?? 'europe-west1';
const serviceName = env.EXPORT_SERVICE_NAME;
const bucket = env.EXPORT_BUCKET;
const callbackUrl = env.EXPORT_CALLBACK_URL;
const callbackSecret = env.EXPORT_CALLBACK_SECRET ?? '';

if (!jobId || !propsFile || !serveUrl || !serviceName || !bucket || !callbackUrl) {
  console.error('[cloudrun-render] missing env');
  process.exit(1);
}

const videoUrl = `https://storage.googleapis.com/${bucket}/renders/${jobId}/video.mp4`;

const report = async (body) => {
  await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-export-token': callbackSecret },
    body: JSON.stringify(body),
  });
};

try {
  execFileSync(
    'npx',
    [
      'remotion',
      'cloudrun',
      'render',
      serveUrl,
      'saas-episode',
      '--service-name',
      serviceName,
      '--region',
      region,
      '--props',
      propsFile,
      '--render-id-override',
      jobId,
      '--out-name',
      'video.mp4',
      '--force-bucket-name',
      bucket,
      '--privacy',
      'public',
      '--yes',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'], timeout: 45 * 60_000 },
  );
  await report({ jobId, ok: true, videoUrl });
} catch (error) {
  console.error('[cloudrun-render] failed:', error.message);
  await report({ jobId, ok: false, error: String(error.message ?? error).slice(0, 500) }).catch(() => {});
  process.exit(1);
}
