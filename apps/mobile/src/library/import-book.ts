import { importBook, generateId, type LibraryRepository } from '@clio-reader/library';
import type { Book } from '@clio-reader/domain';
import { detectBookFormat, type FileSource } from '@clio-reader/reader-core';
import { parseEpub, extractCoverImage } from '@clio-reader/reader-epub';
import { CbzReaderDocument } from '@clio-reader/reader-cbz';
import { MarkdownReaderDocument } from '@clio-reader/reader-md';
import type { MobileBridge } from '../bridges/mobile-bridge';
import { bytesToBase64 } from '../util/base64';

interface ExtractedMetadata {
  title: string;
  author?: string | undefined;
  coverImage?: string | undefined;
  language?: string | undefined;
}

function fallbackTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

async function extractEpub(
  rawData: Uint8Array,
  base: ExtractedMetadata,
): Promise<ExtractedMetadata> {
  const parsed = await parseEpub(rawData);
  const result: ExtractedMetadata = { ...base };
  if (parsed.opf.metadata.title) result.title = parsed.opf.metadata.title;
  if (parsed.opf.metadata.creator) result.author = parsed.opf.metadata.creator;
  if (parsed.opf.metadata.language) result.language = parsed.opf.metadata.language;
  try {
    const cover = await extractCoverImage(rawData, parsed);
    if (cover) {
      result.coverImage = `data:${cover.mimeType};base64,${bytesToBase64(cover.data)}`;
    }
  } catch {
    /* portada opcional */
  }
  return result;
}

async function extractCbz(
  rawData: Uint8Array,
  source: FileSource,
  base: ExtractedMetadata,
): Promise<ExtractedMetadata> {
  const result: ExtractedMetadata = { ...base };
  const doc = new CbzReaderDocument({ uri: source.uri, name: source.name });
  await doc.open(rawData);
  try {
    const meta = await doc.getMetadata();
    if (meta?.title) result.title = meta.title;
    if (meta?.author) result.author = meta.author;
  } catch {
    /* sin metadata */
  }
  try {
    const cover = await doc.getCoverImageDataUrl();
    if (cover) result.coverImage = cover;
  } catch {
    /* sin portada */
  }
  await doc.close();
  return result;
}

async function extractMd(
  rawData: Uint8Array,
  source: FileSource,
  base: ExtractedMetadata,
): Promise<ExtractedMetadata> {
  const result: ExtractedMetadata = { ...base };
  const doc = new MarkdownReaderDocument({ uri: source.uri, name: source.name });
  await doc.open(rawData);
  try {
    const title = await doc.getTitle();
    if (title) result.title = title;
  } catch {
    /* sin título */
  }
  await doc.close();
  return result;
}

export async function importFileToLibrary(
  bridge: MobileBridge,
  repository: LibraryRepository,
  fileSource: FileSource,
): Promise<Book> {
  const format = detectBookFormat(fileSource.name, fileSource.mimeType);
  const durableUri = await bridge.copyToStorage(fileSource.uri, fileSource.name);
  const durableSource: FileSource = {
    uri: durableUri,
    name: fileSource.name,
    ...(fileSource.mimeType ? { mimeType: fileSource.mimeType } : {}),
  };

  let metadata: ExtractedMetadata = { title: fallbackTitle(fileSource.name) };
  if (format === 'epub' || format === 'cbz' || format === 'md') {
    try {
      const rawData = await bridge.readFile(durableUri);
      if (format === 'epub') metadata = await extractEpub(rawData, metadata);
      else if (format === 'cbz') metadata = await extractCbz(rawData, durableSource, metadata);
      else metadata = await extractMd(rawData, durableSource, metadata);
    } catch {
      /* se conserva el título derivado del archivo */
    }
  }

  return importBook(repository, {
    id: generateId(),
    title: metadata.title,
    author: metadata.author,
    format,
    uri: durableUri,
    coverImage: metadata.coverImage,
    language: metadata.language,
  });
}
