import { useRef, useEffect } from 'react';

interface ReaderViewProps {
  fileUri: string;
  format: string;
  onClose: () => void;
}

export function ReaderView({ fileUri, format, onClose }: ReaderViewProps): JSX.Element {
  const webviewRef = useRef<HTMLElement>(null);

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

  const readerUrl = `/reader.html?uri=${encodeURIComponent(fileUri)}&format=${encodeURIComponent(format)}`;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={onClose}>
          ← Back
        </button>
        <span style={styles.title}>Reading</span>
        <div style={styles.spacer} />
      </header>
      <main style={styles.content}>
        <webview
          ref={webviewRef}
          src={readerUrl}
          style={styles.webview}
          partition="persist:reader"
        />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
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
};
