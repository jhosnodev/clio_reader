/**
 * ReaderView.tsx — Vista del lector de libros
 *
 * El toolbar y controles están dentro del webview (reader.html).
 * Este componente solo gestiona: webview, verificación de archivos,
 * inyección de datos, progreso y preferencias.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { bridge } from '../bridges/bridge-singleton';
import type { LibraryRepository } from '@clio-reader/library';
import { updateProgress } from '@clio-reader/library';
import {
  createNoteManaged,
  listNotesManaged,
  removeNoteManaged,
  updateNoteManaged,
  createHighlightManaged,
  listHighlightsManaged,
  removeHighlightManaged,
} from '@clio-reader/annotations';
import type { ReaderLocator, ReaderPreferences } from '@clio-reader/domain';
import { createDefaultPreferences } from '@clio-reader/domain';
import { getPalette, LIGHT_DEFAULTS } from '../themes';
import {
  getResumePositionOrder,
  getResumeScrollRatio,
  locatorToPercent,
  parseLocator,
} from './reader-progress';

/* ==========================================================================
   Props
   ========================================================================== */

interface ReaderViewProps {
  readonly bookId: string;
  readonly fileUri: string;
  readonly format: string;
  readonly title: string;
  readonly author?: string | undefined;
  readonly coverImage?: string | undefined;
  readonly rank?: number | undefined;
  readonly initialLocator?: string | undefined;
  readonly repository: LibraryRepository;
  readonly paletteId: string;
  readonly theme: 'dark' | 'light';
  readonly onClose: () => void;
  readonly onSaveRank?: ((rank: number) => void) | undefined;
}

/* ==========================================================================
   Estados internos
   ========================================================================== */

type FileStatus = 'checking' | 'found' | 'not-found';

/* ==========================================================================
   Helper: build palette CSS string for webview injection
   ========================================================================== */

function hexToRgb(hex: string): string {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? digits.replace(/./g, (c) => c + c) : digits;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

function buildPaletteCss(paletteId: string, mode: 'dark' | 'light'): string {
  const palette = getPalette(paletteId);
  const src = mode === 'dark' ? palette.dark : LIGHT_DEFAULTS;
  const vars: string[] = [];
  for (const [key, val] of Object.entries(src)) {
    vars.push(`--${key}:${val}`);
  }
  // RGB decompositions always from dark palette
  if (mode === 'light') {
    vars.push(`--gold-rgb:${palette.dark['gold-rgb']}`);
    vars.push(`--verdigris-rgb:${palette.dark['verdigris-rgb']}`);
    vars.push(`--ink950-rgb:${palette.dark['ink950-rgb']}`);
    vars.push(`--rose-rgb:${palette.dark['rose-rgb']}`);
  }
  // Tinta del resaltado de texto anotado: gold sobre oscuro, gold-bright sobre claro.
  vars.push(
    `--mark-rgb:${hexToRgb(mode === 'dark' ? palette.dark.gold : palette.dark['gold-bright'])}`,
  );
  return vars.join(';');
}

/* ==========================================================================
   Helper: URL del reader.html resuelta contra la URL del documento host
   (en dev es http://localhost:5173/, en prod file://…/dist/index.html;
   una URL absoluta tipo /reader.html rompería en prod)
   ========================================================================== */

function buildReaderUrl(uri: string, format: string): string {
  const url = new URL('reader.html', window.location.href);
  url.search = `?uri=${encodeURIComponent(uri)}&format=${encodeURIComponent(format)}&_v=${Date.now()}`;
  return url.toString();
}

/* ==========================================================================
   Componente
   ========================================================================== */

export function ReaderView({
  bookId,
  fileUri,
  format,
  title,
  author,
  coverImage,
  rank,
  initialLocator,
  repository,
  paletteId,
  theme,
  onClose,
  onSaveRank,
}: ReaderViewProps): JSX.Element {
  const [fileStatus, setFileStatus] = useState<FileStatus>('checking');
  const [isRelocating, setIsRelocating] = useState(false);
  const [webviewLoaded, setWebviewLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [sourceUri, setSourceUri] = useState(fileUri);
  const webviewRef = useRef<HTMLElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocatorRef = useRef<import('@clio-reader/domain').ReaderLocator | null>(null);
  const lastPercentRef = useRef<number>(0);
  const drainPromiseRef = useRef<Promise<void> | null>(null);
  const closingRef = useRef(false);
  const readerUrlRef = useRef<string | null>(null);
  const readerUrlKeyRef = useRef<string | null>(null);
  const readerUrlKey = `${sourceUri}|${format}|${loadKey}`;
  if (readerUrlKeyRef.current !== readerUrlKey) {
    readerUrlKeyRef.current = readerUrlKey;
    readerUrlRef.current = buildReaderUrl(sourceUri, format);
  }

  /* ----- Handler estable para did-finish-load ----- */
  const handleFinishLoadRef = useRef<(() => Promise<void>) | null>(null);

  /* ----- Sincronizar uri externa (relocalización persistida) ----- */
  useEffect(() => {
    setSourceUri(fileUri);
    setLoadError(null);
  }, [fileUri]);

  /* ----- Verificar existencia del archivo ----- */
  const checkFile = useCallback(async () => {
    setFileStatus('checking');
    try {
      const exists = await bridge.checkFileExists(sourceUri);
      setFileStatus(exists ? 'found' : 'not-found');
    } catch {
      setFileStatus('not-found');
    }
  }, [sourceUri]);

  useEffect(() => {
    checkFile();
  }, [checkFile]);

  /* ----- Cargar preferencias y progreso ----- */
  const loadPreferences = useCallback(async (): Promise<ReaderPreferences> => {
    try {
      const [globalPrefs, bookPrefs] = await Promise.all([
        repository.getGlobalPreferences(),
        repository.getBookPreferences(bookId),
      ]);
      return { ...globalPrefs, ...bookPrefs };
    } catch {
      return createDefaultPreferences();
    }
  }, [repository, bookId]);

  /* ----- Cargar progreso guardado ----- */
  const loadProgress = useCallback(async () => {
    try {
      return await repository.getProgress(bookId);
    } catch {
      return undefined;
    }
  }, [repository, bookId]);

  /* ----- Actualizar el handler del webview cuando cambian las dependencias ----- */
  useEffect(() => {
    handleFinishLoadRef.current = async (): Promise<void> => {
      try {
        const [preferences, fileData, existingNotes, existingHighlights, savedProgress] =
          await Promise.all([
            loadPreferences(),
            bridge.readFile(sourceUri),
            listNotesManaged(repository, bookId).catch(() => []),
            listHighlightsManaged(repository, bookId).catch(() => []),
            loadProgress(),
          ]);

        if (!fileData || fileData.byteLength === 0) {
          console.error('[reader] archivo leído está vacío o es inválido');
          return;
        }

        let binary = '';
        for (let i = 0; i < fileData.byteLength; i++) {
          binary += String.fromCharCode(fileData[i]!);
        }
        const b64 = btoa(binary);

        const notesData = existingNotes.map((n) => ({
          id: n.id,
          body: n.body,
          createdAt: n.createdAt,
          locator: JSON.stringify(n.locator),
          ...(n.selectedText !== undefined ? { selectedText: n.selectedText } : {}),
        }));

        const highlightsData = existingHighlights.map((h) => ({
          id: h.id,
          color: h.color,
          locator: JSON.stringify(h.locatorStart),
          ...(h.selectedText !== undefined ? { selectedText: h.selectedText } : {}),
        }));

        const initData = {
          preferences,
          fileDataB64: b64,
          metadata: {
            bookId,
            title,
            author,
            coverImage: coverImage && coverImage.length < 500_000 ? coverImage : undefined,
            format,
            rank: rank ?? 0,
          },
          notes: notesData,
          highlights: highlightsData,
        };
        const initCode = `window.__initFromHost(${JSON.stringify(initData)})`;

        const wv = webviewRef.current as unknown as {
          executeJavaScript: (code: string) => Promise<unknown>;
        } | null;
        await wv?.executeJavaScript(initCode);

        // Inject palette CSS variables into the webview
        const paletteCss = buildPaletteCss(paletteId, theme);
        await wv?.executeJavaScript(`window.__applyPalette(${JSON.stringify(paletteCss)})`);

        // Resume to saved position: note locator takes priority over saved progress
        const noteLocator = parseLocator(initialLocator);
        const savedLocator = savedProgress?.locator;
        const resumeLocator = noteLocator ?? (savedLocator as ReaderLocator | undefined);
        const resumeOrder = getResumePositionOrder(noteLocator ?? undefined, savedLocator);
        if (typeof resumeOrder === 'number') {
          const resumeRatio = getResumeScrollRatio(noteLocator ?? savedLocator) ?? null;
          await wv?.executeJavaScript(
            `window.__goToChapter && window.__goToChapter(${resumeOrder}, ${JSON.stringify(resumeRatio)}, ${JSON.stringify(initialLocator ?? null)})`,
          );
        } else if (
          resumeLocator &&
          (resumeLocator.format === 'pdf' || resumeLocator.format === 'cbz') &&
          typeof resumeLocator.page === 'number'
        ) {
          await wv?.executeJavaScript(
            `window.__goToPage && window.__goToPage(${resumeLocator.page})`,
          );
        }

        setLoadError(null);
        setWebviewLoaded(true);
        (webviewRef.current as HTMLElement | null)?.focus();
      } catch (err) {
        console.error('[reader] error inyectando datos en webview:', err);
        setLoadError('No se pudo cargar el contenido del libro.');
      }
    };
  }, [
    loadPreferences,
    loadProgress,
    sourceUri,
    paletteId,
    theme,
    bookId,
    title,
    author,
    coverImage,
    format,
    repository,
    initialLocator,
  ]);

  /* ----- Cleanup del listener en unmount ----- */
  useEffect(() => {
    return () => {
      const webview = webviewRef.current as
        | (HTMLElement & { removeEventListener: (event: string, handler: () => void) => void })
        | null;
      if (webview && handleFinishLoadRef.current) {
        webview.removeEventListener('did-finish-load', handleFinishLoadRef.current);
      }
    };
  }, []);

  /* ----- Helper: empujar notas actualizadas al webview ----- */
  const pushNotesToWebview = useCallback(
    async (wv: { executeJavaScript: (code: string) => Promise<unknown> }): Promise<void> => {
      const notes = await listNotesManaged(repository, bookId).catch(() => []);
      const notesData = notes.map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt,
        locator: JSON.stringify(n.locator),
        ...(n.selectedText !== undefined ? { selectedText: n.selectedText } : {}),
      }));
      await wv.executeJavaScript(
        `window.__updateNotes && window.__updateNotes(${JSON.stringify(notesData)})`,
      );
    },
    [repository, bookId],
  );

  /* ----- Helper: empujar resaltados actualizados al webview ----- */
  const pushHighlightsToWebview = useCallback(
    async (wv: { executeJavaScript: (code: string) => Promise<unknown> }): Promise<void> => {
      const highlights = await listHighlightsManaged(repository, bookId).catch(() => []);
      const highlightsData = highlights.map((h) => ({
        id: h.id,
        color: h.color,
        locator: JSON.stringify(h.locatorStart),
        ...(h.selectedText !== undefined ? { selectedText: h.selectedText } : {}),
      }));
      await wv.executeJavaScript(
        `window.__updateHighlights && window.__updateHighlights(${JSON.stringify(highlightsData)})`,
      );
    },
    [repository, bookId],
  );

  type NoteQueueItem = {
    readonly key: string;
    readonly body: string;
    readonly locator: string;
    readonly selectedText?: string;
  };
  type NoteUpdateItem = { readonly key: string; readonly noteId: string; readonly body: string };
  type HighlightQueueItem = {
    readonly key: string;
    readonly color: string;
    readonly locator: string;
    readonly selectedText?: string;
  };

  /* ----- Drenar cola de notas + borrados pendientes del webview ----- */
  const drainNotes = useCallback((): Promise<void> => {
    if (drainPromiseRef.current) return drainPromiseRef.current;

    const run = (async (): Promise<void> => {
      const wv = webviewRef.current as unknown as {
        executeJavaScript: (code: string) => Promise<unknown>;
      } | null;
      if (!wv) return;

      try {
        const pendingDelete = (await wv.executeJavaScript('window.__pendingNoteDelete')) as
          string | null | undefined;
        if (pendingDelete) {
          try {
            await removeNoteManaged(repository, pendingDelete, bookId);
          } catch (err) {
            console.error('[reader] error eliminando nota:', err);
          }
          await wv.executeJavaScript('window.__pendingNoteDelete = null');
        }

        // Guardado en cola: procesa cada ítem y lo quita siempre (éxito o error)
        const queue = (await wv.executeJavaScript('window.__pendingNotes')) as
          NoteQueueItem[] | null | undefined;
        if (queue && queue.length > 0) {
          for (const item of queue) {
            try {
              const locator = JSON.parse(item.locator);
              await createNoteManaged(repository, bookId, locator, item.body, {
                ...(item.selectedText !== undefined ? { selectedText: item.selectedText } : {}),
              });
              await wv.executeJavaScript('window.__noteSaved && window.__noteSaved()');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'No se pudo guardar la nota';
              console.error('[reader] error guardando nota:', err);
              await wv.executeJavaScript(
                `window.__noteError && window.__noteError(${JSON.stringify(message)})`,
              );
            }
            await wv.executeJavaScript(
              `window.__pendingNotes = (window.__pendingNotes ?? []).filter((n) => n.key !== ${JSON.stringify(item.key)})`,
            );
          }
          await pushNotesToWebview(wv);
        }

        // Actualizaciones en cola
        const updateQueue = (await wv.executeJavaScript('window.__pendingNoteUpdates')) as
          NoteUpdateItem[] | null | undefined;
        if (updateQueue && updateQueue.length > 0) {
          for (const item of updateQueue) {
            try {
              await updateNoteManaged(repository, item.noteId, bookId, item.body);
              await wv.executeJavaScript('window.__noteSaved && window.__noteSaved()');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'No se pudo actualizar la nota';
              console.error('[reader] error actualizando nota:', err);
              await wv.executeJavaScript(
                `window.__noteError && window.__noteError(${JSON.stringify(message)})`,
              );
            }
            await wv.executeJavaScript(
              `window.__pendingNoteUpdates = (window.__pendingNoteUpdates ?? []).filter((n) => n.key !== ${JSON.stringify(item.key)})`,
            );
          }
          await pushNotesToWebview(wv);
        }

        // Borrados de resaltados
        const pendingHighlightDeletes = (await wv.executeJavaScript(
          'window.__pendingHighlightDeletes',
        )) as string[] | null | undefined;
        if (pendingHighlightDeletes && pendingHighlightDeletes.length > 0) {
          for (const highlightId of pendingHighlightDeletes) {
            try {
              await removeHighlightManaged(repository, highlightId, bookId);
            } catch (err) {
              console.error('[reader] error eliminando resaltado:', err);
            }
          }
          await wv.executeJavaScript('window.__pendingHighlightDeletes = []');
          await pushHighlightsToWebview(wv);
        }

        // Resaltados en cola
        const highlightQueue = (await wv.executeJavaScript('window.__pendingHighlights')) as
          HighlightQueueItem[] | null | undefined;
        if (highlightQueue && highlightQueue.length > 0) {
          for (const item of highlightQueue) {
            try {
              const locator = JSON.parse(item.locator);
              await createHighlightManaged(repository, bookId, locator, item.color, {
                ...(item.selectedText !== undefined ? { selectedText: item.selectedText } : {}),
              });
              await wv.executeJavaScript('window.__highlightSaved && window.__highlightSaved()');
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'No se pudo guardar el resaltado';
              console.error('[reader] error guardando resaltado:', err);
              await wv.executeJavaScript(
                `window.__highlightError && window.__highlightError(${JSON.stringify(message)})`,
              );
            }
            await wv.executeJavaScript(
              `window.__pendingHighlights = (window.__pendingHighlights ?? []).filter((h) => h.key !== ${JSON.stringify(item.key)})`,
            );
          }
          await pushHighlightsToWebview(wv);
        }
      } catch {
        // Ignorar errores transitorios del poll
      }
    })();

    drainPromiseRef.current = run;
    void run.finally(() => {
      drainPromiseRef.current = null;
    });
    return run;
  }, [repository, bookId, pushNotesToWebview, pushHighlightsToWebview]);

  /* ----- Polling: drenar cola de notas pendientes del webview ----- */
  useEffect(() => {
    if (!webviewLoaded) return;

    const interval = setInterval(() => {
      drainNotes().catch(() => {});
    }, 1000);

    return () => clearInterval(interval);
  }, [webviewLoaded, drainNotes]);

  /* ----- Sincronizar progreso con el webview (poll + debounce) ----- */
  const flushProgress = useCallback(async (): Promise<void> => {
    if (!lastLocatorRef.current) return;

    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    await updateProgress(repository, {
      bookId,
      locator: lastLocatorRef.current,
      percent: lastPercentRef.current,
    });
  }, [repository, bookId]);

  useEffect(() => {
    if (!webviewLoaded) return;

    const interval = setInterval(() => {
      const wv = webviewRef.current as unknown as {
        executeJavaScript: (code: string) => Promise<unknown>;
      } | null;
      if (!wv) return;

      void wv
        .executeJavaScript('window.__getCurrentLocator && window.__getCurrentLocator()')
        .then((result) => {
          if (typeof result !== 'string') return;
          try {
            const locator = JSON.parse(result) as import('@clio-reader/domain').ReaderLocator;
            lastLocatorRef.current = locator;
            lastPercentRef.current = locatorToPercent(locator);
          } catch {
            // Ignore invalid locator
          }
        })
        .catch(() => {});

      // Debounce save: reset timer on each tick
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
      progressTimerRef.current = setTimeout(() => {
        progressTimerRef.current = null;
        void flushProgress().catch(() => {});
      }, 800);
    }, 1000);

    return () => clearInterval(interval);
  }, [webviewLoaded, flushProgress]);

  /* ----- Push rank updates al webview sin re-inicializar ----- */
  useEffect(() => {
    if (!webviewLoaded) return;
    const wv = webviewRef.current as unknown as {
      executeJavaScript: (code: string) => Promise<unknown>;
    } | null;
    if (!wv) return;
    const currentRank = rank ?? 0;
    void wv.executeJavaScript(`window.__updateRank && window.__updateRank(${currentRank})`);
  }, [webviewLoaded, rank]);

  /* ----- Callback ref: adjunta el listener inmediatamente al crear el elemento ----- */
  const webviewCallbackRef = useCallback((el: HTMLElement | null) => {
    const prevEl = webviewRef.current;

    if (prevEl && handleFinishLoadRef.current) {
      (
        prevEl as HTMLElement & {
          removeEventListener: (event: string, handler: () => void) => void;
        }
      ).removeEventListener('did-finish-load', handleFinishLoadRef.current);
    }

    webviewRef.current = el;

    if (el) {
      el.setAttribute('src', readerUrlRef.current ?? '');
      setWebviewLoaded(false);
      (
        el as HTMLElement & { addEventListener: (event: string, handler: () => void) => void }
      ).addEventListener('did-finish-load', handleFinishLoadRef.current!);
    }
  }, []);

  /* ----- Cerrar lector vía sentinel del webview + fallbacks de navegación ----- */
  useEffect(() => {
    const webview = webviewRef.current as
      | (HTMLElement & {
          addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
          removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
        })
      | null;
    if (!webview) return;

    const CLOSE_SENTINEL = '__clio_back__';
    const RANK_SENTINEL = '__clio_rank__';
    const PREFERENCES_SENTINEL = '__clio_prefs__';

    const isBackNavigation = (url: unknown): boolean => {
      if (typeof url !== 'string' || url.length === 0) return false;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return false;
      }
      if (
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'https:' &&
        parsed.protocol !== 'file:'
      ) {
        return false;
      }
      return parsed.pathname === '/' || parsed.pathname === '';
    };

    const closeOnce = (): void => {
      if (closingRef.current) return;
      closingRef.current = true;
      onClose();
    };

    const handleCloseFromSentinel = (): void => {
      if (closingRef.current) return;
      closeOnce();
      // Flush progress + drain notes (fire-and-forget, repo stays valid)
      void flushProgress()
        .then(() => drainNotes())
        .catch(() => {});
    };

    const handleConsoleMessage = (event: unknown): void => {
      const message = (event as { message?: string } | null)?.message ?? '';
      if (message === CLOSE_SENTINEL) handleCloseFromSentinel();
      if (message.startsWith(RANK_SENTINEL)) {
        try {
          const payload = JSON.parse(message.slice(RANK_SENTINEL.length)) as { rank: number };
          onSaveRank?.(payload.rank);
        } catch {
          /* ignore */
        }
      }
      if (message.startsWith(PREFERENCES_SENTINEL)) {
        try {
          const preferences = JSON.parse(
            message.slice(PREFERENCES_SENTINEL.length),
          ) as ReaderPreferences;
          repository.saveGlobalPreferences(preferences).catch((err) => {
            console.error('[reader] error guardando preferencias:', err);
          });
        } catch {
          /* ignore */
        }
      }
    };

    const handleWillNavigate = (event: unknown): void => {
      const nav = event as { url?: string } | undefined;
      if (isBackNavigation(nav?.url)) closeOnce();
    };

    const handleNavigate = (...args: unknown[]): void => {
      const event = args[0] as { href?: string } | undefined;
      if (isBackNavigation(event?.href)) closeOnce();
    };

    const handleFailLoad = (...args: unknown[]): void => {
      const fail = args[0] as
        { errorCode?: number; errorDescription?: string; isMainFrame?: boolean } | undefined;
      if (!fail) return;
      if (fail.errorCode === -3) return;
      if (fail.isMainFrame === false) return;
      console.error('[reader] did-fail-load:', fail.errorCode, fail.errorDescription);
      setLoadError(fail.errorDescription || 'No se pudo cargar el lector.');
    };

    webview.addEventListener('console-message', handleConsoleMessage);
    webview.addEventListener('will-navigate', handleWillNavigate);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-fail-load', handleFailLoad);
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage);
      webview.removeEventListener('will-navigate', handleWillNavigate);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-fail-load', handleFailLoad);
    };
  }, [
    onClose,
    onSaveRank,
    drainNotes,
    flushProgress,
    webviewLoaded,
    fileStatus,
    repository,
    loadKey,
  ]);

  /* ----- Guardar progreso al cerrar la ventana ----- */
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      if (lastLocatorRef.current !== null) {
        updateProgress(repository, {
          bookId,
          locator: lastLocatorRef.current,
          percent: lastPercentRef.current,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [repository, bookId]);

  /* ----- Relocalizar archivo ----- */
  const handleRelocate = useCallback(async () => {
    setIsRelocating(true);
    try {
      const fileSource = await bridge.pickFile();
      if (!fileSource) return;
      const book = await repository.getBook(bookId);
      if (book) {
        await repository.upsertBook({ ...book, uri: fileSource.uri });
      }
      setLoadError(null);
      setSourceUri(fileSource.uri);
    } catch (err) {
      console.error('[reader] error reubicando archivo:', err);
    } finally {
      setIsRelocating(false);
    }
  }, [repository, bookId]);

  /* ----- Reintentar carga del webview ----- */
  const handleRetryLoad = useCallback(() => {
    setLoadError(null);
    setWebviewLoaded(false);
    setLoadKey((key) => key + 1);
  }, []);

  /* ----- Construir URL del reader ----- */
  const readerUrl = readerUrlRef.current ?? buildReaderUrl(sourceUri, format);

  /* ----- Renderizado ----- */
  return (
    <div style={styles.container}>
      {fileStatus === 'checking' && <LoadingState />}
      {fileStatus === 'not-found' && (
        <FileNotFoundState
          fileUri={sourceUri}
          onRelocate={handleRelocate}
          isRelocating={isRelocating}
        />
      )}
      {fileStatus === 'found' && (
        <>
          <webview
            key={loadKey}
            ref={webviewCallbackRef}
            src={readerUrl}
            style={styles.webview}
            partition="persist:reader"
          />
          {loadError ? (
            <LoadErrorState message={loadError} onRetry={handleRetryLoad} onClose={onClose} />
          ) : (
            !webviewLoaded && (
              <div
                style={styles.loadingOverlay}
                role="status"
                aria-busy="true"
                aria-label="Abriendo libro"
              >
                <div style={styles.spinner} aria-hidden="true" />
                <p style={styles.loadingText}>Abriendo libro…</p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   Subcomponentes
   ========================================================================== */

function LoadingState(): JSX.Element {
  return (
    <div style={styles.loadingOverlay}>
      <div style={styles.spinner} aria-hidden="true" />
      <p style={styles.loadingText}>Verificando archivo…</p>
    </div>
  );
}

interface FileNotFoundStateProps {
  readonly fileUri: string;
  readonly onRelocate: () => void;
  readonly isRelocating: boolean;
}

function FileNotFoundState({
  fileUri,
  onRelocate,
  isRelocating,
}: FileNotFoundStateProps): JSX.Element {
  return (
    <div style={styles.stateContainer}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6a657a"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <p style={styles.errorTitle}>Archivo no encontrado</p>
      <p style={styles.errorDetail}>El archivo no se encuentra en la ubicación original:</p>
      <p style={styles.errorPath}>{fileUri}</p>
      <p style={styles.errorHint}>Es posible que el archivo haya sido movido o eliminado.</p>
      <button
        style={styles.relocateButton}
        onClick={onRelocate}
        disabled={isRelocating}
        aria-label="Localizar archivo en otra ubicación"
      >
        {isRelocating ? 'Buscando…' : 'Localizar archivo'}
      </button>
    </div>
  );
}

interface LoadErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

function LoadErrorState({ message, onRetry, onClose }: LoadErrorStateProps): JSX.Element {
  return (
    <div style={styles.stateContainer} role="alert">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6a657a"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <p style={styles.errorTitle}>No se pudo abrir el libro</p>
      <p style={styles.errorDetail}>{message}</p>
      <div style={styles.errorActions}>
        <button style={styles.relocateButton} onClick={onRetry}>
          Reintentar
        </button>
        <button style={styles.secondaryButton} onClick={onClose}>
          Volver a la biblioteca
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Estilos
   ========================================================================== */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--ink-950)',
    fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
    position: 'relative',
  },
  webview: {
    flex: 1,
    border: 'none',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'var(--ink-950)',
    zIndex: 10,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--line)',
    borderTopColor: 'var(--gold)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 15,
    color: 'var(--tx-lo)',
    letterSpacing: '.01em',
  },
  stateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 24,
    textAlign: 'center',
    background: 'var(--ink-950)',
    color: 'var(--tx-lo)',
  },
  errorTitle: {
    fontFamily: '"Fraunces", serif',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--tx-hi)',
    margin: 0,
  },
  errorDetail: {
    fontSize: 14,
    color: 'var(--tx-lo)',
    margin: 0,
  },
  errorPath: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: 'var(--tx)',
    background: 'var(--ink-850)',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--line)',
    wordBreak: 'break-all',
    margin: 0,
  },
  errorHint: {
    fontSize: 13,
    color: 'var(--tx-faint)',
    margin: 0,
  },
  relocateButton: {
    padding: '10px 20px',
    background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
    color: 'var(--on-gold)',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: 'inherit',
  },
  errorActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--tx-hi)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: 'inherit',
  },
};
