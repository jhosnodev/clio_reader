import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import readerHtmlAsset from '../../assets/reader.html';
import {
  updateProgress,
  getBookPreferences,
  getGlobalPreferences,
  type LibraryRepository,
} from '@clio-reader/library';
import {
  createDefaultPreferences,
  normalizeRank,
  type Rank,
  type ReaderLocator,
  type ReaderPreferences,
} from '@clio-reader/domain';
import {
  getResumePositionOrder,
  getResumeScrollRatio,
  locatorToPercent,
  parseLocator,
} from '@clio-reader/reader-core';
import type { MobileBridge } from '../bridges/mobile-bridge';
import { interpretMessage } from '../reader/host-messages';

interface ReaderScreenProps {
  bookId: string;
  fileUri: string;
  format: string;
  title: string;
  author?: string | undefined;
  coverImage?: string | undefined;
  rank?: number | undefined;
  initialLocator?: string | undefined;
  bridge: MobileBridge;
  repository: LibraryRepository;
  onClose: () => void;
}

interface HostInitData {
  preferences: ReaderPreferences;
  fileDataB64: string;
  metadata: {
    bookId: string;
    title: string;
    author?: string | undefined;
    coverImage?: string | undefined;
    format: string;
    rank: number;
  };
  notes: readonly unknown[];
  highlights: readonly unknown[];
}

const PROGRESS_POLL_MS = 2000;
const PROGRESS_DEBOUNCE_MS = 800;

function buildHostParamsScript(fileUri: string, format: string): string {
  return `
    window.__clioHostParams = ${JSON.stringify({ uri: fileUri, format })};
    (function () {
      var orig = console.log;
      console.log = function () {
        try {
          var m = Array.prototype.map.call(arguments, function (a) { return String(a); }).join(' ');
          if (m.indexOf('__clio_') === 0 && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ __clio: true, message: m }));
          }
        } catch (e) {}
        return orig.apply(console, arguments);
      };
    })();
    true;
  `;
}

export function ReaderScreen({
  bookId,
  fileUri,
  format,
  title,
  author,
  coverImage,
  rank,
  initialLocator,
  bridge,
  repository,
  onClose,
}: ReaderScreenProps): JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const [readerUri, setReaderUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const closingRef = useRef(false);
  const lastLocatorRef = useRef<ReaderLocator | null>(null);
  const lastPercentRef = useRef<number>(0);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const asset = Asset.fromModule(readerHtmlAsset);
    asset
      .downloadAsync()
      .then(() => {
        if (cancelled) return;
        const localUri = asset.localUri ?? asset.uri;
        setReaderUri(localUri);
      })
      .catch(() => {
        if (!cancelled) setLoadError('No se pudo preparar el lector.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProgressNow = useCallback(async (): Promise<void> => {
    const locator = lastLocatorRef.current;
    if (!locator) return;
    try {
      await updateProgress(repository, {
        bookId,
        locator,
        percent: Math.round(locatorToPercent(locator) * 100),
      });
    } catch {
      /* progreso best-effort */
    }
  }, [bookId, repository]);

  const scheduleSaveProgress = useCallback((): void => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(() => {
      progressTimerRef.current = null;
      void saveProgressNow();
    }, PROGRESS_DEBOUNCE_MS);
  }, [saveProgressNow]);

  const requestLocator = useCallback((): void => {
    webViewRef.current?.injectJavaScript(
      "window.ReactNativeWebView.postMessage(JSON.stringify({ __clio: 'locator', value: (window.__getCurrentLocator && window.__getCurrentLocator()) || null })); true;",
    );
  }, []);

  const saveRank = useCallback(
    async (rank: Rank): Promise<void> => {
      try {
        const book = await repository.getBook(bookId);
        if (book) await repository.upsertBook({ ...book, rank });
      } catch (err) {
        console.warn('[mobile] error guardando rank:', err);
      }
    },
    [bookId, repository],
  );

  const savePreferences = useCallback(
    async (preferences: ReaderPreferences): Promise<void> => {
      try {
        await repository.saveGlobalPreferences(preferences);
      } catch (err) {
        console.warn('[mobile] error guardando preferencias:', err);
      }
    },
    [repository],
  );

  const handleClose = useCallback((): void => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    void saveProgressNow().finally(() => onClose());
  }, [onClose, saveProgressNow]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent): void => {
      let data: unknown;
      try {
        data = JSON.parse(event.nativeEvent.data) as unknown;
      } catch {
        return;
      }

      const message = interpretMessage(data);
      if (!message) return;

      switch (message.type) {
        case 'locator': {
          const locator = parseLocator(message.value ?? undefined);
          if (locator) {
            lastLocatorRef.current = locator;
            lastPercentRef.current = locatorToPercent(locator);
            scheduleSaveProgress();
          }
          break;
        }
        case 'close':
          handleClose();
          break;
        case 'rank':
          void saveRank(normalizeRank(message.rank));
          break;
        case 'preferences':
          void savePreferences(message.preferences);
          break;
      }
    },
    [handleClose, savePreferences, saveRank, scheduleSaveProgress],
  );

  const handleLoadEnd = useCallback(async (): Promise<void> => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const [globalPrefs, bookPrefs, fileDataB64, savedProgress] = await Promise.all([
        getGlobalPreferences(repository),
        getBookPreferences(repository, bookId),
        bridge.readFileBase64(fileUri),
        repository.getProgress(bookId),
      ]);

      const preferences: ReaderPreferences = {
        ...createDefaultPreferences(),
        ...globalPrefs,
        ...bookPrefs,
      };

      const initData: HostInitData = {
        preferences,
        fileDataB64,
        metadata: {
          bookId,
          title,
          author,
          coverImage: coverImage && coverImage.length < 500_000 ? coverImage : undefined,
          format,
          rank: rank ?? 0,
        },
        notes: [],
        highlights: [],
      };

      webViewRef.current?.injectJavaScript(
        `window.__initFromHost(${JSON.stringify(initData)}); true;`,
      );

      const noteLocator = parseLocator(initialLocator);
      const savedLocator = savedProgress?.locator;
      const resumeOrder = getResumePositionOrder(noteLocator ?? undefined, savedLocator);
      if (typeof resumeOrder === 'number') {
        const ratio = getResumeScrollRatio(noteLocator ?? savedLocator) ?? null;
        webViewRef.current?.injectJavaScript(
          `window.__goToChapter && window.__goToChapter(${resumeOrder}, ${JSON.stringify(ratio)}, ${JSON.stringify(initialLocator ?? null)}); true;`,
        );
      } else if (
        savedLocator &&
        (savedLocator.format === 'pdf' || savedLocator.format === 'cbz') &&
        typeof savedLocator.page === 'number'
      ) {
        webViewRef.current?.injectJavaScript(
          `window.__goToPage && window.__goToPage(${savedLocator.page}); true;`,
        );
      }
    } catch {
      setLoadError('No se pudo cargar el contenido del libro.');
    }
  }, [
    bookId,
    bridge,
    coverImage,
    fileUri,
    format,
    initialLocator,
    rank,
    repository,
    title,
    author,
  ]);

  useEffect(() => {
    if (!readerUri) return;
    const interval = setInterval(requestLocator, PROGRESS_POLL_MS);
    return () => clearInterval(interval);
  }, [readerUri, requestLocator]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  const sourceUri = readerUri
    ? `${readerUri}?uri=${encodeURIComponent(fileUri)}&format=${encodeURIComponent(format)}`
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <Text style={styles.backButtonText}>← Biblioteca</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.content}>
        {loadError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
              <Text style={styles.retryButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        ) : sourceUri ? (
          <WebView
            ref={webViewRef}
            source={{ uri: sourceUri }}
            originWhitelist={['*']}
            allowFileAccess
            allowFileAccessFromFileURLs
            javaScriptEnabled
            injectedJavaScriptBeforeContentLoaded={buildHostParamsScript(fileUri, format)}
            onLoadEnd={handleLoadEnd}
            onMessage={handleMessage}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.centered}>
                <ActivityIndicator color="#c9a24b" />
                <Text style={styles.loadingText}>Cargando libro…</Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color="#c9a24b" />
          </View>
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
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#16141f',
    borderBottomWidth: 1,
    borderBottomColor: '#332f47',
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 15,
    color: '#c9a24b',
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
    color: '#efe9dd',
    marginHorizontal: 8,
  },
  spacer: {
    width: 84,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#100f18',
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#100f18',
  },
  loadingText: {
    fontSize: 14,
    color: '#8b8598',
  },
  errorText: {
    fontSize: 15,
    color: '#e8b4b4',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#c9a24b',
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#100f18',
    fontWeight: '600',
  },
});
