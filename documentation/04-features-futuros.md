# Features futuros

| Campo                             | Valor                                    |
| --------------------------------- | ---------------------------------------- |
| **Nombre**                        | clio_reader — Índice de features futuros |
| **Autor**                         | Manus AI                                 |
| **Fecha de creación**             | 28 de agosto de 2026                     |
| **Fecha de última actualización** | 13 de octubre de 2026                    |
| **Estado**                        | Backlog arquitectónico                   |
| **Versión del documento**         | 1.0.0                                    |

## Propósito

Este documento indexa las capacidades que están fuera del MVP de biblioteca local. El MVP prioriza Windows y Android, funciona offline y no incluye perfiles, cuentas, backend ni sincronización. Cada feature futura tendrá su propio documento en [`features/`](./features/).

## Índice de features fuera del MVP

| ID    | Feature                                                | Documento                                                                                                  | Dependencias                                          |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| F-001 | Compartir y exportar metadata/data con otros elementos | [`features/01-compartir-metadata-data.md`](./features/01-compartir-metadata-data.md)                       | Modelo de anotaciones, locators y exportación local   |
| F-002 | Sincronización con la nube                             | [`features/02-sincronizacion-nube.md`](./features/02-sincronizacion-nube.md)                               | Identidad, API, conflictos y almacenamiento remoto    |
| F-003 | Arquitectura SaaS                                      | [`features/03-arquitectura-saas.md`](./features/03-arquitectura-saas.md)                                   | Nube, usuarios, billing, observabilidad y seguridad   |
| F-004 | Soporte para otras plataformas                         | [`features/04-otras-plataformas.md`](./features/04-otras-plataformas.md)                                   | Estabilidad del núcleo y matriz de compatibilidad     |
| F-005 | Lectura de archivos Markdown (`.md`)                   | [`features/05-lectura-markdown.md`](./features/05-lectura-markdown.md)                                     | Renderer refluible, sanitización y locators textuales |
| F-006 | Preferencias de lectura por libro                      | [`features/12-preferencias-por-libro.md`](./features/12-preferencias-por-libro.md)                         | Overrides por libro y merge con preferencias globales |
| F-007 | Resaltado de texto en PDF                              | —                                                                                                          | Deriva de geometría PDF a texto, anclaje por página   |
| F-008 | Exportar e importar notas y resaltados como Markdown   | [`features/13-exportar-notas-highlights-markdown.md`](./features/13-exportar-notas-highlights-markdown.md) | Modelo de anotaciones, locators y exportación local   |

## Priorización inicial

La primera feature recomendable es F-001 porque puede comenzar como exportación/importación local sin cuentas. F-005 puede avanzar antes de la nube porque reutiliza el renderer refluible y el modelo local de EPUB. F-004 puede avanzar en paralelo mediante spikes de iOS y otros escritorios. F-002 y F-003 deben esperar hasta validar el producto local, el modelo de datos y el valor de la sincronización. F-006 puede avanzar en paralelo porque reutiliza la tabla `book_preferences` y el merge global+libro ya implementados, sin depender de nube ni de otros formatos. F-007 (resaltado en PDF) requiere mapear regiones rectangulares a texto (`PDF.js` text layer) y no es alcanzable en el MVP de PDF como imagen (renderizado en canvas); por eso el widget de resaltado del MVP queda limitado a formatos con texto refluible (EPUB/MD). F-008 es un corte acotado de F-001 (solo notas y resaltados de un libro, en Markdown) y puede avanzar primero porque reutiliza `@clio-reader/annotations` sin requerir el paquete de exportación completo.

## Regla de inclusión

Una capacidad solo puede marcarse como parte del MVP si funciona localmente, no requiere perfil ni servicio remoto y cumple los criterios de [`01-definicion-mvp.md`](./01-definicion-mvp.md). Si requiere cuenta, nube, suscripción, sincronización entre dispositivos o soporte adicional no validado, debe permanecer indexada aquí.
