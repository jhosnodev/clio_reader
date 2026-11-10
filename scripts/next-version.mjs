import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;
const TAG_PREFIX = 'refs/tags/';

export function parseVersion(tag) {
  const match = VERSION_PATTERN.exec(String(tag).trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatVersion({ major, minor, patch }) {
  return `v${major}.${minor}.${patch}`;
}

export function compareVersions(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function computeNextVersion(tags, baseVersion) {
  const base = parseVersion(baseVersion);
  if (!base) throw new Error(`Versión base inválida: "${baseVersion}"`);

  const taken = new Set();
  const candidates = [base];
  for (const tag of tags) {
    const parsed = parseVersion(tag);
    if (!parsed) continue;
    taken.add(formatVersion(parsed));
    candidates.push(parsed);
  }

  const highest = candidates.reduce((max, version) =>
    compareVersions(version, max) > 0 ? version : max,
  );
  let next = { major: highest.major, minor: highest.minor, patch: highest.patch + 1 };
  while (taken.has(formatVersion(next))) {
    next = { ...next, patch: next.patch + 1 };
  }
  return formatVersion(next);
}

export function listLocalTags() {
  const output = execFileSync('git', ['tag', '-l'], { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listRemoteTags() {
  const output = execFileSync('git', ['ls-remote', '--tags', 'origin'], { encoding: 'utf8' });
  const tags = [];
  for (const line of output.split('\n')) {
    const [ref] = line.split('\t');
    if (!ref || !ref.startsWith(TAG_PREFIX)) continue;
    const name = ref.slice(TAG_PREFIX.length);
    if (name.endsWith('^{}')) continue;
    tags.push(name);
  }
  return tags;
}

export function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function readPackageVersion(root = repoRoot()) {
  const pkg = JSON.parse(readFileSync(join(root, 'apps', 'desktop', 'package.json'), 'utf8'));
  return String(pkg.version);
}

export function writePackageVersion(version, root = repoRoot()) {
  const plain = version.replace(/^v/, '');
  const files = [join(root, 'package.json'), join(root, 'apps', 'desktop', 'package.json')];
  for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    pkg.version = plain;
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

function parseArgs(argv) {
  const options = {
    write: false,
    dryRun: false,
    remote: false,
    json: false,
    base: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') options.write = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--remote') options.remote = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--base') {
      i += 1;
      options.base = argv[i] ?? null;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Uso: node scripts/next-version.mjs [opciones]',
    '',
    'Calcula el siguiente tag de release único (vX.Y.Z+1) sin reutilizar tags existentes.',
    '',
    'Opciones:',
    '  --base <v>   Versión base cuando no hay tags (default: apps/desktop/package.json)',
    '  --remote     Consulta los tags de origin (git ls-remote) en vez de los locales',
    '  --write      Escribe la versión en package.json (raíz) y apps/desktop/package.json',
    '  --dry-run    No escribe nada (útil con --write)',
    '  --json       Salida JSON: {"tag":"v0.1.1","version":"0.1.1"}',
    '  --help       Esta ayuda',
  ].join('\n');
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const base = options.base ?? readPackageVersion();
  const tags = options.remote ? listRemoteTags() : listLocalTags();
  const tag = computeNextVersion(tags, base);
  const version = tag.slice(1);

  if (options.write && !options.dryRun) {
    writePackageVersion(version);
    console.error(
      `[next-version] version escrita: ${version} (package.json, apps/desktop/package.json)`,
    );
  } else if (options.write) {
    console.error('[next-version] dry-run: no se escribió ninguna versión');
  }

  console.error(
    `[next-version] base=${base} tags=${tags.length} -> ${tag}${options.remote ? ' (remoto)' : ''}`,
  );

  if (options.json) console.log(JSON.stringify({ tag, version }));
  else console.log(tag);
  return 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`[next-version] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
