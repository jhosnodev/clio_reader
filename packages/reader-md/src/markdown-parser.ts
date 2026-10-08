import type { TocNavEntry } from '@clio-reader/reader-core';

export interface MarkdownHeading {
  readonly level: number;
  readonly title: string;
  readonly slug: string;
  readonly offset: number;
}

export interface MarkdownSection {
  /** Índice de la sección dentro del documento (0-based). */
  readonly index: number;
  /** Nivel del heading que abre la sección (0 = preámbulo sin heading). */
  readonly level: number;
  /** Texto plano del heading (vacío en el preámbulo). */
  readonly title: string;
  /** Identificador estable del heading, usado en locators y TOC. */
  readonly slug: string;
  /** Offset de caracteres del inicio de la sección dentro del Markdown. */
  readonly offset: number;
  /** HTML sanitizado de la sección, incluyendo su heading. */
  readonly html: string;
}

export interface ParsedMarkdown {
  readonly sections: readonly MarkdownSection[];
  readonly toc: readonly TocNavEntry[];
  readonly title?: string;
}

interface RawHeading {
  readonly lineIndex: number;
  readonly level: number;
  readonly title: string;
  readonly slug: string;
  readonly offset: number;
}

const ATX_HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)\s*$/;
const FENCED_CODE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)?.*$/;
const HORIZONTAL_RULE = /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const UNORDERED_LIST = /^ {0,3}[-*+]\s+(.*)$/;
const ORDERED_LIST = /^ {0,3}\d+[.)]\s+(.*)$/;
const BLOCKQUOTE = /^ {0,3}>\s?(.*)$/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.length > 0 ? base : 'seccion';
}

function sanitizeLinkUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    if (/^(https?:|mailto:)/i.test(trimmed)) return escapeHtml(trimmed);
    return '';
  }
  return escapeHtml(trimmed);
}

function sanitizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length === 0) return '';
  if (/^data:image\//i.test(trimmed)) return escapeHtml(trimmed);
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
  return escapeHtml(trimmed);
}

/** Convierte el Markdown inline (énfasis, enlaces, código, imágenes) a HTML. */
export function renderInline(text: string): string {
  const codeSpans: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\uE000${codeSpans.length - 1}\uE001`;
  });

  out = escapeHtml(out);

  out = out.replace(
    /!\[([^\]]*)\]\(((?:[^()\s]|\([^()]*\))+)(?:\s+["']([^"']*)["'])?\)/g,
    (_match, alt: string, url: string, title: string | undefined) => {
      const safe = sanitizeImageUrl(url);
      if (!safe) return escapeHtml(alt);
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${safe}" alt="${alt}"${titleAttr} />`;
    },
  );

  out = out.replace(
    /\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)(?:\s+["']([^"']*)["'])?\)/g,
    (_match, label: string, url: string, title: string | undefined) => {
      const safe = sanitizeLinkUrl(url);
      if (!safe) return label;
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${safe}" rel="noopener noreferrer"${titleAttr}>${label}</a>`;
    },
  );

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/ {2}\n/g, '<br />\n');

  out = out.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => {
    return `<code>${escapeHtml(codeSpans[Number(index)] ?? '')}</code>`;
  });

  return out;
}

function startOfBlock(line: string): boolean {
  return (
    ATX_HEADING.test(line) ||
    FENCED_CODE_OPEN.test(line) ||
    HORIZONTAL_RULE.test(line) ||
    UNORDERED_LIST.test(line) ||
    ORDERED_LIST.test(line) ||
    BLOCKQUOTE.test(line)
  );
}

function isTableStart(lines: readonly string[], index: number): boolean {
  const header = lines[index];
  const delimiter = lines[index + 1];
  if (header === undefined || delimiter === undefined) return false;
  return header.includes('|') && TABLE_DELIMITER.test(delimiter);
}

function splitTableRow(row: string): string[] {
  let value = row.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map((cell) => cell.trim());
}

function renderTable(lines: readonly string[], index: number): { html: string; next: number } {
  const header = splitTableRow(lines[index] ?? '');
  let cursor = index + 2;
  const rows: string[][] = [];
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined || line.trim().length === 0 || !line.includes('|')) break;
    rows.push(splitTableRow(line));
    cursor++;
  }
  const head = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
    .join('');
  return {
    html: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    next: cursor,
  };
}

function renderList(
  lines: readonly string[],
  index: number,
  ordered: boolean,
): { html: string; next: number } {
  const pattern = ordered ? ORDERED_LIST : UNORDERED_LIST;
  const items: string[] = [];
  let cursor = index;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined) break;
    const match = pattern.exec(line);
    if (!match) break;
    items.push(`<li>${renderInline(match[1] ?? '')}</li>`);
    cursor++;
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: cursor };
}

function renderBlockquote(lines: readonly string[], index: number): { html: string; next: number } {
  const inner: string[] = [];
  let cursor = index;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined) break;
    const match = BLOCKQUOTE.exec(line);
    if (!match) break;
    inner.push(match[1] ?? '');
    cursor++;
  }
  return { html: `<blockquote>${renderBlocks(inner)}</blockquote>`, next: cursor };
}

export function renderBlocks(lines: readonly string[]): string {
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (line.trim().length === 0) {
      index++;
      continue;
    }

    const fence = FENCED_CODE_OPEN.exec(line);
    if (fence) {
      const marker = (fence[1] ?? '```')[0]!;
      const language = fence[2] ?? '';
      const code: string[] = [];
      index++;
      while (index < lines.length) {
        const current = lines[index] ?? '';
        if (current.trim().length >= 3 && current.trim().startsWith(marker.repeat(3))) break;
        code.push(current);
        index++;
      }
      index++;
      const langClass = language ? ` class="language-${escapeHtml(language)}"` : '';
      blocks.push(`<pre><code${langClass}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const atx = ATX_HEADING.exec(line);
    if (atx) {
      const level = atx[1]!.length;
      const title = (atx[2] ?? '').trim();
      blocks.push(`<h${level} id="${slugify(title)}">${renderInline(title)}</h${level}>`);
      index++;
      continue;
    }

    if (HORIZONTAL_RULE.test(line)) {
      blocks.push('<hr />');
      index++;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const result = renderBlockquote(lines, index);
      blocks.push(result.html);
      index = result.next;
      continue;
    }

    if (UNORDERED_LIST.test(line) || ORDERED_LIST.test(line)) {
      const result = renderList(lines, index, ORDERED_LIST.test(line));
      blocks.push(result.html);
      index = result.next;
      continue;
    }

    if (isTableStart(lines, index)) {
      const result = renderTable(lines, index);
      blocks.push(result.html);
      index = result.next;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (current.trim().length === 0) break;
      if (paragraph.length > 0 && startOfBlock(current)) break;
      if (paragraph.length > 0 && isTableStart(lines, index)) break;
      paragraph.push(current);
      index++;
    }
    blocks.push(`<p>${renderInline(paragraph.join('\n'))}</p>`);
  }

  return blocks.join('\n');
}

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

function collectHeadings(lines: readonly string[], offsets: readonly number[]): RawHeading[] {
  const headings: RawHeading[] = [];
  let inFence = false;
  let fenceChar = '';

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';

    const fence = FENCED_CODE_OPEN.exec(line);
    if (fence) {
      const marker = (fence[1] ?? '')[0] ?? '';
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const atx = ATX_HEADING.exec(line);
    if (atx) {
      const title = stripInline((atx[2] ?? '').trim());
      headings.push({
        lineIndex: index,
        level: atx[1]!.length,
        title,
        slug: slugify(title),
        offset: offsets[index] ?? 0,
      });
      continue;
    }

    const previous = lines[index - 1];
    if (
      previous !== undefined &&
      previous.trim().length > 0 &&
      SETEXT_UNDERLINE.test(line) &&
      !ATX_HEADING.test(previous)
    ) {
      const level = line.trim().startsWith('=') ? 1 : 2;
      const title = stripInline(previous.trim());
      headings.push({
        lineIndex: index - 1,
        level,
        title,
        slug: slugify(title),
        offset: offsets[index - 1] ?? 0,
      });
    }
  }

  return headings;
}

function isSetextHeading(lines: readonly string[], heading: RawHeading): boolean {
  const nextLine = lines[heading.lineIndex + 1];
  return nextLine !== undefined && SETEXT_UNDERLINE.test(nextLine);
}

function buildToc(sections: readonly MarkdownSection[]): TocNavEntry[] {
  const roots: TocNavEntry[] = [];
  const stack: { level: number; entry: TocNavEntry }[] = [];

  for (const section of sections) {
    if (section.level === 0) continue;
    const entry: TocNavEntry = {
      title: section.title,
      href: `#${section.slug}`,
      chapterIndex: section.index,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1]!.level >= section.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      (parent.entry.children as TocNavEntry[]).push(entry);
    } else {
      roots.push(entry);
    }
    stack.push({ level: section.level, entry });
  }

  return roots;
}

export function parseMarkdown(source: string): ParsedMarkdown {
  const normalized = source.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }

  const headings = collectHeadings(lines, offsets);
  const sections: MarkdownSection[] = [];

  const firstHeadingLine = headings[0]?.lineIndex ?? lines.length;
  const preambleLines = lines.slice(0, firstHeadingLine);
  if (preambleLines.some((line) => line.trim().length > 0)) {
    const html = renderBlocks(preambleLines);
    if (html.trim().length > 0) {
      sections.push({ index: 0, level: 0, title: '', slug: '', offset: 0, html });
    }
  }

  for (let h = 0; h < headings.length; h++) {
    const heading = headings[h]!;
    const next = headings[h + 1]?.lineIndex ?? lines.length;
    const isSetext = isSetextHeading(lines, heading);
    const bodyStart = heading.lineIndex + (isSetext ? 2 : 1);
    const bodyHtml = renderBlocks(lines.slice(bodyStart, next));
    const headingHtml = `<h${heading.level} id="${heading.slug}">${renderInline(heading.title)}</h${heading.level}>`;
    sections.push({
      index: sections.length,
      level: heading.level,
      title: heading.title,
      slug: heading.slug,
      offset: heading.offset,
      html: bodyHtml.length > 0 ? `${headingHtml}\n${bodyHtml}` : headingHtml,
    });
  }

  const slugCounts = new Map<string, number>();
  const deduped = sections.map((section) => {
    if (!section.slug) return section;
    const count = slugCounts.get(section.slug) ?? 0;
    slugCounts.set(section.slug, count + 1);
    return count === 0 ? section : { ...section, slug: `${section.slug}-${count}` };
  });

  const toc = buildToc(deduped);
  const firstH1 = deduped.find((section) => section.level === 1);

  return {
    sections: deduped,
    toc,
    ...(firstH1 ? { title: firstH1.title } : {}),
  };
}
