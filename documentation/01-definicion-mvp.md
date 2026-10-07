# Definición del proyecto como MVP

| Campo                             | Valor                                 |
| --------------------------------- | ------------------------------------- |
| **Nombre**                        | clio_reader — MVP de biblioteca local |
| **Autor**                         | Manus AI                              |
| **Fecha de creación**             | 28 de agosto de 2026                  |
| **Fecha de última actualización** | 28 de agosto de 2026                  |
| **Estado**                        | Propuesta aprobada para planificación |
| **Versión del documento**         | 1.0.0                                 |

## 1. Propósito

clio_reader será una aplicación multiplataforma para organizar y leer localmente libros, cómics y documentos de texto en formatos EPUB, PDF, CBZ y Markdown. El MVP se orienta primero a **Windows y Android**. iOS se mantiene como objetivo posterior, pero no condiciona el primer lanzamiento.

La aplicación no tendrá perfiles, autenticación, backend, sincronización ni dependencia de red. El usuario podrá agregar tantos documentos como permita el almacenamiento disponible del dispositivo, administrarlos en una biblioteca local y reanudar la lectura desde la última posición guardada.

## 2. Alcance funcional

| Capacidad    | Alcance del MVP                                                    |
| ------------ | ------------------------------------------------------------------ |
| Biblioteca   | Importar, listar, abrir y eliminar libros locales                  |
| Formatos     | EPUB, PDF, CBZ y Markdown                                          |
| Lectura      | Navegación, progreso y reanudación                                 |
| Preferencias | Tema, colores, tamaño de letra y controles aplicables al formato   |
| Anotaciones  | Marcadores y notas locales asociados a una posición                |
| Plataformas  | Windows y Android como prioridad; iOS posterior                    |
| Operación    | Funcionalidad offline y datos almacenados localmente               |
| Exportación  | No es requisito del primer corte; se documenta como feature futura |

## 3. Fuera del MVP

Quedan fuera perfiles, cuentas, permisos multiusuario, nube, sincronización, suscripciones SaaS, pagos, tienda, DRM, CBR/RAR, colaboración, estadísticas sociales, OCR y lectura en voz alta. Estas capacidades no deben incorporarse indirectamente mediante un backend temporal.

## 4. Principios del producto

El producto debe ser **local-first**, predecible y reversible. La lectura debe continuar sin conexión; los datos deben poder migrarse mediante versiones de esquema; y las decisiones de plataforma deben quedar aisladas detrás de interfaces. El límite de libros será técnico —espacio disponible, memoria y rendimiento—, no una cuota artificial del producto.

## 5. Criterios de aceptación

El MVP será aceptable cuando el usuario pueda importar al menos un archivo válido de cada formato en Windows y Android, abrirlo, navegar, cerrar la aplicación y reanudar cerca de la última posición. También debe poder cambiar preferencias, crear/listar/eliminar marcadores y crear/editar/listar/eliminar notas. Los errores de archivos corruptos, permisos o formatos no soportados deben ser recuperables y no dejar inutilizada la biblioteca.

## 6. Roadmap resumido

El orden recomendado es: base de plataforma; dominio y almacenamiento local; renderer CBZ; renderer PDF; renderer EPUB; progreso, preferencias y anotaciones; rendimiento y calidad Windows/Android; preparación iOS; y, posteriormente, exportación e interoperabilidad.

## 7. Documentación relacionada

La arquitectura técnica está en [`02-arquitectura-tecnica.md`](./02-arquitectura-tecnica.md). El almacenamiento y modelo de datos están en [`03-arquitectura-data-y-metadata.md`](./03-arquitectura-data-y-metadata.md). El inventario de trabajo futuro está en [`04-features-futuros.md`](./04-features-futuros.md), con detalles en la carpeta [`features/`](./features/).
