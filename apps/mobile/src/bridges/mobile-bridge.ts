import * as DocumentPicker from 'expo-document-picker';
import type { FileSource } from '@clio-reader/reader-core';

export interface MobileBridge {
  readonly platform: 'mobile';
  pickFile(): Promise<FileSource | null>;
  readFile(uri: string): Promise<Uint8Array>;
  getStoragePath(): string;
  onSuspend(callback: () => void): void;
  onResume(callback: () => void): void;
}

export function createMobileBridge(): MobileBridge {
  return {
    platform: 'mobile',

    async pickFile(): Promise<FileSource | null> {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/pdf', 'application/x-cbz', 'text/markdown'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0]!;
      const source: FileSource = {
        uri: asset.uri,
        name: asset.name,
      };
      if (asset.mimeType) {
        return { ...source, mimeType: asset.mimeType };
      }
      return source;
    },

    async readFile(uri: string): Promise<Uint8Array> {
      const { readAsStringAsync, EncodingType } = await import('expo-file-system');
      const base64 = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    },

    getStoragePath(): string {
      return 'expo-storage';
    },

    onSuspend(_callback: () => void): void {
      // React Native AppState handles this
    },

    onResume(_callback: () => void): void {
      // React Native AppState handles this
    },
  };
}
