import * as DocumentPicker from 'expo-document-picker';
import type { FileSource } from '@clio-reader/reader-core';
import { base64ToBytes } from '../util/base64';

export interface MobileBridge {
  readonly platform: 'mobile';
  pickFile(): Promise<FileSource | null>;
  readFile(uri: string): Promise<Uint8Array>;
  readFileBase64(uri: string): Promise<string>;
  copyToStorage(uri: string, fileName: string): Promise<string>;
  checkFileExists(uri: string): Promise<boolean>;
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
      return base64ToBytes(base64);
    },

    async readFileBase64(uri: string): Promise<string> {
      const { readAsStringAsync, EncodingType } = await import('expo-file-system');
      return readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
    },

    async copyToStorage(uri: string, fileName: string): Promise<string> {
      const FileSystem = await import('expo-file-system');
      const dir = `${FileSystem.documentDirectory}clio-reader/books/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const target = `${dir}${Date.now()}-${safeName}`;
      await FileSystem.copyAsync({ from: uri, to: target });
      return target;
    },

    async checkFileExists(uri: string): Promise<boolean> {
      const FileSystem = await import('expo-file-system');
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
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
