# F-006: Preferencias de lectura por libro

| Campo                             | Valor                             |
| --------------------------------- | --------------------------------- |
| **Nombre**                        | Preferencias de lectura por libro |
| **Autor**                         | Manus AI                          |
| **Fecha de creación**             | 22 de septiembre de 2026          |
| **Fecha de última actualización** | 22 de septiembre de 2026          |
| **Estado**                        | Feature futura — fuera del MVP    |
| **Versión del documento**         | 1.0.0                             |

## Objetivo

Permitir que cada libro recuerde su propia configuración de lectura (tema, fuente, tamaño de letra, interlineado) con overrides que conviven con las preferencias globales de la app. Hoy el panel de ajustes del lector (webview) persiste **solo de forma global** (`reader_preferences`); este documento propone añadir la dimensión por libro reutilizando la infraestructura ya existente.

## Contexto y estado actual

Desde la corrección de persistencia de preferencias (2026-09-22), los cambios del panel "Ajustes de lectura" del reader se guardan globalmente vía `saveGlobalPreferences()`:

```text
webview (reader-entry.ts) ──sentinel "__clio_prefs__"──▶ ReaderView.tsx
    ──repository.saveGlobalPreferences()──▶ IPC ──▶ DrizzleRepository (reader_preferences, id=1)
```

La infraestructura **per-book ya existe y está probada**, pero no se usa desde la UI:

- Tabla SQLite `book_preferences` y columnas en `packages/storage/src/schema.ts` (tabla `bookPreferences`, líneas 59-75).
- `LibraryRepository.saveBookPreferences(bookId, partial)` — `packages/library/src/repository.ts:20-21`, implementada en `packages/storage/src/drizzle-repository.ts:183-218` y `packages/storage/src/index.ts:149-158`.
- Merge de lectura `{ ...global, ...bookOverrides }` — `apps/desktop/src/components/ReaderView.tsx` `loadPreferences()` (líneas 122-132).
- `SettingsManager` (`packages/reader-session/src/settings-manager.ts`) con `loadSettings`/`saveBookSettings` que validan el merge antes de persistir. Hoy no está conectado a ninguna app.

## Alcance propuesto

| Capacidad                                     | Prioridad        |
| --------------------------------------------- | ---------------- |
| Overrides por libro en el panel de ajustes    | Alta             |
| Selector libro / libro+mundo en cada ajuste   | Alta             |
| Restaurar ajustes exactos al reabrir un libro | Alta             |
| "Restablecer ajustes del libro"               | Media            |
| Aplicar ajustes de un libro a la biblioteca   | Media            |
| Sincronización cloud de preferencias          | Feature separada |

### Experiencia de usuario propuesta

Cada control del panel "Ajustes de lectura" gana un modo de alcance:

- **Libro** — el cambio se guarda como override en `book_preferences` y solo afecta al libro abierto.
- **Todos los libros** — el cambio se guarda además en `reader_preferences` (global) y se propaga a todos.

El merge de lectura es siempre `global` como base y `book_overrides` encima; el panel muestra el valor _efectivo_ (el del libro si existe, si no el global), con indicador visual si difiere del global ("ajuste propio del libro").

## Arquitectura

1. El webview envía el payload con el alcance elegido, p. ej. `{ theme: 'sepia', scope: 'book' }` ampliando el sentinel `__clio_prefs__` actual.
2. `ReaderView` orquesta según `scope`:
   - `'book'` → `repository.saveBookPreferences(bookId, { theme })`.
   - `'all'` → `repository.saveGlobalPreferences({ ...merged, theme })` (global requiere objeto completo; ver `drizzle-repository.ts:137`).
3. La validación de `validateReaderPreferences` se aplica sobre el merge `{ ...global, ...overrides }` antes de persistir (patrón ya usado en `saveBookPreferences`, `drizzle-repository.ts:187-189`).
4. Opcional: reutilizar `SettingsManager`/`SessionManager` conectándolos en la app como orquestador, para centralizar merge + validación (hoy es código sin usar).

## Casos límite

- **Libro sin overrides**: `getBookPreferences` devuelve `{}`; el resultado efectivo es exactamente el global (comportamiento actual).
- **Override parcial**: un libro guarda solo `lineHeight`; el resto sigue al global. `saveBookPreferences` acepta parcial y valida contra el global.
- **Reset**: "restablecer ajustes del libro" debe borrar la fila de `book_preferences` (o guardar `{}`), no volcar valores globales en el libro.
- **Default visible**: el panel debe reflejar el valor efectivo, no solo el global, para evitar que un override invisible confunda al usuario.

## Pruebas requeridas

- Unitarias: merge `{ ...global, ...book }`, sobreescribe solo las claves del override, `{}` cuando no hay override.
- Repositorio: `saveBookPreferences` upsert con parcial, validación contra global para evitar rangos inválidos, `getBookPreferences` tras reset.
- Integración: abrir libro → cambiar solo del libro → reabrir (efectivo = override); cambiar global → abrir libro sin overrides (efectivo = global); reset → vuelve al global.
- UI manual: indicador de "ajuste del libro", independencia entre libros, coexistencia con el modo global actual.

## Criterios de aceptación

El usuario puede configurar un libro con apariencia distinta al resto de la biblioteca y esa apariencia se conserva entre sesiones. Cambiar la config global no altera los libros con overrides propios. La feature no rompe el modo actual (solo global) y la migración de datos existentes no es necesaria: la tabla `book_preferences` ya existe en el esquema v3.
