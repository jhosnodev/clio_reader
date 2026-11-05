import { describe, expect, it } from 'vitest';

import type { ReaderPreferences } from '@clio-reader/domain';

import {
  generateReaderStyle,
  generateThemeCss,
  generateFontCss,
  generateMarginCss,
} from '../src/epub-themes.js';

const basePrefs: ReaderPreferences = {
  theme: 'light',
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2937',
  accentColor: '#2563eb',
  fontFamily: 'system',
  fontScale: 1,
  lineHeight: 1.5,
  margin: 48,
  readingDirection: 'ltr',
};

describe('generateThemeCss', () => {
  it('generates light theme CSS', () => {
    const css = generateThemeCss({
      ...basePrefs,
      theme: 'light',
      backgroundColor: '#ffffff',
      foregroundColor: '#1f2937',
      accentColor: '#2563eb',
    });

    expect(css).toContain('#ffffff');
    expect(css).toContain('#1f2937');
    expect(css).toContain('#2563eb');
    expect(css).toContain('--reader-bg');
    expect(css).toContain('--reader-fg');
    expect(css).toContain('--reader-accent');
  });

  it('generates dark theme CSS', () => {
    const css = generateThemeCss({
      ...basePrefs,
      theme: 'dark',
      backgroundColor: '#1a1a2e',
      foregroundColor: '#e0e0e0',
      accentColor: '#4fc3f7',
    });

    expect(css).toContain('#1a1a2e');
    expect(css).toContain('#e0e0e0');
    expect(css).toContain('#4fc3f7');
  });

  it('generates sepia theme CSS', () => {
    const css = generateThemeCss({
      ...basePrefs,
      theme: 'sepia',
      backgroundColor: '#f4ecd8',
      foregroundColor: '#5c4b37',
      accentColor: '#8b6914',
    });

    expect(css).toContain('#f4ecd8');
    expect(css).toContain('#5c4b37');
    expect(css).toContain('#8b6914');
  });
});

describe('generateFontCss', () => {
  it('generates CSS for system font', () => {
    const css = generateFontCss({
      ...basePrefs,
      fontFamily: 'system',
      fontScale: 1,
      lineHeight: 1.5,
    });

    expect(css).toContain('font-size: 1rem');
    expect(css).toContain('line-height: 1.5');
    expect(css).toContain('-apple-system');
  });

  it('generates CSS for serif font', () => {
    const css = generateFontCss({
      ...basePrefs,
      fontFamily: 'serif',
      fontScale: 1.2,
      lineHeight: 1.8,
    });

    expect(css).toContain('font-size: 1.2rem');
    expect(css).toContain('line-height: 1.8');
    expect(css).toContain('Georgia');
  });

  it('generates CSS for dyslexic font', () => {
    const css = generateFontCss({
      ...basePrefs,
      fontFamily: 'dyslexic',
      fontScale: 1.5,
      lineHeight: 2.0,
    });

    expect(css).toContain('font-size: 1.5rem');
    expect(css).toContain('line-height: 2');
    expect(css).toContain('OpenDyslexic');
  });

  it('clamps font scale to valid range', () => {
    const cssTooSmall = generateFontCss({
      ...basePrefs,
      fontScale: 0.5,
      lineHeight: 1.5,
    });
    expect(cssTooSmall).toContain('font-size: 0.8rem');

    const cssTooLarge = generateFontCss({
      ...basePrefs,
      fontScale: 3,
      lineHeight: 1.5,
    });
    expect(cssTooLarge).toContain('font-size: 2rem');
  });

  it('clamps line height to valid range', () => {
    const cssTooSmall = generateFontCss({
      ...basePrefs,
      fontScale: 1,
      lineHeight: 0.5,
    });
    expect(cssTooSmall).toContain('line-height: 1');

    const cssTooLarge = generateFontCss({
      ...basePrefs,
      fontScale: 1,
      lineHeight: 3,
    });
    expect(cssTooLarge).toContain('line-height: 2.5');
  });
});

describe('generateMarginCss', () => {
  it('generates compact margin CSS', () => {
    const css = generateMarginCss({
      ...basePrefs,
      margin: 16,
    });

    expect(css).toContain('padding-left: var(--read-margin, 16px)');
    expect(css).toContain('padding-right: var(--read-margin, 16px)');
  });

  it('generates comfortable margin CSS', () => {
    const css = generateMarginCss({
      ...basePrefs,
      margin: 48,
    });

    expect(css).toContain('padding-left: var(--read-margin, 48px)');
    expect(css).toContain('padding-right: var(--read-margin, 48px)');
  });

  it('generates wide margin CSS', () => {
    const css = generateMarginCss({
      ...basePrefs,
      margin: 96,
    });

    expect(css).toContain('padding-left: var(--read-margin, 96px)');
    expect(css).toContain('padding-right: var(--read-margin, 96px)');
  });
});

describe('generateReaderStyle', () => {
  it('combines all CSS generation functions', () => {
    const css = generateReaderStyle({
      theme: 'dark',
      backgroundColor: '#1a1a2e',
      foregroundColor: '#e0e0e0',
      accentColor: '#4fc3f7',
      fontFamily: 'serif',
      fontScale: 1.2,
      lineHeight: 1.8,
      margin: 48,
      readingDirection: 'ltr',
    });

    expect(css).toContain('#1a1a2e');
    expect(css).toContain('font-size: 1.2rem');
    expect(css).toContain('line-height: 1.8');
    expect(css).toContain('padding-left: var(--read-margin, 48px)');
    expect(css).toContain('direction: ltr');
  });

  it('handles RTL direction', () => {
    const css = generateReaderStyle({
      ...basePrefs,
      readingDirection: 'rtl',
    });

    expect(css).toContain('direction: rtl');
  });
});
