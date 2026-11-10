# 17 - Continuous Release (publicación automática en cada push a main)

## Overview

Pipeline de release sin intervención manual: cada push a `main` valida, compila para Linux y Windows, y publica una GitHub Release con instaladores, checksums y notas. La versión se calcula de forma única por ejecución y nunca sobrescribe releases anteriores.

**Estado**

| Fase | Descripción                                          | Estado                           |
| ---- | ---------------------------------------------------- | -------------------------------- |
| 1    | Preparación: compilación reproducible                | ✅ Verificada en local           |
| 2    | Estrategia de versiones (`scripts/next-version.mjs`) | ✅ Implementada                  |
| 3    | CI (`.github/workflows/ci.yml`)                      | ⏳ Pendiente                     |
| 4    | Workflow de Release (`release.yml`)                  | ⏳ Pendiente                     |
| 5    | Seguridad y confiabilidad                            | ⏳ Pendiente (aplica con Fase 4) |
| 6    | Página de descargas (GitHub Pages)                   | ⏳ Pendiente                     |

## Fase 1 — Compilación reproducible (verificada)

### Entorno

| Elemento         | Valor                                                |
| ---------------- | ---------------------------------------------------- |
| Node.js          | 22+                                                  |
| Package manager  | pnpm 12.16.1 (fijado en `packageManager`)            |
| Lockfile         | `pnpm-lock.yaml` → `pnpm install --frozen-lockfile`  |
| TypeScript       | 5.6 (modo estricto)                                  |
| Electron         | 28 (ABI `NODE_MODULE_VERSION` 119)                   |
| electron-builder | 24.9 (config en `apps/desktop/electron-builder.yml`) |

### Targets de compilación

| Plataforma               | Target         | Comando                                          | Verificación                                                       |
| ------------------------ | -------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Linux x64                | AppImage + deb | `pnpm --filter @clio-reader/desktop build:linux` | `scripts/verify-linux-build.mjs` (ELF, ABI Electron, asar, ≥40 MB) |
| Windows x64 (en Windows) | NSIS installer | `pnpm --filter @clio-reader/desktop build:win`   | `scripts/verify-win-build.mjs` (binarios Windows, asar, ≥20 MB)    |
| Windows x64 (en Linux)   | zip portable   | `pnpm --filter @clio-reader/desktop build:win`   | Ídem; NSIS requiere Windows o wine                                 |

NSIS en CI se genera en `windows-latest`; en Linux solo es posible el zip portable.

### Validación local

```bash
pnpm install --frozen-lockfile   # dependencias exactas del lockfile
pnpm validate                    # format:check + build/check + lint + test
```

- `pnpm validate` ejecuta: Prettier, build recursivo + `tsc` por paquete, ESLint y Vitest.
- Tests: 53 archivos / 633 tests (`packages/**/tests`, `apps/desktop/src/**`, `apps/mobile/tests`, `scripts/**`), unitarios y de integración bajo un único `vitest run`.

### Salidas esperadas

Tras `build:linux` en `apps/desktop/release/`:

- `Clio Reader-<versión>.AppImage`
- `clio-reader_<versión>_amd64.deb`

Tras `build:win` en `windows-latest`:

- `Clio Reader Setup <versión>.exe` (NSIS)

## Fase 2 — Estrategia de versiones

### Módulo: `scripts/next-version.mjs`

Calcula el siguiente tag `vX.Y.Z` de forma única, sin reutilizar tags existentes.

```bash
pnpm next-version                 # -> v0.1.1 (stdout) ; info en stderr
pnpm next-version --json          # -> {"tag":"v0.1.1","version":"0.1.1"}
pnpm next-version --remote        # consulta tags de origin (git ls-remote)
pnpm next-version --write         # además escribe la versión en package.json (raíz y desktop)
pnpm next-version --write --dry-run  # calcula sin escribir
pnpm next-version --base 0.2.0    # fuerza la versión base
```

Reglas:

1. **Base**: si no hay tags, parte de la versión de `apps/desktop/package.json` (hoy `0.1.0`) → `v0.1.1`.
2. **Incremento**: patch +1 sobre el mayor entre la base y los tags existentes (orden semver, no lexicográfico: `v0.1.9` < `v0.1.10`).
3. **Nunca reutiliza**: si el tag candidato ya existe, sigue subiendo el patch hasta encontrar uno libre.
4. **Tags malformados** se ignoran.
5. **`--write`** solo modifica el workspace (no hace commit): la versión del instalador coincide con la de la Release y el tag apunta al commit publicado (`git.sha`).

### Pruebas

`scripts/next-version.test.ts` cubre: parseo, incremento, orden semver, tags malformados, anti-reutilización, base como mínimo y errores de validación.

## Fase 3 — CI (pendiente)

`.github/workflows/ci.yml` (sustituye a `quality.yml`): triggers `push` a `main`, `pull_request` y `workflow_call`; pasos separados de format, lint, type-check y tests. Un fallo impide la publicación.

## Fase 4 — Workflow de Release (pendiente)

`release.yml`: `push` a `main` + `workflow_dispatch`. Jobs: `validate` (reutiliza `ci.yml`) → `prepare` (versión + notas) → `build-linux` / `build-windows` → `publish` (único con `permissions: contents: write`; checksums SHA256, tag y GitHub Release).

## Fase 5 — Seguridad (pendiente, se aplica con la Fase 4)

`contents: write` solo en `publish`; `GITHUB_TOKEN` (sin PAT); Actions fijadas a SHA; sin publicación si fallan tests; sin sobrescritura de tags/releases; `concurrency.cancel-in-progress: false`.

## Fase 6 — Página de descargas (pendiente)

GitHub Pages desde `site/`: consulta la API de GitHub Releases para mostrar versión real, AppImage, deb, exe, historial y notas; estado "descarga no disponible" si no hay release válida.
