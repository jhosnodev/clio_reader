import { describe, expect, it } from 'vitest';

import {
  createBook,
  createDefaultPreferences,
  createFeedback,
  createReadingProgress,
  DomainValidationError,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  normalizePercent,
  normalizeReaderMargin,
  validateFeedbackContext,
  validateFeedbackReaction,
  validateReaderPreferences,
} from '../src/index.js';

describe('createBook', () => {
  it('creates a book with defaults', () => {
    const book = createBook({
      id: 'book-1',
      title: 'Example',
      format: 'epub',
      uri: 'file:///example.epub',
      addedAt: 1,
    });

    expect(book.status).toBe('available');
    expect(book.addedAt).toBe(1);
  });

  it('rejects an empty identity field', () => {
    expect(() =>
      createBook({
        id: '',
        title: 'Example',
        format: 'pdf',
        uri: 'file:///example.pdf',
      }),
    ).toThrow(DomainValidationError);
  });
});

describe('reader preferences', () => {
  it('creates valid defaults', () => {
    const preferences = createDefaultPreferences();

    expect(() => validateReaderPreferences(preferences)).not.toThrow();
  });

  it('rejects an invalid font scale', () => {
    expect(() =>
      validateReaderPreferences({
        ...createDefaultPreferences(),
        fontScale: 3,
      }),
    ).toThrow('fontScale must be between 0.8 and 2');
  });

  it('rejects an out-of-range margin', () => {
    expect(() =>
      validateReaderPreferences({
        ...createDefaultPreferences(),
        margin: 200,
      }),
    ).toThrow('margin must be between 8 and 120');
  });

  it('normalizes legacy and numeric margins', () => {
    expect(normalizeReaderMargin('compact')).toBe(16);
    expect(normalizeReaderMargin('comfortable')).toBe(48);
    expect(normalizeReaderMargin('wide')).toBe(96);
    expect(normalizeReaderMargin('64')).toBe(64);
    expect(normalizeReaderMargin(0)).toBe(8);
    expect(normalizeReaderMargin(999)).toBe(120);
    expect(normalizeReaderMargin('unknown')).toBe(48);
  });
});

describe('reading progress', () => {
  it('clamps progress to the supported range', () => {
    expect(normalizePercent(2)).toBe(1);
    expect(normalizePercent(-1)).toBe(0);
  });

  it('creates format-specific progress', () => {
    const progress = createReadingProgress({
      bookId: 'book-1',
      locator: { format: 'pdf', page: 4 },
      percent: 0.4,
      updatedAt: 1,
    });

    expect(progress).toEqual({
      bookId: 'book-1',
      locator: { format: 'pdf', page: 4 },
      percent: 0.4,
      updatedAt: 1,
    });
  });
});

describe('feedback', () => {
  const baseContext = { appVersion: '0.1.0', platform: 'linux' as const };

  it('creates feedback with a reaction only', () => {
    const feedback = createFeedback({
      id: 'fb-1',
      reaction: 'positive',
      context: baseContext,
      createdAt: 1,
    });

    expect(feedback.status).toBe('received');
    expect(feedback.diagnosticsConsent).toBe(false);
    expect(feedback.followUpConsent).toBe(false);
    expect(feedback.createdAt).toBe(1);
    expect(feedback.message).toBeUndefined();
  });

  it('trims the message and accepts message-only feedback', () => {
    const feedback = createFeedback({
      id: 'fb-2',
      message: '  Me encanta el modo noche  ',
      context: { ...baseContext, area: 'reader' },
    });

    expect(feedback.message).toBe('Me encanta el modo noche');
    expect(feedback.reaction).toBeUndefined();
  });

  it('rejects feedback without reaction or message', () => {
    expect(() => createFeedback({ id: 'fb-3', context: baseContext })).toThrow(
      'Feedback must include a reaction or a message',
    );
  });

  it('rejects an empty id', () => {
    expect(() => createFeedback({ id: '   ', reaction: 'neutral', context: baseContext })).toThrow(
      DomainValidationError,
    );
  });

  it('rejects a message over the maximum length', () => {
    const message = 'x'.repeat(FEEDBACK_MESSAGE_MAX_LENGTH + 1);
    expect(() => createFeedback({ id: 'fb-4', message, context: baseContext })).toThrow(
      `Feedback message must not exceed ${FEEDBACK_MESSAGE_MAX_LENGTH} characters`,
    );
  });

  it('accepts a message at the maximum length', () => {
    const message = 'x'.repeat(FEEDBACK_MESSAGE_MAX_LENGTH);
    expect(() => createFeedback({ id: 'fb-5', message, context: baseContext })).not.toThrow();
  });

  it('rejects an unknown reaction', () => {
    expect(() => validateFeedbackReaction('angry')).toThrow('Invalid feedback reaction');
  });

  it('rejects an unknown platform and area', () => {
    expect(() =>
      validateFeedbackContext({ appVersion: '1.0.0', platform: 'beos' as never }),
    ).toThrow('Invalid feedback platform');
    expect(() =>
      validateFeedbackContext({ appVersion: '1.0.0', platform: 'linux', area: 'sync' as never }),
    ).toThrow('Invalid feedback area');
  });

  it('rejects an empty app version', () => {
    expect(() => validateFeedbackContext({ appVersion: ' ', platform: 'windows' })).toThrow(
      'Feedback context appVersion must not be empty',
    );
  });
});
