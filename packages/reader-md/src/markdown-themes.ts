import { normalizeReaderMargin, type ReaderPreferences } from '@clio-reader/domain';

const FONT_FAMILIES: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: 'Arial, Helvetica, sans-serif',
  dyslexic: 'OpenDyslexic, Comic Sans MS, sans-serif',
};

const FONT_FAMILIES_UI: Record<string, string> = {
  system: 'var(--read-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: 'Arial, Helvetica, sans-serif',
  dyslexic: 'OpenDyslexic, Comic Sans MS, sans-serif',
};

const BASE_FONT_PX = 19;

export function generateFontCss(prefs: ReaderPreferences): string {
  const family = FONT_FAMILIES[prefs.fontFamily] ?? FONT_FAMILIES.system!;
  const uiFamily = FONT_FAMILIES_UI[prefs.fontFamily] ?? FONT_FAMILIES_UI.system!;
  const scale = Math.min(2, Math.max(0.8, prefs.fontScale));
  const lineHeight = Math.min(2.5, Math.max(1, prefs.lineHeight));
  const fallbackSize = (BASE_FONT_PX * scale).toFixed(2);

  return `
    .page .md-content {
      font-family: ${family};
      font-size: var(--read-size, ${fallbackSize}px);
      line-height: var(--read-lh, ${lineHeight});
      color: var(--read-tx);
    }
    .reader[data-font='sans'] .page .md-content {
      font-family: ${FONT_FAMILIES_UI.sans!};
    }
    .reader[data-font='serif'] .page .md-content {
      font-family: ${uiFamily};
    }
  `;
}

export function generateMarginCss(prefs: ReaderPreferences): string {
  const margin = `${normalizeReaderMargin(prefs.margin)}px`;
  return `
    .page {
      padding-left: var(--read-margin, ${margin});
      padding-right: var(--read-margin, ${margin});
    }
  `;
}

export function generateContentCss(): string {
  return `
    .page .md-content h1,
    .page .md-content h2,
    .page .md-content h3,
    .page .md-content h4,
    .page .md-content h5,
    .page .md-content h6 {
      font-family: inherit;
      font-weight: 600;
      line-height: 1.25;
      margin: 1.4em 0 0.5em;
      color: var(--read-tx);
    }
    .page .md-content h1 { font-size: 2em; }
    .page .md-content h2 { font-size: 1.6em; }
    .page .md-content h3 { font-size: 1.3em; }
    .page .md-content h4 { font-size: 1.1em; }
    .page .md-content h5 { font-size: 1em; }
    .page .md-content h6 { font-size: 0.9em; }
    .page .md-content p { margin: 0 0 1em; }
    .page .md-content ul,
    .page .md-content ol { margin: 0 0 1em; padding-left: 1.6em; }
    .page .md-content li { margin: 0.25em 0; }
    .page .md-content a { color: var(--gold); text-decoration: underline; }
    .page .md-content blockquote {
      margin: 0 0 1em;
      padding: 0.2em 1em;
      border-left: 3px solid rgba(var(--gold-rgb), 0.5);
      color: var(--read-tx-lo);
    }
    .page .md-content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.9em;
      background: rgba(var(--gold-rgb), 0.15);
      border-radius: 4px;
      padding: 0.1em 0.35em;
    }
    .page .md-content pre {
      margin: 0 0 1em;
      padding: 0.9em 1em;
      overflow-x: auto;
      background: rgba(var(--gold-rgb), 0.12);
      border-radius: 8px;
    }
    .page .md-content pre code {
      background: none;
      padding: 0;
      font-size: 0.85em;
      line-height: 1.5;
    }
    .page .md-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 1em;
    }
    .page .md-content th,
    .page .md-content td {
      border: 1px solid rgba(var(--gold-rgb), 0.35);
      padding: 0.4em 0.6em;
      text-align: left;
    }
    .page .md-content hr {
      border: none;
      border-top: 1px solid rgba(var(--gold-rgb), 0.35);
      margin: 1.5em 0;
    }
    .page .md-content img { max-width: 100%; height: auto; }
  `;
}

export function generateReaderStyle(prefs: ReaderPreferences): string {
  return [generateFontCss(prefs), generateMarginCss(prefs), generateContentCss()].join('\n');
}
