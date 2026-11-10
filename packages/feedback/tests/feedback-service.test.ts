import { describe, expect, it } from 'vitest';
import { DomainValidationError, type Feedback, type FeedbackStatus } from '@clio-reader/domain';

import { FeedbackService } from '../src/feedback-service.js';
import type { FeedbackRepository } from '../src/feedback-repository.js';
import type { AppInfo } from '../src/context-collector.js';

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

const appInfo: AppInfo = { version: '0.1.0', platform: 'win32', osVersion: '10.0.22631' };

function createService(repository = new InMemoryFeedbackRepository()) {
  let counter = 0;
  const service = new FeedbackService(
    repository,
    () => `fb-${++counter}`,
    () => 1_700_000_000_000,
  );
  return { service, repository };
}

describe('FeedbackService', () => {
  it('submits feedback with collected context', async () => {
    const { service, repository } = createService();

    const feedback = await service.submitFeedback({
      appInfo,
      installationId: 'install-1',
      reaction: 'very_positive',
      category: 'praise',
      area: 'library',
      locale: 'es',
    });

    expect(feedback.id).toBe('fb-1');
    expect(feedback.status).toBe('received');
    expect(feedback.createdAt).toBe(1_700_000_000_000);
    expect(feedback.context).toEqual({
      appVersion: '0.1.0',
      platform: 'windows',
      osVersion: '10.0.22631',
      area: 'library',
      documentFormat: undefined,
      eventName: undefined,
      locale: 'es',
    });
    expect(repository.items).toHaveLength(1);
  });

  it('rejects submissions without reaction or message before persisting', async () => {
    const { service, repository } = createService();

    await expect(service.submitFeedback({ appInfo })).rejects.toThrow(
      'Feedback must include a reaction or a message',
    );
    expect(repository.items).toHaveLength(0);
  });

  it('rejects unsupported platforms before persisting', async () => {
    const { service, repository } = createService();

    await expect(
      service.submitFeedback({
        appInfo: { version: '0.1.0', platform: 'sunos' },
        reaction: 'neutral',
      }),
    ).rejects.toThrow(DomainValidationError);
    expect(repository.items).toHaveLength(0);
  });

  it('counts pending submissions', async () => {
    const { service } = createService();

    await service.submitFeedback({ appInfo, reaction: 'positive' });
    await service.submitFeedback({ appInfo, message: 'Comentario' });

    expect(await service.getPendingCount()).toBe(2);

    const items = await service.listFeedback();
    await service.updateStatus(items[0]!.id, 'reviewed');

    expect(await service.getPendingCount()).toBe(1);
  });

  it('removes submissions', async () => {
    const { service, repository } = createService();

    await service.submitFeedback({ appInfo, reaction: 'negative' });
    await service.removeFeedback('fb-1');

    expect(repository.items).toHaveLength(0);
    expect(await service.getPendingCount()).toBe(0);
  });
});
