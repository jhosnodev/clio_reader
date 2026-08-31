import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

interface ReaderScreenProps {
  fileUri: string;
  format: string;
  onClose: () => void;
}

export function ReaderScreen({ fileUri, format, onClose }: ReaderScreenProps): JSX.Element {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: WebViewMessageEvent): void => {
    const data = JSON.parse(event.nativeEvent.data) as { type?: string };
    if (data?.type === 'close') {
      onClose();
    }
  };

  const readerUrl = `https://example.com/reader?uri=${encodeURIComponent(fileUri)}&format=${encodeURIComponent(format)}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reading</Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.content}>
        <WebView
          ref={webViewRef}
          source={{ uri: readerUrl }}
          style={styles.webview}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563eb',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  spacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
