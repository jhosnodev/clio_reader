# Definición del proyecto como MVP

| Campo                             | Valor                                 |
| --------------------------------- | ------------------------------------- |
| **Nombre**                        | clio_reader — MVP de biblioteca local |
| **Autor**                         | Manus AI                              |
| **Fecha de creación**             | 28 de agosto de 2026                  |
| **Fecha de última actualización** | 10 de noviembre de 2026               |
| **Estado**                        | En ejecución                          |
| **Versión del documento**         | 1.2.0                                 |

## 1. Propósito

clio_reader será una aplicación para organizar y leer localmente libros, cómics y documentos de texto en formatos EPUB, PDF, CBZ y Markdown. El MVP se orienta a **Desktop (Windows y Linux)**, como primera etapa del ecosistema descrito en [`00-vision-roadmap.md`](./00-vision-roadmap.md). Android queda para la Etapa 3 y iOS es un objetivo posterior; ninguno condiciona el primer lanzamiento.

La aplicación no tendrá perfiles, autenticación, backend, sincronización ni dependencia de red. El usuario podrá agregar tantos documentos como permita el almacenamiento disponible del dispositivo, administrarlos en una biblioteca local y reanudar la lectura desde la última posición guardada.

## 2. Alcance funcional

| Capacidad    | Alcance del MVP                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biblioteca   | Importar, listar, abrir y eliminar libros locales                                                                                                              |
| Formatos     | EPUB, PDF, CBZ y Markdown                                                                                                                                      |
| Lectura      | Navegación, progreso y reanudación                                                                                                                             |
| Preferencias | Tema, colores, tamaño de letra y controles aplicables al formato                                                                                               |
| Anotaciones  | Marcadores y notas locales asociados a una posición                                                                                                            |
| Plataformas  | Desktop (Windows y Linux) como prioridad; Android Etapa 3; iOS posterior                                                                                       |
| Operación    | Funcionalidad offline y datos almacenados localmente                                                                                                           |
| Exportación  | Exportar/importar anotaciones por libro en Markdown ya está disponible localmente; el formato completo `.echo.json`/metadata sigue como feature futura (F-001) |

## 3. Fuera del MVP

Quedan fuera perfiles, cuentas, permisos multiusuario, nube, sincronización, suscripciones SaaS, pagos, tienda, DRM, CBR/RAR, colaboración, estadísticas sociales, OCR y lectura en voz alta. Estas capacidades no deben incorporarse indirectamente mediante un backend temporal.

El plugin de Obsidian (F-010, Etapa 2) y Android (Etapa 3) también quedan fuera del MVP, aunque estén indexados como etapas siguientes del roadmap.

## 4. Principios del producto

El producto debe ser **local-first**, predecible y reversible. La lectura debe continuar sin conexión; los datos deben poder migrarse mediante versiones de esquema; y las decisiones de plataforma deben quedar aisladas detrás de interfaces. El límite de libros será técnico —espacio disponible, memoria y rendimiento—, no una cuota artificial del producto.

## 5. Criterios de aceptación

El MVP será aceptable cuando el usuario pueda importar al menos un archivo válido de cada formato en Desktop (Windows o Linux), abrirlo, navegar, cerrar la aplicación y reanudar cerca de la última posición. También debe poder cambiar preferencias, crear/listar/eliminar marcadores y crear/editar/listar/eliminar notas. Los errores de archivos corruptos, permisos o formatos no soportados deben ser recuperables y no dejar inutilizada la biblioteca.

**Criterio de salida de la Etapa 1** (ver [`00-vision-roadmap.md`](./00-vision-roadmap.md)): una persona puede instalarlo, importar sus libros, leer, anotar, exportar y recuperar su conocimiento sin depender de servicios externos.

## 6. Roadmap resumido

El orden es **Desktop → Plugin de Obsidian → Android**, definido en [`00-vision-roadmap.md`](./00-vision-roadmap.md):

1. **Etapa 1 — Desktop (MVP y consolidación):** base de plataforma, dominio y almacenamiento local, renderers, progreso y anotaciones, UX/rendimiento, distribución; y como cierre, la exportación completa de metadata/conocimiento (F-001). El corte acotado de notas/resaltados a Markdown (F-008) ya está implementado.
2. **Etapa 2 — Plugin de Obsidian (F-010):** notas y resaltados en el vault, deep links, preservación de IDs y detección de conflictos.
3. **Etapa 3 — Android:** la base de la Fase 9 queda construida y se retoma cuando el dominio y los contratos de exportación estén maduros.

## 7. Documentación relacionada

La visión y el orden de etapas están en [`00-vision-roadmap.md`](./00-vision-roadmap.md). La arquitectura técnica está en [`02-arquitectura-tecnica.md`](./02-arquitectura-tecnica.md). El almacenamiento y modelo de datos están en [`03-arquitectura-data-y-metadata.md`](./03-arquitectura-data-y-metadata.md). El inventario de trabajo futuro está en [`04-features-futuros.md`](./04-features-futuros.md), con detalles en la carpeta [`features/`](./features/).
