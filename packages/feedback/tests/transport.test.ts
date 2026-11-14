import { describe, expect, it } from 'vitest';
import type { Feedback } from '@clio-reader/domain';

import { HttpFeedbackTransport, toWireSubmission } from '../src/transport.js';

function makeFeedback(): Feedback {
  return {
    id: 'fb-1',
    installationId: 'install-1',
    reaction: 'negative',
    category: 'bug',
    message: 'Falló al abrir',
    context: {
      appVersion: '0.1.0',
      platform: 'linux',
      osVersion: '6.8.0',
      area: 'reader',
      documentFormat: 'epub',
      locale: 'es',
    },
    diagnosticsConsent: false,
    followUpConsent: true,
    status: 'received',
    createdAt: Date.parse('2026-01-15T10:00:00.000Z'),
  };
}

describe('toWireSubmission', () => {
  it('maps domain feedback to the wire contract', () => {
    const wire = toWireSubmission(makeFeedback());
    expect(wire).toEqual({
      id: 'fb-1',
      installationId: 'install-1',
      reaction: 'negative',
      category: 'bug',
      message: 'Falló al abrir',
      context: {
        appVersion: '0.1.0',
        platform: 'linux',
        osVersion: '6.8.0',
        area: 'reader',
        documentFormat: 'epub',
        locale: 'es',
      },
      createdAt: '2026-01-15T10:00:00.000Z',
      diagnosticsConsent: false,
      followUpConsent: true,
    });
  });
});

describe('HttpFeedbackTransport', () => {
  it('returns accepted on 201', async () => {
    const fetchImpl = async () => new Response('{}', { status: 201 });
    const transport = new HttpFeedbackTransport({
      endpoint: 'https://api.example.com/feedback',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await transport.submit(toWireSubmission(makeFeedback()));
    expect(result).toEqual({ kind: 'accepted' });
  });

  it('returns duplicate on 200', async () => {
    const fetchImpl = async () => new Response('{}', { status: 200 });
    const transport = new HttpFeedbackTransport({
      endpoint: 'https://api.example.com/feedback',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await transport.submit(toWireSubmission(makeFeedback()));
    expect(result).toEqual({ kind: 'duplicate' });
  });

  it('returns retryable on 429 and 5xx', async () => {
    const transport429 = new HttpFeedbackTransport({
      endpoint: 'https://api.example.com/feedback',
      fetchImpl: (async () => new Response('{}', { status: 429 })) as typeof fetch,
    });
    const transport500 = new HttpFeedbackTransport({
      endpoint: 'https://api.example.com/feedback',
      fetchImpl: (async () => new Response('{}', { status: 503 })) as typeof fetch,
    });
    const wire = toWireSubmission(makeFeedback());
    expect(await transport429.submit(wire)).toEqual({ kind: 'retryable', status: 429 });
    expect(await transport500.submit(wire)).toEqual({ kind: 'retryable', status: 503 });
  });

  it('returns permanent on other 4xx', async () => {
    const transport = new HttpFeedbackTransport({
      endpoint: 'https://api.example.com/feedback',
      fetchImpl: (async () => new Response('{}', { status: 400 })) as typeof fetch,
    });
    const result = await transport.submit(toWireSubmission(makeFeedback()));
    expect(result).toEqual({ kind: 'permanent', status: 400 });
  });

  it('returns retryable when the network fails', async () => {
    const transport = new HttpFeedbackTransport({
      endpoint: 'https://api.example.com/feedback',
      fetchImpl: (async () => {
        throw new TypeError('network down');
      }) as typeof fetch,
    });
    const result = await transport.submit(toWireSubmission(makeFeedback()));
    expect(result).toEqual({ kind: 'retryable' });
  });
});
