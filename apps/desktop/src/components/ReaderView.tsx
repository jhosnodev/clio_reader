/**
 * ReaderView.tsx — Vista del lector de libros
 *
 * Principios aplicados:
 * - SRP: Solo gestiona el webview y la verificación de archivos
 * - DIP: Recibe datos via props, no conoce el repository
 * - Fallback: Verifica existencia del archivo antes de cargar
 * - UI en español
 * - Accesibilidad
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { bridge } from '../bridges/bridge-singleton';

/* ==========================================================================
   Props
   ========================================================================== */

interface ReaderViewProps {
  readonly fileUri: string;
  readonly format: string;
  readonly onClose: () => void;
}

/* ==========================================================================
   Estados internos (SRP: cada estado representa algo específico)
   ========================================================================== */

type FileStatus = 'checking' | 'found' | 'not-found';

/* ==========================================================================
   Componente
   ========================================================================== */

export function ReaderView({
  fileUri,
  format,
  onClose,
}: ReaderViewProps): JSX.Element {
  const [fileStatus, setFileStatus] = useState<FileStatus>('checking');
  const [isRelocating, setIsRelocating] = useState(false);
  const webviewRef = useRef<HTMLElement>(null);

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

  /* ----- Comunicación con el webview ----- */
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string };
      if (data?.type === 'close') {
        onClose();
      }
    };

    const handler = handleMessage as EventListener;
    webview.addEventListener('message', handler);
    return () => {
      webview.removeEventListener('message', handler);
    };
  }, [onClose]);

  /* ----- Relocalizar archivo ----- */
  const handleRelocate = useCallback(async () => {
    setIsRelocating(true);
    try {
      const fileSource = await bridge.pickFile();
      if (fileSource) {
        // Nota: en una implementación completa, aquí se actualizaría
        // la URI del libro en el repository. Por ahora, recargamos
        // con la nueva URI.
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
   Subcomponentes (SRP: cada uno una responsabilidad)
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
