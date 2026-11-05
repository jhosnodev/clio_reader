import { describe, expect, it } from 'vitest';
import {
  lineHeightToButton,
  marginToPx,
  pixelSizeFor,
  stepFontScale,
  themeFromWebview,
  webviewFontFor,
  webviewThemeFor,
} from './reader-prefs';

describe('webviewThemeFor', () => {
  it('maps light to paper', () => {
    expect(webviewThemeFor('light')).toBe('paper');
  });

  it('maps dark to night', () => {
    expect(webviewThemeFor('dark')).toBe('night');
  });

  it('maps sepia to sepia', () => {
    expect(webviewThemeFor('sepia')).toBe('sepia');
  });

  it('maps custom to paper as fallback', () => {
    expect(webviewThemeFor('custom')).toBe('paper');
  });
});

describe('themeFromWebview', () => {
  it('round-trips paper -> light', () => {
    expect(themeFromWebview('paper')).toBe('light');
  });

  it('round-trips sepia -> sepia', () => {
    expect(themeFromWebview('sepia')).toBe('sepia');
  });

  it('round-trips night -> dark', () => {
    expect(themeFromWebview('night')).toBe('dark');
  });
});

describe('webviewFontFor', () => {
  it('maps serif to serif', () => {
    expect(webviewFontFor('serif')).toBe('serif');
  });

  it('maps sans to sans', () => {
    expect(webviewFontFor('sans')).toBe('sans');
  });

  it('maps system and dyslexic to sans', () => {
    expect(webviewFontFor('system')).toBe('sans');
    expect(webviewFontFor('dyslexic')).toBe('sans');
  });
});

describe('pixelSizeFor', () => {
  it('maps fontScale 1 to 19px', () => {
    expect(pixelSizeFor(1)).toBe(19);
  });

  it('rounds fractional scales', () => {
    expect(pixelSizeFor(1.05)).toBe(20);
  });

  it('clamps to the min pixel size', () => {
    expect(pixelSizeFor(0.5)).toBe(14);
  });

  it('clamps to the max pixel size', () => {
    expect(pixelSizeFor(2.5)).toBe(28);
  });
});

describe('stepFontScale', () => {
  it('increments by 0.05', () => {
    expect(stepFontScale(1, 1)).toBe(1.05);
  });

  it('decrements by 0.05', () => {
    expect(stepFontScale(1, -1)).toBe(0.95);
  });

  it('clamps to the max scale', () => {
    expect(stepFontScale(2, 1)).toBe(2);
  });

  it('clamps to the min scale', () => {
    expect(stepFontScale(0.8, -1)).toBe(0.8);
  });
});

describe('lineHeightToButton', () => {
  it('maps 1.5 to 1.55', () => {
    expect(lineHeightToButton(1.5)).toBe('1.55');
  });

  it('maps 1.75 to 1.75', () => {
    expect(lineHeightToButton(1.75)).toBe('1.75');
  });

  it('maps 2 to 2', () => {
    expect(lineHeightToButton(2)).toBe('2');
  });
});

describe('marginToPx', () => {
  it('rounds the margin to whole pixels', () => {
    expect(marginToPx(47.6)).toBe(48);
  });

  it('clamps values below the minimum', () => {
    expect(marginToPx(0)).toBe(8);
  });

  it('clamps values above the maximum', () => {
    expect(marginToPx(999)).toBe(120);
  });
});
