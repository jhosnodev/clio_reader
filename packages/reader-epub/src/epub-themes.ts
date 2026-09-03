import type { ReaderPreferences } from '@clio-reader/domain';

const THEME_COLORS: Record<string, { bg: string; fg: string; accent: string }> = {
  light: { bg: '#ffffff', fg: '#1f2937', accent: '#2563eb' },
  dark: { bg: '#1a1a2e', fg: '#e0e0e0', accent: '#4fc3f7' },
  sepia: { bg: '#f4ecd8', fg: '#5c4b37', accent: '#8b6914' },
  custom: { bg: '#ffffff', fg: '#1f2937', accent: '#2563eb' },
};

const FONT_FAMILIES: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: 'Arial, Helvetica, sans-serif',
  dyslexic: 'OpenDyslexic, Comic Sans MS, sans-serif',
};

const MARGINS: Record<string, string> = {
  compact: '16px',
  comfortable: '48px',
  wide: '96px',
};

export function generateThemeCss(prefs: ReaderPreferences): string {
  const colors = THEME_COLORS[prefs.theme] ?? THEME_COLORS.light;
  const bgColor = prefs.backgroundColor || (colors?.bg ?? '#ffffff');
  const fgColor = prefs.foregroundColor || (colors?.fg ?? '#1f2937');
  const accentColor = prefs.accentColor || (colors?.accent ?? '#2563eb');

  return `
    :root {
      --reader-bg: ${bgColor};
      --reader-fg: ${fgColor};
      --reader-accent: ${accentColor};
    }
    body {
      background-color: var(--reader-bg);
      color: var(--reader-fg);
    }
    a {
      color: var(--reader-accent);
    }
  `;
}

export function generateFontCss(prefs: ReaderPreferences): string {
  const fontFamily = FONT_FAMILIES[prefs.fontFamily] ?? FONT_FAMILIES.system;
  const fontScale = Math.min(2, Math.max(0.8, prefs.fontScale));
  const lineHeight = Math.min(2.5, Math.max(1, prefs.lineHeight));

  return `
    body {
      font-family: ${fontFamily};
      font-size: ${fontScale}rem;
      line-height: ${lineHeight};
    }
  `;
}

export function generateMarginCss(prefs: ReaderPreferences): string {
  const margin = MARGINS[prefs.margin] ?? MARGINS.comfortable;

  return `
    body {
      margin: 0;
      padding: 0;
    }
    .epub-content {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px ${margin};
    }
  `;
}

export function generateDirectionCss(prefs: ReaderPreferences): string {
  return `
    body {
      direction: ${prefs.readingDirection};
    }
  `;
}

export function generateReaderStyle(prefs: ReaderPreferences): string {
  return [
    generateThemeCss(prefs),
    generateFontCss(prefs),
    generateMarginCss(prefs),
    generateDirectionCss(prefs),
  ].join('\n');
}
