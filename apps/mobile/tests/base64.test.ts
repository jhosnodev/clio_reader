import { describe, it, expect } from 'vitest';
import { bytesToBase64, base64ToBytes } from '../src/util/base64';

describe('base64', () => {
  it('encodes bytes like Buffer for varying lengths', () => {
    for (let length = 0; length <= 8; length++) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = (i * 37 + 11) & 255;
      const expected = Buffer.from(bytes).toString('base64');
      expect(bytesToBase64(bytes)).toBe(expected);
    }
  });

  it('decodes back to the original bytes', () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64, 32]);
    const encoded = bytesToBase64(original);
    expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(original));
  });

  it('ignores whitespace in encoded input', () => {
    const original = new Uint8Array([10, 20, 30, 40]);
    const encoded = bytesToBase64(original);
    const withWhitespace = `${encoded.slice(0, 2)}\n${encoded.slice(2)}`;
    expect(Array.from(base64ToBytes(withWhitespace))).toEqual(Array.from(original));
  });

  it('decodes a known vector', () => {
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });
});
