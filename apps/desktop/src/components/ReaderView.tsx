/**
 * ReaderView.tsx — Vista del lector de libros
 *
 * Principios aplicados:
 * - SRP: Gestiona webview, verificación de archivos, progreso y preferencias
 * - DIP: Recibe repository via props, no lo crea
 * - Fallback: Verifica existencia del archivo antes de cargar
 * - UI en español
 * - Accesibilidad
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { bridge } from '../bridges/bridge-singleton';
import type { LibraryRepository } from '@echo-reader/library';
import type { ReaderPreferences } from '@echo-reader/domain';
import { createDefaultPreferences } from '@echo-reader/domain';

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
  const webviewRef = useRef<HTMLElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadProgress = useCallback(async () => {
    try {
      return await repository.getProgress(bookId);
    } catch {
      return undefined;
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
          const { createReadingProgress } = await import('@echo-reader/domain');
          const progress = createReadingProgress({
            bookId,
            locator: locator as import('@echo-reader/domain').ReaderLocator,
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

  /* ----- Enviar preferencias al webview cuando esté listo ----- */
  useEffect(() => {
    const webview = webviewRef.current as (HTMLElement & { postMessage: (msg: unknown, origin: string) => void }) | null;
    if (!webview) return;

    const handleMessage = async (event: MessageEvent): Promise<void> => {
      const data = event.data as { type?: string; locator?: unknown; percent?: number };

      switch (data.type) {
        case 'ready': {
          const preferences = await loadPreferences();
          const progress = await loadProgress();
          webview.postMessage(
            {
              type: 'init',
              preferences,
              savedLocator: progress?.locator ?? null,
            },
            '*',
          );
          break;
        }
        case 'progress':
          if (data.locator !== undefined) {
            saveProgress(data.locator, data.percent ?? 0);
          }
          break;
        case 'close':
          await flushProgress();
          onClose();
          break;
      }
    };

    webview.addEventListener('message', handleMessage as unknown as EventListener);
    return () => {
      webview.removeEventListener('message', handleMessage as unknown as EventListener);
    };
  }, [onClose, loadPreferences, loadProgress, saveProgress, flushProgress]);

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
  const readerUrl = `/reader.html?uri=${encodeURIComponent(fileUri)}&format=${encodeURIComponent(format)}`;

  /* ----- Renderizado ----- */
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          style={styles.backButton}
          onClick={onClose}
          aria-label="Volver a la biblioteca"
        >
          ← Volver
        </button>
        <span style={styles.title}>Leyendo</span>
        <div style={styles.spacer} />
      </header>

      <main style={styles.content}>
        {fileStatus === 'checking' && <LoadingState />}
        {fileStatus === 'not-found' && (
          <FileNotFoundState
            fileUri={fileUri}
            onRelocate={handleRelocate}
            isRelocating={isRelocating}
          />
        )}
        {fileStatus === 'found' && (
          <webview
            ref={webviewRef}
            src={readerUrl}
            style={styles.webview}
            partition="persist:reader"
          />
        )}
      </main>
    </div>
  );
}

/* ==========================================================================
   Subcomponentes
   ========================================================================== */

function LoadingState(): JSX.Element {
  return (
    <div style={styles.stateContainer}>
      <div style={styles.spinner} aria-hidden="true" />
      <p style={styles.stateText}>Verificando archivo...</p>
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
      <p style={styles.errorTitle}>Archivo no encontrado</p>
      <p style={styles.errorDetail}>
        El archivo no se encuentra en la ubicación original:
      </p>
      <p style={styles.errorPath}>{fileUri}</p>
      <p style={styles.errorHint}>
        Es posible que el archivo haya sido movido o eliminado.
      </p>
      <button
        style={styles.relocateButton}
        onClick={onRelocate}
        disabled={isRelocating}
        aria-label="Localizar archivo en otra ubicación"
      >
        {isRelocating ? 'Buscando...' : 'Localizar archivo'}
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  },
  spacer: {
    width: '60px',
  },
  content: {
    flex: 1,
    display: 'flex',
  },
  webview: {
    flex: 1,
    border: 'none',
  },
  stateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    padding: '24px',
    textAlign: 'center',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  stateText: {
    fontSize: '16px',
    color: '#6b7280',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
  },
  errorDetail: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  errorPath: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#374151',
    backgroundColor: '#f3f4f6',
    padding: '8px 12px',
    borderRadius: '4px',
    wordBreak: 'break-all',
    margin: 0,
  },
  errorHint: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: 0,
  },
  relocateButton: {
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '8px',
  },
};
