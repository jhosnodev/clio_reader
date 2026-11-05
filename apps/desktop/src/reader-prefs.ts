import { MAX_READER_MARGIN, MIN_READER_MARGIN, type ReaderPreferences } from '@clio-reader/domain';

export const PREFERENCES_SENTINEL = '__clio_prefs__';

const BASE_FONT_PX = 19;
const MIN_FONT_PX = 14;
const MAX_FONT_PX = 28;
const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 2;
const FONT_SCALE_STEP = 0.05;

export type WebviewTheme = 'paper' | 'sepia' | 'night';
export type WebviewFont = 'serif' | 'sans';

export function webviewThemeFor(theme: ReaderPreferences['theme']): WebviewTheme {
  switch (theme) {
    case 'dark':
      return 'night';
    case 'sepia':
      return 'sepia';
    case 'custom':
    case 'light':
    default:
      return 'paper';
  }
}

export function themeFromWebview(theme: WebviewTheme): ReaderPreferences['theme'] {
  switch (theme) {
    case 'sepia':
      return 'sepia';
    case 'night':
      return 'dark';
    case 'paper':
    default:
      return 'light';
  }
}

export function webviewFontFor(fontFamily: ReaderPreferences['fontFamily']): WebviewFont {
  return fontFamily === 'serif' ? 'serif' : 'sans';
}

export function pixelSizeFor(fontScale: number): number {
  const raw = Math.round(BASE_FONT_PX * fontScale);
  return Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, raw));
}

export function stepFontScale(fontScale: number, delta: -1 | 1): number {
  let next = fontScale + delta * FONT_SCALE_STEP;
  next = Math.round(next * 100) / 100;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, next));
}

export function lineHeightToButton(lineHeight: number): '1.55' | '1.75' | '2' {
  if (lineHeight <= 1.6) return '1.55';
  if (lineHeight < 1.9) return '1.75';
  return '2';
}

export function marginToPx(margin: number): number {
  return Math.min(MAX_READER_MARGIN, Math.max(MIN_READER_MARGIN, Math.round(margin)));
}
