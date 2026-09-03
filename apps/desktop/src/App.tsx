/**
 * App.tsx — Componente raíz de Clio Reader
 *
 * Principios aplicados:
 * - DIP: Crea y expone el repository (abstracción) que los hijos consumen
 * - SRP: Solo orquesta la navegación entre vistas, no contiene lógica de negocio
 * - Explícito: Los datos fluyen de arriba hacia abajo via props
 */

import { useState, useCallback, useRef } from 'react';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { useAppLifecycle } from './bridges/lifecycle';
import { bridge } from './bridges/bridge-singleton';
import { LocalRepository } from '@clio-reader/storage';
import { createElectronKVStore } from './bridges/storage';
import { importBook, listBooks, removeBook, generateId } from '@clio-reader/library';
import type { Book, BookFormat } from '@clio-reader/domain';
import { detectBookFormat } from '@clio-reader/reader-core';

/* ==========================================================================
   Dependencias — DIP: se crean una vez y se inyectan
   ========================================================================== */

const store = createElectronKVStore();
const repository = new LocalRepository(store);

/* ==========================================================================
   Componente raíz
   ========================================================================== */

interface OpenBook {
  readonly id: string;
  readonly uri: string;
  readonly title: string;
  readonly format: string;
}

export function App(): JSX.Element {
  const [openBook, setOpenBook] = useState<OpenBook | null>(null);
  const [books, setBooks] = useState<readonly Book[]>([]);
  const isLoadingRef = useRef(false);

  /* ----- Ciclo de vida ----- */
  useAppLifecycle(
    () => {
      console.log('App suspendiendo...');
    },
    () => {
      console.log('App reanudando...');
    },
  );

  /* ----- Cargar libros ----- */
  const loadBooks = useCallback(async () => {
    try {
      const loadedBooks = await listBooks(repository, {
        sortBy: 'addedAt',
        sortDirection: 'desc',
      });
      setBooks(loadedBooks);
    } catch (err) {
      console.error('Error al cargar libros:', err);
    }
  }, []);

  /* ----- Importar libro ----- */
  const handleImportBook = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const fileSource = await bridge.pickFile();
      if (!fileSource) return;

      const format = detectBookFormat(fileSource.name);
      if (!format) {
        console.error('Formato no reconocido:', fileSource.name);
        return;
      }

      const id = generateId();
      const title = fileSource.name.replace(/\.[^.]+$/, '');

      await importBook(repository, {
        id,
        title,
        format: format as BookFormat,
        uri: fileSource.uri,
      });

      await loadBooks();
    } catch (err) {
      console.error('Error al importar libro:', err);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadBooks]);

  /* ----- Abrir libro ----- */
  const handleOpenBook = useCallback((book: Book) => {
    setOpenBook({
      id: book.id,
      uri: book.uri,
      title: book.title,
      format: book.format,
    });
  }, []);

  /* ----- Cerrar libro ----- */
  const handleCloseBook = useCallback(() => {
    setOpenBook(null);
  }, []);

  /* ----- Eliminar libro ----- */
  const handleRemoveBook = useCallback(
    async (bookId: string, bookTitle: string) => {
      const confirmed = window.confirm(`¿Estás seguro de que quieres eliminar "${bookTitle}"?`);
      if (!confirmed) return;

      try {
        await removeBook(repository, bookId);
        await loadBooks();
      } catch (err) {
        console.error('Error al eliminar libro:', err);
      }
    },
    [loadBooks],
  );

  /* ----- Renderizado ----- */
  if (openBook) {
    return (
      <ReaderView
        bookId={openBook.id}
        fileUri={openBook.uri}
        format={openBook.format}
        repository={repository}
        onClose={handleCloseBook}
      />
    );
  }

  return (
    <LibraryView
      books={books}
      onOpenBook={handleOpenBook}
      onImportBook={handleImportBook}
      onRemoveBook={handleRemoveBook}
      onLoadBooks={loadBooks}
    />
  );
}
