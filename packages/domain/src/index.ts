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

export interface EpubLocator {
  readonly format: 'epub';
  readonly href: string;
  readonly cfi?: string;
  readonly progression?: number;
  readonly positionOrder?: number;
  /** Posición vertical dentro del capítulo actual, 0..1 (0 = inicio del capítulo) */
  readonly scrollRatio?: number;
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
}

export type ReaderLocator = EpubLocator | PdfLocator | CbzLocator | MarkdownLocator;

export interface ReadingProgress {
  readonly bookId: BookId;
  readonly locator: ReaderLocator;
  readonly percent: number;
  readonly updatedAt: number;
}

export interface ReaderPreferences {
  readonly theme: 'light' | 'dark' | 'sepia' | 'custom';
  readonly backgroundColor: string;
  readonly foregroundColor: string;
  readonly accentColor: string;
  readonly fontFamily: 'system' | 'serif' | 'sans' | 'dyslexic';
  readonly fontScale: number;
  readonly lineHeight: number;
  readonly margin: 'compact' | 'comfortable' | 'wide';
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
  margin: 'comfortable',
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
