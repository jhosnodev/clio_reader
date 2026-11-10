import {
  createFeedback,
  type CreateFeedbackInput,
  type Feedback,
  type FeedbackCategory,
  type FeedbackReaction,
  type FeedbackStatus,
} from '@clio-reader/domain';

import {
  collectFeedbackContext,
  type AppInfo,
  type CollectContextOptions,
} from './context-collector.js';
import type { FeedbackRepository } from './feedback-repository.js';

export interface SubmitFeedbackInput {
  readonly appInfo: AppInfo;
  readonly installationId?: string | undefined;
  readonly reaction?: FeedbackReaction | undefined;
  readonly category?: FeedbackCategory | undefined;
  readonly message?: string | undefined;
  readonly area?: CollectContextOptions['area'];
  readonly documentFormat?: CollectContextOptions['documentFormat'];
  readonly eventName?: CollectContextOptions['eventName'];
  readonly locale?: CollectContextOptions['locale'];
  readonly diagnosticsConsent?: boolean | undefined;
  readonly followUpConsent?: boolean | undefined;
  readonly id?: string | undefined;
  readonly createdAt?: number | undefined;
}

export type FeedbackIdGenerator = () => string;

export class FeedbackService {
  constructor(
    private readonly repository: FeedbackRepository,
    private readonly generateId: FeedbackIdGenerator,
    private readonly now: () => number = Date.now,
  ) {}

  async submitFeedback(input: SubmitFeedbackInput): Promise<Feedback> {
    const context = collectFeedbackContext(input.appInfo, {
      area: input.area,
      documentFormat: input.documentFormat,
      eventName: input.eventName,
      locale: input.locale,
    });

    const createInput: CreateFeedbackInput = {
      id: input.id ?? this.generateId(),
      installationId: input.installationId,
      reaction: input.reaction,
      category: input.category,
      message: input.message,
      context,
      diagnosticsConsent: input.diagnosticsConsent,
      followUpConsent: input.followUpConsent,
      status: 'received',
      createdAt: input.createdAt ?? this.now(),
    };

    const feedback = createFeedback(createInput);
    await this.repository.saveFeedback(feedback);
    return feedback;
  }

  async listFeedback(): Promise<readonly Feedback[]> {
    return this.repository.listFeedback();
  }

  async getPendingCount(): Promise<number> {
    return this.repository.countFeedbackByStatus('received');
  }

  async updateStatus(
    feedbackId: string,
    status: FeedbackStatus,
    githubIssueUrl?: string,
  ): Promise<void> {
    await this.repository.updateFeedbackStatus(feedbackId, status, githubIssueUrl);
  }

  async removeFeedback(feedbackId: string): Promise<void> {
    await this.repository.removeFeedback(feedbackId);
  }
}
