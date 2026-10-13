import { isHighlightColor } from './highlight-colors.js';
import { AnnotationValidationError } from './errors.js';

interface ValidationError {
  readonly field: string;
  readonly message: string;
}

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

function assertNonEmptyString(value: unknown, field: string): ValidationError | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { field, message: `${field} must be a non-empty string` };
  }
  return null;
}

function assertString(value: unknown, field: string): ValidationError | null {
  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }
  return null;
}

function assertNumber(value: unknown, field: string): ValidationError | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { field, message: `${field} must be a finite number` };
  }
  return null;
}

function assertObject(value: unknown, field: string): ValidationError | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { field, message: `${field} must be an object` };
  }
  return null;
}

const VALID_LOCATOR_FORMATS = ['epub', 'pdf', 'cbz', 'md'] as const;

function validateAnchor(anchor: unknown, field: string): ValidationError[] {
  const errors: ValidationError[] = [];

  const anchorError = assertObject(anchor, field);
  if (anchorError) {
    errors.push(anchorError);
    return errors;
  }

  const obj = anchor as Record<string, unknown>;

  const startError = assertNumber(obj['start'], `${field}.start`);
  if (startError) {
    errors.push(startError);
  } else if ((obj['start'] as number) < 0 || !Number.isInteger(obj['start'])) {
    errors.push({ field: `${field}.start`, message: `${field}.start must be a positive integer` });
  }

  const endError = assertNumber(obj['end'], `${field}.end`);
  if (endError) {
    errors.push(endError);
  } else if (!Number.isInteger(obj['end'])) {
    errors.push({ field: `${field}.end`, message: `${field}.end must be an integer` });
  }

  if (
    typeof obj['start'] === 'number' &&
    typeof obj['end'] === 'number' &&
    obj['end'] <= obj['start']
  ) {
    errors.push({ field: `${field}.end`, message: `${field}.end must be greater than start` });
  }

  for (const key of ['prefix', 'suffix'] as const) {
    if (obj[key] === undefined) continue;
    const contextError = assertString(obj[key], `${field}.${key}`);
    if (contextError) errors.push(contextError);
  }

  return errors;
}

function validateLocator(locator: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const objError = assertObject(locator, 'locator');
  if (objError) {
    errors.push(objError);
    return errors;
  }

  const loc = locator as Record<string, unknown>;
  const formatError = assertNonEmptyString(loc['format'], 'locator.format');
  if (formatError) {
    errors.push(formatError);
  } else if (!VALID_LOCATOR_FORMATS.includes(loc['format'] as never)) {
    errors.push({ field: 'locator.format', message: 'locator.format must be a valid format' });
  }

  if (loc['format'] === 'epub' || loc['format'] === 'md') {
    if (loc['href'] !== undefined) {
      const hrefError = assertString(loc['href'], 'locator.href');
      if (hrefError) errors.push(hrefError);
    }
    if (loc['progression'] !== undefined) {
      const progError = assertNumber(loc['progression'], 'locator.progression');
      if (progError) errors.push(progError);
    }
  }

  if (loc['format'] === 'pdf' || loc['format'] === 'cbz') {
    if (loc['page'] !== undefined) {
      const pageError = assertNumber(loc['page'], 'locator.page');
      if (pageError) errors.push(pageError);
    }
    if (loc['progression'] !== undefined) {
      const progError = assertNumber(loc['progression'], 'locator.progression');
      if (progError) errors.push(progError);
    }
  }

  if (loc['anchor'] !== undefined) {
    errors.push(...validateAnchor(loc['anchor'], 'locator.anchor'));
  }

  return errors;
}

export function validateBookmarkInput(input: {
  bookId: unknown;
  locator: unknown;
  label?: unknown;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const bookIdError = assertNonEmptyString(input.bookId, 'bookId');
  if (bookIdError) errors.push(bookIdError);

  errors.push(...validateLocator(input.locator));

  if (input.label !== undefined) {
    const labelError = assertString(input.label, 'label');
    if (labelError) errors.push(labelError);
  }

  return { valid: errors.length === 0, errors };
}

export function validateBookmark(bookmark: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof bookmark !== 'object' || bookmark === null || Array.isArray(bookmark)) {
    return { valid: false, errors: [{ field: 'bookmark', message: 'bookmark must be an object' }] };
  }

  const bm = bookmark as Record<string, unknown>;

  const idError = assertNonEmptyString(bm['id'], 'id');
  if (idError) errors.push(idError);

  const bookIdError = assertNonEmptyString(bm['bookId'], 'bookId');
  if (bookIdError) errors.push(bookIdError);

  errors.push(...validateLocator(bm['locator']));

  const createdAtError = assertNumber(bm['createdAt'], 'createdAt');
  if (createdAtError) errors.push(createdAtError);

  if (bm['label'] !== undefined) {
    const labelError = assertString(bm['label'], 'label');
    if (labelError) errors.push(labelError);
  }

  return { valid: errors.length === 0, errors };
}

export function validateNoteInput(input: {
  bookId: unknown;
  locator: unknown;
  body: unknown;
  selectedText?: unknown;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const bookIdError = assertNonEmptyString(input.bookId, 'bookId');
  if (bookIdError) errors.push(bookIdError);

  errors.push(...validateLocator(input.locator));

  const bodyError = assertNonEmptyString(input.body, 'body');
  if (bodyError) {
    errors.push(bodyError);
  } else if (typeof input.body === 'string' && input.body.trim().length === 0) {
    errors.push({ field: 'body', message: 'body must not be empty' });
  }

  if (input.selectedText !== undefined) {
    const textError = assertString(input.selectedText, 'selectedText');
    if (textError) errors.push(textError);
  }

  return { valid: errors.length === 0, errors };
}

export function validateNote(note: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof note !== 'object' || note === null || Array.isArray(note)) {
    return { valid: false, errors: [{ field: 'note', message: 'note must be an object' }] };
  }

  const n = note as Record<string, unknown>;

  const idError = assertNonEmptyString(n['id'], 'id');
  if (idError) errors.push(idError);

  const bookIdError = assertNonEmptyString(n['bookId'], 'bookId');
  if (bookIdError) errors.push(bookIdError);

  errors.push(...validateLocator(n['locator']));

  const bodyError = assertNonEmptyString(n['body'], 'body');
  if (bodyError) {
    errors.push(bodyError);
  } else if (typeof n['body'] === 'string' && (n['body'] as string).trim().length === 0) {
    errors.push({ field: 'body', message: 'body must not be empty' });
  }

  const createdAtError = assertNumber(n['createdAt'], 'createdAt');
  if (createdAtError) errors.push(createdAtError);

  const updatedAtError = assertNumber(n['updatedAt'], 'updatedAt');
  if (updatedAtError) errors.push(updatedAtError);

  if (n['selectedText'] !== undefined) {
    const textError = assertString(n['selectedText'], 'selectedText');
    if (textError) errors.push(textError);
  }

  return { valid: errors.length === 0, errors };
}

export function validateHighlightInput(input: {
  bookId: unknown;
  locator: unknown;
  color: unknown;
  style?: unknown;
  selectedText?: unknown;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const bookIdError = assertNonEmptyString(input.bookId, 'bookId');
  if (bookIdError) errors.push(bookIdError);

  errors.push(...validateLocator(input.locator));

  if (!isHighlightColor(input.color)) {
    errors.push({ field: 'color', message: 'color must be one of the highlight palette colors' });
  }

  if (input.style !== undefined && input.style !== 'highlight' && input.style !== 'underline') {
    errors.push({ field: 'style', message: "style must be 'highlight' or 'underline'" });
  }

  if (input.selectedText !== undefined) {
    const textError = assertString(input.selectedText, 'selectedText');
    if (textError) errors.push(textError);
  }

  return { valid: errors.length === 0, errors };
}

export function validateBookmarkForExport(bookmark: unknown): ValidationResult {
  return validateBookmark(bookmark);
}

export function validateHighlight(note: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof note !== 'object' || note === null || Array.isArray(note)) {
    return {
      valid: false,
      errors: [{ field: 'highlight', message: 'highlight must be an object' }],
    };
  }

  const h = note as Record<string, unknown>;

  const idError = assertNonEmptyString(h['id'], 'id');
  if (idError) errors.push(idError);

  const bookIdError = assertNonEmptyString(h['bookId'], 'bookId');
  if (bookIdError) errors.push(bookIdError);

  errors.push(...validateLocator(h['locatorStart']));

  const locatorEnd = h['locatorEnd'];
  if (locatorEnd !== undefined) {
    errors.push(...validateLocator(locatorEnd));
  }

  if (!isHighlightColor(h['color'])) {
    errors.push({ field: 'color', message: 'color must be one of the highlight palette colors' });
  }

  if (h['style'] !== undefined && h['style'] !== 'highlight' && h['style'] !== 'underline') {
    errors.push({ field: 'style', message: "style must be 'highlight' or 'underline'" });
  }

  const createdAtError = assertNumber(h['createdAt'], 'createdAt');
  if (createdAtError) errors.push(createdAtError);

  const updatedAtError = assertNumber(h['updatedAt'], 'updatedAt');
  if (updatedAtError) errors.push(updatedAtError);

  if (h['selectedText'] !== undefined) {
    const textError = assertString(h['selectedText'], 'selectedText');
    if (textError) errors.push(textError);
  }

  if (h['note'] !== undefined) {
    const noteError = assertString(h['note'], 'note');
    if (noteError) errors.push(noteError);
  }

  return { valid: errors.length === 0, errors };
}

export function validateNoteForExport(note: unknown): ValidationResult {
  return validateNote(note);
}

export function validateHighlightForExport(highlight: unknown): ValidationResult {
  return validateHighlight(highlight);
}

export function throwIfInvalid(result: ValidationResult): void {
  if (!result.valid) {
    const messages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new AnnotationValidationError(messages);
  }
}
