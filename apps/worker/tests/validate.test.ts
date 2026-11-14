import { describe, expect, it } from 'vitest';

import { parseSubmission } from '../src/validate.js';

const base = {
  id: 'abc',
  installationId: 'inst-1',
  reaction: 'neutral' as const,
  context: { appVersion: '1.2.3', platform: 'windows' as const },
  createdAt: '2026-02-01T00:00:00.000Z',
  diagnosticsConsent: false,
  followUpConsent: false,
};

describe('parseSubmission', () => {
  it('accepts a minimal valid payload', () => {
    const result = parseSubmission(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.reaction).toBe('neutral');
      expect(result.value.platform).toBe('windows');
    }
  });

  it('requires reaction or message', () => {
    const result = parseSubmission({ ...base, reaction: undefined });
    expect(result.ok).toBe(false);
  });

  it('accepts message-only submissions', () => {
    const result = parseSubmission({ ...base, reaction: undefined, message: ' hello ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).toBe('hello');
  });

  it('rejects unknown category', () => {
    const result = parseSubmission({ ...base, category: 'spam' });
    expect(result.ok).toBe(false);
  });

  it('rejects missing context', () => {
    const { context: _context, ...rest } = base;
    const result = parseSubmission(rest);
    expect(result.ok).toBe(false);
  });

  it('rejects non-ISO createdAt', () => {
    const result = parseSubmission({ ...base, createdAt: 'yesterday' });
    expect(result.ok).toBe(false);
  });

  it('rejects empty id', () => {
    const result = parseSubmission({ ...base, id: '' });
    expect(result.ok).toBe(false);
  });
});
