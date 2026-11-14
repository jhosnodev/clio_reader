import { describe, expect, it, vi } from 'vitest';

import { createFeedbackBridge, fetchAppInfo } from './feedback-bridge';

type ApiMock = ReturnType<typeof installMockApi>;

function installMockApi() {
  const api = {
    getAppInfo: vi.fn(async () => ({ version: '0.1.0', platform: 'linux', osVersion: '6.8.0' })),
    repo: {
      saveFeedback: vi.fn(async () => undefined),
      listFeedback: vi.fn(async () => [] as readonly unknown[]),
      countFeedbackByStatus: vi.fn(async () => 0),
      updateFeedbackStatus: vi.fn(async () => undefined),
      deleteFeedback: vi.fn(async () => undefined),
    },
  };
  (globalThis as { electronAPI?: unknown }).electronAPI = api;
  (globalThis as { window?: { electronAPI?: unknown } }).window = {
    electronAPI: api,
  } as { electronAPI: unknown };
  return api;
}

describe('createFeedbackBridge', () => {
  it('delegates saveFeedback to the electron API', async () => {
    const api: ApiMock = installMockApi();
    const bridge = createFeedbackBridge();
    const feedback = { id: 'fb-1' };

    await bridge.saveFeedback(feedback as never);

    expect(api.repo.saveFeedback).toHaveBeenCalledWith(feedback);
  });

  it('delegates countFeedbackByStatus', async () => {
    const api: ApiMock = installMockApi();
    api.repo.countFeedbackByStatus.mockResolvedValue(3);
    const bridge = createFeedbackBridge();

    await expect(bridge.countFeedbackByStatus('received')).resolves.toBe(3);
    expect(api.repo.countFeedbackByStatus).toHaveBeenCalledWith('received');
  });

  it('delegates updateFeedbackStatus and removeFeedback', async () => {
    const api: ApiMock = installMockApi();
    const bridge = createFeedbackBridge();

    await bridge.updateFeedbackStatus('fb-1', 'sent');
    await bridge.removeFeedback('fb-1');

    expect(api.repo.updateFeedbackStatus).toHaveBeenCalledWith('fb-1', 'sent', undefined);
    expect(api.repo.deleteFeedback).toHaveBeenCalledWith('fb-1');
  });

  it('fetches app info from the main process', async () => {
    installMockApi();
    await expect(fetchAppInfo()).resolves.toEqual({
      version: '0.1.0',
      platform: 'linux',
      osVersion: '6.8.0',
    });
  });
});
