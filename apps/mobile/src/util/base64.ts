const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const REVERSE: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) {
  REVERSE[CHARS[i]!] = i;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < len ? bytes[i + 1]! : 0;
    const b2 = i + 2 < len ? bytes[i + 2]! : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    result += CHARS[(triplet >> 18) & 63];
    result += CHARS[(triplet >> 12) & 63];
    result += i + 1 < len ? CHARS[(triplet >> 6) & 63] : '=';
    result += i + 2 < len ? CHARS[triplet & 63] : '=';
  }
  return result;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const byteLength = (len * 3) >> 2;
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = REVERSE[clean[i]!] ?? 0;
    const c1 = REVERSE[clean[i + 1]!] ?? 0;
    const c2 = REVERSE[clean[i + 2]!] ?? 0;
    const c3 = REVERSE[clean[i + 3]!] ?? 0;
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes[byteIndex++] = (triplet >> 16) & 255;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triplet >> 8) & 255;
    if (byteIndex < byteLength) bytes[byteIndex++] = triplet & 255;
  }
  return bytes;
}
