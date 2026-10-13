import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'reader-entry.ts'), 'utf8');

describe('reader-entry initialisation order', () => {
  it('creates the progress bar before the first chapter render', () => {
    const init = source.slice(source.indexOf('__initFromHost = async'));
    const setupIndex = init.indexOf('setupProgressBar(currentReaderDoc, currentPreferences)');
    const renderIndex = init.indexOf('await renderChapter(currentReaderDoc, currentPreferences)');

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

  it('registers keyboard navigation together with the other reader controls', () => {
    const init = source.slice(source.indexOf('__initFromHost = async'));
    const setupIndex = init.indexOf('setupNavigation(currentReaderDoc, currentPreferences)');
    const keyboardIndex = init.indexOf('setupKeyboardNavigation()');

    expect(setupIndex).toBeGreaterThan(-1);
    expect(keyboardIndex).toBeGreaterThan(setupIndex);
  });

  it('maps ArrowUp/ArrowDown to vertical scrolling within the chapter', () => {
    const nav = source.slice(source.indexOf('function keyboardDirectionForKey'));
    expect(nav).toContain("case 'ArrowUp'");
    expect(nav).toContain("case 'ArrowDown'");
    expect(nav).toContain('scrollWithinChapter');
    expect(nav).toContain('event.preventDefault()');
  });

  it('maps ArrowLeft/ArrowRight to previous/next chapter', () => {
    const nav = source.slice(source.indexOf('function keyboardDirectionForKey'));
    expect(nav).toContain("case 'ArrowLeft'");
    expect(nav).toContain("case 'ArrowRight'");
    expect(nav).toContain('navigateChapter(readerDoc, currentPreferences');
  });

  it('does not scroll when the chapter is not scrollable', () => {
    expect(source).toContain('if (maxScroll <= 0) return false;');
    expect(source).toContain('function scrollWithinChapter');
  });

  it('shows the selection widget instead of opening the notes drawer', () => {
    const apply = source.slice(
      source.indexOf('function applyPendingSelection'),
      source.indexOf('function hideSelectionWidget'),
    );
    expect(apply).toContain('showSelectionWidget()');
    expect(apply).not.toContain("openDrawer('notes', 'Notas', { scrim: false })");
  });

  it('defines the pending highlights queue and its delete queue', () => {
    expect(source).toContain('window.__pendingHighlights');
    expect(source).toContain('window.__pendingHighlightDeletes');
    expect(source).toContain('function enqueueHighlightDelete');
  });

  it('repaints highlights together with note highlights', () => {
    const refresh = source.slice(source.indexOf('function refreshHighlightHighlights'));
    expect(refresh).toContain('paintHighlightRanges(byName)');
    expect(refresh).toContain('resolveAnchorRange(index, locator, highlight.selectedText)');
  });

  it('updates highlight state from the host after draining', () => {
    const init = source.slice(source.indexOf('__initFromHost = async'));
    expect(init).toContain('currentHighlights = data.highlights ?? []');
    expect(source).toContain('window.__updateHighlights');
  });
});
