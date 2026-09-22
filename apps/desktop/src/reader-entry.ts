/**
 * reader-entry.ts — Entry point del lector de libros (webview)
 *
 * Comunicación con el host: el host usa webview.executeJavaScript() para
 * llamar a window.__initFromHost(data) una vez que lee el archivo.
 */

window.addEventListener('error', (e) => {
  console.error('[reader-entry] UNCAUGHT ERROR:', e.message, e.filename, e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[reader-entry] UNHANDLED REJECTION:', e.reason);
});

import type { ReaderDocument } from '@clio-reader/reader-core';
import type { ReaderPreferences } from '@clio-reader/domain';
import { EpubReaderDocument } from '@clio-reader/reader-epub';

/* ==========================================================================
   Constantes
   ========================================================================== */

const SUPPORTED_FORMATS = ['epub', 'pdf', 'cbz', 'md'] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const DEFAULT_PREFERENCES: ReaderPreferences = {
  theme: 'light',
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2937',
  accentColor: '#2563eb',
  fontFamily: 'system',
  fontScale: 1,
  lineHeight: 1.5,
  margin: 'comfortable',
  readingDirection: 'ltr',
};

/* ==========================================================================
   Sanitización de HTML
   ========================================================================== */

const BLOCKED_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'button',
  'link',
];
const EVENT_HANDLER_REGEX = /\bon\w+\s*=/gi;
const DANGEROUS_ATTRS = ['srcdoc', 'data', 'codebase', 'formaction'];

function sanitizeHtml(html: string): string {
  let result = html;
  for (const tag of BLOCKED_TAGS) {
    result = result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
    result = result.replace(new RegExp(`<${tag}\\b[^>]*/>`, 'gi'), '');
  }
  for (const attr of DANGEROUS_ATTRS) {
    result = result.replace(new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi'), '');
  }
  result = result.replace(EVENT_HANDLER_REGEX, '');
  return result;
}

/* ==========================================================================
   Resolución de imágenes embebidas en EPUB
   ========================================================================== */

const IMG_SRC_REGEX = /<img\b([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi;
const SVG_IMAGE_HREF_RE = /<image\b([^>]*?)(?:xlink:)?href\s*=\s*["']([^"']+)["']([^>]*?)>/gi;
const FAILED_IMG_CLASS = 'epub-img-failed';

let previousBlobUrls: string[] = [];

function revokePreviousBlobUrls(): void {
  for (const url of previousBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  previousBlobUrls = [];
}

function addFailedImgClass(match: string): string {
  if (match.includes('class=')) {
    return match.replace(/class\s*=\s*["']([^"']*)["']/, `class="$1 ${FAILED_IMG_CLASS}"`);
  }
  if (match.charAt(4) === ' ' || match.charAt(4) === '>') {
    return match.replace(/<img\b/, `<img class="${FAILED_IMG_CLASS}"`);
  }
  return match.replace(/<image\b/, `<image class="${FAILED_IMG_CLASS}"`);
}

async function resolveImagesInHtml(readerDoc: ReaderDocument, html: string): Promise<string> {
  const allSrcs: string[] = [];
  const srcTypes: Map<string, 'img' | 'svg'> = new Map();
  let m: RegExpExecArray | null;

  const srcRegex = new RegExp(IMG_SRC_REGEX.source, 'gi');
  while ((m = srcRegex.exec(html)) !== null) {
    if (m[2]) {
      const src = stripFragment(m[2]);
      allSrcs.push(src);
      srcTypes.set(src, 'img');
    }
  }
  const svgRegex = new RegExp(SVG_IMAGE_HREF_RE.source, 'gi');
  while ((m = svgRegex.exec(html)) !== null) {
    if (m[2]) {
      const src = stripFragment(m[2]);
      allSrcs.push(src);
      srcTypes.set(src, 'svg');
    }
  }

  if (allSrcs.length === 0) return html;
  if (!readerDoc.getImageData) return html;

  revokePreviousBlobUrls();
  const newBlobUrls: string[] = [];
  const blobUrlCache = new Map<string, string>();

  const srcsToResolve = [
    ...new Set(allSrcs.filter((s) => !s.startsWith('data:') && !s.startsWith('blob:'))),
  ];
  for (const src of srcsToResolve) {
    try {
      const result = await readerDoc.getImageData(src);
      if (result) {
        const buf = result.data.buffer as ArrayBuffer;
        const blob = new Blob(
          [buf.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength)],
          { type: result.mimeType },
        );
        const blobUrl = URL.createObjectURL(blob);
        blobUrlCache.set(src, blobUrl);
        newBlobUrls.push(blobUrl);
      } else {
        blobUrlCache.set(src, '');
      }
    } catch {
      blobUrlCache.set(src, '');
    }
  }

  previousBlobUrls = newBlobUrls;
  let resultHtml = html;
  for (const [src, blobUrl] of blobUrlCache) {
    const safeSrc = escapeRegExp(src);
    if (!blobUrl) {
      resultHtml = resultHtml.replace(
        new RegExp(`(<img\\b[^>]*?src\\s*=\\s*["']${safeSrc}["'][^>]*?>)`, 'gi'),
        addFailedImgClass,
      );
      resultHtml = resultHtml.replace(
        new RegExp(`(<image\\b[^>]*?(?:xlink:)?href\\s*=\\s*["']${safeSrc}["'][^>]*?>)`, 'gi'),
        addFailedImgClass,
      );
      continue;
    }
    resultHtml = resultHtml.replace(
      new RegExp(`(<img\\b[^>]*?)src\\s*=\\s*["']${safeSrc}["']([^>]*?>)`, 'gi'),
      `$1src="${blobUrl}"$2`,
    );
    resultHtml = resultHtml.replace(
      new RegExp(`(<image\\b[^>]*?)(xlink:)?href\\s*=\\s*["']${safeSrc}["']([^>]*?>)`, 'gi'),
      (_match, pre, xlinkPrefix, post) => {
        return `${pre}${xlinkPrefix ? 'xlink:' : ''}href="${blobUrl}"${post}`;
      },
    );
  }
  return resultHtml;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function stripFragment(href: string): string {
  const i = href.indexOf('#');
  return i >= 0 ? href.substring(0, i) : href;
}

/* ==========================================================================
   Query params
   ========================================================================== */

interface QueryParams {
  readonly uri: string;
  readonly format: SupportedFormat;
}

function parseQueryParams(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  const uri = params.get('uri');
  const format = params.get('format')?.toLowerCase();
  if (!uri) throw new ReaderError('Falta el parámetro "uri" en la URL');
  if (!format || !isSupportedFormat(format))
    throw new ReaderError(`Formato no soportado: "${format ?? 'desconocido'}"`);
  return { uri, format };
}

function isSupportedFormat(value: string): value is SupportedFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}

class ReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReaderError';
  }
}

/* ==========================================================================
   UI State
   ========================================================================== */

type UIState =
  | { readonly type: 'loading' }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'content' };

function setUIState(state: UIState): void {
  const reader = document.getElementById('reader');
  const loading = document.getElementById('reader-loading');
  const error = document.getElementById('reader-error');
  const page = document.getElementById('page');
  const bar = document.getElementById('r-bar');
  const foot = document.getElementById('r-foot');

  // Show/hide the reader container (adds .open to slide it in)
  if (reader) {
    if (state.type === 'content') {
      reader.classList.add('open');
      reader.removeAttribute('aria-hidden');
    } else {
      reader.classList.remove('open');
      reader.setAttribute('aria-hidden', 'true');
    }
  }

  if (loading) loading.style.display = state.type === 'loading' ? 'flex' : 'none';
  if (error) error.style.display = state.type === 'error' ? 'flex' : 'none';
  if (page) page.style.display = state.type === 'content' ? 'block' : 'none';
  if (bar) bar.style.display = state.type === 'content' ? 'flex' : 'none';
  if (foot) foot.style.display = state.type === 'content' ? 'flex' : 'none';

  if (state.type === 'error') {
    const msg = document.getElementById('reader-error-message');
    if (msg) msg.textContent = state.message;
  }
}

/* ==========================================================================
   Renderizado de capítulo
   ========================================================================== */

async function renderChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
): Promise<void> {
  const contentEl = document.getElementById('page');
  if (!contentEl) return;
  if (!readerDoc.getCurrentChapterContent)
    throw new ReaderError('El formato no soporta renderizado de contenido');

  const htmlContent = await readerDoc.getCurrentChapterContent();
  const resolvedHtml = await resolveImagesInHtml(readerDoc, htmlContent);
  contentEl.innerHTML = sanitizeHtml(resolvedHtml);

  if (readerDoc.applyPreferences) {
    const existingStyle = contentEl.querySelector('style');
    if (existingStyle) existingStyle.remove();
    const styleEl = document.createElement('style');
    const css = await readerDoc.applyPreferences(preferences);
    styleEl.textContent = css;
    // Append (no prepend) para que el tema del lector gane sobre los <style> del EPUB
    contentEl.append(styleEl);
  }

  updateChapterInfo(readerDoc);

  const scroll = document.getElementById('r-scroll');
  if (scroll) scroll.scrollTop = 0;
}

async function updateChapterInfo(readerDoc: ReaderDocument): Promise<void> {
  const pct = document.getElementById('pct');
  const btnPrev = document.getElementById('prev-page') as HTMLButtonElement | null;
  const btnNext = document.getElementById('next-page') as HTMLButtonElement | null;

  if (readerDoc.getCurrentChapterIndex && readerDoc.getChapterCount) {
    const currentIndex = await readerDoc.getCurrentChapterIndex();
    const totalChapters = await readerDoc.getChapterCount();
    if (pct) pct.textContent = `Cap. ${currentIndex + 1} de ${totalChapters}`;
    if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    if (btnNext) btnNext.disabled = currentIndex >= totalChapters - 1;
  }
}

/* ==========================================================================
   Navegación
   ========================================================================== */

function setupNavigation(readerDoc: ReaderDocument, preferences: ReaderPreferences): void {
  const btnPrev = document.getElementById('prev-page');
  const btnNext = document.getElementById('next-page');
  if (btnPrev)
    btnPrev.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'previous'));
  if (btnNext)
    btnNext.addEventListener('click', () => navigateChapter(readerDoc, preferences, 'next'));
}

async function syncLocator(): Promise<void> {
  if (!currentReaderDoc) return;
  const locator = await currentReaderDoc.getLocator();
  currentLocator = JSON.stringify(locator);
  renderNotesList(currentNotes);
}

async function navigateChapter(
  readerDoc: ReaderDocument,
  preferences: ReaderPreferences,
  direction: 'next' | 'previous',
): Promise<void> {
  try {
    if (direction === 'next') await readerDoc.goNext();
    else await readerDoc.goPrevious();
    await renderChapter(readerDoc, preferences);
    await syncLocator();
  } catch (error) {
    if (error instanceof Error && error.name === 'EpubNavigationError') return;
    throw error;
  }
}

/* ==========================================================================
   Drawer system
   ========================================================================== */

let currentPanel: string | null = null;

function openDrawer(panelId: string, title: string): void {
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('drawer');
  const drawerTitle = document.getElementById('drawer-title');
  if (!scrim || !drawer) return;

  if (drawerTitle) drawerTitle.textContent = title;
  currentPanel = panelId;

  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${panelId}`);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.r-btn[data-panel]').forEach((btn) => {
    btn.classList.toggle('on', (btn as HTMLElement).dataset.panel === panelId);
  });

  scrim.classList.add('show');
  drawer.classList.add('show');
}

function closeDrawer(): void {
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('drawer');
  if (scrim) scrim.classList.remove('show');
  if (drawer) drawer.classList.remove('show');
  document.querySelectorAll('.r-btn[data-panel]').forEach((btn) => btn.classList.remove('on'));
  currentPanel = null;
}

function setupDrawer(): void {
  const scrim = document.getElementById('scrim');
  const drawerX = document.getElementById('drawer-x');
  if (scrim) scrim.addEventListener('click', closeDrawer);
  if (drawerX) drawerX.addEventListener('click', closeDrawer);

  document.querySelectorAll('.r-btn[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = (btn as HTMLElement).dataset.panel;
      if (!panelId) return;
      if (currentPanel === panelId) {
        closeDrawer();
        return;
      }
      const titles: Record<string, string> = {
        info: 'Información',
        toc: 'Índice',
        search: 'Buscar',
        notes: 'Notas',
        settings: 'Ajustes de lectura',
      };
      openDrawer(panelId, titles[panelId] ?? panelId);
    });
  });
}

/* ==========================================================================
   Zen mode
   ========================================================================== */

function setupZen(): void {
  const zenBtn = document.getElementById('r-zen');
  const zenExit = document.getElementById('zen-exit');
  const reader = document.getElementById('reader');
  if (!reader) return;

  const toggleZen = () => reader.classList.toggle('zen');
  if (zenBtn) zenBtn.addEventListener('click', toggleZen);
  if (zenExit) zenExit.addEventListener('click', toggleZen);
}

/* ==========================================================================
   Settings: theme, font, size, line-height
   ========================================================================== */

function setupSettings(_preferences: ReaderPreferences): void {
  const reader = document.getElementById('reader');
  const page = document.getElementById('page');
  if (!reader || !page) return;

  let currentSize = 19;
  let currentLh = 1.75;

  // Theme swatches
  document.querySelectorAll('.sw[data-t]').forEach((sw) => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.sw[data-t]').forEach((s) => s.classList.remove('sel'));
      sw.classList.add('sel');
      reader.setAttribute('data-theme', (sw as HTMLElement).dataset.t ?? 'paper');
    });
  });

  // Font segmented
  document.querySelectorAll('#sw-font button[data-f]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sw-font button').forEach((b) => b.classList.remove('sel'));
      btn.classList.add('sel');
      reader.setAttribute('data-font', (btn as HTMLElement).dataset.f ?? 'serif');
    });
  });

  // Size stepper
  const sizeVal = document.getElementById('size-val');
  const sizeDown = document.getElementById('size-down');
  const sizeUp = document.getElementById('size-up');
  const updateSize = (delta: number) => {
    currentSize = Math.max(14, Math.min(28, currentSize + delta));
    if (sizeVal) sizeVal.textContent = `${currentSize} px`;
    page.style.setProperty('--read-size', `${currentSize}px`);
  };
  if (sizeDown) sizeDown.addEventListener('click', () => updateSize(-1));
  if (sizeUp) sizeUp.addEventListener('click', () => updateSize(1));

  // Line height segmented
  document.querySelectorAll('#sw-lh button[data-lh]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sw-lh button').forEach((b) => b.classList.remove('sel'));
      btn.classList.add('sel');
      currentLh = parseFloat((btn as HTMLElement).dataset.lh ?? '1.75');
      page.style.setProperty('--read-lh', String(currentLh));
    });
  });
}

/* ==========================================================================
   TOC rendering
   ========================================================================== */

async function renderTOC(readerDoc: ReaderDocument): Promise<void> {
  const tocPanel = document.getElementById('panel-toc');
  if (!tocPanel) return;

  // Check if the document supports TOC via capabilities or optional methods
  const doc = readerDoc as unknown as Record<string, unknown>;
  const getTOC = doc.getTOC as (() => Promise<Array<{ title: string; href?: string }>>) | undefined;
  if (!getTOC) {
    tocPanel.innerHTML =
      '<p style="color:var(--chrome-fg-lo);font-size:14px">No hay índice disponible.</p>';
    return;
  }

  try {
    const toc = await getTOC();
    if (!toc || toc.length === 0) {
      tocPanel.innerHTML =
        '<p style="color:var(--chrome-fg-lo);font-size:14px">No hay índice disponible.</p>';
      return;
    }

    const getCurrentIdx = doc.getCurrentChapterIndex as (() => Promise<number>) | undefined;
    const currentIndex = getCurrentIdx ? await getCurrentIdx() : -1;

    tocPanel.innerHTML = toc
      .map((item: { title: string; href?: string }, i: number) => {
        const isCurrent = i === currentIndex;
        return `<button class="toc-item${isCurrent ? ' current' : ''}" data-chapter="${i}">
        <span class="n">${i + 1}</span>
        <span class="t">${item.title}</span>
      </button>`;
      })
      .join('');

    tocPanel.querySelectorAll('.toc-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt((btn as HTMLElement).dataset.chapter ?? '0', 10);
        const goToChapter = doc.goToChapter as ((i: number) => Promise<void>) | undefined;
        if (goToChapter) {
          await goToChapter(idx);
          await renderChapter(readerDoc, currentPreferences);
          closeDrawer();
          await syncLocator();
        }
      });
    });
  } catch {
    tocPanel.innerHTML =
      '<p style="color:var(--chrome-fg-lo);font-size:14px">Error al cargar el índice.</p>';
  }
}

/* ==========================================================================
   Toast
   ========================================================================== */

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  const toastTx = document.getElementById('toast-tx');
  if (!toast || !toastTx) return;
  toastTx.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ==========================================================================
   Bookmark
   ========================================================================== */

function setupBookmark(): void {
  const markBtn = document.getElementById('r-mark');
  if (markBtn) {
    markBtn.addEventListener('click', () => {
      markBtn.classList.toggle('on');
      const isOn = markBtn.classList.contains('on');
      showToast(isOn ? 'Marcador añadido' : 'Marcador eliminado');
    });
  }
}

/* ==========================================================================
   Back button
   ========================================================================== */

const CLOSE_SENTINEL = '__clio_back__';

function setupBack(): void {
  const backBtn = document.getElementById('r-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      console.log(CLOSE_SENTINEL);
    });
  }
}

/* ==========================================================================
   Carga de documento
   ========================================================================== */

async function loadDocument(
  uri: string,
  format: SupportedFormat,
  preloadedData?: Uint8Array,
): Promise<ReaderDocument> {
  switch (format) {
    case 'epub': {
      const doc = new EpubReaderDocument({ uri, name: '' });
      await doc.open(preloadedData);
      return doc;
    }
    default:
      throw new ReaderError(`Formato no implementado: ${format}`);
  }
}

/* ==========================================================================
   Entry point
   ========================================================================== */

let currentReaderDoc: ReaderDocument | null = null;
let currentPreferences: ReaderPreferences = DEFAULT_PREFERENCES;
let currentNotes: Array<{ id: string; body: string; createdAt: number; locator: string }> = [];
let currentLocator: string = '';
let editingNoteId: string | null = null;

interface PendingNoteItem {
  readonly key: string;
  readonly body: string;
  readonly locator: string;
}

interface PendingNoteUpdateItem {
  readonly key: string;
  readonly noteId: string;
  readonly body: string;
}

declare global {
  interface Window {
    __pendingNotes?: PendingNoteItem[];
    __pendingNoteUpdates?: PendingNoteUpdateItem[];
    __pendingNoteDelete?: string | null;
    __updateNotes?: (
      notes: Array<{ id: string; body: string; createdAt: number; locator: string }>,
    ) => void;
    __noteSaved?: () => void;
    __noteError?: (message: string) => void;
    __goToChapter?: (idx: number) => Promise<void>;
    __getCurrentLocator?: () => string | undefined;
    __updateRank?: (rank: number) => void;
  }
}

function renderInfoPanel(metadata: {
  title: string;
  author?: string;
  coverImage?: string;
  format: string;
  rank: number;
}): void {
  const panel = document.getElementById('panel-info');
  if (!panel) return;

  const rankValue = metadata.rank ?? 0;
  const gradId = `reader-half-star`;

  const authorLast = metadata.author ? (metadata.author.split(' ').pop() ?? '') : '';
  const glyphs = ['Η', 'Θ', 'Β', 'Α', 'C', '∞', 'H', '⁂', 'Μ', '❦', 'G', 'B', 'Σ', 'Ω', 'Δ', 'Φ'];
  let hash = 0;
  const idStr = metadata.title;
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
  }
  const glyph = glyphs[Math.abs(hash) % glyphs.length];

  const palettes: [string, string][] = [
    ['#3a2e5c', '#6b4ea3'],
    ['#173a34', '#2f6d61'],
    ['#4a2b2b', '#8a3f3f'],
    ['#2c3a52', '#4a6a8a'],
    ['#453520', '#8a6a34'],
    ['#3a1f2e', '#7a3a55'],
  ];
  const palette = palettes[Math.abs(hash) % palettes.length]!;
  const pc1 = palette[0];
  const pc2 = palette[1];

  panel.innerHTML = `
    <div class="info-content">
      ${
        metadata.coverImage
          ? `<img src="${metadata.coverImage}" class="info-cover" alt="Portada" />`
          : `<div class="info-cover-placeholder" style="background:linear-gradient(150deg,${pc1},${pc2})">
            <div class="info-cover-author">${authorLast}</div>
            <div class="info-cover-title">${metadata.title}</div>
            <div class="info-cover-glyph">${glyph}</div>
          </div>`
      }
      <h3 class="info-title">${metadata.title}</h3>
      ${metadata.author ? `<p class="info-author">${metadata.author}</p>` : ''}
      <p class="info-format">Formato: ${metadata.format.toUpperCase()}</p>
      <div class="info-rating">
        <svg width="0" height="0" style="position:absolute">
          <defs>
            <linearGradient id="${gradId}">
              <stop offset="50%" stop-color="var(--gold)" />
              <stop offset="50%" stop-color="var(--line)" />
            </linearGradient>
          </defs>
        </svg>
        <div class="info-stars" role="radiogroup" aria-label="Rating del libro" data-rank="${rankValue}">
          ${[1, 2, 3, 4, 5]
            .map((s) => {
              const isHalf = rankValue >= s - 0.5 && rankValue < s;
              const isFull = rankValue >= s;
              const fillClass = isFull ? 'star-full' : isHalf ? 'star-half' : 'star-empty';
              return `<span class="star-btn ${fillClass}" data-star="${s}" role="radio" aria-checked="${isFull || isHalf}" aria-label="${s} estrella${s > 1 ? 's' : ''}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFull ? 'var(--gold)' : isHalf ? `url(#${gradId})` : 'var(--line)'}" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </span>`;
            })
            .join('')}
        </div>
        <span class="info-rank-value">${rankValue > 0 ? rankValue : ''}</span>
      </div>
    </div>
  `;

  const starsContainer = panel.querySelector('.info-stars');
  if (!starsContainer) return;

  const sendRankToHost = (newRank: number): void => {
    console.log('__clio_rank__' + JSON.stringify({ rank: newRank }));
  };

  const updateStars = (displayRank: number): void => {
    starsContainer.querySelectorAll('.star-btn').forEach((btn) => {
      const s = Number((btn as HTMLElement).dataset.star);
      const isHalf = displayRank >= s - 0.5 && displayRank < s;
      const isFull = displayRank >= s;
      btn.classList.toggle('star-full', isFull);
      btn.classList.toggle('star-half', isHalf && !isFull);
      btn.classList.toggle('star-empty', !isFull && !isHalf);
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute(
          'fill',
          isFull ? 'var(--gold)' : isHalf ? `url(#${gradId})` : 'var(--line)',
        );
      }
      btn.setAttribute('aria-checked', String(isFull || isHalf));
    });
    const rankValueEl = panel.querySelector('.info-rank-value');
    if (rankValueEl) rankValueEl.textContent = displayRank > 0 ? String(displayRank) : '';
    starsContainer.setAttribute('data-rank', String(displayRank));
  };

  starsContainer.addEventListener('mousemove', (e: Event) => {
    const me = e as MouseEvent;
    const target = (me.target as HTMLElement).closest('.star-btn');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = me.clientX - rect.left;
    const starIndex = Number((target as HTMLElement).dataset.star);
    const hoverRank = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
    updateStars(hoverRank);
  });

  starsContainer.addEventListener('mouseleave', () => {
    const current = Number(starsContainer.getAttribute('data-rank')) || 0;
    updateStars(current);
  });

  starsContainer.addEventListener('click', (e: Event) => {
    const me = e as MouseEvent;
    const target = (me.target as HTMLElement).closest('.star-btn');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = me.clientX - rect.left;
    const starIndex = Number((target as HTMLElement).dataset.star);
    const clickedRank = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
    const currentRank = Number(starsContainer.getAttribute('data-rank')) || 0;
    const newRank = clickedRank === currentRank ? 0 : clickedRank;
    starsContainer.setAttribute('data-rank', String(newRank));
    updateStars(newRank);
    sendRankToHost(newRank);
  });
}

function renderNotesList(
  notes: Array<{ id: string; body: string; createdAt: number; locator: string }>,
): void {
  const list = document.getElementById('notes-list');
  if (!list) return;

  const pageNotes = notes.filter((n) => n.locator === currentLocator);

  if (pageNotes.length === 0) {
    list.innerHTML = '<p class="notes-empty">No hay notas en esta página.</p>';
    return;
  }

  list.innerHTML = pageNotes
    .map(
      (n) => `
    <div class="note" data-note-id="${n.id}">
      <div class="ntx">${n.body}</div>
      <div class="note-actions">
        <button class="note-edit" data-note-id="${n.id}" data-note-body="${n.body.replace(/"/g, '&quot;')}" title="Editar nota">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="note-delete" data-note-id="${n.id}" title="Eliminar nota">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `,
    )
    .join('');

  list.querySelectorAll('.note-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const noteId = (btn as HTMLElement).dataset.noteId;
      if (noteId) {
        window.__pendingNoteDelete = noteId;
      }
    });
  });

  list.querySelectorAll('.note-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const noteId = (btn as HTMLElement).dataset.noteId;
      const noteBody = (btn as HTMLElement).dataset.noteBody ?? '';
      if (noteId) {
        editingNoteId = noteId;
        const input = document.getElementById('note-input') as HTMLTextAreaElement | null;
        const saveBtn = document.getElementById('note-save');
        if (input) input.value = noteBody;
        if (saveBtn) saveBtn.textContent = 'Actualizar';
      }
    });
  });
}

function enqueueNote(payload: { body: string; locator: string }): void {
  const queue = window.__pendingNotes ?? [];
  if (!window.__pendingNotes) window.__pendingNotes = queue;
  queue.push({
    key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    body: payload.body,
    locator: payload.locator,
  });
}

function enqueueNoteUpdate(payload: { noteId: string; body: string }): void {
  const queue = window.__pendingNoteUpdates ?? [];
  if (!window.__pendingNoteUpdates) window.__pendingNoteUpdates = queue;
  queue.push({
    key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    noteId: payload.noteId,
    body: payload.body,
  });
}

function setupNotes(): void {
  const saveBtn = document.getElementById('note-save');
  const input = document.getElementById('note-input') as HTMLTextAreaElement | null;

  if (saveBtn && input) {
    saveBtn.addEventListener('click', () => {
      const body = input.value.trim();
      if (!body) return;
      if (editingNoteId) {
        enqueueNoteUpdate({ noteId: editingNoteId, body });
        editingNoteId = null;
        saveBtn.textContent = 'Guardar';
        showToast('Actualización en cola');
      } else {
        enqueueNote({ body, locator: currentLocator });
        showToast('Nota en cola');
      }
      input.value = '';
    });
  }

  renderNotesList(currentNotes);
}

async function main(): Promise<void> {
  setUIState({ type: 'loading' });

  try {
    const { uri, format } = parseQueryParams();

    (window as unknown as Record<string, unknown>).__initFromHost = async (data: {
      preferences: ReaderPreferences;
      fileDataB64: string;
      metadata: {
        bookId: string;
        title: string;
        author?: string;
        coverImage?: string;
        format: string;
        rank: number;
      };
      notes: Array<{ id: string; body: string; createdAt: number; locator: string }>;
    }) => {
      try {
        const binary = atob(data.fileDataB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        currentPreferences = data.preferences;
        currentNotes = data.notes ?? [];
        currentReaderDoc = await loadDocument(uri, format, bytes);

        // Populate toolbar with real metadata
        const titleEl = document.getElementById('r-title');
        const authorEl = document.getElementById('r-author');
        if (titleEl && titleEl.childNodes[0]) {
          titleEl.childNodes[0].textContent = data.metadata.title;
        }
        if (authorEl) authorEl.textContent = data.metadata.author ?? '';

        setUIState({ type: 'content' });
        await renderChapter(currentReaderDoc, currentPreferences);
        await syncLocator();
        setupNavigation(currentReaderDoc, currentPreferences);
        setupDrawer();
        setupZen();
        setupSettings(currentPreferences);
        setupBookmark();
        setupBack();
        await renderTOC(currentReaderDoc);
        renderInfoPanel(data.metadata);
        setupNotes();

        // Tema de la superficie de lectura según las preferencias guardadas.
        // El chrome (cintillos y drawer) sigue la paleta de la app por separado.
        const reader = document.getElementById('reader');
        if (reader) {
          const themeMap: Record<string, string> = {
            light: 'paper',
            dark: 'night',
            sepia: 'sepia',
          };
          const theme = themeMap[currentPreferences.theme] ?? 'paper';
          reader.setAttribute('data-theme', theme);
          document.querySelectorAll('.sw[data-t]').forEach((sw) => {
            sw.classList.toggle('sel', (sw as HTMLElement).dataset.t === theme);
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al abrir el libro';
        setUIState({ type: 'error', message });
      }
    };

    /* --- Palette injection from host --- */
    (window as unknown as Record<string, unknown>).__applyPalette = (cssVars: string) => {
      let style = document.getElementById('palette-injected') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = 'palette-injected';
        document.head.appendChild(style);
      }
      style.textContent = `:root { ${cssVars} }`;
    };

    /* --- Notes update from host --- */
    window.__updateNotes = (
      notes: Array<{ id: string; body: string; createdAt: number; locator: string }>,
    ) => {
      currentNotes = notes;
      renderNotesList(currentNotes);
    };

    /* --- Rank update from host --- */
    window.__updateRank = (newRank: number) => {
      const panel = document.getElementById('panel-info');
      if (!panel) return;
      const starsContainer = panel.querySelector('.info-stars');
      if (!starsContainer) return;
      starsContainer.setAttribute('data-rank', String(newRank));
      const gradId = 'reader-half-star';
      starsContainer.querySelectorAll('.star-btn').forEach((btn) => {
        const s = Number((btn as HTMLElement).dataset.star);
        const isHalf = newRank >= s - 0.5 && newRank < s;
        const isFull = newRank >= s;
        btn.classList.toggle('star-full', isFull);
        btn.classList.toggle('star-half', isHalf && !isFull);
        btn.classList.toggle('star-empty', !isFull && !isHalf);
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.setAttribute(
            'fill',
            isFull ? 'var(--gold)' : isHalf ? `url(#${gradId})` : 'var(--line)',
          );
        }
        btn.setAttribute('aria-checked', String(isFull || isHalf));
      });
      const rankValueEl = panel.querySelector('.info-rank-value');
      if (rankValueEl) rankValueEl.textContent = newRank > 0 ? String(newRank) : '';
    };

    /* --- Notes save/error feedback from host --- */
    window.__noteSaved = () => {
      showToast('Nota guardada');
    };
    window.__noteError = (message: string) => {
      showToast(message);
    };

    /* --- Go to chapter by index (for initial locator from host) --- */
    window.__goToChapter = async (idx: number) => {
      if (!currentReaderDoc) return;
      await currentReaderDoc.goToChapter?.(idx);
      await renderChapter(currentReaderDoc, currentPreferences);
      await syncLocator();
    };

    /* --- Get current locator (for host progress sync) --- */
    window.__getCurrentLocator = (): string | undefined => {
      return currentLocator || undefined;
    };

    const retryBtn = document.getElementById('reader-error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        currentReaderDoc = null;
        main();
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al abrir el libro';
    setUIState({ type: 'error', message });
  }
}

main();
