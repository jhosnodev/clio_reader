import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@echo-reader/storage';

import { ProgressSaver } from '../src/progress-saver.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('ProgressSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves progress after debounce delay', async () => {
    const repo = createRepo();
    const saver = new ProgressSaver({ debounceMs: 500 });

    saver.scheduleSave('book-1', { format: 'pdf', page: 5 }, repo, 0.25);

    expect(saver.hasPendingSave).toBe(true);

    await vi.advanceTimersByTimeAsync(500);

    expect(saver.hasPendingSave).toBe(false);

    const saved = await repo.getProgress('book-1');
    expect(saved).toBeDefined();
    expect(saved!.bookId).toBe('book-1');
    expect(saved!.locator).toEqual({ format: 'pdf', page: 5 });
    expect(saver.currentSaveCount).toBe(1);
  });

  it('resets debounce timer on subsequent saves', async () => {
    const repo = createRepo();
    const saver = new ProgressSaver({ debounceMs: 500 });

    saver.scheduleSave('book-1', { format: 'pdf', page: 1 }, repo, 0.1);
    await vi.advanceTimersByTimeAsync(300);

    saver.scheduleSave('book-1', { format: 'pdf', page: 5 }, repo, 0.5);
    await vi.advanceTimersByTimeAsync(300);

    expect(saver.hasPendingSave).toBe(true);

    await vi.advanceTimersByTimeAsync(200);

    const saved = await repo.getProgress('book-1');
    expect(saved!.locator).toEqual({ format: 'pdf', page: 5 });
    expect(saver.currentSaveCount).toBe(1);
  });

  it('flush saves immediately and returns progress', async () => {
    const repo = createRepo();
    const saver = new ProgressSaver({ debounceMs: 5000 });

    saver.scheduleSave('book-1', { format: 'pdf', page: 3 }, repo, 0.15);

    const result = await saver.flush(repo);

    expect(result).toBeDefined();
    expect(result!.bookId).toBe('book-1');
    expect(saver.hasPendingSave).toBe(false);
    expect(saver.currentSaveCount).toBe(1);
  });

  it('flush returns undefined when nothing pending', async () => {
    const repo = createRepo();
    const saver = new ProgressSaver();

    const result = await saver.flush(repo);

    expect(result).toBeUndefined();
    expect(saver.currentSaveCount).toBe(0);
  });

  it('cancel discards pending save', async () => {
    const repo = createRepo();
    const saver = new ProgressSaver({ debounceMs: 500 });

    saver.scheduleSave('book-1', { format: 'pdf', page: 5 }, repo, 0.5);
    saver.cancel();

    expect(saver.hasPendingSave).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);

    const saved = await repo.getProgress('book-1');
    expect(saved).toBeUndefined();
    expect(saver.currentSaveCount).toBe(0);
  });

  it('flushWithPercent saves with explicit percent', async () => {
    const repo = createRepo();
    const saver = new ProgressSaver();

    const result = await saver.flushWithPercent(
      'book-1',
      { format: 'epub', href: 'ch1.xhtml' },
      0.75,
      repo,
    );

    expect(result).toBeDefined();
    expect(result!.bookId).toBe('book-1');
    expect(result!.percent).toBe(0.75);
    expect(result!.locator).toEqual({ format: 'epub', href: 'ch1.xhtml' });
    expect(saver.currentSaveCount).toBe(1);
  });
});
