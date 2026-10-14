import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

export async function resolveReaderHtmlUri(assetModule: number): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const localUri = asset.localUri ?? asset.uri;

  if (localUri.toLowerCase().endsWith('.html')) return localUri;

  const dir = `${FileSystem.documentDirectory}clio-reader/`;
  const target = `${dir}reader.html`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  await FileSystem.copyAsync({ from: localUri, to: target });
  return target;
}
