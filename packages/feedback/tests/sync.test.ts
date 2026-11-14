import { describe, expect, it } from 'vitest';
import type { Feedback, FeedbackStatus } from '@clio-reader/domain';

import { FeedbackSyncService, computeBackoffMs } from '../src/sync.js';
import type { FeedbackRepository } from '../src/feedback-repository.js';
import type {
  FeedbackTransport,
  FeedbackWireSubmission,
  TransportResult,
} from '../src/transport.js';

class InMemoryFeedbackRepository implements FeedbackRepository {
  readonly items: Feedback[] = [];

  async saveFeedback(feedback: Feedback): Promise<void> {
    const index = this.items.findIndex((item) => item.id === feedback.id);
    if (index >= 0) {
      this.items[index] = feedback;
      return;
    }
    this.items.push(feedback);
  }

  async listFeedback(): Promise<readonly Feedback[]> {
    return this.items;
  }

  async countFeedbackByStatus(status: FeedbackStatus): Promise<number> {
    return this.items.filter((item) => item.status === status).length;
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    githubIssueUrl?: string,
  ): Promise<void> {
    const index = this.items.findIndex((item) => item.id === feedbackId);
    if (index < 0) return;
    this.items[index] = { ...this.items[index]!, status, githubIssueUrl };
  }

  async removeFeedback(feedbackId: string): Promise<void> {
    const index = this.items.findIndex((item) => item.id === feedbackId);
    if (index >= 0) this.items.splice(index, 1);
  }
}

function makeFeedback(id: string): Feedback {
  return {
    id,
    installationId: 'install-1',
    reaction: 'positive',
    context: { appVersion: '0.1.0', platform: 'linux' },
    diagnosticsConsent: false,
    followUpConsent: false,
    status: 'received',
    createdAt: 1_700_000_000_000,
  };
}

class ScriptedTransport implements FeedbackTransport {
  readonly sent: FeedbackWireSubmission[] = [];
  private readonly queue: TransportResult[] = [];

  push(...results: TransportResult[]): void {
    this.queue.push(...results);
  }

  async submit(submission: FeedbackWireSubmission): Promise<TransportResult> {
    this.sent.push(submission);
    return this.queue.shift() ?? { kind: 'retryable' };
  }
}

describe('computeBackoffMs', () => {
  it('grows exponentially and respects the cap', () => {
    const noJitter = () => 0;
    expect(computeBackoffMs(1, 1000, 60_000, noJitter)).toBe(900);
    expect(computeBackoffMs(2, 1000, 60_000, noJitter)).toBe(1800);
    expect(computeBackoffMs(3, 1000, 60_000, noJitter)).toBe(3600);
    expect(computeBackoffMs(20, 1000, 60_000, noJitter)).toBe(54_000);
  });

  it('applies jitter within a bounded range', () => {
    const value = computeBackoffMs(3, 1000, 60_000, () => 1);
    expect(value).toBeGreaterThanOrEqual(3600);
    expect(value).toBeLessThanOrEqual(4400);
  });
});

describe('FeedbackSyncService', () => {
  it('marks accepted submissions as sent', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback(makeFeedback('a'));
    const transport = new ScriptedTransport();
    transport.push({ kind: 'accepted' });

    const service = new FeedbackSyncService(repository, transport);
    const result = await service.syncOnce();

    expect(result.sent).toBe(1);
    expect(result.remaining).toBe(0);
    expect(repository.items[0]!.status).toBe('sent');
  });

  it('treats duplicate responses as delivered', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback(makeFeedback('a'));
    const transport = new ScriptedTransport();
    transport.push({ kind: 'duplicate' });

    const service = new FeedbackSyncService(repository, transport);
    const result = await service.syncOnce();

    expect(result.duplicates).toBe(1);
    expect(repository.items[0]!.status).toBe('sent');
  });

  it('keeps retryable failures pending', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback(makeFeedback('a'));
    const transport = new ScriptedTransport();
    transport.push({ kind: 'retryable' });

    const service = new FeedbackSyncService(repository, transport);
    const result = await service.syncOnce();

    expect(result.deferred).toBe(1);
    expect(result.remaining).toBe(1);
    expect(repository.items[0]!.status).toBe('received');
  });

  it('closes permanently rejected submissions', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback(makeFeedback('a'));
    const transport = new ScriptedTransport();
    transport.push({ kind: 'permanent', status: 400 });

    const service = new FeedbackSyncService(repository, transport);
    const result = await service.syncOnce();

    expect(result.failedPermanent).toBe(1);
    expect(repository.items[0]!.status).toBe('closed');
    expect(result.remaining).toBe(0);
  });

  it('closes after max attempts are exhausted', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback(makeFeedback('a'));
    const transport = new ScriptedTransport();

    const service = new FeedbackSyncService(repository, transport, { maxAttempts: 2 });
    await service.syncOnce();
    expect(repository.items[0]!.status).toBe('received');

    transport.push({ kind: 'retryable' });
    const second = await service.syncOnce();
    expect(second.failedPermanent).toBe(1);
    expect(repository.items[0]!.status).toBe('closed');
  });

  it('does not resend items that are already sent', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback({ ...makeFeedback('a'), status: 'sent' });
    const transport = new ScriptedTransport();

    const service = new FeedbackSyncService(repository, transport);
    const result = await service.syncOnce();

    expect(transport.sent).toHaveLength(0);
    expect(result.sent).toBe(0);
  });

  it('serializes concurrent sync runs', async () => {
    const repository = new InMemoryFeedbackRepository();
    await repository.saveFeedback(makeFeedback('a'));
    const transport = new ScriptedTransport();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    class BlockingTransport implements FeedbackTransport {
      async submit(submission: FeedbackWireSubmission): Promise<TransportResult> {
        await gate;
        transport.sent.push(submission);
        return { kind: 'accepted' };
      }
    }

    const service = new FeedbackSyncService(repository, new BlockingTransport());
    const first = service.syncOnce();
    const second = await service.syncOnce();
    expect(second.sent).toBe(0);
    release();
    const firstResult = await first;
    expect(firstResult.sent).toBe(1);
  });
});
