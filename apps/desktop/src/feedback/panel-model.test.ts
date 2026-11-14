import { describe, expect, it } from 'vitest';
import type { FeedbackReaction } from '@clio-reader/domain';

import {
  buildSubmissionFields,
  canSubmitFeedback,
  isMessageWithinLimit,
  normalizeMessage,
} from './panel-model';

describe('canSubmitFeedback', () => {
  it('allows a reaction-only submission', () => {
    expect(canSubmitFeedback({ sending: false, reaction: 'positive', message: '' })).toBe(true);
  });

  it('allows a message-only submission', () => {
    expect(canSubmitFeedback({ sending: false, reaction: null, message: '  hola  ' })).toBe(true);
  });

  it('blocks empty submissions', () => {
    expect(canSubmitFeedback({ sending: false, reaction: null, message: '   ' })).toBe(false);
  });

  it('blocks while sending', () => {
    expect(canSubmitFeedback({ sending: true, reaction: 'positive', message: 'x' })).toBe(false);
  });
});

describe('normalizeMessage', () => {
  it('trims and returns undefined for blank text', () => {
    expect(normalizeMessage('  ')).toBeUndefined();
    expect(normalizeMessage(' hi ')).toBe('hi');
  });
});

describe('isMessageWithinLimit', () => {
  it('accepts messages at the limit', () => {
    expect(isMessageWithinLimit('x'.repeat(2000))).toBe(true);
    expect(isMessageWithinLimit('x'.repeat(2001))).toBe(false);
  });
});

describe('buildSubmissionFields', () => {
  it('omits empty optional fields', () => {
    expect(buildSubmissionFields({ reaction: null, category: null, message: '  ' })).toEqual({});
  });

  it('includes only provided fields', () => {
    expect(
      buildSubmissionFields({
        reaction: 'negative' as FeedbackReaction,
        category: 'idea',
        message: ' idea ',
      }),
    ).toEqual({ reaction: 'negative', category: 'idea', message: 'idea' });
  });
});
