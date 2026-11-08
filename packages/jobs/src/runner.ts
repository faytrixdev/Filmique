import { appendFileSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type StepContext = {
  jobId: string;
  stepId: string;
  attempt: number;
  log: (msg: string) => void;
  readState: <T>(name: string) => T | undefined;
  writeState: <T>(name: string, value: T) => void;
};

export type Step<T = unknown> = {
  id: string;
  cost?: number;
  run: (ctx: StepContext) => Promise<T>;
};

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export type StepResult = {
  id: string;
  status: StepStatus;
  attempts: number;
  cost: number;
  output?: unknown;
  error?: string;
};

export type JobResult<T = unknown> = {
  jobId: string;
  status: 'done' | 'failed';
  steps: StepResult[];
  charged: number;
  refunded: number;
};

export type RunnerEvent = {
  type: 'step' | 'charge' | 'refund';
  stepId?: string;
  amount?: number;
  status?: StepStatus;
};

export type RunnerOptions = {
  jobId: string;
  outDir?: string;
  retries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (e: RunnerEvent) => void;
};

export const STEP_DONE = 'STEP_DONE';

type StepFile = {
  STEP_DONE: boolean;
  stepId: string;
  attempts: number;
  output?: unknown;
};

const sanitize = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const toMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isStepFile = (value: unknown): value is StepFile => {
  if (typeof value !== 'object' || value === null) return false;
  return (value as Record<string, unknown>)[STEP_DONE] === true;
};

export class JobRunner {
  private readonly jobId: string;
  private readonly outDir: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onEvent: ((e: RunnerEvent) => void) | undefined;

  constructor(opts: RunnerOptions) {
    this.jobId = opts.jobId;
    this.outDir = opts.outDir ?? join('out', sanitize(opts.jobId));
    this.retries = opts.retries ?? 2;
    this.retryDelayMs = opts.retryDelayMs ?? 50;
    this.sleep = opts.sleep ?? defaultSleep;
    this.onEvent = opts.onEvent;
  }

  async run<T = unknown>(steps: Step<T>[]): Promise<JobResult<T>> {
    await mkdir(this.outDir, { recursive: true });
    const state = await this.loadState();
    const results: StepResult[] = [];
    let charged = 0;
    let refunded = 0;
    let status: 'done' | 'failed' = 'done';

    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      const stepPath = this.stepPath(step.id);
      const previous = await this.readStepFile(stepPath);

      if (previous) {
        this.emit({ type: 'step', stepId: step.id, status: 'skipped' });
        results.push({
          id: step.id,
          status: 'skipped',
          attempts: 0,
          cost: 0,
          output: previous.output,
        });
        continue;
      }

      const cost = step.cost ?? 0;
      const maxAttempts = this.retries + 1;
      let attempts = 0;
      let output: unknown;
      let error: string | undefined;
      let succeeded = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts = attempt;
        this.emit({ type: 'step', stepId: step.id, status: 'running' });
        if (attempt === 1) {
          charged += cost;
          if (cost > 0) this.emit({ type: 'charge', stepId: step.id, amount: cost });
        }
        try {
          output = await step.run(this.createContext(step.id, attempt, state));
          succeeded = true;
          break;
        } catch (err) {
          error = toMessage(err);
          if (attempt < maxAttempts) await this.sleep(this.retryDelayMs);
        }
      }

      if (succeeded) {
        await this.writeStepFile(stepPath, {
          STEP_DONE: true,
          stepId: step.id,
          attempts,
          output,
        });
        this.emit({ type: 'step', stepId: step.id, status: 'done' });
        results.push({ id: step.id, status: 'done', attempts, cost, output });
        continue;
      }

      if (cost > 0) {
        charged -= cost;
        refunded += cost;
        this.emit({ type: 'refund', stepId: step.id, amount: cost });
      }
      this.emit({ type: 'step', stepId: step.id, status: 'failed' });
      results.push({ id: step.id, status: 'failed', attempts, cost: 0, error });
      status = 'failed';
      for (let rest = index + 1; rest < steps.length; rest++) {
        results.push({ id: steps[rest].id, status: 'pending', attempts: 0, cost: 0 });
      }
      break;
    }

    return { jobId: this.jobId, status, steps: results, charged, refunded };
  }

  private createContext(
    stepId: string,
    attempt: number,
    state: Record<string, unknown>,
  ): StepContext {
    return {
      jobId: this.jobId,
      stepId,
      attempt,
      log: (msg: string) => {
        this.appendLog(stepId, msg);
      },
      readState: <T>(name: string): T | undefined => state[name] as T | undefined,
      writeState: <T>(name: string, value: T): void => {
        state[name] = value;
        this.saveState(state);
      },
    };
  }

  private emit(event: RunnerEvent): void {
    this.onEvent?.(event);
  }

  private stepPath(stepId: string): string {
    return join(this.outDir, `step-${sanitize(stepId)}.json`);
  }

  private get statePath(): string {
    return join(this.outDir, 'state.json');
  }

  private get logPath(): string {
    return join(this.outDir, 'job.log');
  }

  private async readStepFile(path: string): Promise<StepFile | null> {
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return isStepFile(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async writeStepFile(path: string, file: StepFile): Promise<void> {
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  }

  private async loadState(): Promise<Record<string, unknown>> {
    try {
      const raw = await readFile(this.statePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private saveState(state: Record<string, unknown>): void {
    writeFileSync(this.statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private appendLog(stepId: string, msg: string): void {
    appendFileSync(this.logPath, `${new Date().toISOString()} [${stepId}] ${msg}\n`, 'utf8');
  }
}
