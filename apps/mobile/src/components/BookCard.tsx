import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface BookCardProps {
  title: string;
  format: string;
  onPress: () => void;
}

export function BookCard({ title, format, onPress }: BookCardProps): JSX.Element {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cover}>
        <Text style={styles.formatBadge}>{format.toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '47%',
    marginBottom: 16,
  },
  cover: {
    height: 160,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
});
