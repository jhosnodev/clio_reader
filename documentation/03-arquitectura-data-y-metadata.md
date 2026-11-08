# Arquitectura de data y metadata local

| Campo                             | Valor                                            |
| --------------------------------- | ------------------------------------------------ |
| **Nombre**                        | clio_reader — Data, metadata y estado de lectura |
| **Autor**                         | Manus AI                                         |
| **Fecha de creación**             | 28 de agosto de 2026                             |
| **Fecha de última actualización** | 7 de noviembre de 2026                           |
| **Estado**                        | Implementada (en uso)                            |
| **Versión del documento**         | 1.0.0                                            |

## 1. Principio local-first

El MVP no tendrá backend, cuentas, perfiles ni sincronización. Los libros, metadatos extraídos, settings, progreso, marcadores y notas vivirán en el dispositivo. La cantidad de libros no tendrá una cuota artificial; el límite será el almacenamiento, el rendimiento y la memoria disponibles.

## 2. Separación de datos

| Grupo              | Ejemplos                                               | Persistencia                                                          |
| ------------------ | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Metadata del libro | Título, autor, portada, idioma, formato, tamaño y hash | Tabla `books`                                                         |
| Data de lectura    | Última posición, porcentaje, zoom y desplazamiento     | Tabla `reading_progress`                                              |
| Preferencias       | Tema, colores, fuente, escala, márgenes y dirección    | Tablas `reader_preferences` (global) y `book_preferences` (por libro) |
| Anotaciones        | Marcadores, notas, resaltados y texto seleccionado     | Tablas `bookmarks`, `notes` y `highlights`                            |
| Estado técnico     | Versión de esquema, paleta activa y modo               | Tabla `user_settings` (esquema versionado en la app)                  |
| Archivo físico     | EPUB, PDF, CBZ o Markdown importado                    | Directorio gestionado por la aplicación                               |

Búsquedas de texto en notas y resaltados se indexan en las tablas virtuales FTS5 `notes_fts` y `highlights_fts`.

## 3. Modelo mínimo

```ts
interface Book {
  id: string;
  uri: string;
  title: string;
  author?: string;
  format: 'epub' | 'pdf' | 'cbz' | 'md';
  fileHash?: string;
  addedAt: number;
  lastOpenedAt?: number;
}

interface ReadingProgress {
  bookId: string;
  locator: ReaderLocator;
  percent: number;
  updatedAt: number;
}

interface ReaderPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'custom';
  backgroundColor?: string;
  foregroundColor?: string;
  fontFamily: 'system' | 'serif' | 'sans' | 'dyslexic';
  fontScale: number;
  lineHeight: number;
  margin: number;
  readingDirection: 'ltr' | 'rtl';
}

interface Bookmark {
  id: string;
  bookId: string;
  locator: ReaderLocator;
  label?: string;
  createdAt: number;
}

interface Note {
  id: string;
  bookId: string;
  locator: ReaderLocator;
  selectedText?: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}
```

## 4. Locators

La última posición debe almacenarse como un locator específico del formato y no únicamente como porcentaje. EPUB puede usar CFI o capítulo + posición; PDF puede usar página, zoom y viewport; CBZ puede usar índice de imagen, escala y desplazamiento; Markdown puede usar href o offset de línea. `percent` sirve para la biblioteca, mientras que `locator` es la fuente de verdad para reanudar.

El renderer emitirá cambios significativos y el repositorio guardará con debounce. También se debe guardar al cerrar el libro y al pasar la aplicación a segundo plano. Si un locator deja de existir, el adaptador intentará recuperar la página o capítulo más cercano.

## 5. Settings

Los settings globales se cargan al iniciar y se aplican antes de mostrar el lector. Los settings por libro pueden sobrescribir tamaño de letra, fuente, márgenes o dirección. Cada escritura debe validar rangos y colores, y guardar `schemaVersion` (actualmente `CURRENT_SCHEMA_VERSION = 3`) para futuras migraciones.

## 6. Marcadores, notas e índices

Un marcador apunta a una posición y puede tener una etiqueta. Una nota apunta a una posición y conserva el texto escrito y, opcionalmente, el texto seleccionado. La vista de anotaciones se filtra por `bookId` y permite ordenar por posición o fecha.

Los índices técnicos recomendados son `(bookId, locator)`, `(bookId, positionOrder)` y `(bookId, updatedAt)`. Para EPUB, `positionOrder` debe ser calculado por el adaptador porque un locator complejo no siempre se ordena correctamente como texto.

## 7. Ciclo de vida y migraciones

Los datos deben guardarse mediante repositorios y transacciones. Cada instalación debe registrar una versión de esquema. Si el usuario elimina los datos de la aplicación, el MVP no promete recuperación; una exportación/importación local puede añadirse antes de la nube como mecanismo de respaldo.

## 8. Futuro SaaS

La arquitectura debe mantener interfaces como `BookRepository`, `ProgressRepository`, `SettingsRepository` y `AnnotationRepository`. En una fase SaaS se podrán añadir implementaciones remotas, conflictos y sincronización sin cambiar el modelo de la pantalla de lectura. Esa infraestructura queda fuera del MVP.
