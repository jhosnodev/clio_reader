import JSZip from 'jszip';

export interface OpfManifestItem {
  readonly id: string;
  readonly href: string;
  readonly mediaType: string;
  readonly properties?: string | undefined;
}

export interface OpfSpineItem {
  readonly idref: string;
  readonly linear?: boolean;
}

export interface OpfMetadata {
  readonly title?: string;
  readonly creator?: string;
  readonly language?: string;
  readonly identifier?: string;
}

export interface OpfPackage {
  readonly metadata: OpfMetadata;
  readonly manifest: OpfManifestItem[];
  readonly spine: OpfSpineItem[];
  readonly basePath: string;
}

export interface ParsedEpub {
  readonly opf: OpfPackage;
  readonly chapters: ChapterEntry[];
  readonly containerXml: string;
}

export interface ChapterEntry {
  readonly id: string;
  readonly href: string;
  readonly mediaType: string;
  readonly fullPath: string;
}

export class EpubParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpubParseError';
  }
}

function getTagContent(xml: string, tagName: string): string | undefined {
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i'),
    new RegExp(`<${tagName}:[^>]*>([^<]*)</${tagName}[^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function getTagAttribute(xml: string, tagName: string, attrName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = xml.match(pattern);
  return match?.[1];
}

function parseMetadata(xml: string): OpfMetadata {
  const metadataMatch = xml.match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/i);
  if (!metadataMatch?.[1]) return {};

  const metadataXml = metadataMatch[1];

  const title = getTagContent(metadataXml, 'dc:title') ?? getTagContent(metadataXml, 'title');
  const creator = getTagContent(metadataXml, 'dc:creator') ?? getTagContent(metadataXml, 'creator');
  const language =
    getTagContent(metadataXml, 'dc:language') ?? getTagContent(metadataXml, 'language');
  const identifier =
    getTagContent(metadataXml, 'dc:identifier') ?? getTagContent(metadataXml, 'identifier');

  return {
    ...(title !== undefined && { title }),
    ...(creator !== undefined && { creator }),
    ...(language !== undefined && { language }),
    ...(identifier !== undefined && { identifier }),
  };
}

function parseManifest(xml: string): OpfManifestItem[] {
  const manifestMatch = xml.match(/<manifest[^>]*>([\s\S]*?)<\/manifest>/i);
  if (!manifestMatch?.[1]) return [];

  const itemPattern = /<item\s+[^>]*\/>/gi;
  const items: OpfManifestItem[] = [];
  let match = itemPattern.exec(manifestMatch[1]);

  while (match !== null) {
    const itemXml = match[0];
    const id = getTagAttribute(itemXml, 'item', 'id');
    const href = getTagAttribute(itemXml, 'item', 'href');
    const mediaType = getTagAttribute(itemXml, 'item', 'media-type');
    const properties = getTagAttribute(itemXml, 'item', 'properties');

    if (id && href && mediaType) {
      items.push({
        id,
        href,
        mediaType,
        ...(properties !== undefined && { properties }),
      });
    }
    match = itemPattern.exec(manifestMatch[1]);
  }

  return items;
}

function parseSpine(xml: string): OpfSpineItem[] {
  const spineMatch = xml.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
  if (!spineMatch?.[1]) return [];

  const itemPattern = /<itemref\s+[^>]*\/?>/gi;
  const items: OpfSpineItem[] = [];
  let match = itemPattern.exec(spineMatch[1]);

  while (match !== null) {
    const itemXml = match[0];
    const idref = getTagAttribute(itemXml, 'itemref', 'idref');
    const linear = getTagAttribute(itemXml, 'itemref', 'linear');

    if (idref) {
      items.push({
        idref,
        linear: linear !== 'no',
      });
    }
    match = itemPattern.exec(spineMatch[1]);
  }

  return items;
}

function resolveBasePath(opfPath: string): string {
  const lastSlash = opfPath.lastIndexOf('/');
  return lastSlash >= 0 ? opfPath.substring(0, lastSlash + 1) : '';
}

function resolveHref(basePath: string, href: string): string {
  if (href.startsWith('/')) return href.substring(1);
  if (!basePath) return href;

  const baseParts = basePath.split('/').filter(Boolean);
  const hrefParts = href.split('/');

  const resolved: string[] = [...baseParts];
  for (const part of hrefParts) {
    if (part === '..') {
      resolved.pop();
    } else if (part !== '.') {
      resolved.push(part);
    }
  }

  return resolved.join('/');
}

export async function parseEpub(data: Uint8Array): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(data);

  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) {
    throw new EpubParseError('EPUB missing META-INF/container.xml');
  }

  const containerXml = await containerEntry.async('string');
  const rootfileMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  if (!rootfileMatch?.[1]) {
    throw new EpubParseError('Cannot find rootfile path in container.xml');
  }

  const opfPath = rootfileMatch[1];
  const opfEntry = zip.file(opfPath);
  if (!opfEntry) {
    throw new EpubParseError(`OPF file not found: ${opfPath}`);
  }

  const opfXml = await opfEntry.async('string');
  const basePath = resolveBasePath(opfPath);

  const metadata = parseMetadata(opfXml);
  const manifest = parseManifest(opfXml);
  const spine = parseSpine(opfXml);

  if (manifest.length === 0) {
    throw new EpubParseError('OPF manifest is empty');
  }

  if (spine.length === 0) {
    throw new EpubParseError('OPF spine is empty');
  }

  const manifestMap = new Map(manifest.map((item) => [item.id, item]));

  const chapters: ChapterEntry[] = [];
  for (const spineItem of spine) {
    if (spineItem.linear === false) continue;

    const manifestItem = manifestMap.get(spineItem.idref);
    if (!manifestItem) continue;

    const fullPath = resolveHref(basePath, manifestItem.href);
    chapters.push({
      id: manifestItem.id,
      href: manifestItem.href,
      mediaType: manifestItem.mediaType,
      fullPath,
    });
  }

  return {
    opf: { metadata, manifest, spine, basePath },
    chapters,
    containerXml,
  };
}

export async function readChapterContent(data: Uint8Array, fullPath: string): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file(fullPath);
  if (!entry) {
    throw new EpubParseError(`Chapter file not found: ${fullPath}`);
  }
  return entry.async('string');
}
