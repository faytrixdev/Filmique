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

const scriptAt = (): string => join(process.cwd(), 'scripts', 'lambda-render.mjs'); // resolved lazily: the build-time loader has no fs paths
const projectsRoot = (): string => process.cwd();

export const lambdaRender = (): RenderAdapter | null => {
  const env = lambdaRenderEnv();
  if (!env) return null;
  return {
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
        [scriptAt()],
        {
          env: {
            ...process.env,
            EXPORT_JOB_ID: jobId,
            EXPORT_PROPS_FILE: propsFile,
            EXPORT_SERVE_URL: env.serveUrl,
            EXPORT_REGION: env.region,
            EXPORT_FUNCTION_NAME: env.functionName,
            EXPORT_OUTPUT_URL: env.outputUrl,
            EXPORT_CALLBACK_URL: env.callbackUrl,
            EXPORT_CALLBACK_SECRET: env.callbackSecret,
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
  };
};
