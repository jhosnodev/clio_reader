import { useState, useCallback } from 'react';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { useAppLifecycle } from './bridges/lifecycle';
import { createDesktopBridge } from './bridges/desktop-bridge';

interface OpenBook {
  uri: string;
  name: string;
  format: string;
}

const bridge = createDesktopBridge();

export function App(): JSX.Element {
  const [openBook, setOpenBook] = useState<OpenBook | null>(null);

  useAppLifecycle(
    () => {
      console.log('App suspending...');
    },
    () => {
      console.log('App resuming...');
    },
  );

  const handleImportBook = useCallback(async () => {
    const fileSource = await bridge.pickFile();
    if (fileSource) {
      const ext = fileSource.name.split('.').pop()?.toLowerCase() ?? '';
      setOpenBook({
        uri: fileSource.uri,
        name: fileSource.name,
        format: ext,
      });
    }
  }, []);

  const handleOpenBook = useCallback(
    (book: { id: string; title: string; format: string; uri: string }) => {
      setOpenBook({
        uri: book.uri,
        name: book.title,
        format: book.format,
      });
    },
    [],
  );

  const handleCloseBook = useCallback(() => {
    setOpenBook(null);
  }, []);

  if (openBook) {
    return (
      <ReaderView fileUri={openBook.uri} format={openBook.format} onClose={handleCloseBook} />
    );
  }

  return <LibraryView onOpenBook={handleOpenBook} onImportBook={handleImportBook} />;
}
