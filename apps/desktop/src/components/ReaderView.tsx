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
import type { ReaderPreferences } from '@clio-reader/domain';
import { createDefaultPreferences } from '@clio-reader/domain';

/* ==========================================================================
   Props
   ========================================================================== */

interface ReaderViewProps {
  readonly bookId: string;
  readonly fileUri: string;
  readonly format: string;
  readonly repository: LibraryRepository;
  readonly onClose: () => void;
}

/* ==========================================================================
   Estados internos
   ========================================================================== */

type FileStatus = 'checking' | 'found' | 'not-found';

/* ==========================================================================
   Debounce para guardado de progreso
   ========================================================================== */

const PROGRESS_DEBOUNCE_MS = 800;

/* ==========================================================================
   Componente
   ========================================================================== */

export function ReaderView({
  bookId,
  fileUri,
  format,
  repository,
  onClose,
}: ReaderViewProps): JSX.Element {
  const [fileStatus, setFileStatus] = useState<FileStatus>('checking');
  const [isRelocating, setIsRelocating] = useState(false);
  const [webviewLoaded, setWebviewLoaded] = useState(false);
  const webviewRef = useRef<HTMLElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----- Handler estable para did-finish-load ----- */
  const handleFinishLoadRef = useRef<(() => Promise<void>) | null>(null);

  /* ----- Verificar existencia del archivo ----- */
  const checkFile = useCallback(async () => {
    setFileStatus('checking');
    try {
      const exists = await bridge.checkFileExists(fileUri);
      setFileStatus(exists ? 'found' : 'not-found');
    } catch {
      setFileStatus('not-found');
    }
  }, [fileUri]);

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

  /* ----- Guardar progreso con debounce ----- */
  const saveProgress = useCallback(
    (locator: unknown, percent: number) => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }

      progressTimerRef.current = setTimeout(async () => {
        try {
          const { createReadingProgress } = await import('@clio-reader/domain');
          const progress = createReadingProgress({
            bookId,
            locator: locator as import('@clio-reader/domain').ReaderLocator,
            percent,
          });
          await repository.saveProgress(progress);
        } catch (err) {
          console.error('Error al guardar progreso:', err);
        }
      }, PROGRESS_DEBOUNCE_MS);
    },
    [repository, bookId],
  );

  /* ----- Guardar progreso al cerrar (flush) ----- */
  const flushProgress = useCallback(async () => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  /* ----- Actualizar el handler del webview cuando cambian las dependencias ----- */
  useEffect(() => {
    handleFinishLoadRef.current = async (): Promise<void> => {
      try {
        const [preferences, fileData] = await Promise.all([
          loadPreferences(),
          bridge.readFile(fileUri),
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

        const initData = { preferences, fileDataB64: b64 };
        const initCode = `window.__initFromHost(${JSON.stringify(initData)})`;

        await (webviewRef.current as unknown as { executeJavaScript: (code: string) => Promise<unknown> })?.executeJavaScript(initCode);
        setWebviewLoaded(true);
      } catch (err) {
        console.error('[reader] error inyectando datos en webview:', err);
        setWebviewLoaded(true);
      }
    };
  }, [loadPreferences, fileUri]);

  /* ----- Cleanup del listener en unmount ----- */
  useEffect(() => {
    return () => {
      const webview = webviewRef.current as (HTMLElement & { removeEventListener: (event: string, handler: () => void) => void }) | null;
      if (webview && handleFinishLoadRef.current) {
        webview.removeEventListener('did-finish-load', handleFinishLoadRef.current);
      }
    };
  }, []);

  /* ----- Callback ref: adjunta el listener inmediatamente al crear el elemento ----- */
  const webviewCallbackRef = useCallback((el: HTMLElement | null) => {
    const prevEl = webviewRef.current;

    if (prevEl && handleFinishLoadRef.current) {
      (prevEl as HTMLElement & { removeEventListener: (event: string, handler: () => void) => void })
        .removeEventListener('did-finish-load', handleFinishLoadRef.current);
    }

    webviewRef.current = el;

    if (el) {
      setWebviewLoaded(false);
      (el as HTMLElement & { addEventListener: (event: string, handler: () => void) => void })
        .addEventListener('did-finish-load', handleFinishLoadRef.current!);
    }
  }, []);

  /* ----- Interceptar navegación a "/" del webview (back button) ----- */
  useEffect(() => {
    const webview = webviewRef.current as (HTMLElement & { addEventListener: (event: string, handler: (...args: unknown[]) => void) => void; removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void }) | null;
    if (!webview) return;

    const handleNavigate = (...args: unknown[]): void => {
      const event = args[0] as { href?: string } | undefined;
      if (event?.href === '/' || event?.href === '') {
        onClose();
      }
    };

    webview.addEventListener('did-navigate', handleNavigate);
    return () => {
      webview.removeEventListener('did-navigate', handleNavigate);
    };
  }, [onClose]);

  /* ----- Guardar progreso al cerrar la ventana ----- */
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /* ----- Relocalizar archivo ----- */
  const handleRelocate = useCallback(async () => {
    setIsRelocating(true);
    try {
      const fileSource = await bridge.pickFile();
      if (fileSource) {
        window.location.href = `/reader.html?uri=${encodeURIComponent(fileSource.uri)}&format=${encodeURIComponent(format)}`;
      }
    } finally {
      setIsRelocating(false);
    }
  }, [format]);

  /* ----- Construir URL del reader ----- */
  const readerUrl = `/reader.html?uri=${encodeURIComponent(fileUri)}&format=${encodeURIComponent(format)}&_v=${Date.now()}`;

  /* ----- Renderizado ----- */
  return (
    <div style={styles.container}>
      {fileStatus === 'checking' && <LoadingState />}
      {fileStatus === 'not-found' && (
        <FileNotFoundState
          fileUri={fileUri}
          onRelocate={handleRelocate}
          isRelocating={isRelocating}
        />
      )}
      {fileStatus === 'found' && (
        <>
          <webview
            ref={webviewCallbackRef}
            src={readerUrl}
            style={styles.webview}
            partition="persist:reader"
          />
          {!webviewLoaded && (
            <div style={styles.loadingOverlay} role="status" aria-busy="true" aria-label="Abriendo libro">
              <div style={styles.spinner} aria-hidden="true" />
              <p style={styles.loadingText}>Abriendo libro…</p>
            </div>
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
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6a657a" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
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
};
