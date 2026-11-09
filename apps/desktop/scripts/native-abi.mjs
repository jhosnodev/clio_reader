import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveElectronVersion } from './win-native.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const abiMarker = 'node_register_module_v';

export function expectedElectronAbi() {
  const requireFromDesktop = createRequire(join(desktopDir, 'package.json'));
  const requireFromBuilder = createRequire(
    requireFromDesktop.resolve('electron-builder/package.json'),
  );
  const nodeAbi = requireFromBuilder(requireFromBuilder.resolve('node-abi'));
  return Number(nodeAbi.getAbi(resolveElectronVersion(), 'electron'));
}

export function readNodeModuleAbi(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath);
  const markerIndex = content.indexOf(Buffer.from(abiMarker, 'ascii'));
  if (markerIndex === -1) return null;
  const digitsStart = markerIndex + abiMarker.length;
  let digitsEnd = digitsStart;
  while (digitsEnd < content.length && content[digitsEnd] >= 0x30 && content[digitsEnd] <= 0x39) {
    digitsEnd += 1;
  }
  if (digitsEnd === digitsStart) return null;
  return Number(content.subarray(digitsStart, digitsEnd).toString('ascii'));
}
