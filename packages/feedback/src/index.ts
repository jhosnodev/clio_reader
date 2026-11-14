export type { FeedbackRepository } from './feedback-repository.js';
export type { AppInfo, CollectContextOptions } from './context-collector.js';
export { mapPlatform, collectFeedbackContext } from './context-collector.js';
export type { SubmitFeedbackInput, FeedbackIdGenerator } from './feedback-service.js';
export { FeedbackService } from './feedback-service.js';
export type {
  FeedbackWireSubmission,
  FeedbackTransport,
  TransportResult,
  HttpTransportOptions,
} from './transport.js';
export { HttpFeedbackTransport, toWireSubmission } from './transport.js';
export type { SyncOptions, SyncRunResult } from './sync.js';
export { FeedbackSyncService, computeBackoffMs } from './sync.js';
