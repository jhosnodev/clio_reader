import type { ParsedSubmission } from './validate.js';

export interface StoredFeedbackRow {
  readonly id: string;
  readonly installationId: string | null;
  readonly reaction: string | null;
  readonly category: string | null;
  readonly message: string | null;
  readonly appVersion: string;
  readonly platform: string;
  readonly osVersion: string | null;
  readonly area: string | null;
  readonly documentFormat: string | null;
  readonly eventName: string | null;
  readonly locale: string | null;
  readonly diagnosticsConsent: boolean;
  readonly followUpConsent: boolean;
  readonly status: string;
  readonly createdAtIso: string;
  readonly receivedAtMs: number;
}

export type InsertResult = 'created' | 'duplicate';

export interface FeedbackStore {
  insertIfAbsent(row: StoredFeedbackRow): Promise<InsertResult>;
  countSinceInstallation(installationId: string, sinceMs: number): Promise<number>;
}

export function toStoredRow(submission: ParsedSubmission, receivedAtMs: number): StoredFeedbackRow {
  return {
    id: submission.id,
    installationId: submission.installationId ?? null,
    reaction: submission.reaction ?? null,
    category: submission.category ?? null,
    message: submission.message ?? null,
    appVersion: submission.appVersion,
    platform: submission.platform,
    osVersion: submission.osVersion ?? null,
    area: submission.area ?? null,
    documentFormat: submission.documentFormat ?? null,
    eventName: submission.eventName ?? null,
    locale: submission.locale ?? null,
    diagnosticsConsent: submission.diagnosticsConsent,
    followUpConsent: submission.followUpConsent,
    status: 'received',
    createdAtIso: submission.createdAtIso,
    receivedAtMs,
  };
}

interface D1Result {
  readonly success: boolean;
  readonly meta?: { readonly changes?: number };
}

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<D1Result>;
      first<T>(): Promise<T | null>;
    };
  };
}

export class D1FeedbackStore implements FeedbackStore {
  constructor(private readonly db: D1Like) {}

  async insertIfAbsent(row: StoredFeedbackRow): Promise<InsertResult> {
    const existing = await this.db
      .prepare('SELECT id FROM feedback WHERE id = ?')
      .bind(row.id)
      .first<{ id: string }>();
    if (existing) return 'duplicate';

    await this.db
      .prepare(
        `INSERT INTO feedback (
          id, installation_id, reaction, category, message,
          app_version, platform, os_version, area, document_format,
          event_name, locale, diagnostics_consent, follow_up_consent,
          status, created_at, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.installationId,
        row.reaction,
        row.category,
        row.message,
        row.appVersion,
        row.platform,
        row.osVersion,
        row.area,
        row.documentFormat,
        row.eventName,
        row.locale,
        row.diagnosticsConsent ? 1 : 0,
        row.followUpConsent ? 1 : 0,
        row.status,
        Math.floor(Date.parse(row.createdAtIso) / 1000),
        Math.floor(row.receivedAtMs / 1000),
      )
      .run();

    return 'created';
  }

  async countSinceInstallation(installationId: string, sinceMs: number): Promise<number> {
    const sinceSec = Math.floor(sinceMs / 1000);
    const result = await this.db
      .prepare(
        'SELECT COUNT(*) AS total FROM feedback WHERE installation_id = ? AND received_at >= ?',
      )
      .bind(installationId, sinceSec)
      .first<{ total: number }>();
    return result?.total ?? 0;
  }
}

export class InMemoryFeedbackStore implements FeedbackStore {
  readonly rows = new Map<string, StoredFeedbackRow>();

  async insertIfAbsent(row: StoredFeedbackRow): Promise<InsertResult> {
    if (this.rows.has(row.id)) return 'duplicate';
    this.rows.set(row.id, row);
    return 'created';
  }

  async countSinceInstallation(installationId: string, sinceMs: number): Promise<number> {
    let total = 0;
    for (const row of this.rows.values()) {
      if (row.installationId === installationId && row.receivedAtMs >= sinceMs) total += 1;
    }
    return total;
  }
}
