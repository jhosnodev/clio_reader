import React, { useState } from 'react';

interface NotesExportDialogProps {
  readonly open: boolean;
  readonly bookTitle: string;
  readonly onExportMarkdown: () => void;
  readonly onImportMarkdown: () => void;
  readonly onClose: () => void;
}

export function NotesExportDialog({
  open,
  bookTitle,
  onExportMarkdown,
  onImportMarkdown,
  onClose,
}: NotesExportDialogProps): JSX.Element | null {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    try {
      setExporting(true);
      await onExportMarkdown();
    } finally {
      setExporting(false);
      onClose();
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      await onImportMarkdown();
    } finally {
      setImporting(false);
      onClose();
    }
  };

  return (
    <div style={backdropStyle}>
      <div style={dialogStyle} role="dialog" aria-modal="true">
        <h2 style={titleStyle}>Exportar / Importar anotaciones</h2>
        <p style={descStyle}>
          Exportar notas, resaltados y marcadores de <strong>{bookTitle}</strong> como archivo
          Markdown. Al reimportarlo, se restaurarán las anotaciones para este libro.
        </p>
        <div style={actionsStyle}>
          <button style={secondaryBtn} onClick={onClose} disabled={exporting || importing}>
            Cancelar
          </button>
          <button style={secondaryBtn} onClick={handleImport} disabled={importing || exporting}>
            {importing ? 'Importando...' : 'Importar MD'}
          </button>
          <button style={primaryBtn} onClick={handleExport} disabled={exporting || importing}>
            {exporting ? 'Exportando...' : 'Exportar MD'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--ink-900)',
  border: '1px solid var(--gold-dim)',
  borderRadius: 8,
  padding: 24,
  maxWidth: 520,
  width: '90%',
  color: 'var(--tx)',
  fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--gold)',
};

const descStyle: React.CSSProperties = {
  margin: '0 0 24px 0',
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--tx)',
  opacity: 0.9,
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'flex-end',
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--gold)',
  color: 'var(--ink-950)',
  border: '1px solid var(--gold)',
  padding: '8px 16px',
  borderRadius: 6,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  background: 'var(--ink-800)',
  color: 'var(--tx)',
  border: '1px solid var(--gold-dim)',
  padding: '8px 16px',
  borderRadius: 6,
  cursor: 'pointer',
};
