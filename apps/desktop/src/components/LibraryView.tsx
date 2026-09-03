/**
 * LibraryView.tsx — Vista de la biblioteca de libros
 *
 * Principios aplicados:
 * - SRP: Solo muestra libros y maneja interacciones del usuario
 * - DIP: Recibe datos via props, no conoce el repository
 * - ISP: Solo recibe las props que necesita
 * - UI en español
 * - Accesibilidad: roles ARIA, navegación por teclado, contraste
 */

import { useEffect } from 'react';
import type { Book } from '@clio-reader/domain';

/* ==========================================================================
   Props
   ========================================================================== */

interface LibraryViewProps {
  readonly books: readonly Book[];
  readonly onOpenBook: (book: Book) => void;
  readonly onImportBook: () => void;
  readonly onRemoveBook: (bookId: string, bookTitle: string) => void;
  readonly onLoadBooks: () => void;
}

/* ==========================================================================
   Componente
   ========================================================================== */

export function LibraryView({
  books,
  onOpenBook,
  onImportBook,
  onRemoveBook,
  onLoadBooks,
}: LibraryViewProps): JSX.Element {
  useEffect(() => {
    onLoadBooks();
  }, [onLoadBooks]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Clio Reader</h1>
        <button style={styles.importButton} onClick={onImportBook} aria-label="Importar libro">
          Importar libro
        </button>
      </header>

      <main style={styles.content}>
        {books.length === 0 ? (
          <EmptyState />
        ) : (
          <BookGrid books={books} onOpenBook={onOpenBook} onRemoveBook={onRemoveBook} />
        )}
      </main>
    </div>
  );
}

/* ==========================================================================
   Subcomponentes (SRP: cada uno una responsabilidad)
   ========================================================================== */

function EmptyState(): JSX.Element {
  return (
    <div style={styles.emptyState}>
      <p style={styles.emptyText}>No hay libros importados</p>
      <p style={styles.emptyHint}>
        Haz clic en &quot;Importar libro&quot; para agregar tu primer libro.
      </p>
    </div>
  );
}

interface BookGridProps {
  readonly books: readonly Book[];
  readonly onOpenBook: (book: Book) => void;
  readonly onRemoveBook: (bookId: string, bookTitle: string) => void;
}

function BookGrid({ books, onOpenBook, onRemoveBook }: BookGridProps): JSX.Element {
  return (
    <div style={styles.bookGrid}>
      {books.map((book) => (
        <BookCard key={book.id} book={book} onOpen={onOpenBook} onRemove={onRemoveBook} />
      ))}
    </div>
  );
}

interface BookCardProps {
  readonly book: Book;
  readonly onOpen: (book: Book) => void;
  readonly onRemove: (bookId: string, bookTitle: string) => void;
}

function BookCard({ book, onOpen, onRemove }: BookCardProps): JSX.Element {
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(book);
    }
  };

  const handleRemove = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onRemove(book.id, book.title);
  };

  const isMissing = book.status === 'missing';

  return (
    <div
      style={{
        ...styles.bookCard,
        ...(isMissing ? styles['bookCard--missing'] : {}),
      }}
      onClick={() => onOpen(book)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${book.title}`}
    >
      <div style={styles.bookCover}>
        <span style={styles.formatBadge}>{book.format.toUpperCase()}</span>
        {isMissing && <span style={styles.missingBadge}>Archivo perdido</span>}
      </div>
      <div style={styles.bookInfo}>
        <h3 style={styles.bookTitle}>{book.title}</h3>
        {book.author && <p style={styles.bookAuthor}>{book.author}</p>}
        <button
          style={styles.removeButton}
          onClick={handleRemove}
          aria-label={`Eliminar ${book.title}`}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Estilos (constante estática, no se recalcula)
   ========================================================================== */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    color: '#1f2937',
  },
  importButton: {
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  emptyText: {
    fontSize: '18px',
    color: '#6b7280',
    margin: '0 0 8px 0',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },
  bookGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  bookCard: {
    cursor: 'pointer',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    transition: 'box-shadow 0.2s',
  },
  'bookCard--missing': {
    opacity: 0.6,
    borderColor: '#fca5a5',
  },
  bookCover: {
    height: '200px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  formatBadge: {
    padding: '4px 8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#374151',
  },
  missingBadge: {
    padding: '2px 6px',
    backgroundColor: '#fee2e2',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#dc2626',
  },
  bookInfo: {
    padding: '12px',
  },
  bookTitle: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: 500,
    color: '#1f2937',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookAuthor: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#6b7280',
    cursor: 'pointer',
  },
};
