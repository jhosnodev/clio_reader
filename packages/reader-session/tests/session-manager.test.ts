import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Book, ReaderLocator } from '@clio-reader/domain';
import type { ReaderAdapter, ReaderDocument } from '@clio-reader/reader-core';
import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';

import {
  SessionAlreadyOpenError,
  SessionClosedError,
  SessionNotOpenError,
} from '../src/session-errors.js';
import { SessionManager } from '../src/session-manager.js';

const testBook: Book = {
  id: 'book-1',
  title: 'Test Book',
  format: 'pdf',
  uri: 'file:///test.pdf',
  addedAt: Date.now(),
  status: 'available',
};

function createLocator(page: number): ReaderLocator {
  return { format: 'pdf', page };
}

function createFakeDocument(): ReaderDocument {
  let currentPage = 1;
  return {
    format: 'pdf',
    capabilities: {
      reflowable: false,
      supportsFontScale: false,
      supportsZoom: true,
      supportsAnnotations: false,
    },
    open: async () => undefined,
    close: async () => undefined,
    getLocator: async () => createLocator(currentPage),
    goNext: async () => {
      currentPage++;
      return createLocator(currentPage);
    },
    goPrevious: async () => {
      currentPage = Math.max(1, currentPage - 1);
      return createLocator(currentPage);
    },
  };
}

function createAdapter(): ReaderAdapter {
  return {
    format: 'pdf',
    createDocument: () => createFakeDocument(),
  };
}

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('openBook', () => {
    it('transitions to ready state and returns locator', async () => {
      const manager = new SessionManager();
      const repo = createRepo();
      const adapter = createAdapter();

      const locator = await manager.openBook(testBook, adapter, repo);

      expect(locator).toEqual(createLocator(1));
      expect(manager.getState().status).toBe('ready');
      expect(manager.isOpen).toBe(true);
      expect(manager.book?.id).toBe('book-1');
    });

    it('rejects opening a second book', async () => {
      const manager = new SessionManager();
      const repo = createRepo();
      const adapter = createAdapter();

      await manager.openBook(testBook, adapter, repo);

      await expect(manager.openBook(testBook, adapter, repo)).rejects.toBeInstanceOf(
        SessionAlreadyOpenError,
      );
    });

    it('transitions to error on open failure', async () => {
      const manager = new SessionManager();
      const repo = createRepo();
      const failAdapter: ReaderAdapter = {
        format: 'pdf',
        createDocument: () => ({
          ...createFakeDocument(),
          open: async () => {
            throw new Error('disk error');
          },
        }),
      };

      await expect(manager.openBook(testBook, failAdapter, repo)).rejects.toThrow('disk error');
      expect(manager.getState().status).toBe('error');
    });
  });

  describe('closeBook', () => {
    it('saves progress and transitions to closed', async () => {
      const manager = new SessionManager();
      const repo = createRepo();
      const adapter = createAdapter();

      await manager.openBook(testBook, adapter, repo);
      await manager.goNext();

      vi.advanceTimersByTime(1000);

      const progress = await manager.closeBook();

      expect(progress).toBeDefined();
      expect(manager.getState().status).toBe('closed');
      expect(manager.isOpen).toBe(false);
    });

    it('throws when no book is open', async () => {
      const manager = new SessionManager();

      await expect(manager.closeBook()).rejects.toBeInstanceOf(SessionNotOpenError);
    });
  });

  describe('navigation', () => {
    it('goNext returns updated locator', async () => {
      const manager = new SessionManager();
      const repo = createRepo();

      await manager.openBook(testBook, createAdapter(), repo);
      const locator = await manager.goNext();

      expect(locator).toEqual(createLocator(2));
      expect(manager.getState().status).toBe('ready');
    });

    it('goPrevious returns updated locator', async () => {
      const manager = new SessionManager();
      const repo = createRepo();

      await manager.openBook(testBook, createAdapter(), repo);
      await manager.goNext();
      const locator = await manager.goPrevious();

      expect(locator).toEqual(createLocator(1));
      expect(manager.getState().status).toBe('ready');
    });

    it('schedules debounced progress save on navigation', async () => {
      const manager = new SessionManager({ debounceMs: 500 });
      const repo = createRepo();

      await manager.openBook(testBook, createAdapter(), repo);
      await manager.goNext();
      await manager.goNext();
      await manager.goNext();

      await vi.advanceTimersByTimeAsync(500);

      const saved = await repo.getProgress('book-1');
      expect(saved).toBeDefined();
      expect(saved!.locator).toEqual(createLocator(4));
    });

    it('throws when session is not ready', async () => {
      const manager = new SessionManager();

      await expect(manager.goNext()).rejects.toBeInstanceOf(SessionNotOpenError);
    });
  });

  describe('getLocator', () => {
    it('returns current document locator', async () => {
      const manager = new SessionManager();
      const repo = createRepo();

      await manager.openBook(testBook, createAdapter(), repo);
      await manager.goNext();
      await manager.goNext();

      const locator = await manager.getLocator();
      expect(locator).toEqual(createLocator(3));
    });
  });

  describe('settings', () => {
    it('loads merged settings for current book', async () => {
      const manager = new SessionManager();
      const repo = createRepo();

      await repo.saveBookPreferences('book-1', { fontScale: 1.5 });
      await manager.openBook(testBook, createAdapter(), repo);

      const prefs = await manager.loadSettings();
      expect(prefs.fontScale).toBe(1.5);
    });

    it('saves per-book settings', async () => {
      const manager = new SessionManager();
      const repo = createRepo();

      await manager.openBook(testBook, createAdapter(), repo);
      await manager.saveSettings({ lineHeight: 2 });

      const prefs = await repo.getBookPreferences('book-1');
      expect(prefs.lineHeight).toBe(2);
    });
  });

  describe('state after close', () => {
    it('rejects navigation after close', async () => {
      const manager = new SessionManager();
      const repo = createRepo();

      await manager.openBook(testBook, createAdapter(), repo);
      await manager.closeBook();

      await expect(manager.goNext()).rejects.toBeInstanceOf(SessionNotOpenError);
    });
  });
});
