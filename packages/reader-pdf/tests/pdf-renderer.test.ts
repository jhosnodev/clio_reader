import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderPageToCanvas, PdfRenderError } from '../src/pdf-renderer.js';

const mockPage = {
  getViewport: vi.fn().mockReturnValue({ width: 800, height: 600 }),
  render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
  cleanup: vi.fn(),
};

const mockPdfDocument = {
  getPage: vi.fn().mockResolvedValue(mockPage),
};

describe('renderPageToCanvas', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    mockPage.getViewport.mockClear();
    mockPage.render.mockClear();
    mockPage.cleanup.mockClear();
    mockPdfDocument.getPage.mockClear();

    canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn().mockReturnValue({
        setTransform: vi.fn(),
      }),
    } as unknown as HTMLCanvasElement;
  });

  it('renders a page to canvas', async () => {
    await renderPageToCanvas(mockPdfDocument as never, 0, canvas, 1);

    expect(mockPdfDocument.getPage).toHaveBeenCalledWith(1);
    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1 });
    expect(mockPage.render).toHaveBeenCalled();
    expect(mockPage.cleanup).toHaveBeenCalled();
  });

  it('uses correct page number (1-indexed)', async () => {
    await renderPageToCanvas(mockPdfDocument as never, 2, canvas, 1);

    expect(mockPdfDocument.getPage).toHaveBeenCalledWith(3);
  });

  it('applies scale to viewport', async () => {
    await renderPageToCanvas(mockPdfDocument as never, 0, canvas, 2);

    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 2 });
  });

  it('sets canvas dimensions based on viewport', async () => {
    mockPage.getViewport.mockReturnValue({ width: 1024, height: 768 });

    await renderPageToCanvas(mockPdfDocument as never, 0, canvas, 1);

    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.style.width).toContain('px');
    expect(canvas.style.height).toContain('px');
  });

  it('cleans up page after render', async () => {
    await renderPageToCanvas(mockPdfDocument as never, 0, canvas, 1);

    expect(mockPage.cleanup).toHaveBeenCalledTimes(1);
  });

  it('cleans up page even on error', async () => {
    mockPage.render.mockReturnValue({
      promise: Promise.reject(new Error('Render failed')),
    });

    await expect(renderPageToCanvas(mockPdfDocument as never, 0, canvas, 1)).rejects.toThrow(
      PdfRenderError,
    );

    expect(mockPage.cleanup).toHaveBeenCalledTimes(1);
  });

  it('throws PdfRenderError on render failure', async () => {
    mockPage.render.mockReturnValue({
      promise: Promise.reject(new Error('Canvas error')),
    });

    await expect(renderPageToCanvas(mockPdfDocument as never, 0, canvas, 1)).rejects.toThrow(
      PdfRenderError,
    );
  });

  it('throws PdfRenderError when canvas context is null', async () => {
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);

    await expect(renderPageToCanvas(mockPdfDocument as never, 0, canvas, 1)).rejects.toThrow(
      PdfRenderError,
    );
  });
});
