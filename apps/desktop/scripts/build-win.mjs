import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareWindowsNative, restoreHostNative } from './win-native.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const electronBuilder = join(
  desktopDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);

const args = process.argv.slice(2);
const wantsNsis = args.includes('--nsis');
const wantsPortable = args.includes('--portable');
const isWindowsHost = process.platform === 'win32';
const hasWine = isWindowsHost || commandExists('wine');

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

if (!existsSync(electronBuilder)) {
  console.error(`[build-win] No se encontró electron-builder en ${electronBuilder}`);
  process.exit(1);
}

const builderArgs = ['--win', target];
let backups = [];

try {
  if (!isWindowsHost) {
    backups = prepareWindowsNative();
    builderArgs.push('--config.npmRebuild=false');
  }

  console.log(`[build-win] Generando target "${target}" (host: ${process.platform})`);
  execFileSync(electronBuilder, builderArgs, { cwd: desktopDir, stdio: 'inherit' });
} finally {
  restoreHostNative(backups);
}

execFileSync(process.execPath, [join(scriptDir, 'verify-win-build.mjs')], {
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
