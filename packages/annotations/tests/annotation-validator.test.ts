import { describe, expect, it } from 'vitest';

import {
  validateBookmarkInput,
  validateBookmark,
  validateNoteInput,
  validateNote,
  validateBookmarkForExport,
  validateNoteForExport,
  throwIfInvalid,
} from '../src/annotation-validator.js';
import { AnnotationValidationError } from '../src/errors.js';

describe('AnnotationValidator', () => {
  describe('validateBookmarkInput', () => {
    it('returns valid for correct input', () => {
      const result = validateBookmarkInput({
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing bookId', () => {
      const result = validateBookmarkInput({
        bookId: '',
        locator: { format: 'epub', href: 'ch1' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'bookId')).toBe(true);
    });

    it('rejects invalid locator', () => {
      const result = validateBookmarkInput({
        bookId: 'book-1',
        locator: { format: 'invalid', href: 'ch1' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'locator.format')).toBe(true);
    });

    it('validates optional label type', () => {
      const result = validateBookmarkInput({
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        label: 123,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'label')).toBe(true);
    });
  });

  describe('validateBookmark', () => {
    it('returns valid for correct bookmark', () => {
      const result = validateBookmark({
        id: 'bm-1',
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        createdAt: Date.now(),
      });
      expect(result.valid).toBe(true);
    });

    it('rejects missing id', () => {
      const result = validateBookmark({
        id: '',
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        createdAt: Date.now(),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'id')).toBe(true);
    });

    it('rejects non-object input', () => {
      const result = validateBookmark('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.field).toBe('bookmark');
    });
  });

  describe('validateNoteInput', () => {
    it('returns valid for correct input', () => {
      const result = validateNoteInput({
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note text',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty body', () => {
      const result = validateNoteInput({
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'body')).toBe(true);
    });

    it('rejects whitespace-only body', () => {
      const result = validateNoteInput({
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: '   ',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateNote', () => {
    it('returns valid for correct note', () => {
      const result = validateNote({
        id: 'note-1',
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note text',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      expect(result.valid).toBe(true);
    });

    it('rejects missing updatedAt', () => {
      const result = validateNote({
        id: 'note-1',
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note text',
        createdAt: Date.now(),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'updatedAt')).toBe(true);
    });
  });

  describe('validateBookmarkForExport', () => {
    it('validates export format', () => {
      const result = validateBookmarkForExport({
        id: 'bm-1',
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        createdAt: Date.now(),
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateNoteForExport', () => {
    it('validates export format', () => {
      const result = validateNoteForExport({
        id: 'note-1',
        bookId: 'book-1',
        locator: { format: 'epub', href: 'ch1' },
        body: 'Note text',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('throwIfInvalid', () => {
    it('throws when result is invalid', () => {
      expect(() =>
        throwIfInvalid({ valid: false, errors: [{ field: 'test', message: 'error' }] }),
      ).toThrow(AnnotationValidationError);
    });

    it('does not throw when result is valid', () => {
      expect(() => throwIfInvalid({ valid: true, errors: [] })).not.toThrow();
    });
  });
});
