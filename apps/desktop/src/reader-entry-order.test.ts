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

  it('resets the scroll position before measuring progress', () => {
    const renderFn = source.slice(source.indexOf('async function renderChapter'));
    const resetIndex = renderFn.indexOf('scroll.scrollTop = 0');
    const paintIndex = renderFn.indexOf('refreshProgressFromScroll()');

    expect(resetIndex).toBeGreaterThan(-1);
    expect(paintIndex).toBeGreaterThan(resetIndex);
  });
});
