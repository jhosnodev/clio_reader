# Clio Reader

**Clio Reader** es un lector y gestor de biblioteca local para libros y cómics digitales. Diseñado para funcionar sin conexión, sin cuentas y sin backend. Tu biblioteca, tu dispositivo.

## Características

- **Local-first**: Todo se almacena en tu dispositivo, sin dependencia de servicios externos
- **Multi-formato**: Soporte para EPUB, PDF, CBZ y Markdown
- **Biblioteca organizada**: Importa, ordena (rating) y gestiona tu colección de libros
- **Lector personalizable**: Paletas de color, modo oscuro/claro, tipografía, tamaño de letra, interlineado y **márgenes con slider** (8–120 px)
- **Modo Zen**: Oculta los cintillos y expande la página a todo el ancho
- **Anotaciones**: Notas ancladas al texto, **resaltado con 6 colores** (EPUB/MD) y vista "Notas y resaltados" en la biblioteca
- **Exportar/importar anotaciones**: Notas y resaltados por libro como Markdown
- **Persistencia**: Progreso de lectura y preferencias guardados localmente (SQLite en desktop, JSON en mobile)
- **Sin DRM**: Acceso completo a tus archivos sin restricciones

> Los **marcadores** (bookmark) están implementados en dominio/persistencia pero deshabilitados en la UI hasta completar su CRUD desde el lector.

## Formatos soportados

| Formato | Descripción                       |
| ------- | --------------------------------- |
| `.epub` | Libros electrónicos estándar      |
| `.pdf`  | Documentos PDF                    |
| `.cbz`  | Cómics comprimidos (imágenes ZIP) |
| `.md`   | Documentos Markdown               |

## Descargas

| Plataforma | Archivo                   |
| ---------- | ------------------------- |
| Linux      | AppImage y paquete `.deb` |
| Windows    | Instalador NSIS `.exe`    |

- Página de descargas: <https://jhosnodev.github.io/echo_reader/>
- Historial y notas de cada versión: [GitHub Releases](https://github.com/jhosnodev/echo_reader/releases)

La página muestra siempre la versión publicada de forma dinámica; cada release incluye `SHA256SUMS.txt` para verificar los archivos.

## Requisitos previos

| Requisito | Versión                    |
| --------- | -------------------------- |
| Node.js   | 22+                        |
| pnpm      | 12.16.1                    |
| Git       | Cualquier versión reciente |

> No se requiere Rust, .NET ni ninguna otra herramienta. El proyecto es 100% TypeScript/JavaScript.

## Instalación

### Clonar el repositorio

```bash
git clone <url-del-repo>
cd echo_reader
```

### Instalar dependencias

```bash
pnpm install
```

## Ejecutar en modo desarrollo

```bash
# Desde la raíz del monorepo
pnpm --filter @clio-reader/desktop dev
```

Esto abrirá la aplicación de Electron con hot-reload. Cualquier cambio en el código se reflejará automáticamente.

## Build para Windows

### Instalador NSIS (recomendado)

```bash
pnpm --filter @clio-reader/desktop build:win
```

En **Windows** genera un instalador `.exe` en `apps/desktop/release/`.

En **Linux/macOS** el instalador NSIS requiere `wine`; sin él, el mismo comando
genera `Clio Reader-0.1.0-win.zip` con la app portable (`win-unpacked/Clio Reader.exe`),
que sí funciona en Windows.

> **Importante:** nunca uses un `.exe` de Windows empaquetado desde Linux sin
> contar con los binarios nativos de `better-sqlite3` para `win32`; la app no
> arrancaría (el proceso principal falla al cargar SQLite). El script
> `build:win` prepara y verifica esos binarios automáticamente.

### Versión portable (sin instalar)

```bash
pnpm --filter @clio-reader/desktop build:win:portable
```

Genera un ejecutable portable que no requiere instalación (requiere Windows o `wine`).

### Build automático en Windows (GitHub Actions)

El workflow `.github/workflows/windows-build.yml` compila el instalador en
`windows-latest` en cada tag `v*` (o manualmente desde la pestaña Actions) y
sube el `.exe` como artifact `clio-reader-windows`.

### Verificar un build existente

```bash
pnpm --filter @clio-reader/desktop exec node scripts/verify-win-build.mjs
```

Comprueba que los módulos nativos sean binarios de Windows y que el instalador
contenga la app.

## Build para Linux

### AppImage + .deb

```bash
pnpm --filter @clio-reader/desktop build:linux
```

Genera en `apps/desktop/release/`:

- `Clio Reader-0.1.0.AppImage`
- `clio-reader_0.1.0_amd64.deb`

### Solo AppImage

```bash
pnpm --filter @clio-reader/desktop build:linux:appimage
```

### Verificar un build existente

```bash
pnpm --filter @clio-reader/desktop exec node scripts/verify-linux-build.mjs
```

### Build automático en Linux (GitHub Actions)

El workflow `.github/workflows/linux-build.yml` compila en `ubuntu-latest` en
cada tag `v*` (o manualmente) y sube AppImage + `.deb` como artifact
`clio-reader-linux`.

## Ejecutar el build existente

Si ya tienes un build compilado:

```bash
# Windows
start "apps/desktop/release/Clio Reader Setup 0.1.0.exe"

# Linux
./apps/desktop/release/Clio\ Reader-0.1.0.AppImage
```

## Aplicación mobile (Android)

```bash
# Genera apps/mobile/assets/reader.html desde el bundle del reader (requiere pnpm build previo)
pnpm --filter @clio-reader/mobile build:reader

# Metro + dispositivo/emulador
pnpm --filter @clio-reader/mobile android
```

La spec completa está en [`documentation/features/14-lector-mobile-android.md`](./documentation/features/14-lector-mobile-android.md).

## CI / GitHub Actions

| Workflow           | Trigger                                    | Qué ejecuta                                               | Artefactos                                 |
| ------------------ | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------ |
| `ci.yml`           | push a `main` + PR + `workflow_call`       | format + lint + type-check + test (pasos separados)       | —                                          |
| `release.yml`      | push a `main` + manual                     | valida, compila Linux/Windows y publica la GitHub Release | `clio-reader-linux`, `clio-reader-windows` |
| `build-checks.yml` | PR (paths de `apps/desktop/**` y lockfile) | `build:linux` y `build:win` (verificación, sin subir)     | —                                          |
| `pages.yml`        | push a `main` (paths de `site/**`)         | Publica la web de descargas en GitHub Pages               | —                                          |

Todo PR pasa por `ci.yml`; un push a `main` ejecuta `ci.yml` y, si todo está en verde, `release.yml` publica una release nueva. Los PRs que tocan el desktop además compilan de verdad en Linux y Windows con `build-checks.yml`.

## Scripts disponibles

### Raíz del monorepo

| Script              | Descripción                                        |
| ------------------- | -------------------------------------------------- |
| `pnpm build`        | Build recursivo de todos los paquetes              |
| `pnpm check`        | Type-check completo                                |
| `pnpm format`       | Formateo de código con Prettier                    |
| `pnpm format:check` | Verificación de formato (sin escribir)             |
| `pnpm lint`         | Linting con ESLint                                 |
| `pnpm test`         | Ejecutar tests con Vitest                          |
| `pnpm test:watch`   | Tests en modo watch                                |
| `pnpm next-version` | Siguiente tag de release único                     |
| `pnpm validate`     | Validación completa (format + check + lint + test) |

### Aplicación desktop

Todos van con `--filter @clio-reader/desktop`:

| Script                 | Descripción                                             |
| ---------------------- | ------------------------------------------------------- |
| `dev`                  | Desarrollo con HMR (Electron)                           |
| `build`                | Build de producción                                     |
| `build:win`            | Build Windows (NSIS en Windows, zip portable en Linux)  |
| `build:win:nsis`       | Instalador NSIS (requiere Windows o wine)               |
| `build:win:portable`   | Build portable Windows                                  |
| `build:linux`          | AppImage + .deb                                         |
| `build:linux:appimage` | Solo AppImage                                           |
| `build:reader-mobile`  | Bundle del reader para `apps/mobile/assets/reader.html` |
| `preview`              | Vista previa del build web                              |
| `generate-icons`       | Regenera iconos de la app                               |

### Aplicación mobile

| Script                      | Descripción                               |
| --------------------------- | ----------------------------------------- |
| `build:reader`              | Genera `assets/reader.html` (vía desktop) |
| `start` / `android` / `ios` | Metro + dispositivo/emulador              |

## Estructura del proyecto

```
echo_reader/
├── apps/
│   ├── desktop/          # Aplicación Electron + React (Windows/Linux)
│   └── mobile/           # Aplicación Expo + React Native (Android/iOS)
├── packages/
│   ├── domain/           # Tipos y modelos de dominio
│   ├── reader-core/      # Contratos abstractos y máquina de estados
│   ├── reader-epub/      # Adaptador/reader de EPUB
│   ├── reader-pdf/       # Adaptador/reader de PDF
│   ├── reader-cbz/       # Adaptador/reader de CBZ
│   ├── reader-md/        # Adaptador/reader de Markdown
│   ├── reader-session/   # Gestión de sesión de lectura
│   ├── storage/          # Persistencia local (SQLite en desktop, JSON en mobile)
│   ├── library/          # Casos de uso de biblioteca
│   └── annotations/      # Gestión de anotaciones
├── documentation/        # Documentación del proyecto
└── skills/               # Skills reutilizables
```

## Tests

```bash
# Ejecutar todos los tests
pnpm test

# Ejecutar tests en modo watch
pnpm test:watch
```

## Documentación

La documentación completa se encuentra en [`documentation/`](./documentation/):

- [Definición del MVP](./documentation/01-definicion-mvp.md)
- [Arquitectura técnica](./documentation/02-arquitectura-tecnica.md)
- [Arquitectura de datos y metadata](./documentation/03-arquitectura-data-y-metadata.md)
- [Features futuros](./documentation/04-features-futuros.md)
- [Plan de implementación por fases](./documentation/05-plan-implementacion.md)
- [Guía de desarrollo local](./documentation/06-desarrollo-local.md)
- [Flujo de comunicación con la WebView](./documentation/07-flujo-webview.md)
- [Guía de estilos (STYLE-GUIDE)](./documentation/STYLE-GUIDE.md)
- [Diseño de la base de datos](./documentation/diseño-de-DB.md)
- [Guías de desarrollo](./documentation/development/)
- [Especificaciones de features](./documentation/features/)
- [Architecture Decision Records](./documentation/adr/)

## Estado del proyecto

| Fase                             | Estado      |
| -------------------------------- | ----------- |
| Fase 0 — Preparación repo        | ✅ Completa |
| Fase 1 — Spike Windows           | ✅ Completa |
| Fase 2 — Dominio/contratos       | ✅ Completa |
| Fase 3 — Biblioteca/persistencia | ✅ Completa |
| Fase 4 — Renderer CBZ            | ✅ Completa |
| Fase 5 — Renderer PDF            | ✅ Completa |
| Fase 6 — Renderer EPUB/MD        | ✅ Completa |
| Fase 7 — Progreso/settings       | ⚠️ Parcial  |
| Fase 8 — Marcadores/notas        | ⚠️ Parcial  |
| Fase 9 — Mobile Android (MVP)    | ⚠️ Parcial  |

## Plataformas objetivo

- **Windows**: Versión desktop completa (Electron)
- **Linux**: AppImage + .deb (Electron)
- **Android**: Versión mobile en desarrollo (Expo)
- **iOS**: Preparada pero no prioridad para el MVP

## Autor

Desarrollado por [jhosno.dev](https://jhosno.dev)
