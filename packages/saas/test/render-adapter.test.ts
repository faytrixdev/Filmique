import { afterEach, describe, expect, it } from 'vitest';
import { githubActionsRender, githubActionsRenderEnv } from '../src/lib/render-adapter';
import { EpisodeJsonZ } from '@what-if/engine/schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const epFixture = () => EpisodeJsonZ.parse(JSON.parse(readFileSync(join(__dirname, '..', '..', 'engine', 'test', 'fixtures', 'rewind-episode.json'), 'utf8')));

const envWith = (over: Partial<Record<string, string>>) => ({
  GITHUB_RENDER_REPO: 'acme/saas',
  GITHUB_RENDER_TOKEN: 'ghp_test',
  ...over,
}) as unknown as NodeJS.ProcessEnv;

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('githubActionsRenderEnv', () => {
  it('is null without repo or token', () => {
    expect(githubActionsRenderEnv(envWith({ GITHUB_RENDER_REPO: '' }))).toBeNull();
    expect(githubActionsRenderEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('is null when an upstream backend is configured', () => {
    expect(githubActionsRenderEnv(envWith({ REMOTION_LAMBDA_FUNCTION_NAME: 'fn' }))).toBeNull();
    expect(githubActionsRenderEnv(envWith({ CLOUDRUN_SERVICE_NAME: 'svc' }))).toBeNull();
  });

  it('resolves with defaults', () => {
    const env = githubActionsRenderEnv(envWith({}));
    expect(env).toEqual({ repo: 'acme/saas', token: 'ghp_test', workflow: 'saas-render.yml', ref: 'main' });
  });
});

describe('githubActionsRender', () => {
  it('is null when the env gate fails', () => {
    expect(githubActionsRender({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('dispatches the render workflow with job props', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const render = githubActionsRender(envWith({ GITHUB_RENDER_REF: 'dev' }));
    expect(render).not.toBeNull();
    await render!.startRender({ jobId: 'job-1', episode: epFixture() });
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0].init?.body));
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(calls[0].url).toContain('/repos/acme/saas/actions/workflows/saas-render.yml/dispatches');
    expect(headers.authorization).toBe('Bearer ghp_test');
    expect(body.ref).toBe('dev');
    expect(body.inputs.jobId).toBe('job-1');
    const props = JSON.parse(Buffer.from(body.inputs.propsBase64, 'base64').toString('utf8'));
    expect(props.jobId).toBe('job-1');
    expect(props.tts).toEqual({ audioUrl: null, words: null });
  });

  it('throws on a rejected dispatch', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const render = githubActionsRender(envWith({}));
    await expect(render!.startRender({ jobId: 'job-1', episode: epFixture() })).rejects.toThrow(/github_dispatch_failed \(404\)/);
  });

  it('fails fast when the props exceed the dispatch input limit', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    const render = githubActionsRender(envWith({}));
    const ep = epFixture();
    const big = { ...ep, shots: Array.from({ length: 3000 }, () => ep.shots[0]) } as unknown as Parameters<NonNullable<ReturnType<typeof githubActionsRender>>['startRender']>[0]['episode'];
    await expect(render!.startRender({ jobId: 'job-1', episode: big })).rejects.toThrow('props_too_large');
  });
});
