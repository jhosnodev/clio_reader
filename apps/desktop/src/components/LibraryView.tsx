/**
 * LibraryView.tsx — Biblioteca de libros con sidebar
 * Diseño: tinta nocturna + oro viejo + verdigrís
 * Tipos: Fraunces + Hanken Grotesk
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { Book, ReadingStatus } from '@clio-reader/domain';

/* ==========================================================================
   Paletas de portada
   ========================================================================== */

const COVER_PALETTES: [string, string][] = [
  ['#3a2e5c', '#6b4ea3'], ['#173a34', '#2f6d61'], ['#4a2b2b', '#8a3f3f'],
  ['#2c3a52', '#4a6a8a'], ['#453520', '#8a6a34'], ['#3a1f2e', '#7a3a55'],
  ['#1f3a3a', '#3a7a70'], ['#2e2540', '#5a4a8a'], ['#42301a', '#9a6a34'],
  ['#22303f', '#3f6a8a'],
];
const GLYPHS = ['Η', 'Θ', 'Β', 'Α', 'C', '∞', 'H', '⁂', 'Μ', '❦', 'G', 'B', 'Σ', 'Ω', 'Δ', 'Φ'];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function getCoverColors(id: string): [string, string] {
  return COVER_PALETTES[hashStr(id) % COVER_PALETTES.length] as [string, string];
}
function getGlyph(id: string): string {
  return GLYPHS[hashStr(id) % GLYPHS.length] as string;
}
function getAuthorLast(author?: string): string {
  if (!author) return '';
  const p = author.split(' ');
  return (p[p.length - 1] as string) ?? '';
}

/* ==========================================================================
   Fechas
   ========================================================================== */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function relDate(ts: number): string {
  const days = Math.round((Date.now() - ts) / 86400000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem.`;
  return fmtDate(ts);
}

/* ==========================================================================
   Status helpers
   ========================================================================== */

function getReadingStatus(book: Book): ReadingStatus {
  if (book.readingStatus) return book.readingStatus;
  if (book.lastOpenedAt) return 'opened';
  return 'unread';
}

const STATUS_CFG: Record<ReadingStatus, { label: string; dot: string }> = {
  unread: { label: 'Sin leer', dot: '#c17b7b' },
  opened: { label: 'Abierto', dot: '#c9a24b' },
  reading: { label: 'Leyendo', dot: '#4fa393' },
};

/* ==========================================================================
   Props
   ========================================================================== */

type ViewId = 'home' | 'collection' | 'bookmarks';

interface LibraryViewProps {
  readonly books: readonly Book[];
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onOpenBook: (book: Book) => void;
  readonly onImportBook: () => void;
  readonly onRemoveBook: (bookId: string, bookTitle: string) => void;
  readonly onLoadBooks: () => void;
}

/* ==========================================================================
   Componente principal
   ========================================================================== */

export function LibraryView({
  books,
  theme,
  onToggleTheme,
  onOpenBook,
  onImportBook,
  onRemoveBook,
  onLoadBooks,
}: LibraryViewProps): JSX.Element {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [colStatusFilter, setColStatusFilter] = useState<'all' | ReadingStatus>('all');
  const [colFormatFilter, setColFormatFilter] = useState<string>('all');
  const [colLanguageFilter, setColLanguageFilter] = useState<string>('all');
  const [colSort, setColSort] = useState<string>('title');
  const [colQuery, setColQuery] = useState('');
  const [homeSearch, setHomeSearch] = useState('');

  useEffect(() => { onLoadBooks(); }, [onLoadBooks]);

  const recentBooks = useMemo(
    () => [...books].filter((b) => b.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 5),
    [books],
  );
  const addedBooks = useMemo(
    () => [...books].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5),
    [books],
  );

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    books.forEach((b) => { if (b.language) langs.add(b.language); });
    return [...langs].sort();
  }, [books]);

  const colList = useMemo(() => {
    let list = colStatusFilter === 'all' ? [...books] : books.filter((b) => getReadingStatus(b) === colStatusFilter);
    if (colFormatFilter !== 'all') {
      list = list.filter((b) => b.format === colFormatFilter);
    }
    if (colLanguageFilter !== 'all') {
      list = list.filter((b) => b.language === colLanguageFilter);
    }
    if (colQuery) {
      const q = colQuery.toLowerCase();
      list = list.filter((b) => b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q)));
    }
    const statusOrder: Record<string, number> = { reading: 0, unread: 1, opened: 2 };
    list.sort((a, b) => {
      switch (colSort) {
        case 'title': return a.title.localeCompare(b.title, 'es');
        case 'author': return (a.author ?? '').localeCompare(b.author ?? '', 'es');
        case 'language': return (a.language ?? '').localeCompare(b.language ?? '', 'es');
        case 'status': return (statusOrder[getReadingStatus(a)] ?? 3) - (statusOrder[getReadingStatus(b)] ?? 3);
        default: return 0;
      }
    });
    return list;
  }, [books, colStatusFilter, colFormatFilter, colLanguageFilter, colQuery, colSort]);

  const readingCount = books.filter((b) => getReadingStatus(b) === 'reading').length;

  const handleHomeSearchFocus = () => {
    setColQuery(homeSearch);
    setColStatusFilter('all');
    setColFormatFilter('all');
    setColLanguageFilter('all');
    setActiveView('collection');
    setHomeSearch('');
  };

  return (
    <div style={S.app} className="app" data-app-theme={theme}>
      <Rail active={activeView} onChange={setActiveView} theme={theme} onToggleTheme={onToggleTheme} />
      <main style={S.stage}>
        {activeView === 'home' && (
          <HomeView
            books={books}
            recentBooks={recentBooks}
            addedBooks={addedBooks}
            readingCount={readingCount}
            searchValue={homeSearch}
            onSearchChange={setHomeSearch}
            onSearchFocus={handleHomeSearchFocus}
            onOpen={onOpenBook}
            onRemove={onRemoveBook}
            onImport={onImportBook}
          />
        )}
        {activeView === 'collection' && (
          <CollectionView
            books={colList}
            totalCount={books.length}
            readingCount={readingCount}
            statusFilter={colStatusFilter}
            formatFilter={colFormatFilter}
            languageFilter={colLanguageFilter}
            sort={colSort}
            query={colQuery}
            availableLanguages={availableLanguages}
            onStatusFilterChange={setColStatusFilter}
            onFormatFilterChange={setColFormatFilter}
            onLanguageFilterChange={setColLanguageFilter}
            onSortChange={setColSort}
            onQueryChange={setColQuery}
            onOpen={onOpenBook}
            onRemove={onRemoveBook}
          />
        )}
        {activeView === 'bookmarks' && <BookmarksView />}
      </main>
    </div>
  );
}

/* ==========================================================================
   Rail (sidebar de navegación)
   ========================================================================== */

function Rail({ active, onChange, theme, onToggleTheme }: { readonly active: ViewId; readonly onChange: (v: ViewId) => void; readonly theme: 'dark' | 'light'; readonly onToggleTheme: () => void }): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);

  const items: { id: ViewId; label: string; icon: JSX.Element }[] = [
    {
      id: 'home', label: 'Inicio',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/></svg>,
    },
    {
      id: 'collection', label: 'Colección',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="6.5" height="16" rx="1"/><rect x="13.5" y="4" width="6.5" height="16" rx="1"/><path d="M7.2 8h.01M16.7 8h.01"/></svg>,
    },
    {
      id: 'bookmarks', label: 'Marcadores',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v16l-6-4-6 4z"/></svg>,
    },
  ];

  return (
    <aside style={S.rail}>
      <div style={S.brand} title="Clio">
        <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
          <path d="M12 3c-2.4 1.6-3.4 4-3.4 6.4M12 3c2.4 1.6 3.4 4 3.4 6.4" stroke="#e6c874" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M9 6.2c-1.6.3-2.6 1.3-3 2.7M15 6.2c1.6.3 2.6 1.3 3 2.7" stroke="#4fa393" strokeWidth="1.2" strokeLinecap="round"/>
          <rect x="10.4" y="9.5" width="3.2" height="9" rx=".4" fill="#c9a24b"/>
          <path d="M8.5 18.5h7" stroke="#e6c874" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M9.2 21h5.6" stroke="#8a7434" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>

      <nav style={S.nav}>
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <div key={it.id} style={{ position: 'relative' }}>
              <button
                style={{
                  ...S.navBtn,
                  ...(isActive ? S.navBtnActive : {}),
                }}
                onClick={() => onChange(it.id)}
                onMouseEnter={() => setHovered(it.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={it.label}
              >
                {it.icon}
              </button>
              {isActive && <div style={S.navIndicator} />}
              {hovered === it.id && <span style={S.tooltip}>{it.label}</span>}
            </div>
          );
        })}
      </nav>

      <button
        className="theme-toggle"
        style={{
          ...S.navBtn,
          color: theme === 'dark' ? '#8a7434' : '#c9a24b',
        }}
        onClick={onToggleTheme}
        onMouseEnter={() => setHovered('theme')}
        onMouseLeave={() => setHovered(null)}
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        <svg className="i-sun" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.2"/>
          <path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/>
        </svg>
        <svg className="i-moon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>
        </svg>
        {hovered === 'theme' && (
          <span style={S.tooltip}>
            {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          </span>
        )}
      </button>
    </aside>
  );
}

/* ==========================================================================
   Home View
   ========================================================================== */

function HomeView({
  books, recentBooks, addedBooks, readingCount,
  searchValue, onSearchChange, onSearchFocus,
  onOpen, onRemove, onImport,
}: {
  books: readonly Book[];
  recentBooks: readonly Book[];
  addedBooks: readonly Book[];
  readingCount: number;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  onOpen: (b: Book) => void;
  onRemove: (id: string, title: string) => void;
  onImport: () => void;
}): JSX.Element {
  const h = new Date().getHours();
  const greeting = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';

  if (books.length === 0) {
    return (
      <div style={S.wrap}>
        <header style={S.topbar}>
          <div><h1 style={S.h1}>{greeting}</h1><div style={S.sub}>Tu biblioteca bajo la mirada de Clio</div></div>
        </header>
        <div style={S.meander} />
        <EmptyState onImport={onImport} />
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div><h1 style={S.h1}>{greeting}</h1><div style={S.sub}>Tu biblioteca bajo la mirada de Clio</div></div>
        <div style={{ flex: 1 }} />
        <label style={S.search}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input
            style={S.searchInput}
            placeholder="Buscar en tu biblioteca…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
          />
        </label>
      </header>
      <div style={S.meander} />

      {recentBooks.length > 0 && (
        <section style={{ marginBottom: 44 }}>
          <SectionHead title="Continuar leyendo" count={`${readingCount} en curso`} />
          <div style={S.row}>
            {recentBooks.map((b) => <BookCard key={b.id} book={b} onOpen={onOpen} onRemove={onRemove} />)}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Añadidos recientemente" count="últimos 6" />
        <div style={S.row}>
          {addedBooks.map((b) => <BookCard key={b.id} book={b} onOpen={onOpen} onRemove={onRemove} />)}
        </div>
      </section>
    </div>
  );
}

/* ==========================================================================
   Collection View
   ========================================================================== */

const STATUS_FILTERS: { key: 'all' | ReadingStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'reading', label: 'Leyendo' },
  { key: 'unread', label: 'Sin leer' },
  { key: 'opened', label: 'Leídos' },
];

const FORMAT_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'epub', label: 'EPUB' },
  { key: 'pdf', label: 'PDF' },
  { key: 'cbz', label: 'CBZ' },
  { key: 'md', label: 'MD' },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'title', label: 'Título' },
  { key: 'author', label: 'Autor' },
  { key: 'language', label: 'Idioma' },
  { key: 'status', label: 'Estado de lectura' },
];

function CollectionView({
  books, totalCount, readingCount,
  statusFilter, formatFilter, languageFilter, sort, query,
  availableLanguages,
  onStatusFilterChange, onFormatFilterChange, onLanguageFilterChange, onSortChange,
  onQueryChange, onOpen, onRemove,
}: {
  books: readonly Book[];
  totalCount: number;
  readingCount: number;
  statusFilter: 'all' | ReadingStatus;
  formatFilter: string;
  languageFilter: string;
  sort: string;
  query: string;
  availableLanguages: readonly string[];
  onStatusFilterChange: (f: 'all' | ReadingStatus) => void;
  onFormatFilterChange: (f: string) => void;
  onLanguageFilterChange: (f: string) => void;
  onSortChange: (s: string) => void;
  onQueryChange: (q: string) => void;
  onOpen: (b: Book) => void;
  onRemove: (id: string, title: string) => void;
}): JSX.Element {
  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div>
          <h1 style={S.h1}>Colección</h1>
          <div style={S.sub}>{totalCount} documentos · {readingCount} en lectura</div>
        </div>
        <div style={{ flex: 1 }} />
        <label style={S.search}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input
            style={S.searchInput}
            placeholder="Buscar por título o autor…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>
      </header>

      {/* Fila 1: chips de estado */}
      <div style={S.chips}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            style={{ ...S.chip, ...(statusFilter === f.key ? S.chipActive : {}) }}
            onClick={() => onStatusFilterChange(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Fila 2: filtros de formato + idioma + orden */}
      <div style={S.filterRow}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Formato</span>
          <div style={S.chipsSmall}>
            {FORMAT_FILTERS.map((f) => (
              <button
                key={f.key}
                style={{ ...S.chipSm, ...(formatFilter === f.key ? S.chipSmActive : {}) }}
                onClick={() => onFormatFilterChange(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {availableLanguages.length > 0 && (
          <div style={S.filterGroup}>
            <span style={S.filterLabel}>Idioma</span>
            <select
              style={S.select}
              value={languageFilter}
              onChange={(e) => onLanguageFilterChange(e.target.value)}
            >
              <option value="all">Todos</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        )}

        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Ordenar por</span>
          <select
            style={S.select}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {books.length === 0 ? (
        <div style={S.emptyCol}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6a657a" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
          <h3 style={S.emptyTitle}>Sin resultados</h3>
          <p style={S.emptyHint}>Prueba con otro filtro o término de búsqueda.</p>
        </div>
      ) : (
        <div style={S.grid}>
          {books.map((b) => <BookCard key={b.id} book={b} onOpen={onOpen} onRemove={onRemove} />)}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Bookmarks View (empty state)
   ========================================================================== */

function BookmarksView(): JSX.Element {
  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div><h1 style={S.h1}>Marcadores</h1><div style={S.sub}>Páginas que guardaste para volver</div></div>
      </header>
      <div style={S.meander} />
      <div style={S.emptyBookmarks}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6a657a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4h12v16l-6-4-6 4z"/>
        </svg>
        <h3 style={S.emptyTitle}>Aún no hay marcadores</h3>
        <p style={S.emptyHint}>Mientras lees, toca el marcador para guardar la página actual.</p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Subcomponentes compartidos
   ========================================================================== */

function EmptyState({ onImport }: { readonly onImport: () => void }): JSX.Element {
  return (
    <div style={S.empty}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6a657a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
      </svg>
      <h3 style={S.emptyTitle}>No hay libros importados</h3>
      <p style={S.emptyHint}>Haz clic en &quot;Importar libro&quot; para agregar tu primer libro.</p>
      <button style={S.emptyBtn} onClick={onImport}>Importar libro</button>
    </div>
  );
}

function SectionHead({ title, count }: { readonly title: string; readonly count: string }): JSX.Element {
  return (
    <div style={S.sectionHead}>
      <span style={S.sectionAccent} />
      <h2 style={S.sectionTitle}>{title}</h2>
      <span style={S.sectionCount}>{count}</span>
    </div>
  );
}

/* ==========================================================================
   BookCard
   ========================================================================== */

interface BookCardProps {
  readonly book: Book;
  readonly onOpen: (book: Book) => void;
  readonly onRemove: (bookId: string, bookTitle: string) => void;
}

function BookCard({ book, onOpen, onRemove }: BookCardProps): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const isMissing = book.status === 'missing';
  const status = getReadingStatus(book);
  const cfg = STATUS_CFG[status];
  const [c1, c2] = getCoverColors(book.id);
  const glyph = getGlyph(book.id);
  const authorLast = getAuthorLast(book.author);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(book); }
  };
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(book.id, book.title);
  };

  return (
    <div
      style={{
        ...S.card,
        opacity: isMissing ? 0.5 : 1,
        transform: hovered ? 'translateY(-4px)' : undefined,
      }}
      onClick={() => onOpen(book)}
      onKeyDown={handleKey}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${book.title}`}
    >
      <div style={{
        ...S.cover,
        background: `linear-gradient(150deg, ${c1}, ${c2})`,
        boxShadow: hovered
          ? '0 22px 46px -16px rgba(0,0,0,.9), inset 0 0 0 1px rgba(230,200,116,.35)'
          : '0 12px 30px -14px rgba(0,0,0,.85), inset 0 0 0 1px rgba(255,255,255,.05)',
      }}>
        <span style={S.docType}>{book.format.toUpperCase()}</span>
        <span style={S.statusTag}>
          <span style={{
            ...S.dot,
            backgroundColor: cfg.dot,
            boxShadow: status === 'reading' ? '0 0 0 3px rgba(79,163,147,.25)'
              : status === 'opened' ? '0 0 0 3px rgba(201,162,75,.25)' : 'none',
          }} />
          {cfg.label}
        </span>
        <div style={S.coverArt}>
          <div style={S.coverAuthor}>{authorLast}</div>
          <div style={S.coverTitle}>{book.title}</div>
          <div style={S.coverGlyph}>{glyph}</div>
        </div>
        {status === 'reading' && (
          <div style={S.coverProgress}>
            <div style={{ ...S.coverProgressFill, width: '38%' }} />
          </div>
        )}
      </div>
      <div style={S.cardBody}>
        <div style={S.cardTitle}>{book.title}</div>
        {book.author && <div style={S.cardAuthor}>{book.author}</div>}
        <div style={S.cardMeta}>
          {book.lastOpenedAt ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .75 }}>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/>
              </svg>
              Visto {relDate(book.lastOpenedAt)}
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .75 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Añadido {relDate(book.addedAt)}
            </>
          )}
        </div>
        <div style={S.cardFooter}>
          <div style={S.starRating} aria-label="Calificación pendiente">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill="#3b3652" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            ))}
          </div>
          <button style={S.removeBtn} onClick={handleRemove} aria-label={`Eliminar ${book.title}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Estilos
   ========================================================================== */

const S: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex', height: '100vh',
    background: 'radial-gradient(1200px 600px at 80% -10%, rgba(79,163,147,.06), transparent 60%), radial-gradient(1000px 500px at -5% 110%, rgba(201,162,75,.06), transparent 55%), var(--ink-950)',
    fontFamily: '"Hanken Grotesk", system-ui, sans-serif', color: 'var(--tx)',
    transition: 'background .3s var(--ease)',
  },

  /* --- Rail --- */
  rail: {
    width: 76, flexShrink: 0,
    background: 'linear-gradient(180deg, var(--ink-900), var(--ink-950))',
    borderRight: '1px solid var(--line)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '18px 0', gap: 6, position: 'relative', zIndex: 20,
  },
  brand: {
    width: 46, height: 46, borderRadius: 13,
    display: 'grid', placeItems: 'center', marginBottom: 18,
    background: 'radial-gradient(120% 120% at 30% 20%, #2b2740, #17141f)',
    border: '1px solid var(--gold-dim)',
    boxShadow: 'inset 0 1px 0 rgba(230,200,116,.25), 0 6px 18px -8px rgba(0,0,0,.8)',
    position: 'relative',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', flex: 1 },
  navBtn: {
    width: 48, height: 48, borderRadius: 13,
    display: 'grid', placeItems: 'center', color: 'var(--tx-lo)',
    position: 'relative', transition: '.22s cubic-bezier(.22,.61,.36,1)',
    cursor: 'pointer', background: 'none', border: 'none', padding: 0,
  },
  navBtnActive: {
    color: 'var(--on-gold)',
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
  },
  navIndicator: {
    position: 'absolute', left: -18, top: '50%', transform: 'translateY(-50%)',
    width: 4, height: 22, borderRadius: '0 4px 4px 0', background: 'var(--gold-bright)',
  },
  tooltip: {
    position: 'absolute', left: 58, top: '50%', transform: 'translateY(-50%)',
    background: 'var(--ink-800)', color: 'var(--tx-hi)', border: '1px solid var(--line)',
    padding: '6px 11px', borderRadius: 9, fontSize: 12.5, whiteSpace: 'nowrap',
    zIndex: 40, boxShadow: '0 18px 50px -20px rgba(0,0,0,.7)', fontWeight: 500,
  },

  /* --- Stage --- */
  stage: { flex: 1, position: 'relative', overflow: 'hidden' },
  wrap: {
    maxWidth: 1180, margin: '0 auto', padding: '34px 40px 60px',
    height: '100%', overflowY: 'auto',
  } as React.CSSProperties,

  /* --- Topbar --- */
  topbar: { display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 },
  h1: {
    fontFamily: '"Fraunces", serif', fontWeight: 600, color: 'var(--tx-hi)',
    fontSize: 30, letterSpacing: '-.01em', lineHeight: 1.1, margin: 0,
  },
  sub: { color: 'var(--tx-lo)', fontSize: 13.5, marginTop: 2 },
  search: {
    display: 'flex', alignItems: 'center', gap: 9, background: 'var(--ink-850)',
    border: '1px solid var(--line)', borderRadius: 11, padding: '0 12px', height: 42,
    minWidth: 230, transition: '.2s', color: 'var(--tx-lo)',
  },
  searchInput: {
    background: 'none', border: 'none', outline: 'none', color: 'var(--tx-hi)',
    fontSize: 14, width: '100%', fontFamily: 'inherit',
  } as React.CSSProperties,

  /* --- Meander --- */
  meander: {
    height: 8, width: '100%', marginBottom: 34,
    backgroundImage: 'repeating-linear-gradient(90deg, rgba(201,162,75,.55) 0 2px, transparent 2px 14px)',
    WebkitMask: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'8\' viewBox=\'0 0 24 8\'%3E%3Cpath d=\'M0 7h4V3h4v4h4V1h4v6h4\' fill=\'none\' stroke=\'%23000\' stroke-width=\'1.4\'/%3E%3C/svg%3E") repeat-x',
    mask: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'8\' viewBox=\'0 0 24 8\'%3E%3Cpath d=\'M0 7h4V3h4v4h4V1h4v6h4\' fill=\'none\' stroke=\'%23000\' stroke-width=\'1.4\'/%3E%3C/svg%3E") repeat-x',
    opacity: 0.7,
  },

  /* --- Section headers --- */
  sectionHead: { display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 },
  sectionAccent: { width: 26, height: 2, background: 'var(--gold)', borderRadius: 2, alignSelf: 'center', opacity: 0.8, flexShrink: 0 },
  sectionTitle: { fontFamily: '"Fraunces", serif', fontWeight: 600, color: 'var(--tx-hi)', fontSize: 19, letterSpacing: '-.01em', margin: 0 },
  sectionCount: { color: 'var(--tx-faint)', fontSize: 13 },

  /* --- Rows / Grid --- */
  row: {
    display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 200,
    gap: 20, overflowX: 'auto', paddingBottom: 14, scrollSnapType: 'x proximity',
  } as React.CSSProperties,
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 24,
  },

  /* --- Chips --- */
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 },
  chip: {
    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    background: 'var(--ink-850)', border: '1px solid var(--line)', color: 'var(--tx-lo)',
    transition: '.18s', cursor: 'pointer', fontFamily: 'inherit',
  },
  chipActive: {
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)', border: '1px solid transparent', fontWeight: 600,
  },

  /* --- Filter row (format / language / sort) --- */
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '0 0 6px', flexWrap: 'wrap', marginBottom: 28,
  },
  filterGroup: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  filterLabel: {
    fontSize: 13, color: 'var(--tx-lo)', fontWeight: 500, letterSpacing: '.02em',
  },
  chipsSmall: { display: 'flex', gap: 8 },
  chipSm: {
    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    background: 'var(--ink-850)', border: '1px solid var(--line)', color: 'var(--tx-lo)',
    transition: '.18s', cursor: 'pointer', fontFamily: 'inherit',
  },
  chipSmActive: {
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)', border: '1px solid transparent', fontWeight: 600,
  },
  select: {
    padding: '8px 14px', borderRadius: 20, fontSize: 13,
    background: 'var(--ink-850)', border: '1px solid var(--line)', color: 'var(--tx)',
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
    appearance: 'auto' as const,
  },

  /* --- Empty states --- */
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '80px 20px', color: 'var(--tx-lo)', textAlign: 'center',
  },
  emptyCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '60px 20px', color: 'var(--tx-lo)', textAlign: 'center',
  },
  emptyBookmarks: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '80px 20px', color: 'var(--tx-lo)', textAlign: 'center',
  },
  emptyTitle: { fontFamily: '"Fraunces", serif', color: 'var(--tx)', fontWeight: 600, fontSize: 18, margin: 0 },
  emptyHint: { fontSize: 14, color: 'var(--tx-faint)', margin: 0, maxWidth: 340 },
  emptyBtn: {
    marginTop: 8, padding: '10px 20px',
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },

  /* --- Card --- */
  card: {
    width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 11,
    transition: 'transform .22s cubic-bezier(.22,.61,.36,1)',
    cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
  },
  cover: {
    position: 'relative', aspectRatio: '2/3', borderRadius: 12, overflow: 'hidden',
    transition: 'box-shadow .22s cubic-bezier(.22,.61,.36,1)',
  },
  docType: {
    position: 'absolute', top: 10, right: 10, zIndex: 4,
    fontSize: 9.5, fontWeight: 700, letterSpacing: '.09em',
    padding: '4px 7px', borderRadius: 6, color: '#fff',
    background: 'rgba(16,15,24,.6)', backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,.18)',
  },
  statusTag: {
    position: 'absolute', left: 10, top: 10, zIndex: 4,
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 10, fontWeight: 600, letterSpacing: '.02em',
    padding: '4px 8px 4px 6px', borderRadius: 20,
    background: 'rgba(16,15,24,.62)', backdropFilter: 'blur(6px)',
    color: '#efe9dd', border: '1px solid rgba(255,255,255,.12)',
  },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  coverArt: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', padding: '16px 14px 14px 18px',
  },
  coverAuthor: {
    fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,.72)', fontWeight: 600,
  },
  coverTitle: {
    fontFamily: '"Fraunces", serif', fontWeight: 600, fontSize: 16,
    lineHeight: 1.15, color: '#fff', textShadow: '0 1px 12px rgba(0,0,0,.4)',
    letterSpacing: '-.01em',
    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  } as React.CSSProperties,
  coverGlyph: {
    fontFamily: '"Fraunces", serif', fontSize: 38,
    color: 'rgba(255,255,255,.24)', alignSelf: 'flex-end', lineHeight: 1,
  },
  coverProgress: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 4,
    background: 'rgba(0,0,0,.4)', zIndex: 4,
  },
  coverProgressFill: {
    display: 'block', height: '100%',
    background: 'linear-gradient(90deg, #4fa393, #6fd0bf)', borderRadius: 20,
  },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 3, padding: '0 2px' },
  cardTitle: {
    fontFamily: '"Fraunces", serif', fontWeight: 600, color: 'var(--tx-hi)',
    fontSize: 15, lineHeight: 1.25, letterSpacing: '-.005em',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  } as React.CSSProperties,
  cardAuthor: {
    color: 'var(--tx-lo)', fontSize: 12.5,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cardMeta: {
    display: 'flex', alignItems: 'center', gap: 7, marginTop: 5,
    color: 'var(--tx-faint)', fontSize: 11.5,
  },
  cardFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--ink-800)',
  },
  starRating: { display: 'flex', gap: 2 },
  removeBtn: {
    padding: '3px 8px', background: 'transparent',
    border: '1px solid var(--line)', borderRadius: 6,
    color: 'var(--tx-faint)', cursor: 'pointer', display: 'grid', placeItems: 'center',
    fontFamily: 'inherit', transition: '.15s',
  },
};
