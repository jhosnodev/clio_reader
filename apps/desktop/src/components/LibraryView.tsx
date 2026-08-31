import { useState } from 'react';

interface Book {
  id: string;
  title: string;
  format: string;
  uri: string;
}

interface LibraryViewProps {
  onOpenBook: (book: Book) => void;
  onImportBook: () => void;
}

export function LibraryView({ onOpenBook, onImportBook }: LibraryViewProps): JSX.Element {
  const [books] = useState<Book[]>([]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Echo Reader</h1>
        <button style={styles.importButton} onClick={onImportBook}>
          Import Book
        </button>
      </header>
      <main style={styles.content}>
        {books.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No books imported yet.</p>
            <p style={styles.emptyHint}>Click "Import Book" to add your first book.</p>
          </div>
        ) : (
          <div style={styles.bookGrid}>
            {books.map((book) => (
              <div
                key={book.id}
                style={styles.bookCard}
                onClick={() => onOpenBook(book)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpenBook(book);
                }}
              >
                <div style={styles.bookCover}>
                  <span style={styles.formatBadge}>{book.format.toUpperCase()}</span>
                </div>
                <div style={styles.bookInfo}>
                  <h3 style={styles.bookTitle}>{book.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

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
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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
  bookCover: {
    height: '200px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    padding: '4px 8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#374151',
  },
  bookInfo: {
    padding: '12px',
  },
  bookTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 500,
    color: '#1f2937',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
