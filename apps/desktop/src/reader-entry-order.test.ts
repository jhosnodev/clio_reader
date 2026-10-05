import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'reader-entry.ts'), 'utf8');

describe('reader-entry initialisation order', () => {
  it('creates the progress bar before the first chapter render', () => {
    const setupIndex = source.indexOf('setupProgressBar(currentReaderDoc, currentPreferences)');
    const renderIndex = source.indexOf('await renderChapter(currentReaderDoc, currentPreferences)');

    expect(setupIndex).toBeGreaterThan(-1);
    expect(renderIndex).toBeGreaterThan(-1);
    expect(setupIndex).toBeLessThan(renderIndex);
  });

  it('applies the scroll position before measuring progress', () => {
    const renderFn = source.slice(source.indexOf('async function renderChapter'));
    const resetIndex = renderFn.indexOf('applyScrollRatio(scroll, restoreRatio)');
    const paintIndex = renderFn.indexOf('refreshProgressFromScroll()');

    expect(resetIndex).toBeGreaterThan(-1);
    expect(paintIndex).toBeGreaterThan(resetIndex);
  });

  it('re-applies the restored position once the layout settles', () => {
    expect(source).toContain('scheduleScrollSettle(scroll, restoreRatio)');
    expect(source).toContain('function scheduleScrollSettle');
  });

  it('keeps the locator in sync while scrolling inside a chapter', () => {
    const setup = source.slice(source.indexOf('function setupProgressBar'));
    const scrollIndex = setup.indexOf("'scroll'");
    const refreshIndex = setup.indexOf('scheduleLocatorRefresh()');

    expect(scrollIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(scrollIndex);
  });

  it('forwards the saved position when resuming a chapter', () => {
    expect(source).toContain('renderChapter(currentReaderDoc, currentPreferences, restoreRatio)');
  });
});
