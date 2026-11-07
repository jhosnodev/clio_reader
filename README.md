# Clio Reader

**Clio Reader** es un lector y gestor de biblioteca local para libros y cómics digitales. Diseñado para funcionar sin conexión, sin cuentas y sin backend. Tu biblioteca, tu dispositivo.

## Características

- **Local-first**: Todo se almacena en tu dispositivo, sin dependencia de servicios externos
- **Multi-formato**: Soporte para EPUB, PDF, CBZ y Markdown
- **Biblioteca organizada**: Importa, ordena y gestiona tu colección de libros
- **Lector personalizable**: Paletas de color, modo oscuro/claro y preferencias visuales
- **Persistencia**: Progreso de lectura, marcadores y notas guardados localmente
- **Sin DRM**: Acceso completo a tus archivos sin restricciones

## Formatos soportados

| Formato | Descripción                       |
| ------- | --------------------------------- |
| `.epub` | Libros electrónicos estándar      |
| `.pdf`  | Documentos PDF                    |
| `.cbz`  | Cómics comprimidos (imágenes ZIP) |
| `.md`   | Documentos Markdown               |

## Requisitos previos

| Requisito | Versión                    |
| --------- | -------------------------- |
| Node.js   | 22+                        |
| pnpm      | 10.15.1                    |
| Git       | Cualquier versión reciente |

> No se requiere Rust, .NET ni ninguna otra herramienta. El proyecto es 100% TypeScript/JavaScript.

## Instalación

### Clonar el repositorio

```bash
git clone <url-del-repo>
cd clio_reader
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
genera `Clio-Reader-0.1.0-win.zip` con la app portable (`win-unpacked/Clio Reader.exe`),
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
sube el `.exe` como artifact.

### Verificar un build existente

```bash
pnpm --filter @clio-reader/desktop exec node scripts/verify-win-build.mjs
```

Comprueba que los módulos nativos sean binarios de Windows y que el instalador
contenga la app.

## Ejecutar el build existente

Si ya tienes un build compilado:

```bash
# Windows
start "apps/desktop/release/Clio Reader Setup 0.1.0.exe"
```

## Scripts disponibles

### Raíz del monorepo

| Script          | Descripción                                        |
| --------------- | -------------------------------------------------- |
| `pnpm build`    | Build recursivo de todos los paquetes              |
| `pnpm check`    | Type-check completo                                |
| `pnpm format`   | Formateo de código con Prettier                    |
| `pnpm lint`     | Linting con ESLint                                 |
| `pnpm test`     | Ejecutar tests con Vitest                          |
| `pnpm validate` | Validación completa (format + check + lint + test) |

### Aplicación desktop

| Script                    | Descripción                                            |
| ------------------------- | ------------------------------------------------------ |
| `pnpm dev`                | Desarrollo con HMR (Electron)                          |
| `pnpm build`              | Build de producción                                    |
| `pnpm build:win`          | Build Windows (NSIS en Windows, zip portable en Linux) |
| `pnpm build:win:nsis`     | Instalador NSIS (requiere Windows o wine)              |
| `pnpm build:win:portable` | Build portable Windows                                 |

## Estructura del proyecto

```
echo_reader/
├── apps/
│   ├── desktop/          # Aplicación Electron + React (Windows)
│   └── mobile/           # Aplicación Expo + React Native (Android/iOS)
├── packages/
│   ├── domain/           # Tipos y modelos de dominio
│   ├── reader-core/      # Contratos abstractos y máquina de estados
│   ├── reader-epub/      # Renderer de EPUB
│   ├── reader-pdf/       # Renderer de PDF
│   ├── reader-cbz/       # Renderer de CBZ
│   ├── reader-session/   # Gestión de sesión de lectura
│   ├── storage/          # Persistencia local (SQLite)
│   ├── library/          # Casos de uso de biblioteca
│   └── annotations/      # Gestión de anotaciones
└── documentation/        # Documentación del proyecto
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

## Estado del proyecto

| Fase                             | Estado       |
| -------------------------------- | ------------ |
| Fase 0 — Preparación repo        | ✅ Completa  |
| Fase 1 — Spike Windows           | ✅ Completa  |
| Fase 2 — Dominio/contratos       | ✅ Completa  |
| Fase 3 — Biblioteca/persistencia | ✅ Completa  |
| Fase 4 — Renderer CBZ            | ✅ Completa  |
| Fase 5 — Renderer PDF            | ✅ Completa  |
| Fase 6 — Renderer EPUB           | ✅ Completa  |
| Fase 7 — Progreso/settings       | ⚠️ Parcial   |
| Fase 8 — Marcadores/notas        | ❌ Pendiente |

## Plataformas objetivo

- **Windows**: Versión desktop completa (Electron)
- **Android**: Versión mobile en desarrollo (Expo)
- **iOS**: Preparada pero no prioridad para el MVP

## Autor

Desarrollado por [jhosno.dev](https://jhosno.dev)
