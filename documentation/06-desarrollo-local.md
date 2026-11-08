# Entorno de desarrollo local

| Campo                             | Valor                                  |
| --------------------------------- | -------------------------------------- |
| **Nombre**                        | clio_reader — Guía de desarrollo local |
| **Autor**                         | Manus AI                               |
| **Fecha de creación**             | 28 de agosto de 2026                   |
| **Fecha de última actualización** | 7 de noviembre de 2026                 |
| **Estado**                        | Guía operativa (fases 0–9 en curso)    |
| **Versión del documento**         | 1.1.0                                  |

## Requisitos

Se requiere Node.js 22+, pnpm 12.16.1 y Git. Windows y Linux son las plataformas de escritorio del MVP (builds con `build:win` / `build:linux`), y Android es la plataforma mobile (Expo).

## Instalación

```bash
pnpm install
```

## Validaciones

```bash
pnpm format:check
pnpm check
pnpm lint
pnpm test
pnpm validate
```

`validate` debe ejecutarse antes de abrir un pull request. Los tests del dominio y los tests de cada paquete deben permanecer independientes de red y de servicios externos.

## CI

| Workflow           | Trigger                             | Qué ejecuta                 |
| ------------------ | ----------------------------------- | --------------------------- |
| `quality.yml`      | push a `main` + todo PR             | `pnpm validate`             |
| `build-checks.yml` | PR con cambios en `apps/desktop/**` | `build:linux` + `build:win` |

Un PR solo se considera verde cuando pasa `quality.yml`; si toca el desktop, además debe compilar en Linux y Windows.

## Builds de paquete

```bash
pnpm --filter @clio-reader/desktop dev          # desarrollo con HMR
pnpm --filter @clio-reader/desktop build:win    # Windows (NSIS / zip portable)
pnpm --filter @clio-reader/desktop build:linux  # AppImage + .deb
pnpm --filter @clio-reader/mobile build:reader  # bundle del reader para mobile
```

## Convenciones

Cada feature se implementa en un cambio enfocado, con tipos explícitos, pruebas unitarias y pruebas de integración cuando cruce módulos. Las decisiones complejas se documentan en `documentation/adr`. Los cambios de esquema requieren migración y prueba de compatibilidad.

Los commits deben describir el cambio en tiempo presente y mantener un alcance pequeño. No se deben subir libros de prueba, secretos, builds ni archivos generados.

## Estructura

El código de plataforma vive en `apps/`; el dominio y los adaptadores en `packages/`; y las decisiones de producto y arquitectura en `documentation/`. La UI no debe acceder directamente a un renderer o repositorio concreto.
