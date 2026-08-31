import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export class PdfRenderError extends Error {
  constructor(pageIndex: number, cause?: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to render page ${pageIndex}: ${message}`);
    this.name = 'PdfRenderError';
  }
}

export async function renderPageToCanvas(
  pdfDocument: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<PDFPageProxy> {
  let page: PDFPageProxy | undefined;
  try {
    page = await pdfDocument.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });

    const outputScale =
      typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D canvas context');
    }

    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return page;
  } catch (error) {
    throw new PdfRenderError(pageIndex, error);
  } finally {
    page?.cleanup();
  }
}
