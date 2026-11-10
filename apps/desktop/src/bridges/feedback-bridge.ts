import type { Feedback, FeedbackStatus } from '@clio-reader/domain';
import type { AppInfo, FeedbackRepository } from '@clio-reader/feedback';

export function createFeedbackBridge(): FeedbackRepository {
  const api = window.electronAPI;

  return {
    saveFeedback: (feedback: Feedback) => api.repo.saveFeedback(feedback),
    listFeedback: () => api.repo.listFeedback() as Promise<readonly Feedback[]>,
    countFeedbackByStatus: (status: FeedbackStatus) => api.repo.countFeedbackByStatus(status),
    updateFeedbackStatus: (feedbackId, status, githubIssueUrl) =>
      api.repo.updateFeedbackStatus(feedbackId, status, githubIssueUrl),
    removeFeedback: (feedbackId) => api.repo.deleteFeedback(feedbackId),
  };
}

export function fetchAppInfo(): Promise<AppInfo> {
  return window.electronAPI.getAppInfo();
}
