import JSZip from 'jszip';

import { isImageFile } from './image-sort.js';
import { parseComicInfoXml, type ComicInfo } from './comic-info.js';

export interface ExtractedImage {
  readonly fileName: string;
  readonly data: Uint8Array;
}

const HIDDEN_FILE_PREFIXES = ['__', '.'];

function isHiddenFile(fileName: string): boolean {
  const base = fileName.split('/').pop() ?? fileName;
  return HIDDEN_FILE_PREFIXES.some((prefix) => base.startsWith(prefix));
}

export async function extractImagesFromZip(data: Uint8Array): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(data);

  const imageEntries: ExtractedImage[] = [];

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    if (isHiddenFile(path)) continue;
    if (!isImageFile(path)) continue;

    const fileData = await zipEntry.async('uint8array');
    imageEntries.push({ fileName: path, data: fileData });
  }

  return imageEntries;
}

export async function extractComicInfoFromZip(data: Uint8Array): Promise<ComicInfo | null> {
  const zip = await JSZip.loadAsync(data);
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    if (!path.toLowerCase().endsWith('comicinfo.xml')) continue;

    try {
      const text = await zipEntry.async('text');
      return parseComicInfoXml(text);
    } catch (error) {
      return null;
    }
  }
  return null;
}
