import { describe, expect, it } from 'vitest';

import { getImageMimeType, isImageFile, sortImageFiles } from '../src/image-sort.js';

describe('isImageFile', () => {
  it('returns true for supported image extensions', () => {
    expect(isImageFile('page1.jpg')).toBe(true);
    expect(isImageFile('page2.JPEG')).toBe(true);
    expect(isImageFile('page3.png')).toBe(true);
    expect(isImageFile('page4.PNG')).toBe(true);
    expect(isImageFile('page5.webp')).toBe(true);
    expect(isImageFile('page6.gif')).toBe(true);
    expect(isImageFile('page7.bmp')).toBe(true);
  });

  it('returns false for non-image files', () => {
    expect(isImageFile('readme.txt')).toBe(false);
    expect(isImageFile('data.csv')).toBe(false);
    expect(isImageFile('archive.zip')).toBe(false);
    expect(isImageFile('page1')).toBe(false);
  });

  it('returns false for hidden files', () => {
    expect(isImageFile('.DS_Store')).toBe(false);
    expect(isImageFile('__MACOSX/info.plist')).toBe(false);
  });
});

describe('getImageMimeType', () => {
  it('returns correct MIME types', () => {
    expect(getImageMimeType('page.jpg')).toBe('image/jpeg');
    expect(getImageMimeType('page.jpeg')).toBe('image/jpeg');
    expect(getImageMimeType('page.png')).toBe('image/png');
    expect(getImageMimeType('page.webp')).toBe('image/webp');
    expect(getImageMimeType('page.gif')).toBe('image/gif');
    expect(getImageMimeType('page.bmp')).toBe('image/bmp');
  });

  it('returns octet-stream for unknown extensions', () => {
    expect(getImageMimeType('page.txt')).toBe('application/octet-stream');
  });
});

describe('sortImageFiles', () => {
  it('sorts files in natural order', () => {
    const files = ['page10.jpg', 'page2.jpg', 'page1.jpg', 'page20.jpg'];
    expect(sortImageFiles(files)).toEqual(['page1.jpg', 'page2.jpg', 'page10.jpg', 'page20.jpg']);
  });

  it('handles case-insensitive sorting', () => {
    const files = ['PAGE2.jpg', 'page1.jpg', 'Page10.jpg'];
    expect(sortImageFiles(files)).toEqual(['page1.jpg', 'PAGE2.jpg', 'Page10.jpg']);
  });

  it('handles leading zeros', () => {
    const files = ['page002.jpg', 'page10.jpg', 'page01.jpg'];
    expect(sortImageFiles(files)).toEqual(['page01.jpg', 'page002.jpg', 'page10.jpg']);
  });

  it('handles mixed content', () => {
    const files = ['cover.png', 'page5.jpg', 'page1.jpg', 'back.png'];
    expect(sortImageFiles(files)).toEqual(['back.png', 'cover.png', 'page1.jpg', 'page5.jpg']);
  });

  it('does not mutate the original array', () => {
    const files = ['page10.jpg', 'page1.jpg'];
    const original = [...files];
    sortImageFiles(files);
    expect(files).toEqual(original);
  });
});
