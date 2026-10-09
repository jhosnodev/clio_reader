import type { ReaderLocator, TextAnchor } from '@clio-reader/domain';
import { buildTextAnchor, resolveTextAnchor } from '@clio-reader/reader-core';

/** Nombre del highlight CSS Custom API para las notas ancladas. */
export const NOTE_HIGHLIGHT_NAME = 'clio-note';

/** Nombre del highlight CSS Custom API para la nota activa. */
export const ACTIVE_NOTE_HIGHLIGHT_NAME = 'clio-note-active';

const SKIPPED_TAGS = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'HEAD']);

interface HighlightRegistryLike {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

interface HighlightLike {
  ranges: Range[];
}

type HighlightConstructorLike = new (...ranges: Range[]) => HighlightLike;

interface HighlightApi {
  readonly Highlight: HighlightConstructorLike;
  readonly highlights: HighlightRegistryLike;
}

export interface AnchoredSelection {
  readonly quote: string;
  readonly anchor: TextAnchor;
}

export interface AnchorLookup {
  readonly locator: ReaderLocator;
  readonly range: Range;
  readonly recovered: boolean;
}

function highlightApi(): HighlightApi | null {
  const scope = globalThis as unknown as {
    Highlight?: HighlightConstructorLike;
    CSS?: { highlights?: HighlightRegistryLike };
  };
  const registry = scope.CSS?.highlights;
  if (typeof scope.Highlight !== 'function' || !registry) return null;
  return { Highlight: scope.Highlight, highlights: registry };
}

/**
 * Nodos de texto que componen el capítulo renderizado. Se excluyen los nodos no
 * visibles (hojas de estilo del EPUB y del tema) para que los offsets del ancla
 * midan el texto que el usuario lee.
 */
function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      if (!node.nodeValue || node.nodeValue.length === 0) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || SKIPPED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current !== null) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return nodes;
}

/** Texto plano del capítulo, base sobre la que se miden los offsets. */
export function getPlainText(root: HTMLElement): string {
  return collectTextNodes(root)
    .map((node) => node.data)
    .join('');
}

function locateNodeAt(
  nodes: readonly Text[],
  offset: number,
): { node: Text; offset: number } | null {
  if (nodes.length === 0) return null;

  let total = 0;
  for (const node of nodes) {
    const length = node.data.length;
    if (offset <= total + length) {
      return { node, offset: Math.max(0, offset - total) };
    }
    total += length;
  }

  const last = nodes[nodes.length - 1]!;
  return { node: last, offset: last.data.length };
}

/** Convierte un rango del DOM en offsets sobre el texto plano del capítulo. */
export function rangeToOffsets(root: HTMLElement, range: Range): [number, number] | null {
  const nodes = collectTextNodes(root);
  const start = boundaryToOffset(nodes, range.startContainer, range.startOffset);
  const end = boundaryToOffset(nodes, range.endContainer, range.endOffset);
  if (start === null || end === null || end <= start) return null;
  return [start, end];
}

function boundaryToOffset(nodes: readonly Text[], container: Node, offset: number): number | null {
  let total = 0;
  let afterPrecedingNode: number | null = null;

  for (const node of nodes) {
    if (node === container) return total + Math.min(offset, node.data.length);
    total += node.data.length;

    if (!(container instanceof Element)) continue;
    const preceding = offset > 0 ? (container.childNodes[offset - 1] ?? null) : null;
    if (preceding === null) {
      if (container.contains(node)) return total;
    } else if (preceding === node || preceding.contains(node)) {
      afterPrecedingNode = total;
    }
  }

  return afterPrecedingNode;
}

/**
 * Índice del texto del capítulo. Se construye una vez por render para no
 * recorrer el DOM por cada nota que hay que resaltar.
 */
export interface ChapterTextIndex {
  readonly text: string;
  rangeForOffsets(start: number, end: number): Range | null;
}

export function indexChapterText(root: HTMLElement): ChapterTextIndex {
  const nodes = collectTextNodes(root);
  const text = nodes.map((node) => node.data).join('');

  return {
    text,
    rangeForOffsets: (start, end) => createRangeFromNodes(nodes, start, end),
  };
}

function createRangeFromNodes(nodes: readonly Text[], start: number, end: number): Range | null {
  const from = locateNodeAt(nodes, start);
  const to = locateNodeAt(nodes, end);
  if (!from || !to) return null;

  const range = document.createRange();
  try {
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}

/**
 * Captura la selección del usuario sobre el capítulo y construye el ancla de
 * la nota. Devuelve null si la selección está colapsada o cae fuera del texto.
 */
export function captureSelection(root: HTMLElement): AnchoredSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const offsets = rangeToOffsets(root, range);
  const text = getPlainText(root);

  if (offsets === null) {
    const quote = normalizeSelectionText(selection.toString());
    if (quote.length === 0) return null;
    const start = text.indexOf(quote);
    if (start === -1) return null;
    return { quote, anchor: buildTextAnchor(text, start, start + quote.length) };
  }

  const [start, end] = offsets;
  const quote = normalizeSelectionText(text.slice(start, end));
  if (quote.length === 0) return null;

  return { quote, anchor: buildTextAnchor(text, start, end) };
}

function normalizeSelectionText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Localiza el rango del capítulo que cubre una nota anclada. `recovered` indica
 * que la cita se localizó por búsqueda en lugar de por sus offsets originales.
 */
export function resolveAnchorRange(
  index: ChapterTextIndex,
  locator: ReaderLocator,
  quote?: string,
): AnchorLookup | null {
  if (locator.format !== 'epub' && locator.format !== 'md') return null;
  const anchor = locator.anchor;
  if (!anchor || anchor.end <= anchor.start) return null;

  const resolved = resolveTextAnchor(index.text, anchor, quote);
  if (!resolved) return null;

  const range = index.rangeForOffsets(resolved.start, resolved.end);
  if (!range) return null;

  return { locator, range, recovered: resolved.resolution === 'recovered' };
}

/** Pinta visualmente las notas ancladas del capítulo actual. */
export function paintNoteHighlights(ranges: readonly Range[]): void {
  const api = highlightApi();
  if (!api) return;

  if (ranges.length === 0) {
    api.highlights.delete(NOTE_HIGHLIGHT_NAME);
    return;
  }

  api.highlights.set(NOTE_HIGHLIGHT_NAME, new api.Highlight(...ranges));
}

/** Resalta la nota que el usuario está leyendo o editando. */
export function paintActiveNoteHighlight(range: Range | null): void {
  const api = highlightApi();
  if (!api) return;

  if (!range) {
    api.highlights.delete(ACTIVE_NOTE_HIGHLIGHT_NAME);
    return;
  }

  api.highlights.set(ACTIVE_NOTE_HIGHLIGHT_NAME, new api.Highlight(range));
}

/** Elimina los resaltados de notas del capítulo. */
export function clearNoteHighlights(): void {
  const api = highlightApi();
  if (!api) return;
  api.highlights.delete(NOTE_HIGHLIGHT_NAME);
  api.highlights.delete(ACTIVE_NOTE_HIGHLIGHT_NAME);
}

const paintedHighlightNames = new Set<string>();

/**
 * Pinta los resaltados de usuario agrupados por nombre de registry
 * (`clio-hl-<color>`). Los colores que desaparecen del mapa se borran.
 */
export function paintHighlightRanges(byName: Readonly<Record<string, readonly Range[]>>): void {
  const api = highlightApi();
  if (!api) return;

  for (const name of [...paintedHighlightNames]) {
    if (!(name in byName)) {
      api.highlights.delete(name);
      paintedHighlightNames.delete(name);
    }
  }

  for (const [name, ranges] of Object.entries(byName)) {
    if (ranges.length === 0) {
      api.highlights.delete(name);
      paintedHighlightNames.delete(name);
      continue;
    }
    api.highlights.set(name, new api.Highlight(...ranges));
    paintedHighlightNames.add(name);
  }
}

/** Elimina todos los resaltados de usuario del capítulo. */
export function clearHighlightRanges(): void {
  const api = highlightApi();
  if (!api) return;
  for (const name of paintedHighlightNames) {
    api.highlights.delete(name);
  }
  paintedHighlightNames.clear();
}
