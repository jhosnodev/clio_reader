export type BookFormat = 'epub' | 'pdf' | 'cbz' | 'md';
export type BookId = string;
export type ReadingStatus = 'unread' | 'opened' | 'reading';
export type Rank = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface Book {
  readonly id: BookId;
  readonly title: string;
  readonly author?: string | undefined;
  readonly format: BookFormat;
  readonly uri: string;
  readonly fileHash?: string | undefined;
  readonly addedAt: number;
  readonly lastOpenedAt?: number | undefined;
  readonly readingStatus?: ReadingStatus | undefined;
  readonly language?: string | undefined;
  readonly status: 'available' | 'missing';
  readonly rank?: Rank | undefined;
  readonly coverImage?: string | undefined;
}

/**
 * Ancla de texto:Offsets de caracteres dentro del texto plano del documento
 * (capítulo para EPUB/MD), con contexto para recuperar la posición si el texto
 * se ha desplazado. Complementa a `selectedText`, que guarda la cita literal.
 */
export interface TextAnchor {
  /** Offset inicial inclusivo dentro del texto del documento */
  readonly start: number;
  /** Offset final exclusivo dentro del texto del documento */
  readonly end: number;
  /** Hasta 32 caracteres anteriores al ancla, para desambiguar repeticiones */
  readonly prefix?: string | undefined;
  /** Hasta 32 caracteres posteriores al ancla, para desambiguar repeticiones */
  readonly suffix?: string | undefined;
}

export interface EpubLocator {
  readonly format: 'epub';
  readonly href: string;
  readonly cfi?: string;
  readonly progression?: number;
  readonly positionOrder?: number;
  /** Posición vertical dentro del capítulo actual, 0..1 (0 = inicio del capítulo) */
  readonly scrollRatio?: number;
  /** Texto seleccionado al que está atada la anotación */
  readonly anchor?: TextAnchor | undefined;
}

export interface PdfLocator {
  readonly format: 'pdf';
  readonly page: number;
  readonly progression?: number;
  readonly zoom?: number;
  readonly scrollX?: number;
  readonly scrollY?: number;
}

export interface CbzLocator {
  readonly format: 'cbz';
  readonly page: number;
  readonly progression?: number;
  readonly scale?: number;
  readonly scrollX?: number;
  readonly scrollY?: number;
}

export interface MarkdownLocator {
  readonly format: 'md';
  readonly href?: string;
  readonly offset?: number;
  readonly progression?: number;
  readonly positionOrder?: number;
  /** Posición vertical dentro de la sección actual, 0..1 (0 = inicio de la sección) */
  readonly scrollRatio?: number;
  /** Texto seleccionado al que está atada la anotación */
  readonly anchor?: TextAnchor | undefined;
}

export type ReaderLocator = EpubLocator | PdfLocator | CbzLocator | MarkdownLocator;

export interface ReadingProgress {
  readonly bookId: BookId;
  readonly locator: ReaderLocator;
  readonly percent: number;
  readonly updatedAt: number;
}

export const MIN_READER_MARGIN = 8;
export const MAX_READER_MARGIN = 120;
export const DEFAULT_READER_MARGIN = 48;

const LEGACY_READER_MARGINS: Record<string, number> = {
  compact: 16,
  comfortable: DEFAULT_READER_MARGIN,
  wide: 96,
};

export interface ReaderPreferences {
  readonly theme: 'light' | 'dark' | 'sepia' | 'custom';
  readonly backgroundColor: string;
  readonly foregroundColor: string;
  readonly accentColor: string;
  readonly fontFamily: 'system' | 'serif' | 'sans' | 'dyslexic';
  readonly fontScale: number;
  readonly lineHeight: number;
  /** Margen horizontal de lectura en píxeles */
  readonly margin: number;
  readonly readingDirection: 'ltr' | 'rtl';
}

export interface Bookmark {
  readonly id: string;
  readonly bookId: BookId;
  readonly locator: ReaderLocator;
  readonly label?: string;
  readonly createdAt: number;
  readonly updatedAt?: number;
}

export interface Note {
  readonly id: string;
  readonly bookId: BookId;
  readonly locator: ReaderLocator;
  /** Cita literal del texto seleccionado al que se ancla la nota */
  readonly selectedText?: string;
  readonly body: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface Highlight {
  readonly id: string;
  readonly bookId: BookId;
  readonly locatorStart: ReaderLocator;
  readonly locatorEnd: ReaderLocator;
  readonly selectedText?: string;
  readonly color: string;
  readonly style: 'highlight' | 'underline';
  readonly note?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type PaletteMode = 'dark' | 'light';

export interface UserSettings {
  readonly paletteId: string;
  readonly mode: PaletteMode;
}

// ==================== FEEDBACK ====================

export type FeedbackReaction =
  'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';

export type FeedbackCategory = 'bug' | 'idea' | 'praise' | 'general';

export type FeedbackPlatform = 'windows' | 'linux' | 'macos' | 'android' | 'ios';

export type FeedbackStatus = 'received' | 'queued' | 'reviewed' | 'linked' | 'closed';

export type FeedbackArea = 'reader' | 'library' | 'annotations' | 'settings';

export type FeedbackDocumentFormat = 'epub' | 'pdf' | 'markdown' | 'cbz';

export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export const FEEDBACK_REACTIONS: readonly FeedbackReaction[] = [
  'very_negative',
  'negative',
  'neutral',
  'positive',
  'very_positive',
];

export const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = [
  'bug',
  'idea',
  'praise',
  'general',
];

export interface FeedbackContext {
  readonly appVersion: string;
  readonly platform: FeedbackPlatform;
  readonly osVersion?: string | undefined;
  readonly area?: FeedbackArea | undefined;
  readonly documentFormat?: FeedbackDocumentFormat | undefined;
  readonly eventName?: string | undefined;
  readonly locale?: string | undefined;
}

export interface Feedback {
  readonly id: string;
  readonly installationId?: string | undefined;
  readonly reaction?: FeedbackReaction | undefined;
  readonly category?: FeedbackCategory | undefined;
  readonly message?: string | undefined;
  readonly context: FeedbackContext;
  readonly diagnosticsConsent: boolean;
  readonly followUpConsent: boolean;
  readonly status: FeedbackStatus;
  readonly githubIssueUrl?: string | undefined;
  /** Epoch en milisegundos */
  readonly createdAt: number;
}

export interface CreateFeedbackInput {
  id: string;
  installationId?: string | undefined;
  reaction?: FeedbackReaction | undefined;
  category?: FeedbackCategory | undefined;
  message?: string | undefined;
  context: FeedbackContext;
  diagnosticsConsent?: boolean | undefined;
  followUpConsent?: boolean | undefined;
  status?: FeedbackStatus | undefined;
  githubIssueUrl?: string | undefined;
  createdAt?: number | undefined;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  paletteId: 'clio-3',
  mode: 'dark',
};

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: 'light',
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2937',
  accentColor: '#2563eb',
  fontFamily: 'system',
  fontScale: 1,
  lineHeight: 1.5,
  margin: DEFAULT_READER_MARGIN,
  readingDirection: 'ltr',
};

export function createBook(
  input: Omit<Book, 'addedAt' | 'status'> & {
    addedAt?: number | undefined;
    status?: Book['status'] | undefined;
  },
): Book {
  const book: Book = {
    ...input,
    addedAt: input.addedAt ?? Date.now(),
    status: input.status ?? 'available',
    ...(input.rank !== undefined && { rank: normalizeRank(input.rank) }),
  };

  assertNonEmpty(book.id, 'Book id');
  assertNonEmpty(book.title, 'Book title');
  assertNonEmpty(book.uri, 'Book uri');
  return book;
}

export function createDefaultUserSettings(): UserSettings {
  return { ...DEFAULT_USER_SETTINGS };
}

export function createDefaultPreferences(): ReaderPreferences {
  return { ...DEFAULT_READER_PREFERENCES };
}

export function normalizeReaderMargin(value: unknown): number {
  if (typeof value === 'string') {
    const legacy = LEGACY_READER_MARGINS[value];
    if (legacy !== undefined) return legacy;

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return clampReaderMargin(parsed);
    return DEFAULT_READER_MARGIN;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampReaderMargin(value);
  }

  return DEFAULT_READER_MARGIN;
}

function clampReaderMargin(margin: number): number {
  return Math.min(MAX_READER_MARGIN, Math.max(MIN_READER_MARGIN, Math.round(margin)));
}

export function validateReaderPreferences(preferences: ReaderPreferences): void {
  assertColor(preferences.backgroundColor, 'backgroundColor');
  assertColor(preferences.foregroundColor, 'foregroundColor');
  assertColor(preferences.accentColor, 'accentColor');

  if (preferences.fontScale < 0.8 || preferences.fontScale > 2) {
    throw new DomainValidationError('fontScale must be between 0.8 and 2');
  }

  if (preferences.lineHeight < 1 || preferences.lineHeight > 2.5) {
    throw new DomainValidationError('lineHeight must be between 1 and 2.5');
  }

  if (
    !Number.isFinite(preferences.margin) ||
    preferences.margin < MIN_READER_MARGIN ||
    preferences.margin > MAX_READER_MARGIN
  ) {
    throw new DomainValidationError(
      `margin must be between ${MIN_READER_MARGIN} and ${MAX_READER_MARGIN}`,
    );
  }
}

export function normalizePercent(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new DomainValidationError('percent must be a finite number');
  }

  return Math.min(1, Math.max(0, percent));
}

export function normalizeRank(rank: number): Rank {
  if (!Number.isFinite(rank)) {
    throw new DomainValidationError('rank must be a finite number');
  }

  const clamped = Math.min(5, Math.max(0, rank));
  return (Math.round(clamped * 2) / 2) as Rank;
}

export function createReadingProgress(
  input: Omit<ReadingProgress, 'percent' | 'updatedAt'> & {
    percent: number;
    updatedAt?: number;
  },
): ReadingProgress {
  return {
    ...input,
    percent: normalizePercent(input.percent),
    updatedAt: input.updatedAt ?? Date.now(),
  };
}

export function createHighlight(
  input: Omit<Highlight, 'createdAt' | 'updatedAt'> & {
    createdAt?: number;
    updatedAt?: number;
  },
): Highlight {
  const highlight: Highlight = {
    ...input,
    createdAt: input.createdAt ?? Date.now(),
    updatedAt: input.updatedAt ?? Date.now(),
  };

  assertNonEmpty(highlight.id, 'Highlight id');
  assertNonEmpty(highlight.bookId, 'Highlight bookId');
  assertNonEmpty(highlight.color, 'Highlight color');
  assertColor(highlight.color, 'Highlight color');
  return highlight;
}

export function validateHighlightStyle(style: string): void {
  if (style !== 'highlight' && style !== 'underline') {
    throw new DomainValidationError(
      `Highlight style must be 'highlight' or 'underline', got '${style}'`,
    );
  }
}

export function createFeedback(input: CreateFeedbackInput): Feedback {
  const trimmedMessage = input.message?.trim();

  const feedback: Feedback = {
    id: input.id,
    installationId: input.installationId,
    reaction: input.reaction,
    category: input.category,
    message: trimmedMessage && trimmedMessage.length > 0 ? trimmedMessage : undefined,
    context: input.context,
    diagnosticsConsent: input.diagnosticsConsent ?? false,
    followUpConsent: input.followUpConsent ?? false,
    status: input.status ?? 'received',
    githubIssueUrl: input.githubIssueUrl,
    createdAt: input.createdAt ?? Date.now(),
  };

  assertNonEmpty(feedback.id, 'Feedback id');
  validateFeedbackContext(feedback.context);

  if (feedback.reaction === undefined && feedback.message === undefined) {
    throw new DomainValidationError('Feedback must include a reaction or a message');
  }

  if (feedback.message !== undefined && feedback.message.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
    throw new DomainValidationError(
      `Feedback message must not exceed ${FEEDBACK_MESSAGE_MAX_LENGTH} characters`,
    );
  }

  return feedback;
}

export function validateFeedbackReaction(reaction: string): void {
  if (!FEEDBACK_REACTIONS.includes(reaction as FeedbackReaction)) {
    throw new DomainValidationError(`Invalid feedback reaction '${reaction}'`);
  }
}

export function validateFeedbackCategory(category: string): void {
  if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) {
    throw new DomainValidationError(`Invalid feedback category '${category}'`);
  }
}

export function validateFeedbackContext(context: FeedbackContext): void {
  assertNonEmpty(context.appVersion, 'Feedback context appVersion');
  assertNonEmpty(context.platform, 'Feedback context platform');

  const platforms: readonly FeedbackPlatform[] = ['windows', 'linux', 'macos', 'android', 'ios'];
  if (!platforms.includes(context.platform)) {
    throw new DomainValidationError(`Invalid feedback platform '${context.platform}'`);
  }

  if (context.area !== undefined) {
    const areas: readonly FeedbackArea[] = ['reader', 'library', 'annotations', 'settings'];
    if (!areas.includes(context.area)) {
      throw new DomainValidationError(`Invalid feedback area '${context.area}'`);
    }
  }

  if (context.documentFormat !== undefined) {
    const formats: readonly FeedbackDocumentFormat[] = ['epub', 'pdf', 'markdown', 'cbz'];
    if (!formats.includes(context.documentFormat)) {
      throw new DomainValidationError(
        `Invalid feedback document format '${context.documentFormat}'`,
      );
    }
  }

  if (context.eventName !== undefined && context.eventName.trim().length === 0) {
    throw new DomainValidationError('Feedback context eventName must not be empty');
  }

  if (context.locale !== undefined && context.locale.trim().length === 0) {
    throw new DomainValidationError('Feedback context locale must not be empty');
  }
}

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`${field} must not be empty`);
  }
}

function assertColor(value: string, field: string): void {
  const isHexColor = /^#[0-9a-f]{3,8}$/i.test(value);
  if (!isHexColor) {
    throw new DomainValidationError(`${field} must be a hexadecimal color`);
  }
}
