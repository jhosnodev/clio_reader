import { describe, expect, it } from 'vitest';

import { handleFeedbackRequest, type HandlerDeps } from '../src/handler.js';
import { InMemoryRateLimiter } from '../src/rate-limit.js';
import { InMemoryFeedbackStore } from '../src/store.js';

function createDeps(options?: { max?: number; windowMs?: number }): HandlerDeps {
  return {
    store: new InMemoryFeedbackStore(),
    rateLimiter: new InMemoryRateLimiter({
      maxPerInstallation: options?.max ?? 10,
      windowMs: options?.windowMs ?? 600_000,
    }),
    now: () => 1_700_000_000_000,
    corsOrigin: 'https://example.com',
  };
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    installationId: 'install-1',
    reaction: 'positive',
    message: 'Great app',
    context: {
      appVersion: '0.1.0',
      platform: 'linux',
      osVersion: '6.8.0',
      area: 'library',
      locale: 'es',
    },
    createdAt: '2026-01-15T10:00:00.000Z',
    diagnosticsConsent: false,
    followUpConsent: false,
    ...overrides,
  };
}

function post(body: unknown): Request {
  return new Request('https://api.example.com/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /feedback', () => {
  it('accepts a valid submission with 201', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(post(validBody()), deps);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string; status: string };
    expect(json.status).toBe('received');
    expect(deps.store).toBeInstanceOf(InMemoryFeedbackStore);
    expect((deps.store as InMemoryFeedbackStore).rows.size).toBe(1);
  });

  it('is idempotent for the same id', async () => {
    const deps = createDeps();
    const first = await handleFeedbackRequest(post(validBody()), deps);
    const second = await handleFeedbackRequest(post(validBody()), deps);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const json = (await second.json()) as { status: string };
    expect(json.status).toBe('duplicate');
    expect((deps.store as InMemoryFeedbackStore).rows.size).toBe(1);
  });

  it('rejects payloads without reaction or message', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(
      post(validBody({ reaction: undefined, message: undefined })),
      deps,
    );
    expect(res.status).toBe(400);
    expect((deps.store as InMemoryFeedbackStore).rows.size).toBe(0);
  });

  it('rejects invalid platform', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(
      post(validBody({ context: { appVersion: '1.0.0', platform: 'freebsd' } })),
      deps,
    );
    expect(res.status).toBe(400);
  });

  it('rejects messages over the length limit', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(post(validBody({ message: 'x'.repeat(2001) })), deps);
    expect(res.status).toBe(400);
  });

  it('rejects oversized payloads with 413', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(post(validBody({ message: 'x'.repeat(9000) })), deps);
    expect(res.status).toBe(413);
  });

  it('rate limits by installation id', async () => {
    const deps = createDeps({ max: 2 });
    for (let i = 0; i < 2; i += 1) {
      const res = await handleFeedbackRequest(
        post(validBody({ id: `id-${i}`, message: `msg ${i}` })),
        deps,
      );
      expect(res.status).toBe(201);
    }
    const blocked = await handleFeedbackRequest(
      post(validBody({ id: 'id-3', message: 'msg 3' })),
      deps,
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('allows CORS preflight', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(
      new Request('https://api.example.com/feedback', { method: 'OPTIONS' }),
      deps,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.com');
  });

  it('rejects non-POST methods', async () => {
    const deps = createDeps();
    const res = await handleFeedbackRequest(
      new Request('https://api.example.com/feedback', { method: 'GET' }),
      deps,
    );
    expect(res.status).toBe(405);
  });
});
