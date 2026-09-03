# Desarrollo local — App Windows (Electron)

Guía rápida para ejecutar la aplicación de escritorio de Echo Reader en tu máquina local.

## Requisitos

| Requisito | Versión |
|-----------|---------|
| Node.js | 22+ |
| pnpm | 10.15.1 |
| Git | Cualquier versión reciente |

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
pnpm --filter @echo-reader/desktop dev
```

Esto abre la app de Electron con hot-reload. Cualquier cambio en el código se refleja automáticamente.

## Build para Windows

```bash
# Build + empaquetado NSIS (instalador .exe)
pnpm --filter @echo-reader/desktop build:win

# Build portable (sin instalar)
pnpm --filter @echo-reader/desktop build:win:portable
```

Los archivos generados quedan en `apps/desktop/release/`.

> Ya existe un build compilado: `apps/desktop/release/Echo Reader Setup 0.1.0.exe`

## Ejecutar el build existente

```bash
# Abrir el instalador
start "apps/desktop/release/Echo Reader Setup 0.1.0.exe"
```

## Tests y validación

```bash
# Ejecutar todos los tests
pnpm test

# Validación completa (format + typecheck + lint + tests)
pnpm validate
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Desarrollo con HMR (Electron) |
| `pnpm build` | Build de producción |
| `pnpm build:win` | Build + instalador Windows NSIS |
| `pnpm build:win:portable` | Build portable Windows |
| `pnpm test` | Ejecutar tests con Vitest |
| `pnpm validate` | Validación completa |

## Documentación

- [Guía de setup en Windows (troubleshooting)](./windows-setup.md)
- [Documentación del proyecto](../documentation/)
- [Definición del MVP](../documentation/01-definicion-mvp.md)
- [Arquitectura técnica](../documentation/02-arquitectura-tecnica.md)
- [Plan de implementación](../documentation/05-plan-implementacion.md)
