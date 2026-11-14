import { InMemoryRateLimiter, type RateLimitOptions } from './rate-limit.js';
import { D1FeedbackStore, toStoredRow, type FeedbackStore } from './store.js';
import { MAX_PAYLOAD_BYTES, parseSubmission, type ParsedSubmission } from './validate.js';

export interface WorkerEnv {
  readonly DB?: D1LikeDb | undefined;
  readonly FEEDBACK_RATE_LIMIT_PER_INSTALLATION?: string | undefined;
  readonly FEEDBACK_RATE_LIMIT_WINDOW_MINUTES?: string | undefined;
}

type D1LikeDb = ConstructorParameters<typeof D1FeedbackStore>[0];

export interface HandlerDeps {
  readonly store: FeedbackStore;
  readonly rateLimiter: {
    check(key: string | undefined, now?: number): { allowed: boolean; retryAfterSeconds?: number };
  };
  readonly now?: () => number;
  readonly corsOrigin?: string;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  maxPerInstallation: 10,
  windowMs: 10 * 60_000,
};

function jsonResponse(status: number, body: unknown, corsOrigin?: string): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  if (corsOrigin) {
    headers['access-control-allow-origin'] = corsOrigin;
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
  }
  if (status === 204 || body === null) {
    delete headers['content-type'];
    return new Response(null, { status, headers });
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function parseRateLimitEnv(env: WorkerEnv): RateLimitOptions {
  const maxRaw = Number(env.FEEDBACK_RATE_LIMIT_PER_INSTALLATION);
  const windowMinRaw = Number(env.FEEDBACK_RATE_LIMIT_WINDOW_MINUTES);
  return {
    maxPerInstallation:
      Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : DEFAULT_RATE_LIMIT.maxPerInstallation,
    windowMs:
      Number.isFinite(windowMinRaw) && windowMinRaw > 0
        ? windowMinRaw * 60_000
        : DEFAULT_RATE_LIMIT.windowMs,
  };
}

export function createHandlerDepsFromEnv(env: WorkerEnv): HandlerDeps | null {
  if (!env.DB) return null;
  const store = new D1FeedbackStore(env.DB);
  const rateLimiter = new InMemoryRateLimiter(parseRateLimitEnv(env));
  return { store, rateLimiter };
}

async function readBodyText(request: Request): Promise<string | null> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > MAX_PAYLOAD_BYTES) return null;
  }
  const text = await request.text();
  if (text.length > MAX_PAYLOAD_BYTES) return null;
  return text;
}

export async function handleFeedbackRequest(
  request: Request,
  deps: HandlerDeps,
): Promise<Response> {
  const corsOrigin = deps.corsOrigin;
  const now = deps.now ?? Date.now;

  if (request.method === 'OPTIONS') {
    return jsonResponse(204, null, corsOrigin);
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' }, corsOrigin);
  }

  const bodyText = await readBodyText(request);
  if (bodyText === null) {
    return jsonResponse(413, { error: 'payload_too_large' }, corsOrigin);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return jsonResponse(400, { error: 'invalid_json' }, corsOrigin);
  }

  const parsed = parseSubmission(raw);
  if (!parsed.ok) {
    return jsonResponse(400, { error: 'validation_failed', detail: parsed.error }, corsOrigin);
  }

  const submission: ParsedSubmission = parsed.value;
  const rateKey = submission.installationId;
  const decision = deps.rateLimiter.check(rateKey, now());
  if (!decision.allowed) {
    const headers: Record<string, string> = {};
    if (decision.retryAfterSeconds !== undefined) {
      headers['retry-after'] = String(decision.retryAfterSeconds);
    }
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        ...headers,
        ...(corsOrigin
          ? {
              'access-control-allow-origin': corsOrigin,
              'access-control-allow-methods': 'POST, OPTIONS',
              'access-control-allow-headers': 'content-type',
            }
          : {}),
      },
    });
  }

  const insertResult = await deps.store.insertIfAbsent(toStoredRow(submission, now()));

  if (insertResult === 'duplicate') {
    return jsonResponse(200, { id: submission.id, status: 'duplicate' }, corsOrigin);
  }

  return jsonResponse(201, { id: submission.id, status: 'received' }, corsOrigin);
}

export function createFetchHandler(
  env: WorkerEnv,
  deps?: Partial<HandlerDeps>,
): {
  fetch(request: Request): Promise<Response>;
} {
  return {
    async fetch(request: Request): Promise<Response> {
      const resolved =
        deps && deps.store && deps.rateLimiter
          ? (deps as HandlerDeps)
          : createHandlerDepsFromEnv(env);
      if (!resolved) {
        return jsonResponse(500, { error: 'storage_not_configured' });
      }
      return handleFeedbackRequest(request, resolved);
    },
  };
}
