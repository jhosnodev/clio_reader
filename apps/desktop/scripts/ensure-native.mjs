import { existsSync } from 'node:fs';
import { expectedElectronAbi, readNodeModuleAbi } from './native-abi.mjs';
import { fetchElectronPrebuild, findBetterSqlite3Dirs, nativeBinaryPath } from './win-native.mjs';

const packageDirs = findBetterSqlite3Dirs();
if (packageDirs.length === 0) {
  console.error('[ensure-native] No se encontró better-sqlite3 en el workspace');
  process.exit(1);
}

const expectedAbi = expectedElectronAbi();

for (const packageDir of packageDirs) {
  fetchElectronPrebuild(packageDir, { platform: process.platform, arch: process.arch });

  const binary = nativeBinaryPath(packageDir);
  if (!existsSync(binary)) {
    console.error(`[ensure-native] No se generó el binario en ${binary}`);
    process.exit(1);
  }

  const abi = readNodeModuleAbi(binary);
  if (abi !== expectedAbi) {
    console.error(
      `[ensure-native] ${binary} tiene ABI ${abi ?? 'desconocido'} y se esperaba ${expectedAbi}.`,
    );
    process.exit(1);
  }
}

console.log(
  `[ensure-native] OK: better-sqlite3 compilado para Electron (ABI ${expectedAbi}) en ${packageDirs.length} directorio(s).`,
);
