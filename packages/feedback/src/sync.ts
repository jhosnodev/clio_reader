import type { Feedback } from '@clio-reader/domain';

import type { FeedbackRepository } from './feedback-repository.js';
import type { FeedbackTransport, TransportResult } from './transport.js';
import { toWireSubmission } from './transport.js';

export interface SyncOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface SyncRunResult {
  readonly sent: number;
  readonly duplicates: number;
  readonly failedPermanent: number;
  readonly deferred: number;
  readonly remaining: number;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_DELAY_MS = 2_000;
const DEFAULT_MAX_DELAY_MS = 15 * 60_000;

export function computeBackoffMs(
  attempt: number,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * 0.2 * random();
  return Math.round(exponential - exponential * 0.1 + jitter);
}

export class FeedbackSyncService {
  private readonly attempts = new Map<string, number>();
  private running = false;

  constructor(
    private readonly repository: FeedbackRepository,
    private readonly transport: FeedbackTransport,
    private readonly options: SyncOptions = {},
  ) {}

  async syncOnce(): Promise<SyncRunResult> {
    if (this.running) {
      const remaining = await this.repository.countFeedbackByStatus('received');
      return { sent: 0, duplicates: 0, failedPermanent: 0, deferred: 0, remaining };
    }

    this.running = true;
    let sent = 0;
    let duplicates = 0;
    let failedPermanent = 0;
    let deferred = 0;

    try {
      const pending = (await this.repository.listFeedback()).filter(
        (item) => item.status === 'received',
      );

      for (const item of pending) {
        const outcome = await this.sendOne(item);
        if (outcome === 'sent') sent += 1;
        else if (outcome === 'duplicate') duplicates += 1;
        else if (outcome === 'permanent') failedPermanent += 1;
        else deferred += 1;
      }
    } finally {
      this.running = false;
    }

    const remaining = await this.repository.countFeedbackByStatus('received');
    return { sent, duplicates, failedPermanent, deferred, remaining };
  }

  private async sendOne(item: Feedback): Promise<'sent' | 'duplicate' | 'permanent' | 'deferred'> {
    const attempt = (this.attempts.get(item.id) ?? 0) + 1;
    const maxAttempts = this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    let result: TransportResult;
    try {
      result = await this.transport.submit(toWireSubmission(item));
    } catch {
      result = { kind: 'retryable' };
    }

    if (result.kind === 'accepted') {
      this.attempts.delete(item.id);
      await this.repository.updateFeedbackStatus(item.id, 'sent');
      return 'sent';
    }

    if (result.kind === 'duplicate') {
      this.attempts.delete(item.id);
      await this.repository.updateFeedbackStatus(item.id, 'sent');
      return 'duplicate';
    }

    if (result.kind === 'permanent') {
      this.attempts.delete(item.id);
      await this.repository.updateFeedbackStatus(item.id, 'closed');
      return 'permanent';
    }

    if (attempt >= maxAttempts) {
      this.attempts.delete(item.id);
      await this.repository.updateFeedbackStatus(item.id, 'closed');
      return 'permanent';
    }

    this.attempts.set(item.id, attempt);
    return 'deferred';
  }
}
