import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { ClockService } from '../common/services/clock.service';

export type JobRunTrigger = 'cron' | 'manual';
export type JobRunStatus = 'running' | 'success' | 'partial' | 'failed';

export interface JobResult {
  name: string;
  itemsProcessed: number;
  errors: string[];
  counts?: Record<string, any>;
}

export interface JobRun {
  id: string;
  trigger: JobRunTrigger;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: JobRunStatus;
  jobs: JobResult[];
}

@Injectable()
export class JobRunsService {
  private readonly logger = new Logger(JobRunsService.name);
  private runs: JobRun[] = [];
  private isLocked = false;
  private activeRunId: string | null = null;

  constructor(private readonly clockService: ClockService) {}

  /**
   * Acquire lock and initialize a new job run.
   * Throws HTTP 409 Conflict if a tick is already in progress.
   */
  start(trigger: JobRunTrigger): JobRun {
    if (this.isLocked && this.activeRunId) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'JOB_ALREADY_RUNNING',
        message: 'A job tick is already in progress.',
        runId: this.activeRunId,
      });
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = this.clockService.nowIso();

    const newRun: JobRun = {
      id: runId,
      trigger,
      startedAt: nowIso,
      finishedAt: null,
      durationMs: null,
      status: 'running',
      jobs: [],
    };

    this.isLocked = true;
    this.activeRunId = runId;
    this.runs.unshift(newRun);

    // Keep only the latest 200 runs
    if (this.runs.length > 200) {
      this.runs = this.runs.slice(0, 200);
    }

    this.logger.log(`[JobRunsService] Started run ${runId} (trigger: ${trigger})`);
    return newRun;
  }

  /**
   * Record the outcome of an individual job within the run.
   */
  finishJob(runId: string, result: JobResult): void {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) {
      this.logger.warn(`[JobRunsService] Cannot finish job for non-existent run ${runId}`);
      return;
    }

    run.jobs.push({
      name: result.name,
      itemsProcessed: Number(result.itemsProcessed) || 0,
      errors: Array.isArray(result.errors) ? result.errors : [],
      ...(result.counts ? { counts: JSON.parse(JSON.stringify(result.counts)) } : {}),
    });
  }

  /**
   * Complete the run, determine status, compute duration, and release the lock.
   */
  finishRun(runId: string, fatalError?: string): JobRun {
    const run = this.runs.find((r) => r.id === runId);
    const finishedAtIso = this.clockService.nowIso();

    if (!run) {
      this.isLocked = false;
      this.activeRunId = null;
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'RUN_NOT_FOUND',
        message: `Job run with id "${runId}" not found`,
      });
    }

    run.finishedAt = finishedAtIso;
    const startMs = new Date(run.startedAt).getTime();
    const finishMs = new Date(finishedAtIso).getTime();
    run.durationMs = Math.max(0, isNaN(finishMs - startMs) ? 0 : finishMs - startMs);

    if (fatalError) {
      run.status = 'failed';
    } else {
      const hasErrors = run.jobs.some((j) => j.errors && j.errors.length > 0);
      const allFailed = run.jobs.length > 0 && run.jobs.every((j) => j.errors && j.errors.length > 0);

      if (!hasErrors) {
        run.status = 'success';
      } else if (allFailed) {
        run.status = 'failed';
      } else {
        run.status = 'partial';
      }
    }

    // Release in-memory lock
    if (this.activeRunId === runId) {
      this.isLocked = false;
      this.activeRunId = null;
    }

    // Enforce 200 runs cap
    if (this.runs.length > 200) {
      this.runs = this.runs.slice(0, 200);
    }

    this.logger.log(
      `[JobRunsService] Completed run ${runId}: status=${run.status}, duration=${run.durationMs}ms, jobs=${run.jobs.length}`,
    );
    return run;
  }

  /**
   * Return recent runs, newest first.
   */
  list(limit = 20): JobRun[] {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    return this.runs.slice(0, safeLimit);
  }

  /**
   * Find a single run by ID.
   */
  findById(id: string): JobRun | null {
    return this.runs.find((r) => r.id === id) || null;
  }

  /**
   * Inspect current lock state.
   */
  isLockActive(): boolean {
    return this.isLocked;
  }

  /**
   * Retrieve currently active run ID.
   */
  getActiveRunId(): string | null {
    return this.activeRunId;
  }

  /**
   * Clear all runs and reset lock state (used in testing).
   */
  resetToSeed(): void {
    this.reset();
  }

  reset(): void {
    this.runs = [];
    this.isLocked = false;
    this.activeRunId = null;
  }
}
