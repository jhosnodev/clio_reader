import { createFetchHandler, type WorkerEnv } from './handler.js';

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return createFetchHandler(env).fetch(request);
  },
};

export { handleFeedbackRequest, createFetchHandler } from './handler.js';
export { parseSubmission, MAX_PAYLOAD_BYTES } from './validate.js';
export { InMemoryRateLimiter } from './rate-limit.js';
export { InMemoryFeedbackStore, D1FeedbackStore, toStoredRow } from './store.js';
