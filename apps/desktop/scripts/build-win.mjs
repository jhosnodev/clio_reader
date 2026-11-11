import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareWindowsNative, restoreHostNative } from './win-native.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');

const WIN_CODE_SIGN_VERSION = '2.6.0';
const WIN_CODE_SIGN_URL =
  'https://github.com/electron-userland/electron-builder-binaries/releases/download/' +
  `winCodeSign-${WIN_CODE_SIGN_VERSION}/winCodeSign-${WIN_CODE_SIGN_VERSION}.7z`;

function resolveElectronBuilderCli() {
  const requireFromDesktop = createRequire(join(desktopDir, 'package.json'));
  try {
    return requireFromDesktop.resolve('electron-builder/cli.js');
  } catch {
    return null;
  }
}

function resolveSevenZip() {
  try {
    const requireFromDesktop = createRequire(join(desktopDir, 'package.json'));
    const ebCli = requireFromDesktop.resolve('electron-builder/cli.js');
    const builderUtil = requireFromDesktop.resolve('builder-util', { paths: [dirname(ebCli)] });
    const { path7za } = createRequire(builderUtil)('7zip-bin');
    if (path7za && existsSync(path7za)) return path7za;
  } catch {
    // fallback al 7z del sistema
  }
  for (const cmd of ['7z', '7za', '7zr']) {
    if (commandExists(cmd)) return cmd;
  }
  return null;
}

function resolveBuilderCacheDir() {
  const env = process.env.ELECTRON_BUILDER_CACHE;
  if (env && env.length > 0) return resolve(env);
  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local');
    return join(localAppData, 'electron-builder', 'Cache');
  }
  if (process.platform === 'darwin') {
    return join(process.env.HOME ?? '', 'Library', 'Caches', 'electron-builder');
  }
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(process.env.HOME ?? '', '.cache');
  return join(base, 'electron-builder');
}

async function ensureWinCodeSignCache() {
  const vendorParent = join(resolveBuilderCacheDir(), 'winCodeSign');
  const vendorDir = join(vendorParent, `winCodeSign-${WIN_CODE_SIGN_VERSION}`);
  const marker = join(vendorDir, 'rcedit-x64.exe');

  if (existsSync(marker)) return true;

  if (existsSync(vendorDir)) {
    console.warn('[build-win] winCodeSign incompleto; se regenerará.');
    rmSync(vendorDir, { recursive: true, force: true });
  }

  const sevenZip = resolveSevenZip();
  if (!sevenZip) {
    console.warn('[build-win] No se encontró 7z; electron-builder descargará winCodeSign.');
    return false;
  }

  console.log(`[build-win] Pre-sembrando winCodeSign ${WIN_CODE_SIGN_VERSION}…`);
  const stagingDir = join(vendorParent, `.staging-${WIN_CODE_SIGN_VERSION}-${process.pid}`);
  const tmpArchive = join(tmpdir(), `winCodeSign-${WIN_CODE_SIGN_VERSION}-${process.pid}.7z`);

  try {
    const res = await fetch(WIN_CODE_SIGN_URL);
    if (!res.ok) throw new Error(`descarga falló: HTTP ${res.status}`);
    writeFileSync(tmpArchive, Buffer.from(await res.arrayBuffer()));

    mkdirSync(stagingDir, { recursive: true });
    execFileSync(sevenZip, ['x', `-o${stagingDir}`, '-y', tmpArchive, '-xr!darwin'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!existsSync(join(stagingDir, 'rcedit-x64.exe'))) {
      throw new Error('rcedit-x64.exe no encontrado tras extraer');
    }

    mkdirSync(vendorParent, { recursive: true });
    rmSync(vendorDir, { recursive: true, force: true });
    renameSync(stagingDir, vendorDir);
    console.log(`[build-win] winCodeSign listo en ${vendorDir}`);
    return true;
  } catch (err) {
    console.warn(`[build-win] No se pudo pre-sembrar winCodeSign: ${err.message}`);
    console.warn(
      '[build-win] electron-builder intentará descargarlo (puede fallar sin admin en Windows).',
    );
    return false;
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
    rmSync(tmpArchive, { force: true });
  }
}

const args = process.argv.slice(2);
const wantsNsis = args.includes('--nsis');
const wantsPortable = args.includes('--portable');
const isWindowsHost = process.platform === 'win32';
const hasWine = isWindowsHost || commandExists('wine');
const editEnabled = isWindowsHost || hasWine;

let target;
if (wantsPortable) target = 'portable';
else if (wantsNsis) target = 'nsis';
else target = isWindowsHost ? 'nsis' : 'zip';

if (!isWindowsHost && (target === 'nsis' || target === 'portable')) {
  if (!hasWine) {
    console.error(
      '[build-win] Los targets NSIS/portable requieren wine cuando se compilan fuera de Windows.',
    );
    console.error(
      '[build-win] Usa "pnpm --filter @clio-reader/desktop build:win" para generar un zip ' +
        'portable, o compila el instalador en Windows / GitHub Actions.',
    );
    process.exit(1);
  }
}

const electronBuilderCli = resolveElectronBuilderCli();
if (!electronBuilderCli || !existsSync(electronBuilderCli)) {
  console.error('[build-win] No se encontró electron-builder (electron-builder/cli.js)');
  process.exit(1);
}

const builderArgs = ['--win', target, '--config.npmRebuild=false'];
if (!editEnabled) {
  builderArgs.push('--config.win.signAndEditExecutable=false');
}

if (editEnabled) {
  await ensureWinCodeSignCache();
} else {
  console.warn('[build-win] wine no disponible: se omite la edición del icono del .exe.');
  console.warn('[build-win] Instala wine para generar el icono en builds locales de Linux/macOS.');
}

let restoreState = {};

try {
  restoreState = prepareWindowsNative();

  console.log(`[build-win] Generando target "${target}" (host: ${process.platform})`);
  execFileSync(process.execPath, [electronBuilderCli, ...builderArgs], {
    cwd: desktopDir,
    stdio: 'inherit',
  });
} finally {
  restoreHostNative(restoreState);
}

const verifyArgs = [join(scriptDir, 'verify-win-build.mjs')];
if (editEnabled) verifyArgs.push('--expect-icon');
execFileSync(process.execPath, verifyArgs, {
  cwd: desktopDir,
  stdio: 'inherit',
});

if (!isWindowsHost && target === 'zip') {
  console.log(
    '[build-win] Instalador NSIS no generado: requiere Windows o wine. ' +
      'El zip resultante contiene win-unpacked/"Clio Reader.exe" y sí funciona en Windows.',
  );
}

function commandExists(command) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [command], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}
