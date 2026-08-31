import {
  createReadingProgress,
  type ReaderLocator,
  type ReadingProgress,
} from '@echo-reader/domain';

import type { SessionRepository } from './session-repository.js';

export interface ProgressSaverOptions {
  readonly debounceMs?: number;
}

export class ProgressSaver {
  private readonly debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingBookId: string | null = null;
  private pendingLocator: ReaderLocator | null = null;
  private saveCount = 0;

  constructor(options: ProgressSaverOptions = {}) {
    this.debounceMs = options.debounceMs ?? 800;
  }

  scheduleSave(
    bookId: string,
    locator: ReaderLocator,
    repository: SessionRepository,
    percent: number,
  ): void {
    this.pendingBookId = bookId;
    this.pendingLocator = locator;

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.executeSave(repository, percent);
    }, this.debounceMs);
  }

  async flush(repository: SessionRepository): Promise<ReadingProgress | undefined> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingBookId !== null && this.pendingLocator !== null) {
      const bookId = this.pendingBookId;
      const locator = this.pendingLocator;
      const progress = createReadingProgress({ bookId, locator, percent: 0 });
      await repository.saveProgress(progress);
      this.pendingBookId = null;
      this.pendingLocator = null;
      this.saveCount++;
      return progress;
    }

    return undefined;
  }

  flushWithPercent(
    bookId: string,
    locator: ReaderLocator,
    percent: number,
    repository: SessionRepository,
  ): Promise<ReadingProgress | undefined> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const progress = createReadingProgress({ bookId, locator, percent });
    const savePromise = repository.saveProgress(progress).then(() => {
      this.pendingBookId = null;
      this.pendingLocator = null;
      this.saveCount++;
      return progress;
    });

    this.pendingBookId = null;
    this.pendingLocator = null;

    return savePromise;
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingBookId = null;
    this.pendingLocator = null;
  }

  get hasPendingSave(): boolean {
    return this.timer !== null;
  }

  get currentSaveCount(): number {
    return this.saveCount;
  }

  private async executeSave(repository: SessionRepository, percent: number): Promise<void> {
    const bookId = this.pendingBookId;
    const locator = this.pendingLocator;

    if (bookId === null || locator === null) {
      return;
    }

    this.pendingBookId = null;
    this.pendingLocator = null;

    const progress = createReadingProgress({ bookId, locator, percent });
    await repository.saveProgress(progress);
    this.saveCount++;
  }
}
