import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedElectronAbi, readNodeModuleAbi } from './native-abi.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const outputDir = resolve(desktopDir, process.argv[2] ?? 'release');
const unpackedDir = join(outputDir, 'linux-unpacked');
const minimumPackageBytes = 40 * 1024 * 1024;
const arMagic = '!<arch>\n';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function readBytes(filePath, length) {
  const fd = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytes = readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytes);
  } finally {
    closeSync(fd);
  }
}

function isElfBinary(filePath) {
  if (!existsSync(filePath)) return false;
  const header = readBytes(filePath, 4);
  return (
    header.length === 4 &&
    header[0] === 0x7f &&
    header[1] === 0x45 &&
    header[2] === 0x4c &&
    header[3] === 0x46
  );
}

function isDebianPackage(filePath) {
  if (!existsSync(filePath)) return false;
  const header = readBytes(filePath, 512);
  if (header.length < 8 || header.subarray(0, 8).toString('ascii') !== arMagic) return false;
  return header.toString('latin1').includes('debian-binary');
}

function assertMinimumSize(filePath, label) {
  const size = statSync(filePath).size;
  if (size < minimumPackageBytes) {
    console.error(
      `[verify-linux] ${label} pesa ${(size / 1024 / 1024).toFixed(1)} MB: no contiene la app. ` +
        `Un paquete válido debe pesar al menos ${minimumPackageBytes / 1024 / 1024} MB.`,
    );
    process.exit(1);
  }
}

if (!existsSync(unpackedDir)) {
  console.error(`[verify-linux] No existe ${unpackedDir}. Ejecuta primero el build de Linux.`);
  process.exit(1);
}

const files = walk(unpackedDir);
const nativeModules = files.filter((file) => file.endsWith('.node'));

if (nativeModules.length === 0) {
  console.error('[verify-linux] No se encontraron módulos nativos en linux-unpacked.');
  process.exit(1);
}

const wrongPlatform = nativeModules.filter((file) => !isElfBinary(file));
if (wrongPlatform.length > 0) {
  console.error('[verify-linux] Módulos nativos que no son binarios ELF de Linux:');
  for (const file of wrongPlatform) console.error(`  - ${file}`);
  console.error(
    '[verify-linux] El build no contiene binarios nativos de Linux. Compila en Linux ' +
      'con "pnpm --filter @clio-reader/desktop build:linux".',
  );
  process.exit(1);
}

const asar = join(unpackedDir, 'resources', 'app.asar');
if (!existsSync(asar)) {
  console.error('[verify-linux] Falta resources/app.asar en linux-unpacked.');
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
    `[verify-linux] Módulos nativos compilados para otro ABI (se espera ${expectedAbi}):`,
  );
  for (const { file, abi } of wrongAbi) {
    console.error(`  - ${file} (NODE_MODULE_VERSION ${abi ?? 'desconocido'})`);
  }
  console.error(
    '[verify-linux] La app no arrancaría: el binario debe compilar para el ABI de Electron. ' +
      'Revisa el postinstall ("ensure-native.mjs").',
  );
  process.exit(1);
}

const entries = readdirSync(outputDir);
const appImages = entries.filter((entry) => entry.toLowerCase().endsWith('.appimage'));
const debs = entries.filter((entry) => entry.endsWith('.deb'));

if (appImages.length === 0) {
  console.error('[verify-linux] No se encontró ningún AppImage en el directorio de salida.');
  process.exit(1);
}

for (const entry of appImages) {
  const appImage = join(outputDir, entry);
  if (!isElfBinary(appImage)) {
    console.error(`[verify-linux] ${entry} no es un binario ELF válido.`);
    process.exit(1);
  }
  assertMinimumSize(appImage, entry);
}

if (debs.length === 0) {
  console.error('[verify-linux] No se encontró ningún paquete .deb en el directorio de salida.');
  process.exit(1);
}

for (const entry of debs) {
  const deb = join(outputDir, entry);
  if (!isDebianPackage(deb)) {
    console.error(`[verify-linux] ${entry} no es un paquete Debian válido.`);
    process.exit(1);
  }
  assertMinimumSize(deb, entry);
}

console.log(
  `[verify-linux] OK: ${nativeModules.length} módulos nativos ELF (ABI ${expectedAbi}), ` +
    `app.asar, ${appImages.length} AppImage y ${debs.length} deb válidos.`,
);
