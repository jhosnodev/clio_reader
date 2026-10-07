import { describe, expect, it } from 'vitest';
import type { EpubLocator, PdfLocator, CbzLocator, MarkdownLocator } from '@clio-reader/domain';
import {
  getResumePositionOrder,
  getResumeScrollRatio,
  isSameDocumentPosition,
  locatorToPercent,
  parseLocator,
  withScrollRatio,
} from './reader-progress';

describe('getResumePositionOrder', () => {
  it('returns noteLocator.positionOrder when both are provided', () => {
    const note: EpubLocator = {
      format: 'epub',
      href: 'ch3.xhtml',
      positionOrder: 2,
      progression: 0.25,
    };
    const saved: EpubLocator = {
      format: 'epub',
      href: 'ch5.xhtml',
      positionOrder: 4,
      progression: 0.5,
    };
    expect(getResumePositionOrder(note, saved)).toBe(2);
  });

  it('returns savedLocator.positionOrder when noteLocator has no positionOrder', () => {
    const note: EpubLocator = { format: 'epub', href: 'ch1.xhtml' };
    const saved: EpubLocator = {
      format: 'epub',
      href: 'ch4.xhtml',
      positionOrder: 3,
      progression: 0.375,
    };
    expect(getResumePositionOrder(note, saved)).toBe(3);
  });

  it('returns undefined when neither has positionOrder', () => {
    const note: PdfLocator = { format: 'pdf', page: 1 };
    const saved: CbzLocator = { format: 'cbz', page: 5 };
    expect(getResumePositionOrder(note, saved)).toBeUndefined();
  });

  it('returns noteLocator.positionOrder when savedLocator is undefined', () => {
    const note: MarkdownLocator = { format: 'md', positionOrder: 7, progression: 0.1 };
    expect(getResumePositionOrder(note)).toBe(7);
  });

  it('returns undefined when both are undefined', () => {
    expect(getResumePositionOrder(undefined, undefined)).toBeUndefined();
  });
});

describe('locatorToPercent', () => {
  it('returns progression for epub locator', () => {
    const loc: EpubLocator = {
      format: 'epub',
      href: 'ch2.xhtml',
      progression: 0.375,
      positionOrder: 1,
    };
    expect(locatorToPercent(loc)).toBe(0.375);
  });

  it('returns 0 when progression is undefined', () => {
    const loc: PdfLocator = { format: 'pdf', page: 1 };
    expect(locatorToPercent(loc)).toBe(0);
  });

  it('returns 0 for cbz locator without progression', () => {
    const loc: CbzLocator = { format: 'cbz', page: 10 };
    expect(locatorToPercent(loc)).toBe(0);
  });

  it('returns 0 for markdown locator without progression', () => {
    const loc: MarkdownLocator = { format: 'md', offset: 100 };
    expect(locatorToPercent(loc)).toBe(0);
  });

  it('returns progression for markdown locator', () => {
    const loc: MarkdownLocator = { format: 'md', progression: 0.6 };
    expect(locatorToPercent(loc)).toBe(0.6);
  });
});

describe('withScrollRatio', () => {
  it('adds the scroll ratio to an epub locator', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch2.xhtml', positionOrder: 1 };
    expect(withScrollRatio(loc, 0.42)).toEqual({
      format: 'epub',
      href: 'ch2.xhtml',
      positionOrder: 1,
      scrollRatio: 0.42,
    });
  });

  it('clamps ratios outside 0..1', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch2.xhtml' };
    expect(withScrollRatio(loc, 4)).toEqual({ ...loc, scrollRatio: 1 });
    expect(withScrollRatio(loc, -2)).toEqual({ ...loc, scrollRatio: 0 });
  });

  it('ignores non-finite ratios', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch2.xhtml' };
    expect(withScrollRatio(loc, Number.NaN)).toBe(loc);
  });

  it('leaves paginated formats untouched', () => {
    const pdf: PdfLocator = { format: 'pdf', page: 3 };
    const cbz: CbzLocator = { format: 'cbz', page: 7 };
    expect(withScrollRatio(pdf, 0.5)).toBe(pdf);
    expect(withScrollRatio(cbz, 0.5)).toBe(cbz);
  });
});

describe('getResumeScrollRatio', () => {
  it('returns the stored ratio for an epub locator', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch2.xhtml', scrollRatio: 0.63 };
    expect(getResumeScrollRatio(loc)).toBe(0.63);
  });

  it('returns undefined when the locator predates intra-chapter positions', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch2.xhtml', positionOrder: 1 };
    expect(getResumeScrollRatio(loc)).toBeUndefined();
  });

  it('returns undefined for paginated formats and empty input', () => {
    expect(getResumeScrollRatio({ format: 'pdf', page: 2 })).toBeUndefined();
    expect(getResumeScrollRatio({ format: 'cbz', page: 2 })).toBeUndefined();
    expect(getResumeScrollRatio({ format: 'md', offset: 40 })).toBeUndefined();
    expect(getResumeScrollRatio(undefined)).toBeUndefined();
  });

  it('clamps out-of-range stored values', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch2.xhtml', scrollRatio: 9 };
    expect(getResumeScrollRatio(loc)).toBe(1);
  });
});

describe('isSameDocumentPosition', () => {
  it('ignores the intra-chapter ratio of epub locators', () => {
    const a: EpubLocator = { format: 'epub', href: 'ch3.xhtml', positionOrder: 2, scrollRatio: 0 };
    const b: EpubLocator = {
      format: 'epub',
      href: 'ch3.xhtml',
      positionOrder: 2,
      scrollRatio: 0.8,
    };
    expect(isSameDocumentPosition(a, b)).toBe(true);
  });

  it('separates different chapters', () => {
    const a: EpubLocator = { format: 'epub', href: 'ch3.xhtml', positionOrder: 2 };
    const b: EpubLocator = { format: 'epub', href: 'ch4.xhtml', positionOrder: 3 };
    expect(isSameDocumentPosition(a, b)).toBe(false);
  });

  it('falls back to href when positionOrder is missing', () => {
    const a: EpubLocator = { format: 'epub', href: 'ch3.xhtml' };
    const b: EpubLocator = { format: 'epub', href: 'ch3.xhtml', scrollRatio: 0.3 };
    expect(isSameDocumentPosition(a, b)).toBe(true);
  });

  it('compares paginated locators by page', () => {
    expect(isSameDocumentPosition({ format: 'pdf', page: 5 }, { format: 'pdf', page: 5 })).toBe(
      true,
    );
    expect(isSameDocumentPosition({ format: 'cbz', page: 5 }, { format: 'cbz', page: 6 })).toBe(
      false,
    );
  });

  it('never matches across formats', () => {
    expect(isSameDocumentPosition({ format: 'pdf', page: 5 }, { format: 'cbz', page: 5 })).toBe(
      false,
    );
  });
});

describe('parseLocator', () => {
  it('parses a serialized locator', () => {
    const loc: EpubLocator = { format: 'epub', href: 'ch1.xhtml', scrollRatio: 0.2 };
    expect(parseLocator(JSON.stringify(loc))).toEqual(loc);
  });

  it('returns null for invalid JSON, non-objects and missing format', () => {
    expect(parseLocator('not json')).toBeNull();
    expect(parseLocator('42')).toBeNull();
    expect(parseLocator('null')).toBeNull();
    expect(parseLocator('{"href":"ch1.xhtml"}')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseLocator(undefined)).toBeNull();
    expect(parseLocator('')).toBeNull();
  });
});
