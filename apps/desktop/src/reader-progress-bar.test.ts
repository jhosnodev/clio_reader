import { describe, expect, it } from 'vitest';
import {
  chapterIndexFromRatio,
  clamp01,
  formatProgressLabel,
  progressPercent,
  scrollRatio,
} from './reader-progress-bar';

describe('clamp01', () => {
  it('keeps values inside 0..1', () => {
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it('clamps out-of-range values', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(4.2)).toBe(1);
  });

  it('maps non-finite values to 0', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('scrollRatio', () => {
  it('returns 0 at the top of a scrollable chapter', () => {
    expect(scrollRatio(0, 2000, 800)).toBe(0);
  });

  it('returns 1 at the bottom of a scrollable chapter', () => {
    expect(scrollRatio(1200, 2000, 800)).toBe(1);
  });

  it('interpolates linearly in between', () => {
    expect(scrollRatio(600, 2000, 800)).toBe(0.5);
  });

  it('returns 1 when the chapter does not scroll', () => {
    expect(scrollRatio(0, 800, 800)).toBe(1);
  });

  it('returns 1 when content is shorter than the viewport', () => {
    expect(scrollRatio(0, 500, 800)).toBe(1);
  });

  it('clamps overshoot from layout changes mid-read', () => {
    expect(scrollRatio(5000, 2000, 800)).toBe(1);
  });
});

describe('progressPercent', () => {
  it('is 0 at the first chapter top', () => {
    expect(progressPercent(0, 10, 0)).toBe(0);
  });

  it('is 100 at the last chapter bottom', () => {
    expect(progressPercent(9, 10, 1)).toBe(100);
  });

  it('advances within a chapter as the user scrolls', () => {
    expect(progressPercent(0, 10, 0.5)).toBe(5);
    expect(progressPercent(0, 10, 1)).toBe(10);
  });

  it('is continuous across a chapter boundary', () => {
    expect(progressPercent(0, 10, 1)).toBe(progressPercent(1, 10, 0));
  });

  it('reaches 100 across the whole book', () => {
    expect(progressPercent(4, 10, 0)).toBe(40);
    expect(progressPercent(9, 10, 0)).toBe(90);
  });

  it('tracks scroll for a single-chapter book', () => {
    expect(progressPercent(0, 1, 0)).toBe(0);
    expect(progressPercent(0, 1, 0.5)).toBe(50);
    expect(progressPercent(0, 1, 1)).toBe(100);
  });

  it('does not stay at 0 for a two-chapter book', () => {
    expect(progressPercent(0, 2, 0.5)).toBe(25);
    expect(progressPercent(1, 2, 0)).toBe(50);
  });

  it('returns 0 when the book reports no chapters', () => {
    expect(progressPercent(0, 0, 0.5)).toBe(0);
  });

  it('clamps an out-of-range chapter index to the last chapter', () => {
    expect(progressPercent(99, 10, 0)).toBe(90);
    expect(progressPercent(99, 10, 1)).toBe(100);
    expect(progressPercent(-5, 10, 0)).toBe(0);
  });
});

describe('formatProgressLabel', () => {
  it('shows chapter position and percent', () => {
    expect(formatProgressLabel(0, 10, 0)).toBe('Cap. 1/10 · 0%');
    expect(formatProgressLabel(2, 10, 23.4)).toBe('Cap. 3/10 · 23%');
    expect(formatProgressLabel(9, 10, 100)).toBe('Cap. 10/10 · 100%');
  });

  it('falls back to percent only without chapters', () => {
    expect(formatProgressLabel(0, 0, 42)).toBe('42%');
  });
});

describe('chapterIndexFromRatio', () => {
  it('maps the start of the track to the first chapter', () => {
    expect(chapterIndexFromRatio(0, 10)).toBe(0);
  });

  it('maps the end of the track to the last chapter', () => {
    expect(chapterIndexFromRatio(1, 10)).toBe(9);
  });

  it('maps the middle of the track to the middle chapter', () => {
    expect(chapterIndexFromRatio(0.5, 10)).toBe(5);
  });

  it('resolves the chapter owning a given position', () => {
    const percent = progressPercent(3, 10, 0);
    expect(chapterIndexFromRatio(percent / 100, 10)).toBe(3);
  });

  it('returns 0 for a single-chapter book', () => {
    expect(chapterIndexFromRatio(0.5, 1)).toBe(0);
  });

  it('returns 0 when the book reports no chapters', () => {
    expect(chapterIndexFromRatio(0.5, 0)).toBe(0);
  });

  it('clamps out-of-range ratios', () => {
    expect(chapterIndexFromRatio(-1, 10)).toBe(0);
    expect(chapterIndexFromRatio(2, 10)).toBe(9);
  });
});
