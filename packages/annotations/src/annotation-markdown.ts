import type { Bookmark, Highlight, Note, ReaderLocator } from '@clio-reader/domain';

import { validateBookmarkForExport, validateHighlightForExport, validateNoteForExport } from './annotation-validator.js';

export interface AnnotationMarkdownExportOptions {
  readonly bookTitle?: string;
  readonly bookFormat?: string;
  readonly fileHash?: string;
}

export interface AnnotationMarkdownImportResult {
  readonly bookmarksImported: number;
  readonly notesImported: number;
  readonly highlightsImported: number;
  readonly skipped: number;
  readonly unresolved: number;
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatDateIso(ts: number): string {
  return new Date(ts).toISOString();
}

function safeJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function normalizeSelectedText(text?: string): string {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function fenceSelectedText(text: string): string {
  const normalized = normalizeSelectedText(text);
  const hasTripleBacktick = normalized.includes('```');
  if (hasTripleBacktick) {
    return normalized;
  }
  let fence = '```';
  while (normalized.includes(fence)) {
    fence += '`';
  }
  return `${fence}\n${normalized}\n${fence}`;
}

function extractClioBlocks(md: string): Array<{ type: 'highlight' | 'note' | 'bookmark'; json: string }> {
  const blocks: Array<{ type: 'highlight' | 'note' | 'bookmark'; json: string }> = [];
  const regex = /<!--\s*clio:(highlight|note|bookmark)\s+(\{[\s\S]*?\})\s*-->/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(md)) !== null) {
    blocks.push({ type: match[1] as 'highlight' | 'note' | 'bookmark', json: match[2] ?? '{}' });
  }
  return blocks;
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

function asReaderLocator(obj: unknown): ReaderLocator | null {
  if (!isPlainObject(obj)) return null;
  if (typeof obj.format !== 'string') return null;
  return obj as unknown as ReaderLocator;
}

export function exportAnnotationsToMarkdown(
  data: {
    readonly bookId: string;
    readonly bookmarks: readonly Bookmark[];
    readonly notes: readonly Note[];
    readonly highlights: readonly Highlight[];
    readonly exportedAt: number;
  },
  options?: AnnotationMarkdownExportOptions,
): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('clio: annotations');
  lines.push('version: 1');
  lines.push(`bookId: ${data.bookId}`);
  if (options?.bookTitle) {
    lines.push(`bookTitle: "${escapeYamlString(options.bookTitle)}"`);
  }
  if (options?.bookFormat) {
    lines.push(`format: ${options.bookFormat}`);
  }
  if (options?.fileHash) {
    lines.push(`fileHash: "${escapeYamlString(options.fileHash)}"`);
  }
  lines.push(`exportedAt: ${formatDateIso(data.exportedAt)}`);
  lines.push('---');
  lines.push('');

  const title = options?.bookTitle ? options.bookTitle : data.bookId;
  lines.push(`# Notas y resaltados — ${title}`);
  lines.push('');

  // Order: by position heuristic using locator progression/page/anchor.start
  const allItems = [
    ...data.highlights.map((h) => ({ type: 'highlight' as const, createdAt: h.createdAt, item: h })),
    ...data.notes.map((n) => ({ type: 'note' as const, createdAt: n.createdAt, item: n })),
    ...data.bookmarks.map((b) => ({ type: 'bookmark' as const, createdAt: b.createdAt, item: b })),
  ].sort((a, b) => {
    const posA = getPositionKey(extractLocatorForItem(a));
    const posB = getPositionKey(extractLocatorForItem(b));
    if (posA !== posB) return posA - posB;
    return a.createdAt - b.createdAt;
  });

  for (const entry of allItems) {
    const selected = getSelectedText(entry);
    if (selected) {
      lines.push(fenceSelectedText(selected));
      lines.push('');
    }
    if (entry.type === 'highlight') {
      const h = entry.item as Highlight;
      lines.push(`- **Resaltado** — color \`${h.color}\`, estilo \`${h.style}\``);
      lines.push(`  <!-- clio:highlight ${safeJson(toHighlightJson(h))} -->`);
      lines.push('');
    } else if (entry.type === 'note') {
      const n = entry.item as Note;
      if (n.body) {
        lines.push(`- **Nota** — ${n.body}`);
      } else {
        lines.push('- **Nota**');
      }
      lines.push(`  <!-- clio:note ${safeJson(toNoteJson(n))} -->`);
      lines.push('');
    } else if (entry.type === 'bookmark') {
      const b = entry.item as Bookmark;
      const label = b.label ? ` — ${b.label}` : '';
      lines.push(`- **Marcador**${label}`);
      lines.push(`  <!-- clio:bookmark ${safeJson(toBookmarkJson(b))} -->`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function importAnnotationsFromMarkdown(
  md: string,
  bookId: string,
  _expectedBookId?: string,
  _fileHash?: string,
): { data: unknown; result: AnnotationMarkdownImportResult } {
  const blocks = extractClioBlocks(md);
  let result: AnnotationMarkdownImportResult = {
    bookmarksImported: 0,
    notesImported: 0,
    highlightsImported: 0,
    skipped: 0,
    unresolved: 0,
  };

  const bookmarks: Bookmark[] = [];
  const notes: Note[] = [];
  const highlights: Highlight[] = [];

  if (blocks.length === 0) {
    return {
      data: { version: 1, bookId, bookmarks: [], notes: [], highlights: [], exportedAt: Date.now() },
      result: { bookmarksImported: 0, notesImported: 0, highlightsImported: 0, skipped: 0, unresolved: 0 },
    };
  }

  // Optional: warn if book mismatch? but just proceed per spec (we can ignore)
  // Parse each block
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b.json);
      if (b.type === 'highlight') {
        const h = normalizeHighlight(parsed, bookId);
        const v = validateHighlightForExport(h);
        if (v.valid) {
          highlights.push(h as Highlight);
        } else {
          result = { ...result, skipped: result.skipped + 1 };
        }
      } else if (b.type === 'note') {
        const n = normalizeNote(parsed, bookId);
        const v = validateNoteForExport(n);
        if (v.valid) {
          notes.push(n as Note);
        } else {
          result = { ...result, skipped: result.skipped + 1 };
        }
      } else if (b.type === 'bookmark') {
        const bm = normalizeBookmark(parsed, bookId);
        const v = validateBookmarkForExport(bm);
        if (v.valid) {
          bookmarks.push(bm as Bookmark);
        } else {
          result = { ...result, skipped: result.skipped + 1 };
        }
      }
    } catch {
      result = { ...result, skipped: result.skipped + 1 };
    }
  }

  return {
    data: {
      version: 1,
      bookId,
      bookmarks,
      notes,
      highlights,
      exportedAt: Date.now(),
    },
    result: {
      ...result,
      bookmarksImported: bookmarks.length,
      notesImported: notes.length,
      highlightsImported: highlights.length,
    },
  };
}

type Entry = { type: 'highlight' | 'note' | 'bookmark'; createdAt: number; item: Highlight | Note | Bookmark };
function getSelectedText(entry: Entry): string | undefined {
  if (entry.type === 'highlight') return (entry.item as Highlight).selectedText;
  if (entry.type === 'note') return (entry.item as Note).selectedText;
  return undefined;
}

function extractLocatorForItem(entry: Entry): ReaderLocator {
  if (entry.type === 'highlight') return (entry.item as Highlight).locatorStart;
  return (entry.item as Bookmark | Note).locator;
}

function getPositionKey(locator: ReaderLocator): number {
  let base = 0;
  const l = locator as unknown as Record<string, unknown>;
  if (typeof l.progression === 'number') base = l.progression;
  else if (typeof l.positionOrder === 'number') base = l.positionOrder;
  else if (typeof l.page === 'number') base = l.page;
  const anchor = l['anchor'] as Record<string, unknown> | undefined;
  const anchorStart = anchor?.['start'];
  return base * 1_000_000 + (typeof anchorStart === 'number' ? anchorStart : 0);
}

function toHighlightJson(h: Highlight): unknown {
  return {
    id: h.id,
    bookId: h.bookId,
    locatorStart: h.locatorStart,
    ...(h.locatorEnd ? { locatorEnd: h.locatorEnd } : {}),
    ...(h.selectedText !== undefined ? { selectedText: h.selectedText } : {}),
    color: h.color,
    style: h.style,
    ...(h.note !== undefined ? { note: h.note } : {}),
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
  };
}

function toNoteJson(n: Note): unknown {
  return {
    id: n.id,
    bookId: n.bookId,
    locator: n.locator,
    ...(n.selectedText !== undefined ? { selectedText: n.selectedText } : {}),
    body: n.body,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

function toBookmarkJson(b: Bookmark): unknown {
  return {
    id: b.id,
    bookId: b.bookId,
    locator: b.locator,
    ...(b.label !== undefined ? { label: b.label } : {}),
    createdAt: b.createdAt,
    ...(b.updatedAt !== undefined ? { updatedAt: b.updatedAt } : {}),
  };
}

function normalizeHighlight(obj: Record<string, unknown>, bookId: string): Partial<Highlight> {
  const out: Record<string, unknown> = {
    id: typeof obj.id === 'string' ? obj.id : `hl-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    bookId: typeof obj.bookId === 'string' ? obj.bookId : bookId,
    locatorStart: asReaderLocator(obj.locatorStart) ?? { format: 'epub', href: '#' },
    color: typeof obj.color === 'string' ? obj.color : '#facc15',
    style: obj.style === 'underline' ? 'underline' : 'highlight',
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
  };
  const le = asReaderLocator(obj.locatorEnd);
  if (le) out.locatorEnd = le;
  if (typeof obj.selectedText === 'string') out.selectedText = obj.selectedText;
  if (typeof obj.note === 'string') out.note = obj.note;
  return out;
}

function normalizeNote(obj: Record<string, unknown>, bookId: string): Partial<Note> {
  const out: Record<string, unknown> = {
    id: typeof obj.id === 'string' ? obj.id : `note-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    bookId: typeof obj.bookId === 'string' ? obj.bookId : bookId,
    locator: asReaderLocator(obj.locator) ?? { format: 'epub', href: '#' },
    body: typeof obj.body === 'string' ? obj.body : '',
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
  };
  if (typeof obj.selectedText === 'string') out.selectedText = obj.selectedText;
  return out;
}

function normalizeBookmark(obj: Record<string, unknown>, bookId: string): Partial<Bookmark> {
  const out: Record<string, unknown> = {
    id: typeof obj.id === 'string' ? obj.id : `bm-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    bookId: typeof obj.bookId === 'string' ? obj.bookId : bookId,
    locator: asReaderLocator(obj.locator) ?? { format: 'epub', href: '#' },
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
  };
  if (typeof obj.updatedAt === 'number') out.updatedAt = obj.updatedAt;
  if (typeof obj.label === 'string') out.label = obj.label;
  return out;
}
