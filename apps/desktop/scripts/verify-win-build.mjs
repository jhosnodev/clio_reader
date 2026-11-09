import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedElectronAbi, readNodeModuleAbi } from './native-abi.mjs';
import { isWindowsBinary } from './win-native.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const outputDir = resolve(desktopDir, process.argv[2] ?? 'release');
const unpackedDir = join(outputDir, 'win-unpacked');
const minimumInstallerBytes = 20 * 1024 * 1024;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

if (!existsSync(unpackedDir)) {
  console.error(`[verify-win] No existe ${unpackedDir}. Ejecuta primero el build de Windows.`);
  process.exit(1);
}

const files = walk(unpackedDir);
const nativeModules = files.filter((file) => file.endsWith('.node'));

if (nativeModules.length === 0) {
  console.error('[verify-win] No se encontraron módulos nativos en win-unpacked.');
  process.exit(1);
}

const wrongPlatform = nativeModules.filter((file) => !isWindowsBinary(file));
if (wrongPlatform.length > 0) {
  console.error('[verify-win] Módulos nativos que no son binarios de Windows:');
  for (const file of wrongPlatform) console.error(`  - ${file}`);
  console.error(
    '[verify-win] El build se generó en otra plataforma. Compila en Windows o usa ' +
      '"pnpm --filter @clio-reader/desktop build:win" en Linux (descarga binarios win32).',
  );
  process.exit(1);
}

const asar = join(unpackedDir, 'resources', 'app.asar');
if (!existsSync(asar)) {
  console.error('[verify-win] Falta resources/app.asar en win-unpacked.');
  process.exit(1);
}

const expectedAbi = expectedElectronAbi();
const wrongAbi = [];
for (const file of nativeModules) {
  const abi = readNodeModuleAbi(file);
  if (abi !== expectedAbi) wrongAbi.push({ file, abi });
}

if (wrongAbi.length > 0) {
  console.error(
    `[verify-win] Módulos nativos compilados para otro ABI (se espera ${expectedAbi}):`,
  );
  for (const { file, abi } of wrongAbi) {
    console.error(`  - ${file} (NODE_MODULE_VERSION ${abi ?? 'desconocido'})`);
  }
  console.error(
    '[verify-win] La app no arrancaría en Windows: el binario debe compilar para el ABI ' +
      'de Electron. Revisa "prepareWindowsNative" y que "npmRebuild" esté desactivado.',
  );
  process.exit(1);
}

const strayBackups = files.filter((file) => file.endsWith('.host-backup'));
if (strayBackups.length > 0) {
  console.error('[verify-win] Respaldos de binarios del host empaquetados en la app:');
  for (const file of strayBackups) console.error(`  - ${file}`);
  process.exit(1);
}

for (const entry of readdirSync(outputDir)) {
  if (!/setup|portable/i.test(entry) || !entry.toLowerCase().endsWith('.exe')) continue;
  const installer = join(outputDir, entry);
  const size = statSync(installer).size;
  if (size < minimumInstallerBytes) {
    console.error(
      `[verify-win] ${entry} pesa ${(size / 1024 / 1024).toFixed(1)} MB: no contiene la app. ` +
        'Un instalador NSIS válido debe incluir el payload (decenas de MB).',
    );
    process.exit(1);
  }
}

console.log(
  `[verify-win] OK: ${nativeModules.length} módulos nativos Windows (ABI ${expectedAbi}), ` +
    'app.asar presente.',
);
