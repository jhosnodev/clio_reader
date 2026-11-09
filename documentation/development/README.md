# Desarrollo local — App de escritorio (Electron)

Guía rápida para ejecutar la aplicación de escritorio de Clio Reader en tu máquina local.

## Requisitos

| Requisito | Versión                    |
| --------- | -------------------------- |
| Node.js   | 22+                        |
| pnpm      | 12.16.1                    |
| Git       | Cualquier versión reciente |

> No se requiere Rust, .NET ni ninguna otra herramienta. El proyecto es 100% TypeScript/JavaScript.

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd echo_reader

# 2. Instalar dependencias del monorepo
pnpm install
```

## Ejecutar en modo desarrollo

```bash
# Desde la raíz del monorepo
pnpm --filter @clio-reader/desktop dev
```

Esto abre la app de Electron con hot-reload. Cualquier cambio en el código se refleja automáticamente.

## Build para Windows

```bash
# Build + empaquetado por defecto (ver electron-builder.yml)
pnpm --filter @clio-reader/desktop build:win

# Instalador NSIS explícito
pnpm --filter @clio-reader/desktop build:win:nsis

# Build portable (sin instalar)
pnpm --filter @clio-reader/desktop build:win:portable
```

## Build para Linux

```bash
# AppImage + .deb
pnpm --filter @clio-reader/desktop build:linux

# Solo AppImage (config electron-builder.yml)
pnpm --filter @clio-reader/desktop build:linux:appimage
```

Los archivos generados de ambos quedan en `apps/desktop/release/`.

## Tests y validación

```bash
# Ejecutar todos los tests (desde la raíz)
pnpm test

# Validación completa (format + typecheck + lint + tests)
pnpm validate
```

## CI en pull requests

- `quality.yml` ejecuta `pnpm validate` en cada PR y push a `main` (gate obligatorio).
- `build-checks.yml` ejecuta builds reales de Linux y Windows en PRs que tocan `apps/desktop/**` o el lockfile.
- Los builds de release (`windows-build.yml`, `linux-build.yml`) se disparan con tags `v*` o manualmente.

## Solución a problemas comunes

Si Electron no se instala correctamente, consulta la [guía de troubleshooting](./windows-setup.md#troubleshooting).

## Scripts disponibles

Todos los scripts de build van con `--filter` (no existen en la raíz):

| Script                                                  | Descripción                      |
| ------------------------------------------------------- | -------------------------------- |
| `pnpm --filter @clio-reader/desktop dev`                | Desarrollo con HMR (Electron)    |
| `pnpm --filter @clio-reader/desktop build`              | Build de producción              |
| `pnpm --filter @clio-reader/desktop build:win`          | Build + paquete Windows          |
| `pnpm --filter @clio-reader/desktop build:win:nsis`     | Instalador NSIS                  |
| `pnpm --filter @clio-reader/desktop build:win:portable` | Build portable Windows           |
| `pnpm --filter @clio-reader/desktop build:linux`        | AppImage + .deb                  |
| `pnpm test`                                             | Ejecutar tests con Vitest (raíz) |
| `pnpm validate`                                         | Validación completa (raíz)       |

## Documentación

- [Guía de setup en Windows (troubleshooting)](./windows-setup.md)
- [Módulos nativos y ABI de Electron](./windows-native-abi.md)
- [Definición del MVP](../01-definicion-mvp.md)
- [Arquitectura técnica](../02-arquitectura-tecnica.md)
- [Plan de implementación](../05-plan-implementacion.md)
- [Diseño de la base de datos](../diseño-de-DB.md)
