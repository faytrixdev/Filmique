import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { EpisodeJson } from '@what-if/engine/schema';
import type { RenderAdapter } from './export-flow';

// The real Remotion Lambda render, CLI-driven: a detached `remotion lambda render`
// process runs the citation, and its companion script  scripts/lambda-render.mjs
// POSTs our callback when the render settles. No bundler/native addon is ever
// imported into the Next server process (rspack cannot place @rspack bindings).

export const lambdaRenderEnv = (env: NodeJS.ProcessEnv = process.env): { region: string; functionName: string; serveUrl: string; outputUrl: string; callbackUrl: string; callbackSecret: string } | null => {
  if (!env.REMOTION_LAMBDA_FUNCTION_NAME || !env.REMOTION_LAMBDA_SERVE_URL || !env.REMOTION_LAMBDA_BUCKET) return null;
  return {
    region: env.REMOTION_LAMBDA_REGION ?? 'eu-west-1',
    functionName: env.REMOTION_LAMBDA_FUNCTION_NAME,
    serveUrl: env.REMOTION_LAMBDA_SERVE_URL,
    outputUrl: env.REMOTION_LAMBDA_BUCKET,
    callbackUrl: env.EXPORT_CALLBACK_URL ?? 'http://localhost:3000/api/exports/lambda',
    callbackSecret: env.EXPORT_CALLBACK_SECRET ?? '',
  };
};

/** GCP Cloud Run backend: chosen when the Cloud Run env is set and Lambda's is not. */
export const cloudrunRenderEnv = (env: NodeJS.ProcessEnv = process.env): { region: string; serviceName: string; serveUrl: string; bucket: string; callbackUrl: string; callbackSecret: string } | null => {
  if (env.REMOTION_LAMBDA_FUNCTION_NAME) return null; // Lambda wins when both are configured
  if (!env.CLOUDRUN_SERVICE_NAME || !env.CLOUDRUN_SERVE_URL || !env.CLOUDRUN_BUCKET) return null;
  return {
    region: env.CLOUDRUN_REGION ?? 'europe-west1',
    serviceName: env.CLOUDRUN_SERVICE_NAME,
    serveUrl: env.CLOUDRUN_SERVE_URL,
    bucket: env.CLOUDRUN_BUCKET,
    callbackUrl: env.EXPORT_CALLBACK_URL ?? 'http://localhost:3000/api/exports/lambda',
    callbackSecret: env.EXPORT_CALLBACK_SECRET ?? '',
  };
};

const scriptAt = (name: string): string => join(process.cwd(), 'scripts', name); // resolved lazily: the build-time loader has no fs paths
const projectsRoot = (): string => process.cwd();

const spawnRender = (scriptName: string, extraEnv: Record<string, string>): RenderAdapter => ({
  startRender: async ({ jobId, episode, audioUrl }): Promise<void> => {
    const propsFile = join(tmpdir(), `export-${jobId}.json`);
    await writeFile(
      propsFile,
      JSON.stringify({
        episodeJson: episode,
        tts: { audioUrl: audioUrl ?? null, words: null },
        metadata: { jobId },
        // our own field: the render script pairs the callback without extra round trips
        jobId,
      }),
    );
    const child = spawn(
      process.execPath,
      [scriptAt(scriptName)],
      {
        env: {
          ...process.env,
          EXPORT_JOB_ID: jobId,
          EXPORT_PROPS_FILE: propsFile,
          EXPORT_CALLBACK_URL: extraEnv.callbackUrl,
          EXPORT_CALLBACK_SECRET: extraEnv.callbackSecret,
        },
        cwd: projectsRoot(),
        stdio: 'ignore',
        detached: true,
      },
    );
    child.on('error', () => {
      // nothing more we can do here: the job stays queued until the callback
    });
    child.unref();
  },
});

export const lambdaRender = (): RenderAdapter | null => {
  const env = lambdaRenderEnv();
  if (!env) return null;
  return spawnRender('lambda-render.mjs', {
    callbackUrl: env.callbackUrl,
    callbackSecret: env.callbackSecret,
    EXPORT_SERVE_URL: env.serveUrl,
    EXPORT_REGION: env.region,
    EXPORT_FUNCTION_NAME: env.functionName,
    EXPORT_OUTPUT_URL: env.outputUrl,
  });
};

export const cloudrunRender = (): RenderAdapter | null => {
  const env = cloudrunRenderEnv();
  if (!env) return null;
  return spawnRender('cloudrun-render.mjs', {
    callbackUrl: env.callbackUrl,
    callbackSecret: env.callbackSecret,
    EXPORT_SERVE_URL: env.serveUrl,
    EXPORT_REGION: env.region,
    EXPORT_SERVICE_NAME: env.serviceName,
    EXPORT_BUCKET: env.bucket,
  });
};
