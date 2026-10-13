import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Book, Rank } from '@clio-reader/domain';
import { BookCard } from '../components/BookCard';

interface LibraryScreenProps {
  books: readonly Book[];
  progressByBook: Readonly<Record<string, number>>;
  importing: boolean;
  onOpenBook: (book: Book) => void;
  onImportBook: () => void;
  onRemoveBook: (book: Book) => void;
  onSaveRank: (book: Book, rank: Rank) => void;
}

export function LibraryScreen({
  books,
  progressByBook,
  importing,
  onOpenBook,
  onImportBook,
  onRemoveBook,
  onSaveRank,
}: LibraryScreenProps): JSX.Element {
  const confirmRemove = (book: Book): void => {
    Alert.alert('Eliminar libro', `¿Eliminar "${book.title}" de tu biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onRemoveBook(book) },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mi biblioteca</Text>
          <Text style={styles.sub}>Tu colección bajo la mirada de Clio</Text>
        </View>
        <TouchableOpacity
          style={[styles.importButton, importing && styles.importButtonDisabled]}
          onPress={onImportBook}
          disabled={importing}
        >
          <Text style={styles.importButtonText}>{importing ? 'Importando…' : 'Importar'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>No hay libros importados</Text>
            <Text style={styles.emptyHint}>
              Toca &quot;Importar&quot; para agregar tu primer libro.
            </Text>
          </View>
        ) : (
          <FlatList
            data={[...books]}
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
                rank={item.rank}
                coverImage={item.coverImage}
                progressPercent={progressByBook[item.id]}
                onPress={() => onOpenBook(item)}
                onLongPress={() => confirmRemove(item)}
                onSaveRank={(rank) => onSaveRank(item, rank)}
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
  importButtonDisabled: {
    opacity: 0.6,
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
    fontWeight: '600',
    color: '#cbc4ba',
  },
  emptyHint: {
    fontSize: 14,
    color: '#6a657a',
    textAlign: 'center',
  },
  bookList: {
    padding: 20,
  },
  row: {
    justifyContent: 'space-between',
  },
});
