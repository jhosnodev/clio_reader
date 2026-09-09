import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BookCard } from '../components/BookCard';
import type { MobileBridge } from '../bridges/mobile-bridge';

type ReadingStatus = 'unread' | 'opened' | 'reading';

interface Book {
  id: string;
  title: string;
  author?: string;
  format: string;
  uri: string;
  addedAt?: number;
  lastOpenedAt?: number;
  readingStatus?: ReadingStatus;
}

interface LibraryScreenProps {
  bridge: MobileBridge;
  onOpenBook: (book: Book) => void;
}

export function LibraryScreen({ bridge, onOpenBook }: LibraryScreenProps): JSX.Element {
  const [books, setBooks] = useState<Book[]>([]);

  const handleImportBook = async (): Promise<void> => {
    try {
      const fileSource = await bridge.pickFile();
      if (fileSource) {
        const ext = fileSource.name.split('.').pop()?.toLowerCase() ?? '';
        const newBook: Book = {
          id: `book-${Date.now()}`,
          title: fileSource.name,
          format: ext,
          uri: fileSource.uri,
          addedAt: Date.now(),
          readingStatus: 'unread',
        };
        setBooks((prev: Book[]) => [...prev, newBook]);
        onOpenBook(newBook);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to import book');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mi biblioteca</Text>
          <Text style={styles.sub}>Tu colección bajo la mirada de Clio</Text>
        </View>
        <TouchableOpacity style={styles.importButton} onPress={handleImportBook}>
          <Text style={styles.importButtonText}>Importar</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>No hay libros importados</Text>
            <Text style={styles.emptyHint}>Toca &quot;Importar&quot; para agregar tu primer libro.</Text>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.bookList}
            renderItem={({ item }) => (
              <BookCard
                title={item.title}
                author={item.author}
                format={item.format}
                addedAt={item.addedAt}
                lastOpenedAt={item.lastOpenedAt}
                readingStatus={item.readingStatus}
                onPress={() => onOpenBook(item)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100f18',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#16141f',
    borderBottomWidth: 1,
    borderBottomColor: '#332f47',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#efe9dd',
    fontFamily: 'System',
  },
  sub: {
    fontSize: 13,
    color: '#8b8598',
    marginTop: 2,
  },
  importButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#c9a24b',
    borderRadius: 10,
  },
  importButtonText: {
    color: '#100f18',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#cbc4ba',
  },
  emptyHint: {
    fontSize: 14,
    color: '#6a657a',
  },
  bookList: {
    padding: 20,
  },
  row: {
    justifyContent: 'space-between',
  },
});
