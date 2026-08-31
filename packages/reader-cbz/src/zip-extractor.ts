import JSZip from 'jszip';

import { isImageFile } from './image-sort.js';

export interface ExtractedImage {
  readonly fileName: string;
  readonly data: Uint8Array;
}

const HIDDEN_FILE_PREFIXES = ['__', '.'];

function isHiddenOrMetadataFile(fileName: string): boolean {
  for (const prefix of HIDDEN_FILE_PREFIXES) {
    if (fileName.startsWith(prefix)) return true;
  }
  return false;
}

export async function extractImagesFromZip(data: Uint8Array): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(data);

  const imageEntries: ExtractedImage[] = [];

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    if (isHiddenOrMetadataFile(path)) continue;
    if (!isImageFile(path)) continue;

    const fileData = await zipEntry.async('uint8array');
    imageEntries.push({ fileName: path, data: fileData });
  }

  return imageEntries;
}
