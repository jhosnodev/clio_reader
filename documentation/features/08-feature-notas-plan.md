# Plan — Feature Notas (Fase 8, desktop)

## Objetivo

Cerrar la Fase 8 en Windows/desktop: notas funcionales y sin pérdida de datos,
integrando `@clio-reader/annotations` (filtrado/orden/búsqueda/export) y una vista
de anotaciones por libro con filtro y orden, según
`documentation/03-arquitectura-data-y-metadata.md` §6 y
`documentation/05-plan-implementacion.md` Fase 8.

## Estado

| Pieza | Antes | Ahora |
|-------|-------|-------|
| Dominio `Note` / `Bookmark` | ✅ | ✅ |
| CRUD de notas (`packages/library`) | ✅ | ✅ |
| Persistencia JSON + SQLite + FTS | ✅ | ✅ |
| Paquete `@clio-reader/annotations` | ❌ dead code | ✅ integrado en desktop |
| Notas dentro del reader (crear/borrar/listar por página) | ⚠️ WIP con bugs | ✅ sin bugs conocidos |
| Vista de anotaciones por libro (filtro + orden) | ❌ | ✅ `LibraryView` → "Notas" |
| Crear marcador desde el reader | ❌ stub | ❌ pendiente (fuera de notas) |
| Mobile (Android) | ❌ | ❌ fuera de alcance |

## Bugs corregidos

| Bug | Ubicación original | Fix |
|-----|--------------------|-----|
| **B1** Pérdida de notas: slot único `window.__pendingNote` + poll 1s. Guardar dos notas seguidas sobrescribía la primera; cerrar antes del poll perdía la nota; toast de éxito antes de persistir. | `ReaderView.tsx`, `reader-entry.ts` | Cola `window.__pendingNotes`; drain por ítem; ack `__noteSaved`/`__noteError`; flush antes de cerrar vía `will-navigate` (cancelable en `<webview>`) |
| **B2** Locator obsoleto: navegar por TOC no actualizaba `currentLocator`, así que no aparecían las notas de la página destino. | `reader-entry.ts` (click TOC) | Helper `syncLocator()` invocado tras TOC, prev/next, carga inicial y retry |
| **B3** Retry infinito: si `createNote` fallaba, `__pendingNote` nunca se limpiaba y reintentaba cada segundo en silencio. | `ReaderView.tsx` | El ítem se quita de la cola siempre (éxito o error); el error se muestra con `__noteError` |
| **B4** Error genérico `new Error(...)` en `updateNoteManaged`. | `packages/annotations/src/note-manager.ts` | Lanza `AnnotationValidationError` (field `body`) |

## Fases aplicadas

### Fase 1 — Bugs del reader

- Cola de guardado en el webview con `key` única por nota.
- Drain en el host con lock por promesa (`drainPromiseRef`) para evitar
  procesamiento duplicado y garantizar el flush al cerrar.
- `will-navigate` intercepta el botón atrás (`/`), drena pendientes y luego cierra.
- `did-navigate` queda como fallback con guarda `closeOnce`.
- Feedback: "Nota en cola" al encolar, "Nota guardada" al persistir, mensaje de
  error si falla.

### Fase 2 — Integración de `@clio-reader/annotations`

- `ReaderView.tsx` usa `createNoteManaged` / `listNotesManaged` / `removeNoteManaged`.
- Alias de resolución en `apps/desktop/tsconfig.json` y `apps/desktop/vite.config.ts`
  (mismo patrón que `@clio-reader/library`).
- Correcciones de tipos para `exactOptionalPropertyTypes` en `note-manager.ts`,
  `bookmark-manager.ts` y `annotation-export.ts`.

### Fase 3 — Vista de anotaciones por libro

- Nueva vista **"Notas"** en `LibraryView.tsx` (patrón de `BookmarksView`):
  - Filtro por libro (`<select>`).
  - Orden por fecha (recientes/antiguas) o por posición.
  - Muestra texto seleccionado, cuerpo, libro, posición y fecha.
  - Eliminar con `removeNoteManaged`.
- No se modificó `LibraryRepository` (no se agregó `listAllNotes`).

### Fase 4 — Validación

- `pnpm vitest run` — 341 tests pasan (incluye test nuevo de B4).
- `pnpm --filter @clio-reader/desktop check` — limpio.
- `pnpm --filter @clio-reader/desktop build` — OK.

## Decisiones

- **Duplicados de nota en el mismo locator: permitidos** (comportamiento actual,
  sin `DuplicateLocatorError` para notas).
- **Flush al cerrar** vía `will-navigate`; el cierre abrupto de toda la ventana
  (quit de la app) conserva la ventana de hasta 1s del poll como limitación conocida.
- **`selectedText`**: el contrato y la UI de la vista lo soportan; la captura de
  selección dentro del reader queda para una iteración posterior.

## Pendientes (fuera de este plan)

- Crear marcador desde el reader (`setupBookmark()` sigue siendo stub).
- `listAllNotes` global + vista de anotaciones de toda la biblioteca.
- Mobile (Android): integración completa.
- Highlights (existen en SQLite sin dominio ni UI).
- Export/import de anotaciones en la UI (el paquete ya lo implementa).

## Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `packages/annotations/src/note-manager.ts` | B4 + exactOptionalPropertyTypes |
| `packages/annotations/src/bookmark-manager.ts` | exactOptionalPropertyTypes |
| `packages/annotations/src/annotation-export.ts` | tipos de repo acotado |
| `packages/annotations/tests/note-manager.test.ts` | test de error tipado |
| `apps/desktop/src/components/ReaderView.tsx` | cola, drain, flush, managed |
| `apps/desktop/src/reader-entry.ts` | cola, syncLocator, ack/error |
| `apps/desktop/src/components/LibraryView.tsx` | vista Notas + fixes de tipo |
| `apps/desktop/src/themes.ts` | fix de tipo preexistente |
| `apps/desktop/tsconfig.json` / `vite.config.ts` | alias annotations |
