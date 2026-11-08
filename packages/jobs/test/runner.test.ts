import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JobRunner } from '../src/index.js';
import type { RunnerEvent, Step } from '../src/index.js';

const createdDirs: string[] = [];

const makeTmpDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'what-if-jobs-'));
  createdDirs.push(dir);
  return dir;
};

afterEach(async () => {
  const dirs = createdDirs.splice(0, createdDirs.length);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

const noSleep = async (): Promise<void> => {};

describe('JobRunner', () => {
  it('un step réussi est done, écrit son output et débite son coût', async () => {
    const dir = await makeTmpDir();
    const runner = new JobRunner({ jobId: 'job-done', outDir: dir });

    const result = await runner.run([
      { id: 'draft', cost: 7, run: async () => ({ text: 'hello' }) },
    ]);

    expect(result.status).toBe('done');
    expect(result.charged).toBe(7);
    expect(result.refunded).toBe(0);
    expect(result.steps[0]).toMatchObject({
      id: 'draft',
      status: 'done',
      attempts: 1,
      cost: 7,
    });
    expect(result.steps[0].output).toEqual({ text: 'hello' });

    const raw = await readFile(join(dir, 'step-draft.json'), 'utf8');
    const file = JSON.parse(raw) as Record<string, unknown>;
    expect(file.STEP_DONE).toBe(true);
    expect(file.output).toEqual({ text: 'hello' });
  });

  it('un step qui échoue deux fois puis réussit est done avec attempts 3 et sans remboursement', async () => {
    const dir = await makeTmpDir();
    const delays: number[] = [];
    let calls = 0;
    const runner = new JobRunner({
      jobId: 'job-retry',
      outDir: dir,
      retries: 2,
      retryDelayMs: 7,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const result = await runner.run([
      {
        id: 'flaky',
        cost: 3,
        run: async (ctx) => {
          calls += 1;
          expect(ctx.attempt).toBe(calls);
          if (calls < 3) throw new Error(`boom ${calls}`);
          return 'ok';
        },
      },
    ]);

    expect(result.status).toBe('done');
    expect(result.steps[0]).toMatchObject({ status: 'done', attempts: 3, cost: 3 });
    expect(result.charged).toBe(3);
    expect(result.refunded).toBe(0);
    expect(calls).toBe(3);
    expect(delays).toEqual([7, 7]);
  });

  it('un step qui échoue toujours est failed, le runner s’arrête, le step suivant reste pending et error est renseigné', async () => {
    const dir = await makeTmpDir();
    const runner = new JobRunner({
      jobId: 'job-fail',
      outDir: dir,
      retries: 2,
      sleep: noSleep,
    });
    let laterCalls = 0;

    const result = await runner.run([
      {
        id: 'boom',
        cost: 2,
        run: async () => {
          throw new Error('nope');
        },
      },
      {
        id: 'after',
        run: async () => {
          laterCalls += 1;
          return 'never';
        },
      },
    ]);

    expect(result.status).toBe('failed');
    expect(result.steps[0]).toMatchObject({
      id: 'boom',
      status: 'failed',
      attempts: 3,
      cost: 0,
      error: 'nope',
    });
    expect(result.steps[1]).toMatchObject({
      id: 'after',
      status: 'pending',
      attempts: 0,
      cost: 0,
    });
    expect(laterCalls).toBe(0);
  });

  it('relancer le runner avec le même jobId et les mêmes steps skip les steps, ne les ré-exécute pas et ne facture rien', async () => {
    const dir = await makeTmpDir();
    let calls = 0;
    const steps: Step<string>[] = [
      {
        id: 'once',
        cost: 4,
        run: async () => {
          calls += 1;
          return 'v1';
        },
      },
    ];

    const first = await new JobRunner({ jobId: 'job-idem', outDir: dir }).run(steps);
    const second = await new JobRunner({ jobId: 'job-idem', outDir: dir }).run(steps);

    expect(first.steps[0].status).toBe('done');
    expect(second.status).toBe('done');
    expect(second.steps[0]).toMatchObject({
      id: 'once',
      status: 'skipped',
      attempts: 0,
      cost: 0,
      output: 'v1',
    });
    expect(calls).toBe(1);
    expect(second.charged).toBe(0);
    expect(second.refunded).toBe(0);
  });

  it('un step en échec est remboursé: charged vaut 0 et refunded vaut le coût du step', async () => {
    const dir = await makeTmpDir();
    const runner = new JobRunner({
      jobId: 'job-refund',
      outDir: dir,
      retries: 0,
      sleep: noSleep,
    });

    const result = await runner.run([
      {
        id: 'paid',
        cost: 5,
        run: async () => {
          throw new Error('echec');
        },
      },
    ]);

    expect(result.status).toBe('failed');
    expect(result.charged).toBe(0);
    expect(result.refunded).toBe(5);
    expect(result.steps[0].cost).toBe(0);
    expect(result.charged).toBe(
      result.steps.reduce((total, step) => total + step.cost, 0),
    );
  });

  it('writeState et readState transmettent l’état d’un step au suivant', async () => {
    const dir = await makeTmpDir();
    const runner = new JobRunner({ jobId: 'job-state', outDir: dir });

    const result = await runner.run([
      {
        id: 'writer',
        run: async (ctx) => {
          ctx.writeState('topic', 'dinos');
          return 'written';
        },
      },
      {
        id: 'reader',
        run: async (ctx) => {
          const topic = ctx.readState<string>('topic');
          return `read:${topic ?? 'none'}`;
        },
      },
    ]);

    expect(result.steps[1].output).toBe('read:dinos');
    const raw = await readFile(join(dir, 'state.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ topic: 'dinos' });
  });

  it('onEvent reçoit les événements step, charge et refund dans l’ordre', async () => {
    const dir = await makeTmpDir();
    const events: RunnerEvent[] = [];
    const runner = new JobRunner({
      jobId: 'job-events',
      outDir: dir,
      retries: 0,
      sleep: noSleep,
      onEvent: (event) => {
        events.push(event);
      },
    });

    await runner.run([
      { id: 'ok', cost: 2, run: async () => 'ok' },
      {
        id: 'ko',
        cost: 3,
        run: async () => {
          throw new Error('boom');
        },
      },
    ]);

    expect(events).toEqual([
      { type: 'step', stepId: 'ok', status: 'running' },
      { type: 'charge', stepId: 'ok', amount: 2 },
      { type: 'step', stepId: 'ok', status: 'done' },
      { type: 'step', stepId: 'ko', status: 'running' },
      { type: 'charge', stepId: 'ko', amount: 3 },
      { type: 'refund', stepId: 'ko', amount: 3 },
      { type: 'step', stepId: 'ko', status: 'failed' },
    ]);
  });

  it('outDir par défaut vaut out/<jobId> relatif au cwd', async () => {
    const dir = await makeTmpDir();
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const runner = new JobRunner({ jobId: 'auto' });
      const result = await runner.run([{ id: 'x', run: async () => 'ok' }]);

      expect(result.status).toBe('done');
      const raw = await readFile(join(dir, 'out', 'auto', 'step-x.json'), 'utf8');
      expect(JSON.parse(raw).output).toBe('ok');
    } finally {
      process.chdir(previousCwd);
    }
  });
});
