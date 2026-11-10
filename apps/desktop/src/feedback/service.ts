import { FeedbackService } from '@clio-reader/feedback';

import { createFeedbackBridge } from '../bridges/feedback-bridge';

let instance: FeedbackService | null = null;

export function getFeedbackService(): FeedbackService {
  if (!instance) {
    instance = new FeedbackService(createFeedbackBridge(), () => crypto.randomUUID());
  }
  return instance;
}
