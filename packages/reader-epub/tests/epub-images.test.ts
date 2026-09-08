import { describe, expect, it } from 'vitest';

import {
  extractImageSrcs,
  replaceImgSrc,
  addFailedImgClassToSrc,
  escapeRegExp,
} from '../src/epub-images.js';

describe('epub-images', () => {
  describe('extractImageSrcs', () => {
    it('extracts src from a single img tag', () => {
      const html = '<html><body><img src="images/fig1.png"/></body></html>';
      expect(extractImageSrcs(html)).toEqual(['images/fig1.png']);
    });

    it('extracts src from multiple img tags', () => {
      const html = `
        <img src="a.png"/>
        <img src="b.jpg"/>
        <img src="c.svg"/>
      `;
      expect(extractImageSrcs(html)).toEqual(['a.png', 'b.jpg', 'c.svg']);
    });

    it('returns empty array when no img tags', () => {
      expect(extractImageSrcs('<html><body><p>No images</p></body></html>')).toEqual([]);
    });

    it('handles img tags with single-quoted src', () => {
      const html = "<img src='image.gif'/>";
      expect(extractImageSrcs(html)).toEqual(['image.gif']);
    });

    it('handles img tags with extra attributes', () => {
      const html = '<img class="wide" src="photo.jpg" alt="A photo" width="200"/>';
      expect(extractImageSrcs(html)).toEqual(['photo.jpg']);
    });

    it('skips data: and blob: URLs', () => {
      const html = `
        <img src="data:image/png;base64,abc"/>
        <img src="blob:http://localhost/123"/>
        <img src="real.png"/>
      `;
      const srcs = extractImageSrcs(html);
      expect(srcs).toEqual([
        'data:image/png;base64,abc',
        'blob:http://localhost/123',
        'real.png',
      ]);
    });

    it('handles self-closing and non-self-closing img tags', () => {
      const html = `
        <img src="a.png"/>
        <img src="b.png">
      `;
      expect(extractImageSrcs(html)).toEqual(['a.png', 'b.png']);
    });
  });

  describe('replaceImgSrc', () => {
    it('replaces src attribute value', () => {
      const html = '<img src="old.png"/>';
      const result = replaceImgSrc(html, 'old.png', 'blob:http://x/new');
      expect(result).toContain('src="blob:http://x/new"');
      expect(result).not.toContain('old.png');
    });

    it('preserves other attributes', () => {
      const html = '<img class="wide" src="img.png" alt="photo"/>';
      const result = replaceImgSrc(html, 'img.png', 'blob:replaced');
      expect(result).toContain('class="wide"');
      expect(result).toContain('alt="photo"');
      expect(result).toContain('src="blob:replaced"');
    });

    it('handles multiple img tags, only replaces matching src', () => {
      const html = '<img src="a.png"/><img src="b.png"/>';
      const result = replaceImgSrc(html, 'a.png', 'blob:replaced-a');
      expect(result).toContain('src="blob:replaced-a"');
      expect(result).toContain('src="b.png"');
    });

    it('does nothing if src is not found', () => {
      const html = '<img src="existing.png"/>';
      const result = replaceImgSrc(html, 'missing.png', 'blob:x');
      expect(result).toBe(html);
    });

    it('escapes special regex chars in src', () => {
      const html = '<img src="path/to/image (1).png"/>';
      const result = replaceImgSrc(html, 'path/to/image (1).png', 'blob:special');
      expect(result).toContain('src="blob:special"');
    });
  });

  describe('addFailedImgClassToSrc', () => {
    it('adds epub-img-failed class to img without class attribute', () => {
      const html = '<img src="missing.png"/>';
      const result = addFailedImgClassToSrc(html, 'missing.png');
      expect(result).toContain('class="epub-img-failed"');
      expect(result).toContain('src="missing.png"');
    });

    it('appends epub-img-failed to existing class', () => {
      const html = '<img class="wide" src="missing.png"/>';
      const result = addFailedImgClassToSrc(html, 'missing.png');
      expect(result).toContain('epub-img-failed');
      expect(result).toContain('wide');
    });

    it('only affects matching src', () => {
      const html = '<img src="ok.png"/><img src="bad.png"/>';
      const result = addFailedImgClassToSrc(html, 'bad.png');
      const imgs = result.match(/<img[^>]+>/gi) ?? [];
      const okImg = imgs.find((s) => s.includes('ok.png')) ?? '';
      const badImg = imgs.find((s) => s.includes('bad.png')) ?? '';
      expect(okImg).not.toContain('epub-img-failed');
      expect(badImg).toContain('epub-img-failed');
    });
  });

  describe('extractImageSrcs — SVG <image> tags', () => {
    it('extracts xlink:href from SVG image tag', () => {
      const html = '<svg><image xlink:href="Image00000.jpg"></image></svg>';
      expect(extractImageSrcs(html)).toEqual(['Image00000.jpg']);
    });

    it('extracts from SVG image with extra attributes', () => {
      const html = '<svg><image height="1920" width="1663" xlink:href="Image00001.jpg"></image></svg>';
      expect(extractImageSrcs(html)).toEqual(['Image00001.jpg']);
    });

    it('extracts from both img and SVG image tags', () => {
      const html = `
        <img src="cover.png"/>
        <svg><image xlink:href="Image00000.jpg"></image></svg>
      `;
      expect(extractImageSrcs(html)).toEqual(['cover.png', 'Image00000.jpg']);
    });

    it('extracts from SVG image with single-quoted href', () => {
      const html = "<svg><image xlink:href='pic.jpg'></image></svg>";
      expect(extractImageSrcs(html)).toEqual(['pic.jpg']);
    });

    it('handles nested SVG in XHTML', () => {
      const html = `<!DOCTYPE html>
<html><body>
<div>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<image height="1920" width="1663" xlink:href="Image00000.jpg"></image>
</svg>
</div>
</body></html>`;
      expect(extractImageSrcs(html)).toEqual(['Image00000.jpg']);
    });
  });

  describe('replaceImgSrc — SVG <image> tags', () => {
    it('replaces xlink:href in SVG image tag', () => {
      const html = '<svg><image xlink:href="old.jpg"></image></svg>';
      const result = replaceImgSrc(html, 'old.jpg', 'blob:http://x/new');
      expect(result).toContain('href="blob:http://x/new"');
      expect(result).not.toContain('old.jpg');
    });

    it('preserves SVG image attributes', () => {
      const html = '<svg><image height="1920" width="1663" xlink:href="img.jpg"></image></svg>';
      const result = replaceImgSrc(html, 'img.jpg', 'blob:replaced');
      expect(result).toContain('height="1920"');
      expect(result).toContain('width="1663"');
      expect(result).toContain('href="blob:replaced"');
    });

    it('replaces both img src and SVG image xlink:href', () => {
      const html = '<img src="a.png"/><svg><image xlink:href="b.jpg"></image></svg>';
      const resultA = replaceImgSrc(html, 'a.png', 'blob:a');
      expect(resultA).toContain('src="blob:a"');
      expect(resultA).toContain('href="b.jpg"');
      const resultB = replaceImgSrc(html, 'b.jpg', 'blob:b');
      expect(resultB).toContain('src="a.png"');
      expect(resultB).toContain('href="blob:b"');
    });
  });

  describe('addFailedImgClassToSrc — SVG <image> tags', () => {
    it('adds epub-img-failed class to SVG image tag', () => {
      const html = '<svg><image xlink:href="missing.jpg"></image></svg>';
      const result = addFailedImgClassToSrc(html, 'missing.jpg');
      expect(result).toContain('class="epub-img-failed"');
      expect(result).toContain('xlink:href="missing.jpg"');
    });
  });

  describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegExp('a.b+c')).toBe('a\\.b\\+c');
    });

    it('escapes parentheses and brackets', () => {
      expect(escapeRegExp('file(1)[test]')).toBe('file\\(1\\)\\[test\\]');
    });

    it('returns plain string unchanged', () => {
      expect(escapeRegExp('simple')).toBe('simple');
    });
  });
});
