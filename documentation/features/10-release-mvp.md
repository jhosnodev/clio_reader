# 10 - Release del MVP (Windows y Linux)

## Overview

Configured `electron-builder` for Windows and Linux builds with placeholder icons. The desktop app can be packaged as a Windows installer/portable executable or as Linux AppImage/deb, y los workflows de GitHub Actions publican los artefactos.

## Configuration

### electron-builder.yml

Located at `apps/desktop/electron-builder.yml`:

- **appId**: `com.clio-reader.desktop`
- **productName**: `Clio Reader`
- **Output directory**: `release/`
- **Build resources**: `resources/` (icons, license, etc.)
- **Windows target**: NSIS installer (x64)
- **Linux targets**: AppImage + deb (`category: Office`)
- **NSIS options**: Non-one-click, custom install directory, preserves user data on uninstall

### Build Scripts

Todos con `--filter @clio-reader/desktop` desde la raíz:

| Script                 | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| `build`                | TypeScript compile + Vite build (no packaging)                                    |
| `build:win`            | Windows package (NSIS en Windows; en Linux prepara binarios win32 y zip portable) |
| `build:win:nsis`       | Instalador NSIS explícito (requiere Windows o wine)                               |
| `build:win:portable`   | Portable Windows executable (no install)                                          |
| `build:linux`          | AppImage + .deb (con `verify-linux-build.mjs`)                                    |
| `build:linux:appimage` | Solo AppImage                                                                     |
| `generate-icons`       | Regenerate placeholder icons                                                      |

## Placeholder Icons

Icons are generated via `scripts/generate-icons.js`:

- **256x256 PNG** with "ER" text on blue background
- **ICO file** embedding the PNG for Windows
- Located in `apps/desktop/resources/`

### Replacing with Real Icons

Replace `resources/icon.png` and `resources/icon.ico` with production artwork. Recommended:

- **ICO**: 256x256 with 16, 32, 48, 64, 128, 256px variants
- **PNG**: 512x512 or 1024x1024 for high-DPI displays

## Build Instructions

### Prerequisites

- Node.js 22+
- pnpm 12.16.1
- Electron dependencies installed

### Building

```bash
# Desde la raíz del monorepo

# Development build (no packaging)
pnpm --filter @clio-reader/desktop build

# Windows NSIS installer
pnpm --filter @clio-reader/desktop build:win

# Windows portable (no install required)
pnpm --filter @clio-reader/desktop build:win:portable

# Linux AppImage + .deb
pnpm --filter @clio-reader/desktop build:linux
```

Output files will be in `apps/desktop/release/`.

### Testing the Build

1. Run `pnpm --filter @clio-reader/desktop build:win` (o `build:linux`)
2. Find the artifact in `release/`
3. Run it on a Windows/Linux machine
4. Verify the app launches and all features work
5. Optional: `pnpm --filter @clio-reader/desktop exec node scripts/verify-win-build.mjs` (o `verify-linux-build.mjs`)

### Creating a Release

1. Update version in `package.json`
2. Tag it (`git tag v0.1.0 && git push --tags`)
3. Los workflows `windows-build.yml` y `linux-build.yml` compilan y suben los artefactos (`clio-reader-windows`, `clio-reader-linux`)
4. Descargar los artefactos de la ejecución de Actions o publicarlos en GitHub Releases
5. Probar instalación/actualización en una máquina limpia

## File Structure

```
apps/desktop/
├── electron-builder.yml    # Builder configuration
├── resources/
│   ├── icon.png            # Placeholder PNG icon
│   └── icon.ico            # Placeholder ICO icon
├── scripts/
│   └── generate-icons.js   # Icon generation script
├── release/                # Build output (gitignored)
└── package.json            # Build scripts
```

## CI

| Workflow            | Trigger                | Qué hace                                                        |
| ------------------- | ---------------------- | --------------------------------------------------------------- |
| `build-checks.yml`  | PR (`apps/desktop/**`) | Compila Linux y Windows sin subir artefactos                    |
| `windows-build.yml` | tags `v*` + manual     | `build:win` → artefacto `clio-reader-windows` (.exe)            |
| `linux-build.yml`   | tags `v*` + manual     | `build:linux` → artefacto `clio-reader-linux` (AppImage + .deb) |

Los gate de calidad (format/check/lint/test) los cubre `quality.yml` en cada PR.

## Notes

- The `release/` directory is gitignored
- Icons are placeholders; replace before production release
- NSIS installer preserves user data on uninstall (`deleteAppDataOnUninstall: false`)
- User data is stored in `%APPDATA%/clio-reader/clio-reader/` (Electron userData path) en producción y en la variante con sufijo `-dev` en desarrollo (`%APPDATA%/clio-reader-dev/clio-reader/`)
