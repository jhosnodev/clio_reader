import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedElectronAbi, readNodeModuleAbi } from './native-abi.mjs';
import { isWindowsBinary } from './win-native.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const cliArgs = process.argv.slice(2);
const expectIcon = cliArgs.includes('--expect-icon');
const positional = cliArgs.filter((a) => !a.startsWith('--'));
const outputDir = resolve(desktopDir, positional[0] ?? 'release');
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

if (expectIcon) {
  verifyEmbeddedIcon(unpackedDir);
}

console.log(
  `[verify-win] OK: ${nativeModules.length} módulos nativos Windows (ABI ${expectedAbi}), ` +
    'app.asar presente.',
);

function verifyEmbeddedIcon(dir) {
  const ymlPath = join(desktopDir, 'electron-builder.yml');
  let productName = 'Clio Reader';
  if (existsSync(ymlPath)) {
    const yml = readFileSync(ymlPath, 'utf8');
    const m = yml.match(/^productName:\s*(.+)$/m);
    if (m) productName = m[1].trim();
  }

  const mainExe = join(dir, `${productName}.exe`);
  if (!existsSync(mainExe)) {
    console.error(`[verify-win] No se encontró ${productName}.exe en win-unpacked.`);
    process.exit(1);
  }

  const icoPath = join(desktopDir, 'resources', 'icon.ico');
  if (!existsSync(icoPath)) {
    console.error('[verify-win] Falta resources/icon.ico.');
    process.exit(1);
  }

  const pngEntries = readIcoPngEntries(icoPath);
  if (pngEntries.length === 0) {
    console.error('[verify-win] icon.ico no contiene entradas PNG.');
    process.exit(1);
  }

  const exeBuf = readFileSync(mainExe);
  const found = pngEntries.some((entry) => exeBuf.includes(entry));
  if (!found) {
    console.error(`[verify-win] ${productName}.exe no contiene el icono de resources/icon.ico.`);
    console.error(
      '[verify-win] signAndEditExecutable puede estar desactivado o rcedit falló durante el build.',
    );
    process.exit(1);
  }

  console.log(
    `[verify-win] Icono verificado en ${productName}.exe ` +
      `(${pngEntries.length} entradas PNG en ico).`,
  );
}

function readIcoPngEntries(icoPath) {
  const buf = readFileSync(icoPath);
  if (buf.length < 6) return [];
  const count = buf.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    if (o + 16 > buf.length) break;
    const len = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    if (off + len > buf.length) continue;
    const data = buf.subarray(off, off + len);
    if (
      data.length > 8 &&
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    ) {
      entries.push(data);
    }
  }
  return entries;
}
