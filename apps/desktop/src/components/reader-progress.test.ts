import { describe, expect, it } from 'vitest';
import type { EpubLocator, PdfLocator, CbzLocator, MarkdownLocator } from '@clio-reader/domain';
import { getResumePositionOrder, locatorToPercent } from './reader-progress';

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
