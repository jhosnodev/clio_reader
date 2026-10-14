import type { ReaderPreferences } from '@clio-reader/domain';

export const CLOSE_SENTINEL = '__clio_back__';
export const RANK_SENTINEL = '__clio_rank__';
export const PREFERENCES_SENTINEL = '__clio_prefs__';

export type HostEvent =
  | { readonly type: 'close' }
  | { readonly type: 'rank'; readonly rank: number }
  | { readonly type: 'preferences'; readonly preferences: ReaderPreferences }
  | { readonly type: 'locator'; readonly value: string | null };

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function parseSentinel(message: string): HostEvent | null {
  if (message === CLOSE_SENTINEL) return { type: 'close' };

  if (message.startsWith(RANK_SENTINEL)) {
    const payload = safeParse(message.slice(RANK_SENTINEL.length));
    if (
      payload &&
      typeof payload === 'object' &&
      typeof (payload as { rank?: unknown }).rank === 'number'
    ) {
      return { type: 'rank', rank: (payload as { rank: number }).rank };
    }
    return null;
  }

  if (message.startsWith(PREFERENCES_SENTINEL)) {
    const payload = safeParse(message.slice(PREFERENCES_SENTINEL.length));
    if (payload && typeof payload === 'object') {
      return { type: 'preferences', preferences: payload as ReaderPreferences };
    }
    return null;
  }

  return null;
}

export function interpretMessage(data: unknown): HostEvent | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  if (record.__clio === 'locator') {
    const value = record.value;
    return { type: 'locator', value: typeof value === 'string' ? value : null };
  }

  if (record.__clio === true && typeof record.message === 'string') {
    return parseSentinel(record.message);
  }

  return null;
}
