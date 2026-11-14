export interface RateLimitOptions {
  readonly maxPerInstallation: number;
  readonly windowMs: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

interface Bucket {
  readonly timestamps: number[];
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimitOptions) {}

  check(key: string | undefined, now = Date.now()): RateLimitDecision {
    if (!key) {
      return { allowed: true };
    }

    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    const cutoff = now - this.options.windowMs;
    const recent = bucket.timestamps.filter((ts) => ts > cutoff);

    if (recent.length >= this.options.maxPerInstallation) {
      const oldest = recent[0] ?? now;
      const retryAfterMs = oldest + this.options.windowMs - now;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    recent.push(now);
    this.buckets.set(key, { timestamps: recent });
    return { allowed: true };
  }
}
