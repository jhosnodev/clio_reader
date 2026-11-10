import type { Feedback, FeedbackStatus } from '@clio-reader/domain';

export interface FeedbackRepository {
  saveFeedback(feedback: Feedback): Promise<void>;
  listFeedback(): Promise<readonly Feedback[]>;
  countFeedbackByStatus(status: FeedbackStatus): Promise<number>;
  updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackStatus,
    githubIssueUrl?: string,
  ): Promise<void>;
  removeFeedback(feedbackId: string): Promise<void>;
}
