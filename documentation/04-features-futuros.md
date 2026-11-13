# Features futuros

| Campo                             | Valor                                       |
| --------------------------------- | ------------------------------------------- |
| **Nombre**                        | clio_reader — Índice de features futuros    |
| **Autor**                         | Manus AI                                    |
| **Fecha de creación**             | 28 de agosto de 2026                        |
| **Fecha de última actualización** | 10 de noviembre de 2026                     |
| **Estado**                        | Backlog arquitectónico (con avances hechos) |
| **Versión del documento**         | 1.2.0                                       |

## Propósito

Este documento indexa las capacidades que están fuera del MVP de biblioteca local. El MVP es **solo Desktop (Windows y Linux)**, funciona offline y no incluye perfiles, cuentas, backend ni sincronización. El orden de etapas (Desktop → Obsidian → Android) está definido en [`00-vision-roadmap.md`](./00-vision-roadmap.md). Cada feature futura tendrá su propio documento en [`features/`](./features/).

## Índice de features fuera del MVP

| ID    | Feature                                                | Documento                                                                                                  | Dependencias                                          | Estado                   |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| F-001 | Compartir y exportar metadata/data con otros elementos | [`features/01-compartir-metadata-data.md`](./features/01-compartir-metadata-data.md)                       | Modelo de anotaciones, locators y exportación local   | Futura (Etapa 1)         |
| F-002 | Sincronización con la nube                             | [`features/02-sincronizacion-nube.md`](./features/02-sincronizacion-nube.md)                               | Identidad, API, conflictos y almacenamiento remoto    | Bloqueada (horizonte)    |
| F-003 | Arquitectura SaaS                                      | [`features/03-arquitectura-saas.md`](./features/03-arquitectura-saas.md)                                   | Nube, usuarios, billing, observabilidad y seguridad   | Bloqueada (horizonte)    |
| F-004 | Soporte para otras plataformas                         | [`features/04-otras-plataformas.md`](./features/04-otras-plataformas.md)                                   | Estabilidad del núcleo y matriz de compatibilidad     | Futura (Etapa 3+)        |
| F-005 | Lectura de archivos Markdown (`.md`)                   | [`features/05-lectura-markdown.md`](./features/05-lectura-markdown.md)                                     | Renderer refluible, sanitización y locators textuales | ✅ Implementada          |
| F-006 | Preferencias de lectura por libro                      | [`features/12-preferencias-por-libro.md`](./features/12-preferencias-por-libro.md)                         | Overrides por libro y merge con preferencias globales | ⚠️ Infra lista, falta UI |
| F-007 | Resaltado de texto en PDF                              | —                                                                                                          | Deriva de geometría PDF a texto, anclaje por página   | Futura (horizonte)       |
| F-008 | Exportar e importar notas y resaltados como Markdown   | [`features/13-exportar-notas-highlights-markdown.md`](./features/13-exportar-notas-highlights-markdown.md) | Modelo de anotaciones, locators y exportación local   | ✅ Implementada          |
| F-009 | Skill de portabilidad a plataformas                    | [`features/06-skill-portabilidad-plataformas.md`](./features/06-skill-portabilidad-plataformas.md)         | Contratos de `reader-core` y matriz de plataformas    | ✅ Skill creado          |
| F-010 | Plugin de Obsidian                                     | [`features/18-plugin-obsidian.md`](./features/18-plugin-obsidian.md)                                       | F-001, Markdown estable, deep links y IDs estables    | Futura (Etapa 2)         |
| F-011 | IA sobre las notas de los libros                       | —                                                                                                          | Notas exportadas, formato abierto y control usuario   | Horizonte                |

## Priorización inicial

**Etapa 1 (actual) — Desktop:** F-001 sigue siendo la primera recomendable: puede comenzar como exportación/importación local sin cuentas (el corte acotado F-008 ya está implementado como precedente) y es además el contrato que habilita el Knowledge Core (exportar y editar el conocimiento fuera de la app). F-006 puede avanzar en paralelo porque reutiliza la tabla `book_preferences` y el merge global+libro ya implementados; lo que falta es la UI de escritura.

**Etapa 2 — Obsidian:** F-010 se activa cuando F-001 y Markdown sean estables; valida comunidad antes de asumir otra app completa.

**Etapa 3 — Android:** F-004 y la Fase 9 se retoman con el núcleo y los contratos de exportación maduros.

**Horizonte:** F-002 y F-003 esperan a validar el producto local, el modelo de datos y el valor real de la sincronización; F-011 (IA) parte de las notas ya exportadas y bajo control del usuario. F-007 (resaltado en PDF) requiere mapear regiones rectangulares a texto (`PDF.js` text layer) y no es alcanzable en el MVP de PDF como imagen (renderizado en canvas); por eso el widget de resaltado del MVP queda limitado a formatos con texto refluible (EPUB/MD).

## Regla de inclusión

Una capacidad solo puede marcarse como parte del MVP si funciona localmente, no requiere perfil ni servicio remoto y cumple los criterios de [`01-definicion-mvp.md`](./01-definicion-mvp.md). Si requiere cuenta, nube, suscripción, sincronización entre dispositivos o soporte adicional no validado, debe permanecer indexada aquí.
