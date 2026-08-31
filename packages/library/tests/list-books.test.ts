import { describe, expect, it } from 'vitest';

import { InMemoryKeyValueStore, LocalRepository } from '@echo-reader/storage';

import { importBook } from '../src/import-book.js';
import { listBooks } from '../src/list-books.js';

function createRepo(): LocalRepository {
  return new LocalRepository(new InMemoryKeyValueStore());
}

describe('listBooks', () => {
  it('returns empty array when no books exist', async () => {
    const repo = createRepo();
    const books = await listBooks(repo);
    expect(books).toEqual([]);
  });

  it('returns all books', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'First',
      format: 'epub',
      uri: 'file:///first.epub',
      addedAt: 1,
    });
    await importBook(repo, {
      id: 'book-2',
      title: 'Second',
      format: 'pdf',
      uri: 'file:///second.pdf',
      addedAt: 2,
    });

    const books = await listBooks(repo);
    expect(books).toHaveLength(2);
  });

  it('filters by format', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'Epub Book',
      format: 'epub',
      uri: 'file:///book1.epub',
    });
    await importBook(repo, {
      id: 'book-2',
      title: 'Pdf Book',
      format: 'pdf',
      uri: 'file:///book2.pdf',
    });
    await importBook(repo, {
      id: 'book-3',
      title: 'Another Epub',
      format: 'epub',
      uri: 'file:///book3.epub',
    });

    const epubBooks = await listBooks(repo, { format: 'epub' });
    expect(epubBooks).toHaveLength(2);
    expect(epubBooks.every((b) => b.format === 'epub')).toBe(true);

    const pdfBooks = await listBooks(repo, { format: 'pdf' });
    expect(pdfBooks).toHaveLength(1);
  });

  it('sorts by title ascending', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-c',
      title: 'Charlie',
      format: 'epub',
      uri: 'file:///c.epub',
    });
    await importBook(repo, {
      id: 'book-a',
      title: 'Alice',
      format: 'epub',
      uri: 'file:///a.epub',
    });
    await importBook(repo, {
      id: 'book-b',
      title: 'Bob',
      format: 'epub',
      uri: 'file:///b.epub',
    });

    const books = await listBooks(repo, { sortBy: 'title', sortDirection: 'asc' });
    expect(books.map((b) => b.title)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts by title descending', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-c',
      title: 'Charlie',
      format: 'epub',
      uri: 'file:///c.epub',
    });
    await importBook(repo, {
      id: 'book-a',
      title: 'Alice',
      format: 'epub',
      uri: 'file:///a.epub',
    });

    const books = await listBooks(repo, { sortBy: 'title', sortDirection: 'desc' });
    expect(books.map((b) => b.title)).toEqual(['Charlie', 'Alice']);
  });

  it('sorts by addedAt ascending by default', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'Second',
      format: 'epub',
      uri: 'file:///1.epub',
      addedAt: 20,
    });
    await importBook(repo, {
      id: 'book-2',
      title: 'First',
      format: 'epub',
      uri: 'file:///2.epub',
      addedAt: 10,
    });

    const books = await listBooks(repo, { sortBy: 'addedAt' });
    expect(books.map((b) => b.id)).toEqual(['book-2', 'book-1']);
  });

  it('combines filter and sort', async () => {
    const repo = createRepo();
    await importBook(repo, {
      id: 'book-1',
      title: 'Zebra',
      format: 'epub',
      uri: 'file:///z.epub',
      addedAt: 1,
    });
    await importBook(repo, {
      id: 'book-2',
      title: 'Apple',
      format: 'pdf',
      uri: 'file:///a.pdf',
      addedAt: 2,
    });
    await importBook(repo, {
      id: 'book-3',
      title: 'Mango',
      format: 'epub',
      uri: 'file:///m.epub',
      addedAt: 3,
    });

    const books = await listBooks(repo, { format: 'epub', sortBy: 'title' });
    expect(books.map((b) => b.title)).toEqual(['Mango', 'Zebra']);
  });
});
