import type { FeedbackCategory, FeedbackReaction } from '@clio-reader/domain';
import { FEEDBACK_MESSAGE_MAX_LENGTH } from '@clio-reader/domain';

export interface FeedbackPanelFormState {
  readonly sending: boolean;
  readonly reaction: FeedbackReaction | null;
  readonly message: string;
}

export function canSubmitFeedback(state: FeedbackPanelFormState): boolean {
  if (state.sending) return false;
  return state.reaction !== null || state.message.trim().length > 0;
}

export function normalizeMessage(message: string): string | undefined {
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isMessageWithinLimit(message: string): boolean {
  return message.length <= FEEDBACK_MESSAGE_MAX_LENGTH;
}

export interface FeedbackDraft {
  readonly reaction: FeedbackReaction | null;
  readonly category: FeedbackCategory | null;
  readonly message: string;
}

export function buildSubmissionFields(draft: FeedbackDraft): {
  reaction?: FeedbackReaction;
  category?: FeedbackCategory;
  message?: string;
} {
  const message = normalizeMessage(draft.message);
  return {
    ...(draft.reaction !== null ? { reaction: draft.reaction } : {}),
    ...(draft.category !== null ? { category: draft.category } : {}),
    ...(message !== undefined ? { message } : {}),
  };
}
