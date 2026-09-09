# 10 - Windows Build Configuration

## Overview

Configured `electron-builder` for Windows builds with placeholder icons. The desktop app can now be packaged as a Windows installer or portable executable.

## Configuration

### electron-builder.yml

Located at `apps/desktop/electron-builder.yml`:

- **appId**: `com.clio-reader.desktop`
- **productName**: `Clio Reader`
- **Output directory**: `release/`
- **Build resources**: `resources/` (icons, license, etc.)
- **Windows target**: NSIS installer (x64)
- **NSIS options**: Non-one-click, custom install directory, preserves user data on uninstall

### Build Scripts

| Script               | Description                                    |
| -------------------- | ---------------------------------------------- |
| `build`              | TypeScript compile + Vite build (no packaging) |
| `build:win`          | Full Windows NSIS installer                    |
| `build:win:portable` | Portable Windows executable (no install)       |
| `generate-icons`     | Regenerate placeholder icons                   |

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

- Node.js 18+
- pnpm
- Electron dependencies installed

### Building

```bash
cd apps/desktop

# Development build (no packaging)
pnpm build

# Windows NSIS installer
pnpm build:win

# Windows portable (no install required)
pnpm build:win:portable
```

Output files will be in `apps/desktop/release/`.

### Testing the Build

1. Run `pnpm build:win`
2. Find the installer in `release/`
3. Run the installer on a Windows machine
4. Verify the app launches and all features work

### Creating a Release

1. Update version in `package.json`
2. Run `pnpm build:win`
3. Test the installer
4. Upload `release/Clio Reader Setup x.x.x.exe` to GitHub Releases

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

## Notes

- The `release/` directory is gitignored
- Icons are placeholders; replace before production release
- NSIS installer preserves user data on uninstall (`deleteAppDataOnUninstall: false`)
- User data is stored in `%APPDATA%/clio-reader/clio-reader/` (Electron userData path)
