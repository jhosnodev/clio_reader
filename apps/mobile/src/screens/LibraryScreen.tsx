import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BookCard } from '../components/BookCard';
import type { MobileBridge } from '../bridges/mobile-bridge';

interface Book {
  id: string;
  title: string;
  format: string;
  uri: string;
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
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Echo Reader</Text>
        <TouchableOpacity style={styles.importButton} onPress={handleImportBook}>
          <Text style={styles.importButtonText}>Import</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No books imported yet.</Text>
            <Text style={styles.emptyHint}>Tap "Import" to add your first book.</Text>
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
                format={item.format}
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
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
  },
  importButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    borderRadius: 6,
  },
  importButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#9ca3af',
  },
  bookList: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
});
