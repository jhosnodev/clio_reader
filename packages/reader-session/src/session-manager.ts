import type { Book, ReaderLocator, ReaderPreferences, ReadingProgress } from '@echo-reader/domain';
import type { ReaderAdapter, ReaderDocument, ReaderSessionState } from '@echo-reader/reader-core';
import { transitionReaderSession, INITIAL_READER_SESSION } from '@echo-reader/reader-core';

import { ProgressSaver } from './progress-saver.js';
import { SettingsManager } from './settings-manager.js';
import type { SessionRepository } from './session-repository.js';
import {
  SessionAlreadyOpenError,
  SessionClosedError,
  SessionNotOpenError,
} from './session-errors.js';

export interface SessionManagerOptions {
  readonly debounceMs?: number;
}

export class SessionManager {
  private state: ReaderSessionState = INITIAL_READER_SESSION;
  private currentBook: Book | null = null;
  private currentDocument: ReaderDocument | null = null;
  private currentRepository: SessionRepository | null = null;
  private readonly progressSaver: ProgressSaver;
  private readonly settingsManager: SettingsManager;

  constructor(options: SessionManagerOptions = {}) {
    this.progressSaver = new ProgressSaver(
      options.debounceMs !== undefined ? { debounceMs: options.debounceMs } : {},
    );
    this.settingsManager = new SettingsManager();
  }

  async openBook(
    book: Book,
    adapter: ReaderAdapter,
    repository: SessionRepository,
  ): Promise<ReaderLocator> {
    if (this.currentBook !== null) {
      throw new SessionAlreadyOpenError();
    }

    this.state = transitionReaderSession(this.state, {
      type: 'openRequested',
      source: { uri: book.uri, name: book.title },
      format: book.format,
    });

    this.currentRepository = repository;

    try {
      const document = adapter.createDocument({ uri: book.uri, name: book.title });
      this.currentDocument = document;

      await document.open();

      const locator = await document.getLocator();

      this.currentBook = book;
      this.state = transitionReaderSession(this.state, {
        type: 'opened',
        locator,
      });

      return locator;
    } catch (error) {
      this.state = transitionReaderSession(this.state, {
        type: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
      this.cleanup();
      throw error;
    }
  }

  async closeBook(): Promise<ReadingProgress | undefined> {
    if (this.currentBook === null || this.currentRepository === null) {
      throw new SessionNotOpenError();
    }

    let savedProgress: ReadingProgress | undefined;

    if (this.currentDocument !== null && this.currentRepository !== null) {
      const locator = await this.currentDocument.getLocator();
      savedProgress = await this.progressSaver.flushWithPercent(
        this.currentBook.id,
        locator,
        0,
        this.currentRepository,
      );
    }

    if (this.currentDocument !== null) {
      await this.currentDocument.close();
    }

    this.state = transitionReaderSession(this.state, { type: 'closeRequested' });
    this.cleanup();

    return savedProgress;
  }

  async goNext(): Promise<ReaderLocator> {
    this.assertReady();

    this.state = transitionReaderSession(this.state, { type: 'navigationStarted' });

    try {
      const locator = await this.currentDocument!.goNext();

      this.state = transitionReaderSession(this.state, {
        type: 'locatorChanged',
        locator,
      });

      if (this.currentBook !== null && this.currentRepository !== null) {
        this.progressSaver.scheduleSave(this.currentBook.id, locator, this.currentRepository, 0);
      }

      return locator;
    } catch (error) {
      this.state = transitionReaderSession(this.state, {
        type: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async goPrevious(): Promise<ReaderLocator> {
    this.assertReady();

    this.state = transitionReaderSession(this.state, { type: 'navigationStarted' });

    try {
      const locator = await this.currentDocument!.goPrevious();

      this.state = transitionReaderSession(this.state, {
        type: 'locatorChanged',
        locator,
      });

      if (this.currentBook !== null && this.currentRepository !== null) {
        this.progressSaver.scheduleSave(this.currentBook.id, locator, this.currentRepository, 0);
      }

      return locator;
    } catch (error) {
      this.state = transitionReaderSession(this.state, {
        type: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getLocator(): Promise<ReaderLocator> {
    this.assertReady();
    return this.currentDocument!.getLocator();
  }

  async loadSettings(): Promise<ReaderPreferences> {
    this.assertReady();
    if (this.currentBook === null || this.currentRepository === null) {
      throw new SessionNotOpenError();
    }
    const resolved = await this.settingsManager.loadSettings(
      this.currentBook.id,
      this.currentRepository,
    );
    return resolved.merged;
  }

  async saveSettings(preferences: Partial<ReaderPreferences>): Promise<void> {
    this.assertReady();
    if (this.currentBook === null || this.currentRepository === null) {
      throw new SessionNotOpenError();
    }
    await this.settingsManager.saveBookSettings(
      this.currentBook.id,
      preferences,
      this.currentRepository,
    );
  }

  getState(): ReaderSessionState {
    return this.state;
  }

  get book(): Book | null {
    return this.currentBook;
  }

  get isOpen(): boolean {
    return this.currentBook !== null;
  }

  private assertReady(): void {
    if (this.currentBook === null) {
      throw new SessionNotOpenError();
    }
    if (this.state.status === 'closed') {
      throw new SessionClosedError();
    }
  }

  private cleanup(): void {
    this.progressSaver.cancel();
    this.currentDocument = null;
    this.currentBook = null;
    this.currentRepository = null;
  }
}
