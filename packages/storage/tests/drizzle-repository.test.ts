import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createFeedback } from '@clio-reader/domain';
import { DrizzleRepository } from '../src/drizzle.js';
import { createInMemoryDatabase } from '../src/drizzle-test.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { BetterSqlite3Connection } from '../src/db-better-sqlite3.js';

describe('DrizzleRepository', () => {
  let dbResult: Awaited<ReturnType<typeof createInMemoryDatabase>> | null = null;
  let repository: DrizzleRepository;

  beforeEach(async () => {
    if (dbResult) {
      dbResult.close();
    }

    dbResult = await createInMemoryDatabase();
    repository = new DrizzleRepository(dbResult.db as unknown as BetterSqlite3Connection);

    const migrationSQL = readFileSync(
      join(__dirname, '../drizzle/0000_initial_no_fts.sql'),
      'utf-8',
    );
    dbResult.rawDb.run(migrationSQL);
  });

  afterAll(() => {
    if (dbResult) {
      dbResult.close();
    }
  });

  describe('Books', () => {
    it('should create and retrieve a book', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        author: 'Test Author',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);
      const books = await repository.listBooks();

      expect(books).toHaveLength(1);
      expect(books[0]!.id).toBe('book-1');
      expect(books[0]!.title).toBe('Test Book');
    });

    it('should update an existing book', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const updatedBook = {
        ...book,
        title: 'Updated Title',
      };

      await repository.upsertBook(updatedBook);
      const books = await repository.listBooks();

      expect(books).toHaveLength(1);
      expect(books[0]!.title).toBe('Updated Title');
    });

    it('should soft delete a book', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);
      await repository.removeBook('book-1');
      const books = await repository.listBooks();

      expect(books).toHaveLength(0);
    });
  });

  describe('Reading Progress', () => {
    it('should save and retrieve reading progress', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const progress = {
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(...)' },
        percent: 0.5,
        updatedAt: Date.now(),
      };

      await repository.saveProgress(progress);
      const retrieved = await repository.getProgress('book-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.percent).toBe(0.5);
    });

    it('should list all progress', async () => {
      const book1 = {
        id: 'book-1',
        title: 'Book 1',
        format: 'epub' as const,
        uri: '/path/to/book1.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      const book2 = {
        id: 'book-2',
        title: 'Book 2',
        format: 'pdf' as const,
        uri: '/path/to/book2.pdf',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book1);
      await repository.upsertBook(book2);

      await repository.saveProgress({
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'ch1', cfi: 'epubcfi(...)' },
        percent: 0.3,
        updatedAt: Date.now(),
      });

      await repository.saveProgress({
        bookId: 'book-2',
        locator: { format: 'pdf' as const, page: 5 },
        percent: 0.7,
        updatedAt: Date.now(),
      });

      const all = await repository.listAllProgress();
      expect(all).toHaveLength(2);
    });
  });

  describe('Preferences', () => {
    it('should save and retrieve global preferences', async () => {
      const prefs = {
        theme: 'dark' as const,
        backgroundColor: '#000000',
        foregroundColor: '#ffffff',
        accentColor: '#ff0000',
        fontFamily: 'serif' as const,
        fontScale: 1.2,
        lineHeight: 1.8,
        margin: 96 as const,
        readingDirection: 'rtl' as const,
      };

      await repository.saveGlobalPreferences(prefs);
      const retrieved = await repository.getGlobalPreferences();

      expect(retrieved.theme).toBe('dark');
      expect(retrieved.fontScale).toBe(1.2);
    });

    it('should save and retrieve book-specific preferences', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const prefs = { fontScale: 1.5 };
      await repository.saveBookPreferences('book-1', prefs);
      const retrieved = await repository.getBookPreferences('book-1');

      expect(retrieved.fontScale).toBe(1.5);
    });
  });

  describe('Bookmarks', () => {
    it('should save and retrieve bookmarks', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const bookmark = {
        id: 'bookmark-1',
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(...)' },
        label: 'My Bookmark',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.saveBookmark(bookmark);
      const bookmarks = await repository.listBookmarks('book-1');

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]!.label).toBe('My Bookmark');
    });

    it('should list all bookmarks', async () => {
      const book1 = {
        id: 'book-1',
        title: 'Book 1',
        format: 'epub' as const,
        uri: '/path/to/book1.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      const book2 = {
        id: 'book-2',
        title: 'Book 2',
        format: 'pdf' as const,
        uri: '/path/to/book2.pdf',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book1);
      await repository.upsertBook(book2);

      await repository.saveBookmark({
        id: 'bm-1',
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'ch1', cfi: 'epubcfi(...)' },
        createdAt: Date.now(),
      });

      await repository.saveBookmark({
        id: 'bm-2',
        bookId: 'book-2',
        locator: { format: 'pdf' as const, page: 3 },
        createdAt: Date.now(),
      });

      const all = await repository.listAllBookmarks();
      expect(all).toHaveLength(2);
    });

    it('should soft delete a bookmark', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const bookmark = {
        id: 'bookmark-1',
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(...)' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.saveBookmark(bookmark);
      await repository.removeBookmark('bookmark-1');
      const bookmarks = await repository.listBookmarks('book-1');

      expect(bookmarks).toHaveLength(0);
    });
  });

  describe('Notes', () => {
    it('should save and retrieve notes', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const note = {
        id: 'note-1',
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(...)' },
        selectedText: 'Important text',
        body: 'This is my note',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.saveNote(note);
      const notes = await repository.listNotes('book-1');

      expect(notes).toHaveLength(1);
      expect(notes[0]!.body).toBe('This is my note');
    });

    it('should persist the text anchor and the quote of a note', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const note = {
        id: 'note-anchor',
        bookId: 'book-1',
        locator: {
          format: 'epub' as const,
          href: 'chapter1',
          positionOrder: 1,
          anchor: { start: 120, end: 134, prefix: 'digo que ', suffix: ' y luego' },
        },
        selectedText: 'texto anudado',
        body: 'Anotación sobre el texto',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.saveNote(note);
      const notes = await repository.listNotes('book-1');

      expect(notes[0]!.selectedText).toBe('texto anudado');
      expect(notes[0]!.locator).toEqual({
        format: 'epub',
        href: 'chapter1',
        positionOrder: 1,
        anchor: { start: 120, end: 134, prefix: 'digo que ', suffix: ' y luego' },
      });
    });

    it('should throw error for empty note body', async () => {
      const note = {
        id: 'note-1',
        bookId: 'book-1',
        locator: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(...)' },
        body: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(repository.saveNote(note)).rejects.toThrow('Note body must not be empty');
    });
  });

  describe('Highlights', () => {
    it('should save and retrieve highlights', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const highlight = {
        id: 'highlight-1',
        bookId: 'book-1',
        locatorStart: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(start)' },
        locatorEnd: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(end)' },
        selectedText: 'Highlighted text',
        color: '#ffff00',
        style: 'highlight' as const,
        note: 'Important!',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.saveHighlight(highlight);
      const highlights = await repository.listHighlights('book-1');

      expect(highlights).toHaveLength(1);
      expect(highlights[0]!.color).toBe('#ffff00');
      expect(highlights[0]!.style).toBe('highlight');
    });

    it('should soft delete a highlight', async () => {
      const book = {
        id: 'book-1',
        title: 'Test Book',
        format: 'epub' as const,
        uri: '/path/to/book.epub',
        addedAt: Date.now(),
        status: 'available' as const,
      };

      await repository.upsertBook(book);

      const highlight = {
        id: 'highlight-1',
        bookId: 'book-1',
        locatorStart: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(start)' },
        locatorEnd: { format: 'epub' as const, href: 'chapter1', cfi: 'epubcfi(end)' },
        color: '#ffff00',
        style: 'highlight' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await repository.saveHighlight(highlight);
      await repository.removeHighlight('highlight-1');
      const highlights = await repository.listHighlights('book-1');

      expect(highlights).toHaveLength(0);
    });
  });

  describe('User Settings', () => {
    it('should return defaults when empty', async () => {
      const settings = await repository.getUserSettings();
      expect(settings.paletteId).toBe('clio-3');
      expect(settings.mode).toBe('dark');
    });

    it('should save and retrieve user settings', async () => {
      await repository.saveUserSettings({ paletteId: 'clio-5', mode: 'light' });
      const settings = await repository.getUserSettings();
      expect(settings.paletteId).toBe('clio-5');
      expect(settings.mode).toBe('light');
    });
  });

  describe('Feedback', () => {
    const makeFeedback = (overrides: Partial<Parameters<typeof createFeedback>[0]> = {}) =>
      createFeedback({
        id: 'fb-1',
        reaction: 'positive',
        message: 'Gran app',
        category: 'praise',
        installationId: 'install-1',
        context: {
          appVersion: '0.1.0',
          platform: 'linux',
          osVersion: '6.8.0',
          area: 'library',
          locale: 'es',
        },
        createdAt: 1_700_000_000_000,
        ...overrides,
      });

    it('should save and retrieve feedback with context', async () => {
      await repository.saveFeedback(makeFeedback());
      const items = await repository.listFeedback();

      expect(items).toHaveLength(1);
      const item = items[0]!;
      expect(item.id).toBe('fb-1');
      expect(item.reaction).toBe('positive');
      expect(item.message).toBe('Gran app');
      expect(item.status).toBe('received');
      expect(item.diagnosticsConsent).toBe(false);
      expect(item.context.appVersion).toBe('0.1.0');
      expect(item.context.platform).toBe('linux');
      expect(item.context.osVersion).toBe('6.8.0');
      expect(item.context.area).toBe('library');
      expect(item.context.locale).toBe('es');
      expect(item.createdAt).toBe(1_700_000_000_000);
    });

    it('should update feedback status and issue url', async () => {
      await repository.saveFeedback(makeFeedback());
      await repository.updateFeedbackStatus('fb-1', 'linked', 'https://example/issues/1');

      const items = await repository.listFeedback();
      expect(items[0]!.status).toBe('linked');
      expect(items[0]!.githubIssueUrl).toBe('https://example/issues/1');
    });

    it('should count feedback by status', async () => {
      await repository.saveFeedback(makeFeedback({ id: 'fb-1', reaction: 'positive' }));
      await repository.saveFeedback(makeFeedback({ id: 'fb-2', reaction: 'negative' }));
      await repository.updateFeedbackStatus('fb-2', 'reviewed');

      expect(await repository.countFeedbackByStatus('received')).toBe(1);
      expect(await repository.countFeedbackByStatus('reviewed')).toBe(1);
    });

    it('should remove feedback', async () => {
      await repository.saveFeedback(makeFeedback());
      await repository.removeFeedback('fb-1');

      expect(await repository.listFeedback()).toHaveLength(0);
    });
  });
});
