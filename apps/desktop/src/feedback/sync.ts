import { FeedbackSyncService, HttpFeedbackTransport } from '@clio-reader/feedback';

import { createFeedbackBridge } from '../bridges/feedback-bridge';

let syncService: FeedbackSyncService | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

function getEndpoint(): string | undefined {
  const fromEnv = import.meta.env.VITE_FEEDBACK_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return undefined;
}

export function getFeedbackSyncService(): FeedbackSyncService | null {
  const endpoint = getEndpoint();
  if (!endpoint) return null;
  if (!syncService) {
    syncService = new FeedbackSyncService(
      createFeedbackBridge(),
      new HttpFeedbackTransport({ endpoint }),
    );
  }
  return syncService;
}

export async function triggerFeedbackSync(): Promise<void> {
  const service = getFeedbackSyncService();
  if (!service || inFlight) return;

  inFlight = true;
  try {
    const result = await service.syncOnce();
    if (result.remaining > 0) {
      scheduleRetry(result.deferred + result.sent + result.duplicates + result.failedPermanent);
    }
  } catch (err) {
    console.warn('[feedback-sync] sync failed:', err);
    scheduleRetry(1);
  } finally {
    inFlight = false;
  }
}

function scheduleRetry(_progress: number): void {
  if (syncTimer) return;
  const delayMs = 30_000;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void triggerFeedbackSync();
  }, delayMs);
}

export function scheduleInitialSync(): void {
  setTimeout(() => {
    void triggerFeedbackSync();
  }, 2_000);
}
