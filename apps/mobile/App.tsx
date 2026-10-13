import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import type { Book, Rank } from '@clio-reader/domain';
import { listBooks, removeBook, type LibraryRepository } from '@clio-reader/library';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { useAppLifecycle } from './src/bridges/lifecycle';
import { createMobileBridge } from './src/bridges/mobile-bridge';
import { createRepository } from './src/repository';
import { importFileToLibrary } from './src/library/import-book';

const repository: LibraryRepository = createRepository();
const bridge = createMobileBridge();

export default function App(): JSX.Element {
  const [books, setBooks] = useState<readonly Book[]>([]);
  const [progressByBook, setProgressByBook] = useState<Record<string, number>>({});
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [importing, setImporting] = useState(false);

  const loadBooks = useCallback(async (): Promise<void> => {
    try {
      const loaded = await listBooks(repository, { sortBy: 'addedAt', sortDirection: 'desc' });
      setBooks(loaded);
      const progress = await repository.listAllProgress();
      const map: Record<string, number> = {};
      for (const item of progress) {
        map[item.bookId] = Math.round(item.percent);
      }
      setProgressByBook(map);
    } catch (err) {
      console.warn('[mobile] error cargando biblioteca:', err);
    }
  }, []);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useAppLifecycle(
    () => {
      console.log('[mobile] app suspendida');
    },
    () => {
      console.log('[mobile] app reanudada');
      void loadBooks();
    },
  );

  const handleImportBook = useCallback(async (): Promise<void> => {
    if (importing) return;
    setImporting(true);
    try {
      const fileSource = await bridge.pickFile();
      if (!fileSource) return;
      await importFileToLibrary(bridge, repository, fileSource);
      await loadBooks();
    } catch (err) {
      console.warn('[mobile] error importando libro:', err);
    } finally {
      setImporting(false);
    }
  }, [importing, loadBooks]);

  const handleOpenBook = useCallback(async (book: Book): Promise<void> => {
    try {
      await repository.upsertBook({
        ...book,
        lastOpenedAt: Date.now(),
        readingStatus: 'reading',
      });
    } catch (err) {
      console.warn('[mobile] error marcando libro como abierto:', err);
    }
    setOpenBook(book);
  }, []);

  const handleCloseBook = useCallback((): void => {
    setOpenBook(null);
    void loadBooks();
  }, [loadBooks]);

  const handleRemoveBook = useCallback(
    async (book: Book): Promise<void> => {
      try {
        await removeBook(repository, book.id);
        await loadBooks();
      } catch (err) {
        console.warn('[mobile] error eliminando libro:', err);
      }
    },
    [loadBooks],
  );

  const handleSaveRank = useCallback(
    async (book: Book, rank: Rank): Promise<void> => {
      try {
        await repository.upsertBook({ ...book, rank });
        await loadBooks();
      } catch (err) {
        console.warn('[mobile] error guardando rank:', err);
      }
    },
    [loadBooks],
  );

  if (openBook) {
    return (
      <SafeAreaView style={styles.container}>
        <ReaderScreen
          bookId={openBook.id}
          fileUri={openBook.uri}
          format={openBook.format}
          title={openBook.title}
          author={openBook.author}
          coverImage={openBook.coverImage}
          rank={openBook.rank}
          bridge={bridge}
          repository={repository}
          onClose={handleCloseBook}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LibraryScreen
        books={books}
        progressByBook={progressByBook}
        importing={importing}
        onOpenBook={handleOpenBook}
        onImportBook={handleImportBook}
        onRemoveBook={handleRemoveBook}
        onSaveRank={handleSaveRank}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100f18',
  },
});
