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
  const webviewRef = useRef<HTMLElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----- Handler estable para did-finish-load (ref para evitar stale closures) ----- */
  const handleFinishLoadRef = useRef<(() => Promise<void>) | null>(null);

  /* ----- Verificar existencia del archivo ----- */
  const checkFile = useCallback(async () => {
    setFileStatus('checking');
    console.log('[reader] verificando archivo:', fileUri);
    try {
      const exists = await bridge.checkFileExists(fileUri);
      console.log('[reader] archivo', exists ? 'encontrado' : 'no encontrado');
      setFileStatus(exists ? 'found' : 'not-found');
    } catch (err) {
      console.error('[reader] error verificando archivo:', err);
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
      console.log('[reader] did-finish-load disparado, inyectando datos...');
      try {
        const [preferences, fileData] = await Promise.all([
          loadPreferences(),
          bridge.readFile(fileUri),
        ]);

        console.log('[reader] datos cargados:', {
          archivoTamanio: fileData.byteLength,
          esUint8Array: fileData instanceof Uint8Array,
          preferenciasTema: preferences.theme,
        });

        if (!fileData || fileData.byteLength === 0) {
          console.error('[reader] ERROR: archivo leído está vacío o es inválido');
          return;
        }

        const fileArray = Array.from(fileData);
        console.log('[reader] array serializado, longitud:', fileArray.length);

        const initData = { preferences, fileData: fileArray };
        const initCode = `window.__initFromHost(${JSON.stringify(initData)})`;
        console.log('[reader] ejecutando __initFromHost, tamaño del código:', initCode.length);

        await (webviewRef.current as unknown as { executeJavaScript: (code: string) => Promise<unknown> })?.executeJavaScript(initCode);
        console.log('[reader] datos inyectados en webview exitosamente');
      } catch (err) {
        console.error('[reader] ERROR inyectando datos en webview:', err);
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

    // Limpiar listener del elemento anterior si existe
    if (prevEl && handleFinishLoadRef.current) {
      (prevEl as HTMLElement & { removeEventListener: (event: string, handler: () => void) => void })
        .removeEventListener('did-finish-load', handleFinishLoadRef.current);
    }

    webviewRef.current = el;

    if (el) {
      console.log('[reader] webview elemento creado, adjuntando listener did-finish-load');
      (el as HTMLElement & { addEventListener: (event: string, handler: () => void) => void })
        .addEventListener('did-finish-load', handleFinishLoadRef.current!);
    }
  }, []);

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
        <button style={styles.backButton} onClick={onClose} aria-label="Volver a la biblioteca">
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
            ref={webviewCallbackRef}
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
      <p style={styles.errorDetail}>El archivo no se encuentra en la ubicación original:</p>
      <p style={styles.errorPath}>{fileUri}</p>
      <p style={styles.errorHint}>Es posible que el archivo haya sido movido o eliminado.</p>
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
