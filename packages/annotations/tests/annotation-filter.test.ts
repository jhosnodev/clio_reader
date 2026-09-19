import { describe, expect, it } from 'vitest';

import type { Bookmark, Note } from '@clio-reader/domain';

import {
  filterByDateRange,
  sortByDate,
  sortByPosition,
  sortByLabel,
  applyFilter,
  applySort,
} from '../src/annotation-filter.js';

const now = Date.now();

function makeBookmark(
  overrides: Partial<{
    id: string;
    label: string;
    createdAt: number;
    locator:
      { format: 'epub'; href: string; progression: number } | { format: 'pdf'; page: number };
  }> = {},
): Bookmark {
  const base: Bookmark = {
    id: overrides.id ?? 'bm-1',
    bookId: 'book-1',
    locator: (overrides.locator ?? { format: 'epub' as const, href: 'ch1' }) as Bookmark['locator'],
    createdAt: overrides.createdAt ?? now,
  };
  if (overrides.label !== undefined) {
    return { ...base, label: overrides.label };
  }
  return base;
}

function makeNote(
  overrides: Partial<{
    id: string;
    body: string;
    createdAt: number;
    locator: { format: 'epub'; href: string };
  }> = {},
): Note {
  return {
    id: overrides.id ?? 'note-1',
    bookId: 'book-1',
    locator: overrides.locator ?? { format: 'epub' as const, href: 'ch1' },
    body: overrides.body ?? 'Note body',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.createdAt ?? now,
  };
}

describe('AnnotationFilter', () => {
  describe('filterByDateRange', () => {
    it('returns all annotations within date range', () => {
      const bookmarks = [
        makeBookmark({ createdAt: now - 2000 }),
        makeBookmark({ createdAt: now - 1000 }),
        makeBookmark({ createdAt: now }),
      ];

      const result = filterByDateRange(bookmarks, now - 3000, now);
      expect(result).toHaveLength(3);
    });

    it('filters out annotations outside range', () => {
      const bookmarks = [
        makeBookmark({ createdAt: now - 2000 }),
        makeBookmark({ createdAt: now - 1000 }),
        makeBookmark({ createdAt: now + 1000 }),
      ];

      const result = filterByDateRange(bookmarks, now - 1500, now);
      expect(result).toHaveLength(1);
    });

    it('handles start only', () => {
      const bookmarks = [makeBookmark({ createdAt: now - 2000 }), makeBookmark({ createdAt: now })];

      const result = filterByDateRange(bookmarks, now - 1000);
      expect(result).toHaveLength(1);
    });

    it('handles end only', () => {
      const bookmarks = [makeBookmark({ createdAt: now - 2000 }), makeBookmark({ createdAt: now })];

      const result = filterByDateRange(bookmarks, undefined, now - 1000);
      expect(result).toHaveLength(1);
    });
  });

  describe('sortByDate', () => {
    it('sorts ascending by default', () => {
      const bookmarks = [
        makeBookmark({ createdAt: now }),
        makeBookmark({ createdAt: now - 2000 }),
        makeBookmark({ createdAt: now - 1000 }),
      ];

      const result = sortByDate(bookmarks);
      expect(result[0]!.createdAt).toBe(now - 2000);
      expect(result[2]!.createdAt).toBe(now);
    });

    it('sorts descending', () => {
      const bookmarks = [
        makeBookmark({ createdAt: now }),
        makeBookmark({ createdAt: now - 2000 }),
        makeBookmark({ createdAt: now - 1000 }),
      ];

      const result = sortByDate(bookmarks, 'desc');
      expect(result[0]!.createdAt).toBe(now);
      expect(result[2]!.createdAt).toBe(now - 2000);
    });
  });

  describe('sortByPosition', () => {
    it('sorts by progression', () => {
      const bookmarks = [
        makeBookmark({
          locator: { format: 'epub', href: 'ch3', progression: 0.6 },
          createdAt: now,
        }),
        makeBookmark({
          locator: { format: 'epub', href: 'ch1', progression: 0.1 },
          createdAt: now,
        }),
        makeBookmark({
          locator: { format: 'epub', href: 'ch2', progression: 0.3 },
          createdAt: now,
        }),
      ];

      const result = sortByPosition(bookmarks);
      expect(result[0]!.locator.progression).toBe(0.1);
      expect(result[2]!.locator.progression).toBe(0.6);
    });

    it('sorts pdf locators by page', () => {
      const bookmarks = [
        makeBookmark({ locator: { format: 'pdf' as const, page: 10 }, createdAt: now }),
        makeBookmark({ locator: { format: 'pdf' as const, page: 2 }, createdAt: now }),
        makeBookmark({ locator: { format: 'pdf' as const, page: 5 }, createdAt: now }),
      ];

      const result = sortByPosition(bookmarks);
      expect(result[0]!.locator).toEqual({ format: 'pdf', page: 2 });
      expect(result[2]!.locator).toEqual({ format: 'pdf', page: 10 });
    });
  });

  describe('sortByLabel', () => {
    it('sorts alphabetically by label', () => {
      const bookmarks = [
        makeBookmark({ label: 'Charlie', createdAt: now }),
        makeBookmark({ label: 'Alpha', createdAt: now }),
        makeBookmark({ label: 'Bravo', createdAt: now }),
      ];

      const result = sortByLabel(bookmarks);
      expect(result[0]!.label).toBe('Alpha');
      expect(result[2]!.label).toBe('Charlie');
    });

    it('puts unlabeled bookmarks at the end', () => {
      const bookmarks = [
        makeBookmark({ label: 'Bravo', createdAt: now }),
        makeBookmark({ createdAt: now }),
        makeBookmark({ label: 'Alpha', createdAt: now }),
      ];

      const result = sortByLabel(bookmarks);
      expect(result[0]!.label).toBe('Alpha');
      expect(result[1]!.label).toBe('Bravo');
      expect(result[2]!.label).toBeUndefined();
    });
  });

  describe('applyFilter', () => {
    it('returns all when no filter provided', () => {
      const bookmarks = [makeBookmark(), makeBookmark()];
      expect(applyFilter(bookmarks)).toHaveLength(2);
    });

    it('applies date range filter', () => {
      const bookmarks = [makeBookmark({ createdAt: now - 2000 }), makeBookmark({ createdAt: now })];

      const result = applyFilter(bookmarks, { dateRange: { start: now - 1000 } });
      expect(result).toHaveLength(1);
    });
  });

  describe('applySort', () => {
    it('returns all when no sort provided', () => {
      const bookmarks = [makeBookmark(), makeBookmark()];
      expect(applySort(bookmarks)).toHaveLength(2);
    });

    it('applies date sort', () => {
      const bookmarks = [makeBookmark({ createdAt: now }), makeBookmark({ createdAt: now - 1000 })];

      const result = applySort(bookmarks, { field: 'date', order: 'asc' });
      expect(result[0]!.createdAt).toBe(now - 1000);
    });
  });
});
