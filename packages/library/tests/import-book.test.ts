import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@clio-reader/storage';

import { DuplicateBookError } from '../src/errors.js';
import { importBook } from '../src/import-book.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('importBook', () => {
  it('imports a book and returns it', async () => {
    const repo = createRepo();
    const book = await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'epub',
      uri: 'file:///book.epub',
    });

    expect(book.id).toBe('book-1');
    expect(book.title).toBe('My Book');
    expect(book.format).toBe('epub');
    expect(book.status).toBe('available');
  });

  it('persists the book in the repository', async () => {
    const repo = createRepo();
    const book = await importBook(repo, {
      id: 'book-1',
      title: 'My Book',
      format: 'pdf',
      uri: 'file:///book.pdf',
    });

    const books = await repo.listBooks();
    expect(books).toHaveLength(1);
    expect(books[0]!.id).toBe(book.id);
  });

  it('throws DuplicateBookError for duplicate id', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'First',
      format: 'epub',
      uri: 'file:///first.epub',
    });

    await expect(
      importBook(repo, {
        id: 'book-1',
        title: 'Second',
        format: 'epub',
        uri: 'file:///second.epub',
      }),
    ).rejects.toBeInstanceOf(DuplicateBookError);
  });

  it('allows importing books with different ids', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'First',
      format: 'epub',
      uri: 'file:///first.epub',
    });
    await importBook(repo, {
      id: 'book-2',
      title: 'Second',
      format: 'pdf',
      uri: 'file:///second.pdf',
    });

    const books = await repo.listBooks();
    expect(books).toHaveLength(2);
  });

  it('rejects empty title via domain validation', async () => {
    const repo = createRepo();

    await expect(
      importBook(repo, {
        id: 'book-1',
        title: '',
        format: 'epub',
        uri: 'file:///book.epub',
      }),
    ).rejects.toThrow();
  });

  it('rejects empty id via domain validation', async () => {
    const repo = createRepo();

    await expect(
      importBook(repo, {
        id: '',
        title: 'My Book',
        format: 'epub',
        uri: 'file:///book.epub',
      }),
    ).rejects.toThrow();
  });

  it('rejects empty uri via domain validation', async () => {
    const repo = createRepo();

    await expect(
      importBook(repo, {
        id: 'book-1',
        title: 'My Book',
        format: 'epub',
        uri: '',
      }),
    ).rejects.toThrow();
  });
});
