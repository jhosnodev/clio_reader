# Entorno de desarrollo local

| Campo                             | Valor                                  |
| --------------------------------- | -------------------------------------- |
| **Nombre**                        | clio_reader — Guía de desarrollo local |
| **Autor**                         | Manus AI                               |
| **Fecha de creación**             | 28 de agosto de 2026                   |
| **Fecha de última actualización** | 28 de agosto de 2026                   |
| **Estado**                        | Guía inicial de Fase 0                 |
| **Versión del documento**         | 1.0.0                                  |

## Requisitos

Se requiere Node.js compatible con el proyecto, pnpm 10.x y Git. Windows y Android son las plataformas primarias del MVP; la preparación de los shells se realizará en las fases siguientes.

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

`validate` debe ejecutarse antes de abrir un pull request. Los tests del dominio y los futuros tests de cada paquete deben permanecer independientes de red y de servicios externos.

## Convenciones

Cada feature se implementa en un cambio enfocado, con tipos explícitos, pruebas unitarias y pruebas de integración cuando cruce módulos. Las decisiones complejas se documentan en `documentation/adr`. Los cambios de esquema requieren migración y prueba de compatibilidad.

Los commits deben describir el cambio en tiempo presente y mantener un alcance pequeño. No se deben subir libros de prueba, secretos, builds ni archivos generados.

## Estructura

El código de plataforma vive en `apps/`; el dominio y los adaptadores en `packages/`; y las decisiones de producto y arquitectura en `documentation/`. La UI no debe acceder directamente a un renderer o repositorio concreto.
