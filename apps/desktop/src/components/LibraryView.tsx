/**
 * LibraryView.tsx — Biblioteca de libros con sidebar
 * Diseño: tinta nocturna + oro viejo + verdigrís
 * Tipos: Fraunces + Hanken Grotesk
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type {
  Book,
  Bookmark,
  Note,
  Highlight,
  ReaderLocator,
  ReadingStatus,
  Rank,
  ReadingProgress,
} from '@clio-reader/domain';
import type { LibraryRepository } from '@clio-reader/library';
import {
  removeNoteManaged,
  removeHighlightManaged,
  exportAnnotations,
  importAnnotations,
  exportAnnotationsToMarkdown,
  importAnnotationsFromMarkdown,
  readAnnotationMarkdownMeta,
} from '@clio-reader/annotations';
import { bridgeExtras } from '../bridges/bridge-singleton';
import { NotesExportDialog } from './NotesExportDialog';
import type { ThemePalette } from '../themes';
import { PALETTES } from '../themes';
import { BrandIcon } from './BrandIcon';
import type { ImportProgress } from '../App';

/* ==========================================================================
   Paletas de portada
   ========================================================================== */

const COVER_PALETTES: [string, string][] = [
  ['#3a2e5c', '#6b4ea3'],
  ['#173a34', '#2f6d61'],
  ['#4a2b2b', '#8a3f3f'],
  ['#2c3a52', '#4a6a8a'],
  ['#453520', '#8a6a34'],
  ['#3a1f2e', '#7a3a55'],
  ['#1f3a3a', '#3a7a70'],
  ['#2e2540', '#5a4a8a'],
  ['#42301a', '#9a6a34'],
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
  unread: { label: 'Sin leer', dot: 'var(--rose)' },
  opened: { label: 'Abierto', dot: 'var(--gold)' },
  reading: { label: 'Leyendo', dot: 'var(--verdigris)' },
};

/* ==========================================================================
   Props
   ========================================================================== */

type ViewId = 'home' | 'collection' | 'bookmarks' | 'notes';

interface LibraryViewProps {
  readonly books: readonly Book[];
  readonly theme: 'dark' | 'light';
  readonly paletteId: string;
  readonly palette: ThemePalette;
  readonly repository: LibraryRepository;
  readonly importProgress: ImportProgress | null;
  readonly onToggleTheme: () => void;
  readonly onSetPalette: (id: string) => void;
  readonly onOpenBook: (book: Book, initialLocator?: string) => void;
  readonly onImportBook: () => void;
  readonly onImportFiles: () => void;
  readonly onImportFolder: () => void;
  readonly onRemoveBook: (bookId: string, bookTitle: string) => void;
  readonly onLoadBooks: () => void;
}

/* ==========================================================================
   Componente principal
   ========================================================================== */

export function LibraryView({
  books,
  theme,
  paletteId,
  palette,
  repository,
  importProgress,
  onToggleTheme,
  onSetPalette,
  onOpenBook,
  onImportFiles,
  onImportFolder,
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
  const [progressMap, setProgressMap] = useState<Map<string, ReadingProgress>>(new Map());

  useEffect(() => {
    onLoadBooks();
  }, [onLoadBooks]);

  // Load progress for all books
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const allProgress = await repository.listAllProgress();
        const map = new Map<string, ReadingProgress>();
        for (const progress of allProgress) {
          map.set(progress.bookId, progress);
        }
        setProgressMap(map);
      } catch (err) {
        console.error('Error cargando progreso:', err);
      }
    };
    loadProgress();
  }, [books, repository]);

  const handleSaveRank = useCallback(
    async (bookId: string, rank: Rank) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) return;
      await repository.upsertBook({ ...book, rank });
      onLoadBooks();
    },
    [books, repository, onLoadBooks],
  );

  const recentBooks = useMemo(
    () =>
      [...books]
        .filter((b) => b.lastOpenedAt)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        .slice(0, 5),
    [books],
  );
  const addedBooks = useMemo(
    () => [...books].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5),
    [books],
  );

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    books.forEach((b) => {
      if (b.language) langs.add(b.language);
    });
    return [...langs].sort();
  }, [books]);

  const colList = useMemo(() => {
    let list =
      colStatusFilter === 'all'
        ? [...books]
        : books.filter((b) => getReadingStatus(b) === colStatusFilter);
    if (colFormatFilter !== 'all') {
      list = list.filter((b) => b.format === colFormatFilter);
    }
    if (colLanguageFilter !== 'all') {
      list = list.filter((b) => b.language === colLanguageFilter);
    }
    if (colQuery) {
      const q = colQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q)),
      );
    }
    const statusOrder: Record<string, number> = { reading: 0, unread: 1, opened: 2 };
    list.sort((a, b) => {
      switch (colSort) {
        case 'title':
          return a.title.localeCompare(b.title, 'es');
        case 'author':
          return (a.author ?? '').localeCompare(b.author ?? '', 'es');
        case 'language':
          return (a.language ?? '').localeCompare(b.language ?? '', 'es');
        case 'status':
          return (statusOrder[getReadingStatus(a)] ?? 3) - (statusOrder[getReadingStatus(b)] ?? 3);
        default:
          return 0;
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
      <Rail
        active={activeView}
        onChange={setActiveView}
        theme={theme}
        paletteId={paletteId}
        palette={palette}
        onToggleTheme={onToggleTheme}
        onSetPalette={onSetPalette}
      />
      <main style={S.stage}>
        {activeView === 'home' && (
          <HomeView
            books={books}
            recentBooks={recentBooks}
            addedBooks={addedBooks}
            readingCount={readingCount}
            searchValue={homeSearch}
            progressMap={progressMap}
            importProgress={importProgress}
            onSearchChange={setHomeSearch}
            onSearchFocus={handleHomeSearchFocus}
            onOpen={onOpenBook}
            onRemove={onRemoveBook}
            onImportFiles={onImportFiles}
            onImportFolder={onImportFolder}
            onSaveRank={handleSaveRank}
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
            progressMap={progressMap}
            onStatusFilterChange={setColStatusFilter}
            onFormatFilterChange={setColFormatFilter}
            onLanguageFilterChange={setColLanguageFilter}
            onSortChange={setColSort}
            onQueryChange={setColQuery}
            onOpen={onOpenBook}
            onRemove={onRemoveBook}
            onSaveRank={handleSaveRank}
          />
        )}
        {activeView === 'bookmarks' && (
          <BookmarksView books={books} repository={repository} onOpen={onOpenBook} />
        )}
        {activeView === 'notes' && (
          <NotesView books={books} repository={repository} onOpen={onOpenBook} />
        )}
      </main>
    </div>
  );
}

/* ==========================================================================
   Rail (sidebar de navegación)
   ========================================================================== */

function Rail({
  active,
  onChange,
  theme,
  paletteId,
  palette,
  onToggleTheme,
  onSetPalette,
}: {
  readonly active: ViewId;
  readonly onChange: (v: ViewId) => void;
  readonly theme: 'dark' | 'light';
  readonly paletteId: string;
  readonly palette: ThemePalette;
  readonly onToggleTheme: () => void;
  readonly onSetPalette: (id: string) => void;
}): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);
  const [showPalettePicker, setShowPalettePicker] = useState(false);

  const items: { id: ViewId; label: string; icon: JSX.Element }[] = [
    {
      id: 'home',
      label: 'Inicio',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M9.5 20v-6h5v6" />
        </svg>
      ),
    },
    {
      id: 'collection',
      label: 'Colección',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="6.5" height="16" rx="1" />
          <rect x="13.5" y="4" width="6.5" height="16" rx="1" />
          <path d="M7.2 8h.01M16.7 8h.01" />
        </svg>
      ),
    },
    /* TODO: marcadores no funcional — re-habilitar cuando el CRUD esté completo */
    // {
    //   id: 'bookmarks',
    //   label: 'Marcadores',
    //   icon: (
    //     <svg
    //       width="22"
    //       height="22"
    //       viewBox="0 0 24 24"
    //       fill="none"
    //       stroke="currentColor"
    //       strokeWidth="1.7"
    //       strokeLinecap="round"
    //       strokeLinejoin="round"
    //     >
    //       <path d="M6 4h12v16l-6-4-6 4z" />
    //     </svg>
    //   ),
    // },
    {
      id: 'notes',
      label: 'Notas',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 5h16v11l-4 4H4z" />
          <path d="M16 20v-4h4" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      ),
    },
  ];

  return (
    <aside style={S.rail}>
      <div style={S.brand} title="Clio">
        <BrandIcon color={palette.dark.gold} size={26} />
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

      {/* Palette selector */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            ...S.navBtn,
            background: palette.dark['ink-950'],
            border: `2px solid ${palette.dark.gold}`,
          }}
          onClick={() => setShowPalettePicker(!showPalettePicker)}
          onMouseEnter={() => setHovered('palette')}
          onMouseLeave={() => setHovered(null)}
          aria-label="Selector de tema"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={palette.dark.gold}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </button>
        {hovered === 'palette' && <span style={S.tooltip}>Tema</span>}
        {showPalettePicker && (
          <div style={S.palettePopover}>
            <div style={S.palettePopoverTitle}>Tema</div>
            <div style={S.paletteGrid}>
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  style={{
                    ...S.paletteSwatch,
                    background: p.dark['ink-950'],
                    borderColor: p.id === paletteId ? p.dark.gold : 'transparent',
                  }}
                  onClick={() => {
                    onSetPalette(p.id);
                    setShowPalettePicker(false);
                  }}
                  title={p.name}
                >
                  <div style={{ ...S.paletteSwatchAccent, background: p.dark.gold }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Theme toggle (dark/light) */}
      <button
        className="theme-toggle"
        style={{
          ...S.navBtn,
          color: theme === 'dark' ? palette.dark['gold-dim'] : palette.dark.gold,
        }}
        onClick={onToggleTheme}
        onMouseEnter={() => setHovered('theme')}
        onMouseLeave={() => setHovered(null)}
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        <svg
          className="i-sun"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
        </svg>
        <svg
          className="i-moon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" />
        </svg>
        {hovered === 'theme' && (
          <span style={S.tooltip}>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
        )}
      </button>
    </aside>
  );
}

/* ==========================================================================
   Home View
   ========================================================================== */

function HomeView({
  books,
  recentBooks,
  addedBooks,
  readingCount,
  searchValue,
  progressMap,
  importProgress,
  onSearchChange,
  onSearchFocus,
  onOpen,
  onRemove,
  onImportFiles,
  onImportFolder,
  onSaveRank,
}: {
  books: readonly Book[];
  recentBooks: readonly Book[];
  addedBooks: readonly Book[];
  readingCount: number;
  searchValue: string;
  progressMap: Map<string, ReadingProgress>;
  importProgress: ImportProgress | null;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  onOpen: (b: Book) => void;
  onRemove: (id: string, title: string) => void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onSaveRank: (bookId: string, rank: Rank) => void;
}): JSX.Element {
  const h = new Date().getHours();
  const greeting =
    h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';

  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (books.length === 0) {
    return (
      <div style={S.wrap}>
        <header style={S.topbar}>
          <div>
            <h1 style={S.h1}>{greeting}</h1>
            <div style={S.sub}>Tu biblioteca bajo la mirada de Clio</div>
          </div>
        </header>
        <div style={S.meander} />
        <EmptyState onImportFiles={onImportFiles} onImportFolder={onImportFolder} />
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div>
          <h1 style={S.h1}>{greeting}</h1>
          <div style={S.sub}>Tu biblioteca bajo la mirada de Clio</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }} ref={importMenuRef}>
          <button style={S.importBtn} onClick={() => setShowImportMenu(!showImportMenu)}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Importar
          </button>
          {showImportMenu && (
            <div style={S.importMenu}>
              <button
                style={S.importMenuItem}
                onClick={() => {
                  setShowImportMenu(false);
                  onImportFiles();
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Importar archivo(s)
              </button>
              <button
                style={S.importMenuItem}
                onClick={() => {
                  setShowImportMenu(false);
                  onImportFolder();
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Importar carpeta
              </button>
            </div>
          )}
        </div>
        <label style={S.search}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            style={S.searchInput}
            placeholder="Buscar en tu biblioteca…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
          />
        </label>
      </header>
      {importProgress && (
        <div style={S.importProgress}>
          <div style={S.importProgressBar}>
            <div
              style={{
                ...S.importProgressFill,
                width: `${((importProgress.imported + importProgress.skipped) / importProgress.total) * 100}%`,
              }}
            />
          </div>
          <div style={S.importProgressText}>
            Importando: {importProgress.current} ({importProgress.imported + importProgress.skipped}
            /{importProgress.total})
            {importProgress.skipped > 0 && (
              <span style={{ color: 'var(--gold)', marginLeft: 8 }}>
                ({importProgress.skipped} omitidos)
              </span>
            )}
          </div>
        </div>
      )}
      <div style={S.meander} />

      {recentBooks.length > 0 && (
        <section style={{ marginBottom: 44 }}>
          <SectionHead title="Continuar leyendo" count={`${readingCount} en curso`} />
          <div style={S.row}>
            {recentBooks.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                progress={progressMap.get(b.id)}
                onOpen={onOpen}
                onRemove={onRemove}
                onSaveRank={onSaveRank}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Añadidos recientemente" count="últimos 6" />
        <div style={S.row}>
          {addedBooks.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              progress={progressMap.get(b.id)}
              onOpen={onOpen}
              onRemove={onRemove}
              onSaveRank={onSaveRank}
            />
          ))}
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
  books,
  totalCount,
  readingCount,
  statusFilter,
  formatFilter,
  languageFilter,
  sort,
  query,
  availableLanguages,
  progressMap,
  onStatusFilterChange,
  onFormatFilterChange,
  onLanguageFilterChange,
  onSortChange,
  onQueryChange,
  onOpen,
  onRemove,
  onSaveRank,
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
  progressMap: Map<string, ReadingProgress>;
  onStatusFilterChange: (f: 'all' | ReadingStatus) => void;
  onFormatFilterChange: (f: string) => void;
  onLanguageFilterChange: (f: string) => void;
  onSortChange: (s: string) => void;
  onQueryChange: (q: string) => void;
  onOpen: (b: Book) => void;
  onRemove: (id: string, title: string) => void;
  onSaveRank: (bookId: string, rank: Rank) => void;
}): JSX.Element {
  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div>
          <h1 style={S.h1}>Colección</h1>
          <div style={S.sub}>
            {totalCount} documentos · {readingCount} en lectura
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <label style={S.search}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
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
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Ordenar por</span>
          <select style={S.select} value={sort} onChange={(e) => onSortChange(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {books.length === 0 ? (
        <div style={S.emptyCol}>
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tx-faint)"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
          <h3 style={S.emptyTitle}>Sin resultados</h3>
          <p style={S.emptyHint}>Prueba con otro filtro o término de búsqueda.</p>
        </div>
      ) : (
        <div style={S.grid}>
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              progress={progressMap.get(b.id)}
              onOpen={onOpen}
              onRemove={onRemove}
              onSaveRank={onSaveRank}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Bookmarks View
   ========================================================================== */

function BookmarksView({
  books,
  repository,
  onOpen,
}: {
  books: readonly Book[];
  repository: LibraryRepository;
  onOpen: (book: Book) => void;
}): JSX.Element {
  const [bookmarks, setBookmarks] = useState<(Bookmark & { bookTitle?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        const allBookmarks = await repository.listAllBookmarks();
        const bookmarksWithTitle = allBookmarks.map((b) => ({
          ...b,
          bookTitle: books.find((book) => book.id === b.bookId)?.title ?? 'Libro desconocido',
        }));
        setBookmarks(bookmarksWithTitle.sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.error('Error cargando marcadores:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBookmarks();
  }, [repository, books]);

  const handleDelete = useCallback(
    async (bookmarkId: string) => {
      try {
        await repository.removeBookmark(bookmarkId);
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      } catch (err) {
        console.error('Error eliminando marcador:', err);
      }
    },
    [repository],
  );

  const handleOpenBook = useCallback(
    (bookId: string) => {
      const book = books.find((b) => b.id === bookId);
      if (book) onOpen(book);
    },
    [books, onOpen],
  );

  if (loading) {
    return (
      <div style={S.wrap}>
        <header style={S.topbar}>
          <div>
            <h1 style={S.h1}>Marcadores</h1>
            <div style={S.sub}>Páginas que guardaste para volver</div>
          </div>
        </header>
        <div style={S.meander} />
        <div style={S.emptyBookmarks}>
          <div style={{ ...S.spinner, width: 24, height: 24 }} aria-hidden="true" />
          <p style={S.emptyHint}>Cargando marcadores…</p>
        </div>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div style={S.wrap}>
        <header style={S.topbar}>
          <div>
            <h1 style={S.h1}>Marcadores</h1>
            <div style={S.sub}>Páginas que guardaste para volver</div>
          </div>
        </header>
        <div style={S.meander} />
        <div style={S.emptyBookmarks}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tx-faint)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4h12v16l-6-4-6 4z" />
          </svg>
          <h3 style={S.emptyTitle}>Aún no hay marcadores</h3>
          <p style={S.emptyHint}>Mientras lees, toca el marcador para guardar la página actual.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div>
          <h1 style={S.h1}>Marcadores</h1>
          <div style={S.sub}>
            {bookmarks.length} marcador{bookmarks.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </header>
      <div style={S.meander} />
      <div style={S.bookmarksList}>
        {bookmarks.map((bookmark) => (
          <div key={bookmark.id} style={S.bookmarkItem}>
            <div
              style={S.bookmarkContent}
              onClick={() => handleOpenBook(bookmark.bookId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpenBook(bookmark.bookId);
              }}
              role="button"
              tabIndex={0}
            >
              <div style={S.bookmarkIcon}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 4h12v16l-6-4-6 4z" />
                </svg>
              </div>
              <div style={S.bookmarkInfo}>
                <div style={S.bookmarkTitle}>{bookmark.bookTitle}</div>
                <div style={S.bookmarkMeta}>
                  {bookmark.label && <span>{bookmark.label}</span>}
                  {bookmark.label && <span style={S.bookmarkDot}>·</span>}
                  <span>{fmtDate(bookmark.createdAt)}</span>
                </div>
              </div>
            </div>
            <button
              style={S.bookmarkDelete}
              onClick={() => handleDelete(bookmark.id)}
              aria-label={`Eliminar marcador de ${bookmark.bookTitle}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Notes View
   ========================================================================== */

type NotesSort = 'date-desc' | 'date-asc' | 'position';

function fmtLocator(locator: ReaderLocator): string {
  switch (locator.format) {
    case 'epub':
      if (typeof locator.progression === 'number') {
        return `${Math.round(locator.progression * 100)}%`;
      }
      return locator.href || 'EPUB';
    case 'pdf':
    case 'cbz':
      return `Pág. ${locator.page}`;
    case 'md':
      if (locator.href) return locator.href;
      if (typeof locator.offset === 'number') return `Offset ${locator.offset}`;
      return 'Markdown';
  }
}

type AnnotationItemKind = 'note' | 'highlight';

const NOTICE_KINDS: Record<'success' | 'warn' | 'error', React.CSSProperties> = {
  success: { borderColor: 'var(--verdigris)' },
  warn: { borderColor: 'var(--gold)' },
  error: { borderColor: 'var(--rose)' },
};

interface AnnotationItem {
  readonly kind: AnnotationItemKind;
  readonly id: string;
  readonly bookId: string;
  readonly locator: ReaderLocator;
  readonly selectedText?: string;
  readonly body?: string;
  readonly color?: string;
  readonly createdAt: number;
}

/** Clave de posición ordenable que combina progreso de libro y ancla en el capítulo. */
function annotationPositionKey(locator: ReaderLocator): number {
  let base = 0;
  if ('progression' in locator && locator.progression !== undefined) {
    base = locator.progression;
  } else if ('positionOrder' in locator && locator.positionOrder !== undefined) {
    base = locator.positionOrder;
  } else if ('page' in locator && locator.page !== undefined) {
    base = locator.page;
  }
  const anchor = 'anchor' in locator ? locator.anchor : undefined;
  return base * 1_000_000 + (anchor?.start ?? 0);
}

function sortAnnotationItems(items: readonly AnnotationItem[], sort: NotesSort): AnnotationItem[] {
  const sorted = [...items];
  if (sort === 'position') {
    return sorted.sort(
      (a, b) => annotationPositionKey(a.locator) - annotationPositionKey(b.locator),
    );
  }
  const direction = sort === 'date-asc' ? 1 : -1;
  return sorted.sort((a, b) => direction * (a.createdAt - b.createdAt));
}

function NotesView({
  books,
  repository,
  onOpen,
}: {
  books: readonly Book[];
  repository: LibraryRepository;
  onOpen: (book: Book, initialLocator?: string) => void;
}): JSX.Element {
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [sort, setSort] = useState<NotesSort>('date-desc');
  const [notes, setNotes] = useState<readonly Note[]>([]);
  const [highlights, setHighlights] = useState<readonly Highlight[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [notice, setNotice] = useState<{
    readonly kind: 'success' | 'warn' | 'error';
    readonly message: string;
  } | null>(null);

  const bookTitle = useCallback(
    (bookId: string) => books.find((b) => b.id === bookId)?.title ?? 'Libro desconocido',
    [books],
  );

  // Libro por defecto: el primero con notas o resaltados, o el primero de la biblioteca
  useEffect(() => {
    if (selectedBookId) return;
    let cancelled = false;
    const pick = async () => {
      let found = '';
      for (const b of books) {
        const [noteList, highlightList] = await Promise.all([
          repository.listNotes(b.id).catch(() => []),
          repository.listHighlights(b.id).catch(() => []),
        ]);
        if (noteList.length > 0 || highlightList.length > 0) {
          found = b.id;
          break;
        }
      }
      if (cancelled) return;
      setSelectedBookId(found || books[0]?.id || '');
    };
    pick();
    return () => {
      cancelled = true;
    };
  }, [books, repository, selectedBookId]);

  const loadNotes = useCallback(async () => {
    if (!selectedBookId) {
      setNotes([]);
      setHighlights([]);
      return;
    }
    setLoading(true);
    try {
      const [noteList, highlightList] = await Promise.all([
        repository.listNotes(selectedBookId).catch(() => []),
        repository.listHighlights(selectedBookId).catch(() => []),
      ]);
      setNotes(noteList);
      setHighlights(highlightList);
    } catch (err) {
      console.error('Error cargando anotaciones:', err);
      setNotes([]);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, [repository, selectedBookId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId),
    [books, selectedBookId],
  );

  const handleExportAnnotations = useCallback(async () => {
    const book = books.find((b) => b.id === selectedBookId);
    if (!book) return;
    try {
      const data = await exportAnnotations(repository, book.id);
      const markdown = exportAnnotationsToMarkdown(data, {
        bookTitle: book.title,
        bookFormat: book.format,
        ...(book.fileHash ? { fileHash: book.fileHash } : {}),
      });
      const baseName = book.title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
      const savedPath = await bridgeExtras.saveFile({
        defaultPath: `${baseName || 'anotaciones'}.md`,
        content: markdown,
      });
      if (savedPath) {
        setNotice({ kind: 'success', message: `Anotaciones exportadas a ${savedPath}` });
      }
    } catch (err) {
      console.error('Error exportando anotaciones:', err);
      setNotice({ kind: 'error', message: 'No se pudieron exportar las anotaciones.' });
    }
  }, [books, repository, selectedBookId]);

  const handleImportAnnotations = useCallback(async () => {
    try {
      const file = await bridgeExtras.openFile({
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      });
      if (!file) return;

      const meta = readAnnotationMarkdownMeta(file.content);
      const hasClioBlocks = /clio:(highlight|note|bookmark)/.test(file.content);
      if (meta.version !== 1 && !hasClioBlocks) {
        setNotice({
          kind: 'error',
          message: 'El archivo no es una exportación de anotaciones de Clio Reader.',
        });
        return;
      }

      // Resolución del libro destino con fallback por desajuste.
      let targetBookId = selectedBookId;
      let fallback = false;
      if (meta.bookId === selectedBookId) {
        targetBookId = selectedBookId;
      } else if (meta.bookId && books.some((b) => b.id === meta.bookId)) {
        targetBookId = meta.bookId;
      } else {
        const hashMatch = meta.fileHash
          ? books.find((b) => b.fileHash && b.fileHash === meta.fileHash)
          : undefined;
        if (hashMatch) {
          targetBookId = hashMatch.id;
        } else {
          targetBookId = selectedBookId;
          fallback = true;
        }
      }

      const { data, result } = importAnnotationsFromMarkdown(file.content, targetBookId);
      await importAnnotations(repository, targetBookId, data);

      const total = result.bookmarksImported + result.notesImported + result.highlightsImported;
      const targetTitle = books.find((b) => b.id === targetBookId)?.title ?? targetBookId;

      if (targetBookId !== selectedBookId) {
        setSelectedBookId(targetBookId);
      } else {
        await loadNotes();
      }

      if (total === 0) {
        setNotice({
          kind: 'warn',
          message: 'El archivo no contenía anotaciones nuevas para importar.',
        });
      } else if (fallback) {
        setNotice({
          kind: 'warn',
          message: `El archivo pertenece a otro libro; se importaron ${total} anotación(es) en “${targetTitle}”.`,
        });
      } else if (targetBookId !== selectedBookId) {
        setNotice({
          kind: 'success',
          message: `Importadas ${total} anotación(es) en “${targetTitle}”.`,
        });
      } else {
        setNotice({ kind: 'success', message: `Importadas ${total} anotación(es) en este libro.` });
      }
    } catch (err) {
      console.error('Error importando anotaciones:', err);
      setNotice({ kind: 'error', message: 'No se pudo importar el archivo de anotaciones.' });
    }
  }, [books, loadNotes, repository, selectedBookId]);

  const items = useMemo<AnnotationItem[]>(() => {
    const noteItems: AnnotationItem[] = notes.map((n) => ({
      kind: 'note',
      id: n.id,
      bookId: n.bookId,
      locator: n.locator,
      body: n.body,
      createdAt: n.createdAt,
      ...(n.selectedText !== undefined ? { selectedText: n.selectedText } : {}),
    }));
    const highlightItems: AnnotationItem[] = highlights.map((h) => ({
      kind: 'highlight',
      id: h.id,
      bookId: h.bookId,
      locator: h.locatorStart,
      color: h.color,
      createdAt: h.createdAt,
      ...(h.selectedText !== undefined ? { selectedText: h.selectedText } : {}),
    }));
    return sortAnnotationItems([...noteItems, ...highlightItems], sort);
  }, [notes, highlights, sort]);

  const handleDeleteItem = useCallback(
    async (item: AnnotationItem) => {
      try {
        if (item.kind === 'note') {
          await removeNoteManaged(repository, item.id, selectedBookId);
          setNotes((prev) => prev.filter((n) => n.id !== item.id));
        } else {
          await removeHighlightManaged(repository, item.id, selectedBookId);
          setHighlights((prev) => prev.filter((h) => h.id !== item.id));
        }
      } catch (err) {
        console.error('Error eliminando anotación:', err);
      }
    },
    [repository, selectedBookId],
  );

  const handleOpenBook = useCallback(
    (bookId: string, locator?: string) => {
      const book = books.find((b) => b.id === bookId);
      if (book) onOpen(book, locator);
    },
    [books, onOpen],
  );

  const bookOptions = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title, 'es')),
    [books],
  );

  if (books.length === 0) {
    return (
      <div style={S.wrap}>
        <header style={S.topbar}>
          <div>
            <h1 style={S.h1}>Notas</h1>
            <div style={S.sub}>Tus anotaciones, guardadas localmente</div>
          </div>
        </header>
        <div style={S.meander} />
        <div style={S.emptyBookmarks}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tx-faint)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5h16v11l-4 4H4z" />
            <path d="M16 20v-4h4" />
            <path d="M8 9h8M8 13h5" />
          </svg>
          <h3 style={S.emptyTitle}>No hay libros todavía</h3>
          <p style={S.emptyHint}>Importa un libro para empezar a tomar notas.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div>
          <h1 style={S.h1}>Notas y resaltados</h1>
          <div style={S.sub}>
            {notes.length} nota{notes.length !== 1 ? 's' : ''} y {highlights.length} resaltado
            {highlights.length !== 1 ? 's' : ''} en {bookTitle(selectedBookId)}
          </div>
        </div>
      </header>
      <div style={S.meander} />

      <div style={S.notesToolbar}>
        <select
          style={S.notesSelect}
          value={selectedBookId}
          onChange={(e) => setSelectedBookId(e.target.value)}
          aria-label="Filtrar notas por libro"
        >
          {bookOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <select
          style={S.notesSelect}
          value={sort}
          onChange={(e) => setSort(e.target.value as NotesSort)}
          aria-label="Ordenar notas"
        >
          <option value="date-desc">Más recientes</option>
          <option value="date-asc">Más antiguas</option>
          <option value="position">Por posición</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          style={S.notesActionBtn}
          onClick={() => setShowExportDialog(true)}
          aria-label="Exportar o importar anotaciones del libro"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Exportar / Importar
        </button>
      </div>

      {notice && (
        <div style={{ ...S.notesNotice, ...NOTICE_KINDS[notice.kind] }} role="status">
          <span>{notice.message}</span>
          <button
            style={S.notesNoticeClose}
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div style={S.emptyBookmarks}>
          <div style={{ ...S.spinner, width: 24, height: 24 }} aria-hidden="true" />
          <p style={S.emptyHint}>Cargando anotaciones…</p>
        </div>
      ) : items.length === 0 ? (
        <div style={S.emptyBookmarks}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tx-faint)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5h16v11l-4 4H4z" />
            <path d="M16 20v-4h4" />
            <path d="M8 9h8M8 13h5" />
          </svg>
          <h3 style={S.emptyTitle}>Sin anotaciones en este libro</h3>
          <p style={S.emptyHint}>
            Selecciona otro libro o abre uno para escribir notas y resaltar texto.
          </p>
        </div>
      ) : (
        <div style={S.bookmarksList}>
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} style={S.bookmarkItem}>
              <div
                style={S.bookmarkContent}
                onClick={() => handleOpenBook(item.bookId, JSON.stringify(item.locator))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenBook(item.bookId, JSON.stringify(item.locator));
                }}
                role="button"
                tabIndex={0}
              >
                {item.kind === 'highlight' ? (
                  <div
                    style={{ ...S.highlightSwatch, background: item.color }}
                    aria-label={`Resaltado en color ${item.color}`}
                  />
                ) : (
                  <div style={S.bookmarkIcon}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--gold)"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 5h16v11l-4 4H4z" />
                      <path d="M16 20v-4h4" />
                      <path d="M8 9h8M8 13h5" />
                    </svg>
                  </div>
                )}
                <div style={S.bookmarkInfo}>
                  {item.selectedText && <div style={S.noteQuote}>“{item.selectedText}”</div>}
                  {item.kind === 'note' ? (
                    <div style={S.noteBody}>{item.body}</div>
                  ) : (
                    <div style={S.highlightLabel}>Resaltado</div>
                  )}
                  <div style={S.bookmarkMeta}>
                    <span>{bookTitle(item.bookId)}</span>
                    <span style={S.bookmarkDot}>·</span>
                    <span>{fmtLocator(item.locator)}</span>
                    <span style={S.bookmarkDot}>·</span>
                    <span>{fmtDate(item.createdAt)}</span>
                  </div>
                </div>
              </div>
              <button
                style={S.bookmarkDelete}
                onClick={() => handleDeleteItem(item)}
                aria-label={item.kind === 'note' ? 'Eliminar nota' : 'Eliminar resaltado'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <NotesExportDialog
        open={showExportDialog}
        bookTitle={selectedBook?.title ?? ''}
        onClose={() => setShowExportDialog(false)}
        onExportMarkdown={handleExportAnnotations}
        onImportMarkdown={handleImportAnnotations}
      />
    </div>
  );
}

/* ==========================================================================
   Subcomponentes compartidos
   ========================================================================== */

function EmptyState({
  onImportFiles,
  onImportFolder,
}: {
  readonly onImportFiles: () => void;
  readonly onImportFolder: () => void;
}): JSX.Element {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={S.empty}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--tx-faint)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
      <h3 style={S.emptyTitle}>No hay libros importados</h3>
      <p style={S.emptyHint}>Importa tu primer libro para comenzar a leer.</p>
      <div style={{ position: 'relative' }} ref={importMenuRef}>
        <button style={S.emptyBtn} onClick={() => setShowImportMenu(!showImportMenu)}>
          Importar libro
        </button>
        {showImportMenu && (
          <div style={S.importMenu}>
            <button
              style={S.importMenuItem}
              onClick={() => {
                setShowImportMenu(false);
                onImportFiles();
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Importar archivo(s)
            </button>
            <button
              style={S.importMenuItem}
              onClick={() => {
                setShowImportMenu(false);
                onImportFolder();
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Importar carpeta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({
  title,
  count,
}: {
  readonly title: string;
  readonly count: string;
}): JSX.Element {
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
  readonly progress?: ReadingProgress | undefined;
  readonly onOpen: (book: Book) => void;
  readonly onRemove: (bookId: string, bookTitle: string) => void;
  readonly onSaveRank: (bookId: string, rank: Rank) => void;
}

function BookCard({ book, progress, onOpen, onRemove, onSaveRank }: BookCardProps): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const [hoverRank, setHoverRank] = useState<number | null>(null);
  const isMissing = book.status === 'missing';
  const status = getReadingStatus(book);
  const cfg = STATUS_CFG[status];
  const [c1, c2] = getCoverColors(book.id);
  const glyph = getGlyph(book.id);
  const authorLast = getAuthorLast(book.author);
  const progressPercent = progress ? Math.round(progress.percent * 100) : 0;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(book);
    }
  };
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(book.id, book.title);
  };

  const handleRankClick = (e: React.MouseEvent, rank: number) => {
    e.stopPropagation();
    onSaveRank(book.id, rank as Rank);
  };

  const handleRankKeyDown = (e: React.KeyboardEvent) => {
    const current = book.rank ?? 0;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const next = Math.min(5, current + 0.5);
      onSaveRank(book.id, next as Rank);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      const prev = Math.max(0, current - 0.5);
      onSaveRank(book.id, prev as Rank);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      onSaveRank(book.id, 0 as Rank);
    }
  };

  const handleClearRank = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveRank(book.id, 0 as Rank);
  };

  const handleStarMouseMove = (e: React.MouseEvent, starIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftHalf = x < rect.width / 2;
    setHoverRank(isLeftHalf ? starIndex - 0.5 : starIndex);
  };

  const gradientId = `halfStar-${book.id}`;
  const currentRank = book.rank ?? 0;

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
      <div
        style={{
          ...S.cover,
          background: book.coverImage ? undefined : `linear-gradient(150deg, ${c1}, ${c2})`,
          boxShadow: hovered
            ? '0 22px 46px -16px rgba(0,0,0,.9), inset 0 0 0 1px rgba(230,200,116,.35)'
            : '0 12px 30px -14px rgba(0,0,0,.85), inset 0 0 0 1px rgba(255,255,255,.05)',
        }}
      >
        {book.coverImage ? (
          <img
            src={book.coverImage}
            alt={book.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        ) : (
          <div style={S.coverArt}>
            <div style={S.coverAuthor}>{authorLast}</div>
            <div style={S.coverTitle}>{book.title}</div>
            <div style={S.coverGlyph}>{glyph}</div>
          </div>
        )}
        <span style={S.docType}>{book.format.toUpperCase()}</span>
        <span style={S.statusTag}>
          <span
            style={{
              ...S.dot,
              backgroundColor: cfg.dot,
              boxShadow:
                status === 'reading'
                  ? '0 0 0 3px rgba(133,179,150,.25)'
                  : status === 'opened'
                    ? '0 0 0 3px rgba(169,171,58,.25)'
                    : 'none',
            }}
          />
          {cfg.label}
        </span>
        {status === 'reading' && progressPercent > 0 && (
          <div style={S.coverProgress}>
            <div style={{ ...S.coverProgressFill, width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
      <div style={S.cardBody}>
        <div style={S.cardTitle}>{book.title}</div>
        {book.author && <div style={S.cardAuthor}>{book.author}</div>}
        <div style={S.cardMeta}>
          {book.lastOpenedAt ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.75 }}
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              Visto {relDate(book.lastOpenedAt)}
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.75 }}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Añadido {relDate(book.addedAt)}
            </>
          )}
          {progressPercent > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--verdigris)' }}>
              {progressPercent}% leído
            </span>
          )}
        </div>
        <div style={S.cardFooter}>
          <div
            style={S.starRating}
            role="radiogroup"
            aria-label={`Rating: ${currentRank} de 5 estrellas`}
            onMouseLeave={() => setHoverRank(null)}
            onKeyDown={handleRankKeyDown}
            tabIndex={0}
          >
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id={gradientId}>
                  <stop offset="50%" stopColor="var(--gold)" />
                  <stop offset="50%" stopColor="var(--line)" />
                </linearGradient>
              </defs>
            </svg>
            {[1, 2, 3, 4, 5].map((s) => {
              const displayRank = hoverRank ?? currentRank;
              const isHalf = displayRank >= s - 0.5 && displayRank < s;
              const isFull = displayRank >= s;
              return (
                <span
                  key={s}
                  role="radio"
                  aria-checked={isFull || isHalf}
                  aria-label={`${s} estrella${s > 1 ? 's' : ''}`}
                  style={S.starBtn}
                  onMouseMove={(e) => handleStarMouseMove(e, s)}
                  onClick={(e) => handleRankClick(e, isHalf ? s - 0.5 : s)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={isFull ? 'var(--gold)' : isHalf ? `url(#${gradientId})` : 'var(--line)'}
                    stroke="none"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              );
            })}
            {hoverRank !== null && <span style={S.rankTooltip}>{hoverRank}</span>}
          </div>
          {currentRank > 0 && (
            <button style={S.clearRankBtn} onClick={handleClearRank} aria-label="Limpiar rating">
              ×
            </button>
          )}
          <button style={S.removeBtn} onClick={handleRemove} aria-label={`Eliminar ${book.title}`}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
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
    display: 'flex',
    height: '100vh',
    background:
      'radial-gradient(1200px 600px at 80% -10%, rgba(var(--verdigris-rgb),.06), transparent 60%), radial-gradient(1000px 500px at -5% 110%, rgba(var(--gold-rgb),.06), transparent 55%), var(--ink-950)',
    fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
    color: 'var(--tx)',
    transition: 'background .3s var(--ease)',
  },

  /* --- Rail --- */
  rail: {
    width: 76,
    flexShrink: 0,
    background: 'linear-gradient(180deg, var(--ink-900), var(--ink-950))',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '18px 0',
    gap: 6,
    position: 'relative',
    zIndex: 20,
  },
  brand: {
    width: 46,
    height: 46,
    borderRadius: 13,
    display: 'grid',
    placeItems: 'center',
    marginBottom: 18,
    background: 'radial-gradient(120% 120% at 30% 20%, var(--ink-800), var(--ink-950))',
    border: '1px solid var(--gold-dim)',
    boxShadow: 'inset 0 1px 0 rgba(var(--gold-rgb),.25), 0 6px 18px -8px rgba(0,0,0,.8)',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', flex: 1 },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 13,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--tx-lo)',
    position: 'relative',
    transition: '.22s cubic-bezier(.22,.61,.36,1)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  },
  navBtnActive: {
    color: 'var(--on-gold)',
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
  },
  navIndicator: {
    position: 'absolute',
    left: -18,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 4,
    height: 22,
    borderRadius: '0 4px 4px 0',
    background: 'var(--gold-bright)',
  },
  tooltip: {
    position: 'absolute',
    left: 58,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--ink-800)',
    color: 'var(--tx-hi)',
    border: '1px solid var(--line)',
    padding: '6px 11px',
    borderRadius: 9,
    fontSize: 12.5,
    whiteSpace: 'nowrap',
    zIndex: 40,
    boxShadow: '0 18px 50px -20px rgba(0,0,0,.7)',
    fontWeight: 500,
  },

  /* --- Stage --- */
  stage: { flex: 1, position: 'relative', overflow: 'hidden' },
  wrap: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '34px 40px 60px',
    height: '100%',
    overflowY: 'auto',
  } as React.CSSProperties,

  /* --- Topbar --- */
  topbar: { display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 },
  h1: {
    fontFamily: '"Fraunces", serif',
    fontWeight: 600,
    color: 'var(--tx-hi)',
    fontSize: 30,
    letterSpacing: '-.01em',
    lineHeight: 1.1,
    margin: 0,
  },
  sub: { color: 'var(--tx-lo)', fontSize: 13.5, marginTop: 2 },
  search: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    borderRadius: 11,
    padding: '0 12px',
    height: 42,
    minWidth: 230,
    transition: '.2s',
    color: 'var(--tx-lo)',
  },
  searchInput: {
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--tx-hi)',
    fontSize: 14,
    width: '100%',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  /* --- Meander --- */
  meander: {
    height: 8,
    width: '100%',
    marginBottom: 34,
    backgroundImage:
      'repeating-linear-gradient(90deg, rgba(var(--gold-rgb),.55) 0 2px, transparent 2px 14px)',
    WebkitMask:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Cpath d='M0 7h4V3h4v4h4V1h4v6h4' fill='none' stroke='%23000' stroke-width='1.4'/%3E%3C/svg%3E\") repeat-x",
    mask: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8' viewBox='0 0 24 8'%3E%3Cpath d='M0 7h4V3h4v4h4V1h4v6h4' fill='none' stroke='%23000' stroke-width='1.4'/%3E%3C/svg%3E\") repeat-x",
    opacity: 0.7,
  },

  /* --- Section headers --- */
  sectionHead: { display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 },
  sectionAccent: {
    width: 26,
    height: 2,
    background: 'var(--gold)',
    borderRadius: 2,
    alignSelf: 'center',
    opacity: 0.8,
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: '"Fraunces", serif',
    fontWeight: 600,
    color: 'var(--tx-hi)',
    fontSize: 19,
    letterSpacing: '-.01em',
    margin: 0,
  },
  sectionCount: { color: 'var(--tx-faint)', fontSize: 13 },

  /* --- Rows / Grid --- */
  row: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 200,
    gap: 20,
    overflowX: 'auto',
    paddingBottom: 14,
    scrollSnapType: 'x proximity',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 24,
  },

  /* --- Chips --- */
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 },
  chip: {
    padding: '8px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    color: 'var(--tx-lo)',
    transition: '.18s',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chipActive: {
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)',
    border: '1px solid transparent',
    fontWeight: 600,
  },

  /* --- Filter row (format / language / sort) --- */
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '0 0 6px',
    flexWrap: 'wrap',
    marginBottom: 28,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    color: 'var(--tx-lo)',
    fontWeight: 500,
    letterSpacing: '.02em',
  },
  chipsSmall: { display: 'flex', gap: 8 },
  chipSm: {
    padding: '8px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    color: 'var(--tx-lo)',
    transition: '.18s',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chipSmActive: {
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)',
    border: '1px solid transparent',
    fontWeight: 600,
  },
  select: {
    padding: '8px 14px',
    borderRadius: 20,
    fontSize: 13,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    color: 'var(--tx)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'auto' as const,
  },

  /* --- Import button & menu --- */
  importBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 600,
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: '.18s',
  },
  importMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    background: 'var(--ink-800)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    padding: 6,
    zIndex: 50,
    boxShadow: '0 18px 50px -20px rgba(0,0,0,.7)',
    minWidth: 200,
  },
  importMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'none',
    border: 'none',
    color: 'var(--tx)',
    fontSize: 13.5,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: '.15s',
    textAlign: 'left',
  },
  importProgress: {
    marginBottom: 20,
    padding: '14px 16px',
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    borderRadius: 10,
  },
  importProgressBar: {
    height: 6,
    background: 'var(--ink-800)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  importProgressFill: {
    display: 'block',
    height: '100%',
    background: 'linear-gradient(90deg, var(--verdigris), var(--gold-bright))',
    borderRadius: 4,
    transition: 'width .3s',
  },
  importProgressText: {
    fontSize: 13,
    color: 'var(--tx-lo)',
  },

  /* --- Empty states --- */
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '80px 20px',
    color: 'var(--tx-lo)',
    textAlign: 'center',
  },
  emptyCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '60px 20px',
    color: 'var(--tx-lo)',
    textAlign: 'center',
  },
  emptyBookmarks: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '80px 20px',
    color: 'var(--tx-lo)',
    textAlign: 'center',
  },
  bookmarksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bookmarkItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: 10,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    transition: '.15s',
  },
  bookmarkContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    cursor: 'pointer',
  },
  bookmarkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(var(--gold-rgb),.12)',
  },
  bookmarkInfo: { flex: 1, minWidth: 0 },
  bookmarkTitle: {
    fontFamily: '"Fraunces", serif',
    fontWeight: 600,
    color: 'var(--tx-hi)',
    fontSize: 14,
    lineHeight: 1.3,
    marginBottom: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bookmarkMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--tx-faint)',
    fontSize: 12,
  },
  bookmarkDot: { opacity: 0.5 },
  bookmarkDelete: {
    padding: '6px 8px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    color: 'var(--tx-faint)',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'inherit',
    transition: '.15s',
    flexShrink: 0,
  },
  notesToolbar: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  notesSelect: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    color: 'var(--tx)',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
    minWidth: 180,
  },
  notesActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 8,
    background: 'var(--ink-850)',
    border: '1px solid var(--gold-dim)',
    color: 'var(--tx)',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    transition: '.15s',
  },
  notesNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    marginBottom: 16,
    borderRadius: 8,
    background: 'var(--ink-850)',
    border: '1px solid var(--line)',
    color: 'var(--tx)',
    fontSize: 13,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },
  notesNoticeClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--tx-faint)',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    padding: '0 4px',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  noteBody: {
    fontSize: 14,
    color: 'var(--tx)',
    lineHeight: 1.45,
    marginBottom: 2,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  noteQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'var(--tx-lo)',
    borderLeft: '2px solid var(--line)',
    paddingLeft: 8,
    marginBottom: 4,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  },
  highlightSwatch: {
    width: 18,
    height: 34,
    borderRadius: 6,
    border: '1px solid var(--line)',
    flexShrink: 0,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'var(--tx-faint)',
    marginBottom: 2,
  },
  emptyTitle: {
    fontFamily: '"Fraunces", serif',
    color: 'var(--tx)',
    fontWeight: 600,
    fontSize: 18,
    margin: 0,
  },
  emptyHint: { fontSize: 14, color: 'var(--tx-faint)', margin: 0, maxWidth: 340 },
  emptyBtn: {
    marginTop: 8,
    padding: '10px 20px',
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* --- Card --- */
  card: {
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
    transition: 'transform .22s cubic-bezier(.22,.61,.36,1)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
  },
  cover: {
    position: 'relative',
    aspectRatio: '2/3',
    borderRadius: 12,
    overflow: 'hidden',
    transition: 'box-shadow .22s cubic-bezier(.22,.61,.36,1)',
  },
  docType: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 4,
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '.09em',
    padding: '4px 7px',
    borderRadius: 6,
    color: '#fff',
    background: 'rgba(var(--ink950-rgb),.6)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,.18)',
  },
  statusTag: {
    position: 'absolute',
    left: 10,
    top: 10,
    zIndex: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '.02em',
    padding: '4px 8px 4px 6px',
    borderRadius: 20,
    background: 'rgba(var(--ink950-rgb),.62)',
    backdropFilter: 'blur(6px)',
    color: 'var(--tx-hi)',
    border: '1px solid rgba(255,255,255,.12)',
  },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  coverArt: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px 14px 14px 18px',
  },
  coverAuthor: {
    fontSize: 10.5,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.72)',
    fontWeight: 600,
  },
  coverTitle: {
    fontFamily: '"Fraunces", serif',
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 1.15,
    color: '#fff',
    textShadow: '0 1px 12px rgba(0,0,0,.4)',
    letterSpacing: '-.01em',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as React.CSSProperties,
  coverGlyph: {
    fontFamily: '"Fraunces", serif',
    fontSize: 38,
    color: 'rgba(255,255,255,.24)',
    alignSelf: 'flex-end',
    lineHeight: 1,
  },
  coverProgress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    background: 'rgba(0,0,0,.4)',
    zIndex: 4,
  },
  coverProgressFill: {
    display: 'block',
    height: '100%',
    background: 'linear-gradient(90deg, var(--verdigris), var(--gold-bright))',
    borderRadius: 20,
  },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 3, padding: '0 2px' },
  cardTitle: {
    fontFamily: '"Fraunces", serif',
    fontWeight: 600,
    color: 'var(--tx-hi)',
    fontSize: 15,
    lineHeight: 1.25,
    letterSpacing: '-.005em',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as React.CSSProperties,
  cardAuthor: {
    color: 'var(--tx-lo)',
    fontSize: 12.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
    color: 'var(--tx-faint)',
    fontSize: 11.5,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTop: '1px solid var(--ink-800)',
  },
  starRating: { display: 'flex', gap: 2, alignItems: 'center', outline: 'none' },
  starBtn: {
    cursor: 'pointer',
    display: 'inline-flex',
    padding: 2,
    borderRadius: 3,
    transition: 'transform .1s',
  },
  rankTooltip: {
    fontSize: 10,
    color: 'var(--gold)',
    fontWeight: 600,
    marginLeft: 4,
    fontFamily: 'var(--font-body)',
  },
  clearRankBtn: {
    padding: '1px 5px',
    background: 'transparent',
    border: 'none',
    color: 'var(--tx-faint)',
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: 1,
    fontFamily: 'inherit',
    borderRadius: 4,
    transition: '.15s',
  },
  removeBtn: {
    padding: '3px 8px',
    background: 'transparent',
    border: '1px solid var(--line)',
    borderRadius: 6,
    color: 'var(--tx-faint)',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'inherit',
    transition: '.15s',
  },

  /* --- Palette picker --- */
  palettePopover: {
    position: 'absolute',
    left: 58,
    bottom: 0,
    background: 'var(--ink-800)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: 14,
    zIndex: 50,
    boxShadow: '0 18px 50px -20px rgba(0,0,0,.7)',
    minWidth: 200,
  },
  palettePopoverTitle: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--tx-lo)',
    marginBottom: 10,
  },
  paletteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
  },
  paletteSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '2px solid transparent',
    cursor: 'pointer',
    position: 'relative',
    transition: '.15s',
    display: 'grid',
    placeItems: 'center',
    padding: 0,
  },
  paletteSwatchAccent: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
};
