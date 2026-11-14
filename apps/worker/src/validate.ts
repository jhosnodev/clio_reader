import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_REACTIONS,
  type FeedbackArea,
  type FeedbackCategory,
  type FeedbackDocumentFormat,
  type FeedbackPlatform,
  type FeedbackReaction,
} from '@clio-reader/domain';

export interface ParsedSubmission {
  readonly id: string;
  readonly installationId?: string | undefined;
  readonly reaction?: FeedbackReaction | undefined;
  readonly category?: FeedbackCategory | undefined;
  readonly message?: string | undefined;
  readonly appVersion: string;
  readonly platform: FeedbackPlatform;
  readonly osVersion?: string | undefined;
  readonly area?: FeedbackArea | undefined;
  readonly documentFormat?: FeedbackDocumentFormat | undefined;
  readonly eventName?: string | undefined;
  readonly locale?: string | undefined;
  readonly diagnosticsConsent: boolean;
  readonly followUpConsent: boolean;
  readonly createdAtIso: string;
}

export type ParseResult =
  | { readonly ok: true; readonly value: ParsedSubmission }
  | { readonly ok: false; readonly error: string };

export const MAX_PAYLOAD_BYTES = 8 * 1024;

const PLATFORMS: readonly FeedbackPlatform[] = ['windows', 'linux', 'macos', 'android', 'ios'];
const AREAS: readonly FeedbackArea[] = ['reader', 'library', 'annotations', 'settings'];
const FORMATS: readonly FeedbackDocumentFormat[] = ['epub', 'pdf', 'markdown', 'cbz'];

type StringOrError =
  | { readonly kind: 'value'; readonly value: string | undefined }
  | { readonly kind: 'error'; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, field: string): StringOrError {
  if (value === undefined || value === null) return { kind: 'value', value: undefined };
  if (typeof value !== 'string') return { kind: 'error', error: `${field} must be a string` };
  return { kind: 'value', value };
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}

export function parseSubmission(raw: unknown): ParseResult {
  if (!isRecord(raw)) {
    return fail('Body must be a JSON object');
  }

  const id = raw['id'];
  if (typeof id !== 'string' || id.trim().length === 0 || id.length > 64) {
    return fail('id must be a non-empty string (max 64 chars)');
  }

  const installationId = optionalString(raw['installationId'], 'installationId');
  if (installationId.kind === 'error') return fail(installationId.error);

  const reactionRaw = raw['reaction'];
  let reaction: FeedbackReaction | undefined;
  if (reactionRaw !== undefined && reactionRaw !== null) {
    if (
      typeof reactionRaw !== 'string' ||
      !FEEDBACK_REACTIONS.includes(reactionRaw as FeedbackReaction)
    ) {
      return fail('reaction is invalid');
    }
    reaction = reactionRaw as FeedbackReaction;
  }

  const categoryRaw = raw['category'];
  let category: FeedbackCategory | undefined;
  if (categoryRaw !== undefined && categoryRaw !== null) {
    if (
      typeof categoryRaw !== 'string' ||
      !FEEDBACK_CATEGORIES.includes(categoryRaw as FeedbackCategory)
    ) {
      return fail('category is invalid');
    }
    category = categoryRaw as FeedbackCategory;
  }

  const messageResult = optionalString(raw['message'], 'message');
  if (messageResult.kind === 'error') return fail(messageResult.error);
  let message = messageResult.value;
  if (message !== undefined) {
    message = message.trim();
    if (message.length === 0) message = undefined;
    else if (message.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      return fail(`message must not exceed ${FEEDBACK_MESSAGE_MAX_LENGTH} characters`);
    }
  }

  if (reaction === undefined && message === undefined) {
    return fail('reaction or message is required');
  }

  const context = raw['context'];
  if (!isRecord(context)) {
    return fail('context is required');
  }

  const appVersion = context['appVersion'];
  if (typeof appVersion !== 'string' || appVersion.trim().length === 0 || appVersion.length > 64) {
    return fail('context.appVersion must be a non-empty string');
  }

  const platformRaw = context['platform'];
  if (typeof platformRaw !== 'string' || !PLATFORMS.includes(platformRaw as FeedbackPlatform)) {
    return fail('context.platform is invalid');
  }

  const osVersion = optionalString(context['osVersion'], 'context.osVersion');
  if (osVersion.kind === 'error') return fail(osVersion.error);

  const areaRaw = context['area'];
  let area: FeedbackArea | undefined;
  if (areaRaw !== undefined && areaRaw !== null) {
    if (typeof areaRaw !== 'string' || !AREAS.includes(areaRaw as FeedbackArea)) {
      return fail('context.area is invalid');
    }
    area = areaRaw as FeedbackArea;
  }

  const formatRaw = context['documentFormat'];
  let documentFormat: FeedbackDocumentFormat | undefined;
  if (formatRaw !== undefined && formatRaw !== null) {
    if (typeof formatRaw !== 'string' || !FORMATS.includes(formatRaw as FeedbackDocumentFormat)) {
      return fail('context.documentFormat is invalid');
    }
    documentFormat = formatRaw as FeedbackDocumentFormat;
  }

  const eventName = optionalString(context['eventName'], 'context.eventName');
  if (eventName.kind === 'error') return fail(eventName.error);

  const locale = optionalString(context['locale'], 'context.locale');
  if (locale.kind === 'error') return fail(locale.error);

  const createdAt = raw['createdAt'];
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    return fail('createdAt must be an ISO-8601 date string');
  }

  const diagnosticsConsent = raw['diagnosticsConsent'];
  const followUpConsent = raw['followUpConsent'];
  if (diagnosticsConsent !== undefined && typeof diagnosticsConsent !== 'boolean') {
    return fail('diagnosticsConsent must be a boolean');
  }
  if (followUpConsent !== undefined && typeof followUpConsent !== 'boolean') {
    return fail('followUpConsent must be a boolean');
  }

  return {
    ok: true,
    value: {
      id,
      installationId: installationId.value,
      reaction,
      category,
      message,
      appVersion: appVersion.trim(),
      platform: platformRaw as FeedbackPlatform,
      osVersion: osVersion.value,
      area,
      documentFormat,
      eventName: eventName.value,
      locale: locale.value,
      diagnosticsConsent: diagnosticsConsent === true,
      followUpConsent: followUpConsent === true,
      createdAtIso: createdAt,
    },
  };
}
