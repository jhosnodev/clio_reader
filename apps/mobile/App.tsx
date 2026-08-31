import React, { useState, useCallback } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { useAppLifecycle } from './src/bridges/lifecycle';
import { createMobileBridge } from './src/bridges/mobile-bridge';

interface OpenBook {
  uri: string;
  name: string;
  format: string;
}

const bridge = createMobileBridge();

export default function App(): JSX.Element {
  const [openBook, setOpenBook] = useState<OpenBook | null>(null);

  useAppLifecycle(
    () => {
      console.log('App suspending...');
    },
    () => {
      console.log('App resuming...');
    },
  );

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
      <SafeAreaView style={styles.container}>
        <ReaderScreen
          fileUri={openBook.uri}
          format={openBook.format}
          onClose={handleCloseBook}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LibraryScreen bridge={bridge} onOpenBook={handleOpenBook} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});
