const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);

const IMAGE_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(fileName));
}

export function getImageMimeType(fileName: string): string {
  return IMAGE_MIME_MAP[getExtension(fileName)] ?? 'application/octet-stream';
}

function naturalCompare(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  let i = 0;
  let j = 0;

  while (i < aLower.length && j < bLower.length) {
    const aChar = aLower[i]!;
    const bChar = bLower[j]!;

    if (aChar >= '0' && aChar <= '9' && bChar >= '0' && bChar <= '9') {
      const aStart = i;
      const bStart = j;

      while (i < aLower.length && aLower[i]! >= '0' && aLower[i]! <= '9') i++;
      while (j < bLower.length && bLower[j]! >= '0' && bLower[j]! <= '9') j++;

      const aNum = aLower.slice(aStart, i);
      const bNum = bLower.slice(bStart, j);

      const aInt = parseInt(aNum, 10);
      const bInt = parseInt(bNum, 10);

      if (aInt !== bInt) {
        return aInt - bInt;
      }

      if (aNum !== bNum) {
        return aNum.length - bNum.length;
      }
    } else {
      if (aChar !== bChar) {
        return aChar < bChar ? -1 : 1;
      }
      i++;
      j++;
    }
  }

  return aLower.length - bLower.length;
}

export function sortImageFiles(files: string[]): string[] {
  return [...files].sort(naturalCompare);
}
