import JSZip from 'jszip';

import type { OpfPackage } from './epub-parser.js';

export interface TocEntry {
  readonly title: string;
  readonly href?: string | undefined;
  readonly children: readonly TocEntry[];
}

export class TocParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TocParseError';
  }
}

const MAX_TOC_DEPTH = 64;

function getTagContent(xml: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(pattern);
  return match?.[1]?.trim();
}

function getTagAttribute(xml: string, tagName: string, attrName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = xml.match(pattern);
  return match?.[1];
}

function parseNavToc(navXml: string): TocEntry[] {
  const startIdx = navXml.search(/<ol[\s>]/i);
  if (startIdx === -1) return [];

  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < navXml.length; i++) {
    const openMatch = navXml.substring(i).match(/^<ol[\s>]/i);
    if (openMatch) {
      depth++;
      i += openMatch[0].length - 1;
      continue;
    }
    const closeMatch = navXml.substring(i).match(/^<\/ol>/i);
    if (closeMatch) {
      depth--;
      if (depth === 0) {
        endIdx = i + closeMatch[0].length;
        break;
      }
      i += closeMatch[0].length - 1;
    }
  }

  if (endIdx === -1) return [];
  const olContent = navXml.substring(startIdx, endIdx);
  const innerContent = olContent.replace(/^<ol[^>]*>/i, '').replace(/<\/ol>$/i, '');

  return parseNavOl(innerContent);
}

function extractTopLevelLiItems(olXml: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < olXml.length; i++) {
    const liOpenMatch = olXml.substring(i).match(/^<li[\s>]/i);
    if (liOpenMatch && depth === 0) {
      start = i;
      depth = 1;
      i += liOpenMatch[0].length - 1;
      continue;
    }

    const liCloseMatch = olXml.substring(i).match(/^<\/li>/i);
    if (liCloseMatch && depth === 1) {
      items.push(olXml.substring(start, i + liCloseMatch[0].length));
      depth = 0;
      start = -1;
      i += liCloseMatch[0].length - 1;
      continue;
    }

    const nestedOpenMatch = olXml.substring(i).match(/^<(ol|li)[\s>]/i);
    if (nestedOpenMatch && depth > 0) {
      depth++;
      i += nestedOpenMatch[0].length - 1;
      continue;
    }

    const nestedCloseMatch = olXml.substring(i).match(/^<\/(ol|li)>/i);
    if (nestedCloseMatch && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        items.push(olXml.substring(start, i + nestedCloseMatch[0].length));
        start = -1;
      }
      i += nestedCloseMatch[0].length - 1;
      continue;
    }
  }

  return items;
}

function parseNavOl(olXml: string, depth = 0): TocEntry[] {
  if (depth > MAX_TOC_DEPTH) return [];

  const entries: TocEntry[] = [];
  const liItems = extractTopLevelLiItems(olXml);

  for (const liXml of liItems) {
    const aMatch = liXml.match(/<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);

    if (aMatch?.[1] && aMatch?.[2]) {
      const href = aMatch[1];
      const title = aMatch[2].replace(/<[^>]+>/g, '').trim();

      const nestedOlMatch = liXml.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      const children = nestedOlMatch?.[1] ? parseNavOl(nestedOlMatch[1], depth + 1) : [];

      entries.push({ title, href, children });
    }
  }

  return entries;
}

function parseNcxToc(ncxXml: string): TocEntry[] {
  const navMapMatch = ncxXml.match(/<navMap[^>]*>([\s\S]*?)<\/navMap>/i);
  if (!navMapMatch?.[1]) return [];

  return parseNcxNavPoints(navMapMatch[1]);
}

function parseNcxNavPoints(xml: string, depth = 0): TocEntry[] {
  if (depth > MAX_TOC_DEPTH) return [];

  const entries: TocEntry[] = [];
  const navPointPattern = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/gi;
  let match = navPointPattern.exec(xml);

  while (match !== null) {
    const navPointXml = match[1] ?? '';
    const label = getTagContent(navPointXml, 'text') ?? '';
    const src = getTagAttribute(navPointXml, 'content', 'src') ?? '';

    const nestedNavPoints = navPointXml.match(/<navPoint[^>]*>([\s\S]*?)<\/navPoint>/gi);
    const children: TocEntry[] = [];
    if (nestedNavPoints) {
      for (const nested of nestedNavPoints) {
        const nestedEntries = parseNcxNavPoints(nested, depth + 1);
        children.push(...nestedEntries);
      }
    }

    if (label || src) {
      entries.push({ title: label, href: src, children });
    }
    match = navPointPattern.exec(xml);
  }

  return entries;
}

function findTocManifestItem(opf: OpfPackage): { href: string; fullPath: string } | undefined {
  const navItem = opf.manifest.find(
    (item) =>
      item.properties === 'nav' ||
      (item.mediaType === 'application/xhtml+xml' && item.id.toLowerCase().includes('nav')),
  );
  if (navItem) {
    return {
      href: navItem.href,
      fullPath: opf.basePath ? `${opf.basePath}/${navItem.href}` : navItem.href,
    };
  }

  const ncxItem = opf.manifest.find((item) => item.mediaType === 'application/x-dtbncx+xml');
  if (ncxItem) {
    return {
      href: ncxItem.href,
      fullPath: opf.basePath ? `${opf.basePath}/${ncxItem.href}` : ncxItem.href,
    };
  }

  return undefined;
}

export async function extractToc(data: Uint8Array, opf: OpfPackage): Promise<TocEntry[]> {
  const tocItem = findTocManifestItem(opf);
  if (tocItem) {
    const zip = await JSZip.loadAsync(data);
    const entry = zip.file(tocItem.fullPath);
    if (entry) {
      const content = await entry.async('string');
      const extracted = parseTocContent(content);
      if (extracted.length > 0) {
        return normalizeTocHrefs(extracted, directoryOf(tocItem.fullPath));
      }
    }
  }

  return buildSpineFallbackToc(opf);
}

function directoryOf(fullPath: string): string {
  const slash = fullPath.lastIndexOf('/');
  return slash >= 0 ? fullPath.substring(0, slash) : '';
}

function normalizeHref(baseDir: string, href: string): string {
  const withoutFragment = href.split('#')[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    decoded = withoutFragment;
  }

  const parts = (baseDir ? `${baseDir}/${decoded}` : decoded).split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved.join('/');
}

function normalizeTocHrefs(entries: readonly TocEntry[], baseDir: string): TocEntry[] {
  return entries.map((entry) => {
    const children = entry.children?.length ? normalizeTocHrefs(entry.children, baseDir) : [];
    return {
      title: entry.title,
      href: entry.href != null ? normalizeHref(baseDir, entry.href) : undefined,
      children,
    };
  });
}

function parseTocContent(content: string): TocEntry[] {
  if (content.includes('<nav') && content.includes('epub:type="toc"')) {
    return parseNavToc(content);
  }
  if (content.includes('<ncx') || content.includes('<navMap')) {
    return parseNcxToc(content);
  }
  if (content.includes('<ol')) {
    return parseNavToc(content);
  }
  return [];
}

function buildSpineFallbackToc(opf: OpfPackage): TocEntry[] {
  const entries: TocEntry[] = [];
  const manifestById = new Map(opf.manifest.map((item) => [item.id, item]));

  opf.spine.forEach((spineItem) => {
    if (spineItem.linear === false) return;
    const manifestItem = manifestById.get(spineItem.idref);
    if (!manifestItem) return;

    entries.push({
      title: titleFromHref(manifestItem.href),
      href: normalizeHref(opf.basePath, manifestItem.href),
      children: [],
    });
  });

  return entries;
}

function titleFromHref(href: string): string {
  const basename = href.split('/').pop() ?? href;
  const withoutExt = basename.replace(/\.[^/.]+$/, '');
  const cleaned = withoutExt.replace(/[_]/g, ' ').replace(/-+/g, ' ').trim();
  if (cleaned.length === 0) return 'Capítulo';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
