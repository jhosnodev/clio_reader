# clio_reader

**clio_reader** es un lector y gestor de biblioteca local para libros y cómics digitales.

## MVP

La primera versión estará orientada principalmente a **Windows y Android**. Permitirá al usuario agregar y leer archivos almacenados localmente en su dispositivo, sin necesidad de conexión a internet, cuenta o perfil.

Formatos previstos:

- `.epub`
- `.pdf`
- `.cbz`

El MVP incluirá una biblioteca local, navegación de lectura, guardado de la última posición, preferencias visuales, marcadores y notas. La cantidad de libros dependerá únicamente del espacio de almacenamiento y de las capacidades del dispositivo.

La sincronización con la nube, los perfiles, la arquitectura SaaS, la exportación avanzada y el soporte para otras plataformas se consideran funcionalidades futuras.

## Documentación

La documentación del proyecto se encuentra en [`documentation/`](./documentation/):

- [Definición del MVP](./documentation/01-definicion-mvp.md)
- [Arquitectura técnica](./documentation/02-arquitectura-tecnica.md)
- [Arquitectura de data y metadata](./documentation/03-arquitectura-data-y-metadata.md)
- [Features futuros](./documentation/04-features-futuros.md)
- [Plan de implementación por fases](./documentation/05-plan-implementacion.md)
- [Guía de desarrollo local](./documentation/06-desarrollo-local.md)
- [Flujo del WebView](./documentation/07-flujo-webview.md)
- [ADR: dominio y persistencia local](./documentation/adr/0001-dominio-y-persistencia-local.md)
- [ADR: reader-core y máquina de estados](./documentation/adr/0002-reader-core-state-machine.md)
- [Documentos de features futuras](./documentation/features/)

## Estado

El proyecto se encuentra en fase de implementación activa. Las fases completadas son:

| Fase                             | Estado       | Detalle                                                        |
| -------------------------------- | ------------ | -------------------------------------------------------------- |
| Fase 0 — Preparación repo        | ✅ Completa  | Monorepo, TypeScript estricto, Prettier, ESLint, Vitest, CI    |
| Fase 1 — Spike Windows           | ✅ Completa  | Electron shell, selector de archivos, IPC, ciclo de vida       |
| Fase 2 — Dominio/contratos       | ✅ Completa  | `domain`, `reader-core`, `reader-session` con tests            |
| Fase 3 — Biblioteca/persistencia | ✅ Completa  | `storage` + `library` conectados a la UI via Electron KV store |
| Fase 4 — Renderer CBZ            | ✅ Completa  | `reader-cbz` implementado con tests                            |
| Fase 5 — Renderer PDF            | ✅ Completa  | `reader-pdf` implementado con tests                            |
| Fase 6 — Renderer EPUB           | ✅ Completa  | `reader-epub` integrado al webview con navegación y temas      |
| Fase 7 — Progreso/settings       | ⚠️ Parcial   | `reader-session` existe, progreso se guarda al cerrar          |
| Fase 8 — Marcadores/notas        | ❌ Pendiente | Tipos definidos en dominio, sin UI                             |

**Funcionalidades implementadas:**

- Importar libros EPUB, PDF y CBZ
- Biblioteca local con persistencia (los libros sobreviven al reinicio)
- Lector EPUB con navegación por capítulos
- Manejo de archivos perdidos/movidos con opción de reubicar
- UI completamente en español
- Arquitectura SOLID con separación de responsabilidades
