import { execFileSync } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const repoRoot = resolve(desktopDir, '../..');

function workspacePackageDirs() {
  const dirs = [desktopDir];
  for (const group of ['apps', 'packages']) {
    const groupDir = join(repoRoot, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir)) {
      const dir = join(groupDir, entry);
      if (statSync(dir).isDirectory()) dirs.push(dir);
    }
  }
  return dirs;
}

export function findBetterSqlite3Dirs() {
  const found = new Set();
  for (const baseDir of workspacePackageDirs()) {
    try {
      const requireFromBase = createRequire(join(baseDir, 'package.json'));
      const packageJsonPath = requireFromBase.resolve('better-sqlite3/package.json');
      found.add(realpathSync(dirname(packageJsonPath)));
    } catch {
      // El paquete no depende de better-sqlite3.
    }
  }
  return [...found];
}

export function resolveElectronVersion() {
  const requireFromDesktop = createRequire(join(desktopDir, 'package.json'));
  return JSON.parse(readFileSync(requireFromDesktop.resolve('electron/package.json'), 'utf8'))
    .version;
}

export function isWindowsBinary(filePath) {
  if (!existsSync(filePath)) return false;
  const fd = openSync(filePath, 'r');
  try {
    const signature = Buffer.alloc(2);
    const bytes = readSync(fd, signature, 0, 2, 0);
    return bytes === 2 && signature[0] === 0x4d && signature[1] === 0x5a;
  } finally {
    closeSync(fd);
  }
}

export function nativeBinaryPath(packageDir) {
  return join(packageDir, 'build', 'Release', 'better_sqlite3.node');
}

function fetchWindowsPrebuild(packageDir, electronVersion, arch) {
  const requireFromPackage = createRequire(join(packageDir, 'package.json'));
  const prebuildBin = requireFromPackage.resolve('prebuild-install/bin.js');

  console.log(
    `[win-native] Descargando better-sqlite3 win32-${arch} para Electron ${electronVersion}`,
  );
  execFileSync(
    process.execPath,
    [
      prebuildBin,
      '--runtime',
      'electron',
      '--target',
      electronVersion,
      '--platform',
      'win32',
      '--arch',
      arch,
      '--tag-prefix',
      'v',
    ],
    { cwd: packageDir, stdio: 'inherit' },
  );
}

/**
 * Reemplaza temporalmente el binario nativo de better-sqlite3 por el de Windows
 * y devuelve los respaldos para poder restaurar el binario del host al terminar.
 */
export function prepareWindowsNative({ arch = 'x64' } = {}) {
  const packageDirs = findBetterSqlite3Dirs();
  if (packageDirs.length === 0) {
    throw new Error('No se encontró better-sqlite3 en el workspace');
  }

  const electronVersion = resolveElectronVersion();
  const backups = [];

  for (const packageDir of packageDirs) {
    const binary = nativeBinaryPath(packageDir);
    if (existsSync(binary)) {
      const backup = `${binary}.host-backup`;
      copyFileSync(binary, backup);
      backups.push({ binary, backup });
    }

    fetchWindowsPrebuild(packageDir, electronVersion, arch);

    if (!isWindowsBinary(binary)) {
      throw new Error(`better-sqlite3 no quedó compilado para Windows en ${packageDir}`);
    }
  }

  return backups;
}

export function restoreHostNative(backups) {
  for (const { binary, backup } of backups) {
    if (existsSync(backup)) {
      copyFileSync(backup, binary);
      rmSync(backup, { force: true });
    }
  }
}
