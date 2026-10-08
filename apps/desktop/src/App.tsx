/**
 * App.tsx — Componente raíz de Clio Reader
 *
 * Principios aplicados:
 * - DIP: Crea y expone el repository (abstracción) que los hijos consumen
 * - SRP: Solo orquesta la navegación entre vistas, no contiene lógica de negocio
 * - Explícito: Los datos fluyen de arriba hacia abajo via props
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { useAppLifecycle } from './bridges/lifecycle';
import { bridge } from './bridges/bridge-singleton';
import { createDatabaseBridge } from './bridges/database';
import { importBook, listBooks, removeBook, generateId } from '@clio-reader/library';
import type { Book } from '@clio-reader/domain';
import { detectBookFormat } from '@clio-reader/reader-core';
import { parseEpub, extractCoverImage } from '@clio-reader/reader-epub';
import { PdfReaderDocument } from '@clio-reader/reader-pdf';
import { CbzReaderDocument } from '@clio-reader/reader-cbz';
import { applyTheme, savePalettePreference, loadPalettePreference, getPalette } from './themes';

/* ==========================================================================
   Dependencias — DIP: se crean una vez y se inyectan
   ========================================================================== */

const repository = createDatabaseBridge();

/* ==========================================================================
   Componente raíz
   ========================================================================== */

interface OpenBook {
  readonly id: string;
  readonly uri: string;
  readonly title: string;
  readonly author?: string | undefined;
  readonly coverImage?: string | undefined;
  readonly format: string;
  readonly rank?: number | undefined;
  readonly initialLocator?: string | undefined;
}

export interface ImportProgress {
  readonly total: number;
  readonly imported: number;
  readonly skipped: number;
  readonly current: string;
}

export function App(): JSX.Element {
  const [openBook, setOpenBook] = useState<OpenBook | null>(null);
  const [books, setBooks] = useState<readonly Book[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // Theme state: palette ID + dark/light mode
  const [paletteId, setPaletteId] = useState<string>(() => {
    const saved = loadPalettePreference();
    return saved?.id ?? 'clio-0';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = loadPalettePreference();
    if (saved) return saved.mode;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const isLoadingRef = useRef(false);

  // Apply theme to DOM whenever paletteId or theme changes
  useEffect(() => {
    applyTheme(paletteId, theme);
    savePalettePreference(paletteId, theme);
  }, [paletteId, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setPalette = useCallback((id: string) => {
    setPaletteId(id);
  }, []);

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
      console.log('[loadBooks] cargando libros...');
      const loadedBooks = await listBooks(repository, {
        sortBy: 'addedAt',
        sortDirection: 'desc',
      });
      console.log('[loadBooks] libros cargados:', loadedBooks.length);
      setBooks(loadedBooks);
    } catch (err) {
      console.error('[loadBooks] error:', err);
    }
  }, []);

  /* ----- Importar libro ----- */
  const handleImportBook = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      console.log('[import] picker abierto');
      const fileSource = await bridge.pickFile();
      console.log('[import] archivo seleccionado:', fileSource);
      if (!fileSource) {
        console.log('[import] cancelado por el usuario');
        return;
      }

      const format = detectBookFormat(fileSource.name);
      console.log('[import] archivo:', fileSource.name, 'formato detectado:', format);

      const id = generateId();
      let title = fileSource.name.replace(/\.[^.]+$/, '');
      let author: string | undefined;
      let coverImage: string | undefined;
      let language: string | undefined;

      const rawData = await bridge.readFile(fileSource.uri);
      if (format === 'epub') {
        try {
          const parsed = await parseEpub(rawData);
          if (parsed.opf.metadata.title) title = parsed.opf.metadata.title;
          if (parsed.opf.metadata.creator) author = parsed.opf.metadata.creator;
          if (parsed.opf.metadata.language) language = parsed.opf.metadata.language;
          const coverResult = await extractCoverImage(rawData, parsed);
          if (coverResult) {
            const base64 = btoa(
              Array.from(coverResult.data)
                .map((byte) => String.fromCharCode(byte))
                .join(''),
            );
            coverImage = `data:${coverResult.mimeType};base64,${base64}`;
          }
        } catch (err) {
          console.warn('[import] error extrayendo metadata del EPUB:', err);
        }
      } else if (format === 'pdf') {
        try {
          const doc = new PdfReaderDocument({ uri: fileSource.uri, name: fileSource.name });
          await doc.open(rawData);
          try {
            const meta = await doc.getMetadata();
            if (meta?.title) title = meta.title;
            if (meta?.author) author = meta.author;
          } catch {
            // sin datos disponibles
          }
          try {
            const cover = await doc.getCoverImageDataUrl(0.3);
            if (cover) coverImage = cover;
          } catch {
            // sin datos disponibles
          }
          await doc.close();
        } catch (err) {
          console.warn('[import] error extrayendo metadata del PDF:', err);
        }
      } else if (format === 'cbz') {
        try {
          const doc = new CbzReaderDocument({ uri: fileSource.uri, name: fileSource.name });
          await doc.open(rawData);
          try {
            const meta = await doc.getMetadata();
            if (meta?.title) title = meta.title;
            if (meta?.author) author = meta.author;
          } catch {
            // sin datos disponibles
          }
          try {
            const cover = await doc.getCoverImageDataUrl();
            if (cover) coverImage = cover;
          } catch {
            // sin datos disponibles
          }
          await doc.close();
        } catch (err) {
          console.warn('[import] error extrayendo metadata del CBZ:', err);
        }
      }

      console.log('[import] guardando libro:', { id, title, author, uri: fileSource.uri });
      await importBook(repository, {
        id,
        title,
        author,
        format,
        uri: fileSource.uri,
        coverImage,
        language,
      });
      console.log('[import] libro guardado');

      await loadBooks();
      console.log('[import] lista de libros recargada');
    } catch (err) {
      console.error('[import] error:', err);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadBooks]);

  /* ----- Importar múltiples archivos ----- */
  const handleImportFiles = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      console.log('[importFiles] picker abierto');
      const fileSources = await bridge.pickFiles();
      console.log('[importFiles] archivos seleccionados:', fileSources.length);
      if (fileSources.length === 0) {
        console.log('[importFiles] cancelado por el usuario');
        return;
      }

      let imported = 0;
      let skipped = 0;

      for (let i = 0; i < fileSources.length; i++) {
        const fileSource = fileSources[i]!;
        setImportProgress({
          total: fileSources.length,
          imported,
          skipped,
          current: fileSource.name,
        });

        try {
          const format = detectBookFormat(fileSource.name);
          const id = generateId();
          let title = fileSource.name.replace(/\.[^.]+$/, '');
          let author: string | undefined;
          let coverImage: string | undefined;

          const rawData = await bridge.readFile(fileSource.uri);
          if (format === 'epub') {
            try {
              const parsed = await parseEpub(rawData);
              if (parsed.opf.metadata.title) title = parsed.opf.metadata.title;
              if (parsed.opf.metadata.creator) author = parsed.opf.metadata.creator;
              const coverResult = await extractCoverImage(rawData, parsed);
              if (coverResult) {
                const base64 = btoa(
                  Array.from(coverResult.data)
                    .map((byte) => String.fromCharCode(byte))
                    .join(''),
                );
                coverImage = `data:${coverResult.mimeType};base64,${base64}`;
              }
            } catch (err) {
              console.warn('[importFiles] error extrayendo metadata del EPUB:', err);
            }
          } else if (format === 'pdf') {
            try {
              const doc = new PdfReaderDocument({ uri: fileSource.uri, name: fileSource.name });
              await doc.open(rawData);
              try {
                const meta = await doc.getMetadata();
                if (meta?.title) title = meta.title;
                if (meta?.author) author = meta.author;
              } catch {
                // sin datos disponibles
              }
              try {
                const cover = await doc.getCoverImageDataUrl(0.3);
                if (cover) coverImage = cover;
              } catch {
                // sin datos disponibles
              }
              await doc.close();
            } catch (err) {
              console.warn('[importFiles] error extrayendo metadata del PDF:', err);
            }
          } else if (format === 'cbz') {
            try {
              const doc = new CbzReaderDocument({ uri: fileSource.uri, name: fileSource.name });
              await doc.open(rawData);
              try {
                const meta = await doc.getMetadata();
                if (meta?.title) title = meta.title;
                if (meta?.author) author = meta.author;
              } catch {
                // sin datos disponibles
              }
              try {
                const cover = await doc.getCoverImageDataUrl();
                if (cover) coverImage = cover;
              } catch {
                // sin datos disponibles
              }
              await doc.close();
            } catch (err) {
              console.warn('[importFiles] error extrayendo metadata del CBZ:', err);
            }
          }

          await importBook(repository, {
            id,
            title,
            author,
            format,
            uri: fileSource.uri,
            coverImage,
          });
          imported++;
          console.log('[importFiles] libro importado:', title);
        } catch (err) {
          if (err instanceof Error && err.name === 'DuplicateBookError') {
            skipped++;
            console.log('[importFiles] libro duplicado, omitido:', fileSource.name);
          } else {
            console.error('[importFiles] error importando:', fileSource.name, err);
          }
        }
      }

      setImportProgress(null);
      await loadBooks();
      console.log(`[importFiles] completado: ${imported} importados, ${skipped} omitidos`);
    } catch (err) {
      console.error('[importFiles] error:', err);
      setImportProgress(null);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadBooks]);

  /* ----- Importar desde carpeta ----- */
  const handleImportFolder = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      console.log('[importFolder] seleccionando carpeta...');
      const folderPath = await bridge.pickFolder();
      console.log('[importFolder] carpeta seleccionada:', folderPath);
      if (!folderPath) {
        console.log('[importFolder] cancelado por el usuario');
        return;
      }

      console.log('[importFolder] leyendo archivos de la carpeta...');
      const fileSources = await bridge.readFolderBooks(folderPath);
      console.log('[importFolder] archivos encontrados:', fileSources.length);

      if (fileSources.length === 0) {
        console.log('[importFolder] no se encontraron libros en la carpeta');
        setImportProgress(null);
        return;
      }

      let imported = 0;
      let skipped = 0;

      for (let i = 0; i < fileSources.length; i++) {
        const fileSource = fileSources[i]!;
        setImportProgress({
          total: fileSources.length,
          imported,
          skipped,
          current: fileSource.name,
        });

        try {
          const format = detectBookFormat(fileSource.name);
          const id = generateId();
          let title = fileSource.name.replace(/\.[^.]+$/, '');
          let author: string | undefined;
          let coverImage: string | undefined;

          const rawData = await bridge.readFile(fileSource.uri);
          if (format === 'epub') {
            try {
              const parsed = await parseEpub(rawData);
              if (parsed.opf.metadata.title) title = parsed.opf.metadata.title;
              if (parsed.opf.metadata.creator) author = parsed.opf.metadata.creator;
              const coverResult = await extractCoverImage(rawData, parsed);
              if (coverResult) {
                const base64 = btoa(
                  Array.from(coverResult.data)
                    .map((byte) => String.fromCharCode(byte))
                    .join(''),
                );
                coverImage = `data:${coverResult.mimeType};base64,${base64}`;
              }
            } catch (err) {
              console.warn('[importFolder] error extrayendo metadata del EPUB:', err);
            }
          } else if (format === 'pdf') {
            try {
              const doc = new PdfReaderDocument({ uri: fileSource.uri, name: fileSource.name });
              await doc.open(rawData);
              try {
                const meta = await doc.getMetadata();
                if (meta?.title) title = meta.title;
                if (meta?.author) author = meta.author;
              } catch {
                // sin datos disponibles
              }
              try {
                const cover = await doc.getCoverImageDataUrl(0.3);
                if (cover) coverImage = cover;
              } catch {
                // sin datos disponibles
              }
              await doc.close();
            } catch (err) {
              console.warn('[importFolder] error extrayendo metadata del PDF:', err);
            }
          } else if (format === 'cbz') {
            try {
              const doc = new CbzReaderDocument({ uri: fileSource.uri, name: fileSource.name });
              await doc.open(rawData);
              try {
                const meta = await doc.getMetadata();
                if (meta?.title) title = meta.title;
                if (meta?.author) author = meta.author;
              } catch {
                // sin datos disponibles
              }
              try {
                const cover = await doc.getCoverImageDataUrl();
                if (cover) coverImage = cover;
              } catch {
                // sin datos disponibles
              }
              await doc.close();
            } catch (err) {
              console.warn('[importFolder] error extrayendo metadata del CBZ:', err);
            }
          }

          await importBook(repository, {
            id,
            title,
            author,
            format,
            uri: fileSource.uri,
            coverImage,
          });
          imported++;
          console.log('[importFolder] libro importado:', title);
        } catch (err) {
          if (err instanceof Error && err.name === 'DuplicateBookError') {
            skipped++;
            console.log('[importFolder] libro duplicado, omitido:', fileSource.name);
          } else {
            console.error('[importFolder] error importando:', fileSource.name, err);
          }
        }
      }

      setImportProgress(null);
      await loadBooks();
      console.log(`[importFolder] completado: ${imported} importados, ${skipped} omitidos`);
    } catch (err) {
      console.error('[importFolder] error:', err);
      setImportProgress(null);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadBooks]);

  /* ----- Abrir libro ----- */
  const handleOpenBook = useCallback(
    async (book: Book, initialLocator?: string) => {
      console.log('[openBook]', book.id, book.title);
      await repository.upsertBook({
        ...book,
        lastOpenedAt: Date.now(),
        readingStatus: 'reading',
      });
      setOpenBook({
        id: book.id,
        uri: book.uri,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        format: book.format,
        rank: book.rank,
        initialLocator,
      });
    },
    [repository],
  );

  /* ----- Cerrar libro ----- */
  const handleCloseBook = useCallback(() => {
    console.log('[closeBook]');
    setOpenBook(null);
    loadBooks();
  }, [loadBooks]);

  /* ----- Guardar ranking desde el reader ----- */
  const handleSaveRankFromReader = useCallback(
    async (rank: number) => {
      if (!openBook) return;
      const book = await repository.getBook(openBook.id);
      if (!book) return;
      await repository.upsertBook({ ...book, rank: rank as import('@clio-reader/domain').Rank });
      setOpenBook((prev) => (prev ? { ...prev, rank } : prev));
      loadBooks();
    },
    [openBook, repository, loadBooks],
  );

  /* ----- Eliminar libro ----- */
  const handleRemoveBook = useCallback(
    async (bookId: string, bookTitle: string) => {
      const confirmed = window.confirm(`¿Estás seguro de que quieres eliminar "${bookTitle}"?`);
      if (!confirmed) return;

      try {
        console.log('[removeBook]', bookId, bookTitle);
        await removeBook(repository, bookId);
        await loadBooks();
        console.log('[removeBook] eliminado');
      } catch (err) {
        console.error('[removeBook] error:', err);
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
        title={openBook.title}
        author={openBook.author}
        coverImage={openBook.coverImage}
        rank={openBook.rank}
        initialLocator={openBook.initialLocator}
        repository={repository}
        paletteId={paletteId}
        theme={theme}
        onClose={handleCloseBook}
        onSaveRank={handleSaveRankFromReader}
      />
    );
  }

  return (
    <LibraryView
      books={books}
      theme={theme}
      paletteId={paletteId}
      palette={getPalette(paletteId)}
      repository={repository}
      importProgress={importProgress}
      onToggleTheme={toggleTheme}
      onSetPalette={setPalette}
      onOpenBook={handleOpenBook}
      onImportBook={handleImportBook}
      onImportFiles={handleImportFiles}
      onImportFolder={handleImportFolder}
      onRemoveBook={handleRemoveBook}
      onLoadBooks={loadBooks}
    />
  );
}
