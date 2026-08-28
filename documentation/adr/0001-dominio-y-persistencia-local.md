# ADR-0001: Dominio y persistencia local de lectura

| Campo                             | Valor                                   |
| --------------------------------- | --------------------------------------- |
| **Nombre**                        | Dominio y persistencia local de lectura |
| **Autor**                         | Manus AI                                |
| **Fecha de creación**             | 28 de agosto de 2026                    |
| **Fecha de última actualización** | 28 de agosto de 2026                    |
| **Estado**                        | Aceptado para el MVP                    |
| **Versión del documento**         | 1.0.0                                   |

## Contexto

El MVP de echo_reader necesita guardar libros locales, última posición, preferencias, marcadores y notas sin perfiles ni conexión cloud. El dominio debe poder consumirse desde Windows y Android sin conocer la biblioteca concreta de almacenamiento ni el renderer de cada formato.

## Decisión

Se adopta un dominio TypeScript independiente en `@echo-reader/domain`, contratos de lectura en `@echo-reader/reader-core` y un repositorio local en `@echo-reader/storage`.

El dominio contiene entidades y validaciones puras. `ReaderFactory` registra adaptadores por formato y crea documentos mediante un contrato común. La persistencia se abstrae mediante `KeyValueStore`; la implementación inicial `InMemoryKeyValueStore` permite pruebas deterministas y sirve como doble de test mientras se conecta el almacenamiento nativo de cada plataforma.

El estado local se serializa como un documento versionado con libros, progreso, preferencias globales y por libro, marcadores y notas. `migrateState` normaliza la estructura y `CURRENT_SCHEMA_VERSION` permite añadir migraciones sin romper instalaciones existentes.

## Modelo mínimo

| Entidad             | Identidad         | Información principal                                                 |
| ------------------- | ----------------- | --------------------------------------------------------------------- |
| `Book`              | `id`              | Título, autor, formato, URI, hash opcional y estado de disponibilidad |
| `ReadingProgress`   | `bookId`          | Locator específico del formato, porcentaje y fecha de actualización   |
| `ReaderPreferences` | Global o `bookId` | Tema, colores, tipografía, escala, interlineado y márgenes            |
| `Bookmark`          | `id`              | Libro, locator, etiqueta opcional y fechas                            |
| `Note`              | `id`              | Libro, locator, texto seleccionado, cuerpo y fechas                   |

## Consecuencias positivas

La UI puede depender de casos de uso y contratos en lugar de APIs concretas. Los renderers EPUB, PDF, CBZ y Markdown futuros pueden implementar el mismo contrato. Los repositorios pueden sustituirse por almacenamiento nativo sin modificar las reglas de negocio. El esquema versionado facilita migraciones y una futura exportación `.echo.json`.

## Consecuencias y límites

La implementación actual no proporciona cifrado de datos locales, almacenamiento nativo, transacciones entre múltiples archivos ni sincronización. `InMemoryKeyValueStore` no debe usarse como persistencia de producción; la fase de cada plataforma deberá conectar un adaptador persistente y probar recuperación después de reinicio.

El locator es específico por formato. EPUB puede requerir CFI y contexto textual; PDF utiliza página y viewport; CBZ utiliza índice de imagen; Markdown utiliza offset, heading o contexto. Si el documento cambia, una posición puede quedar obsoleta y debe mostrarse como no resuelta.

## Pruebas asociadas

La decisión está cubierta por pruebas de dominio, de `ReaderFactory` y de `LocalRepository`. Las pruebas verifican validaciones, defaults, normalización de progreso, selección de adaptador, persistencia de última posición, separación de settings, aislamiento de anotaciones, eliminación en cascada y detección de JSON inválido.

## Alternativas consideradas

Una base de datos remota se descarta porque contradice el MVP offline y agrega perfiles, red y operación SaaS. Un estado global dentro de React se descarta porque acopla reglas de negocio al ciclo de vida de la UI. Persistir cada entidad en archivos independientes se deja para una evaluación posterior si el almacenamiento nativo requiere esa estrategia; por ahora un documento versionado permite arrancar con un contrato pequeño y migrable.
