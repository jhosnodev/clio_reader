# Plan — Feature Notas (Fase 8, desktop)

## Objetivo

Cerrar la Fase 8 en Windows/desktop: notas funcionales y sin pérdida de datos,
integrando `@clio-reader/annotations` (filtrado/orden/búsqueda/export) y una vista
de anotaciones por libro con filtro y orden, según
`documentation/03-arquitectura-data-y-metadata.md` §6 y
`documentation/05-plan-implementacion.md` Fase 8.

## Estado

| Pieza                                                           | Antes             | Ahora                                   |
| --------------------------------------------------------------- | ----------------- | --------------------------------------- |
| Dominio `Note` / `Bookmark`                                     | ✅                | ✅                                      |
| CRUD de notas (`packages/library`)                              | ✅                | ✅                                      |
| Persistencia JSON + SQLite + FTS                                | ✅                | ✅                                      |
| Paquete `@clio-reader/annotations`                              | ❌ dead code      | ✅ integrado en desktop                 |
| Notas dentro del reader (crear/editar/borrar/listar por página) | ⚠️ WIP con bugs   | ✅ sin bugs conocidos                   |
| Vista de anotaciones por libro (filtro + orden)                 | ❌                | ✅ `LibraryView` → "Notas y resaltados" |
| Highlights (dominio + SQLite)                                   | ⚠️ sin dominio/UI | ✅ desktop EPUB/MD (widget + vista)     |
| Resaltado en PDF                                                | ❌                | ❌ feature futura (F-007)               |
| Crear marcador desde el reader                                  | ❌ stub           | ❌ pendiente (fuera de notas)           |
| Mobile (Android)                                                | ❌                | ❌ fuera de alcance                     |

## Bugs corregidos

| Bug                                                                                                                                                                                                | Ubicación original                         | Fix                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** Pérdida de notas: slot único `window.__pendingNote` + poll 1s. Guardar dos notas seguidas sobrescribía la primera; cerrar antes del poll perdía la nota; toast de éxito antes de persistir. | `ReaderView.tsx`, `reader-entry.ts`        | Cola `window.__pendingNotes`; drain por ítem; ack `__noteSaved`/`__noteError`; flush antes de cerrar vía `will-navigate` (cancelable en `<webview>`) |
| **B2** Locator obsoleto: navegar por TOC no actualizaba `currentLocator`, así que no aparecían las notas de la página destino.                                                                     | `reader-entry.ts` (click TOC)              | Helper `syncLocator()` invocado tras TOC, prev/next, carga inicial y retry                                                                           |
| **B3** Retry infinito: si `createNote` fallaba, `__pendingNote` nunca se limpiaba y reintentaba cada segundo en silencio.                                                                          | `ReaderView.tsx`                           | El ítem se quita de la cola siempre (éxito o error); el error se muestra con `__noteError`                                                           |
| **B4** Error genérico `new Error(...)` en `updateNoteManaged`.                                                                                                                                     | `packages/annotations/src/note-manager.ts` | Lanza `AnnotationValidationError` (field `body`)                                                                                                     |

## Fases aplicadas

### Fase 1 — Bugs del reader

- Cola de guardado en el webview con `key` única por nota.
- Drain en el host con lock por promesa (`drainPromiseRef`) para evitar
  procesamiento duplicado y garantizar el flush al cerrar.
- `console-message` sentinel (`__clio_back__`) para cerrar el lector sin
  navegar a `/` (evita el bug del webview cargando la app completa sin
  `electronAPI` → biblioteca vacía + import roto).
- `will-navigate` / `did-navigate` como fallback sin gating (Electron
  `<webview>` no soporta `preventDefault` en `will-navigate`).
- Feedback: "Nota en cola" al encolar, "Nota guardada" al persistir, mensaje de
  error si falla.

### Fase 1b — Editar notas

- Botón de editar (lápiz) en cada nota de la lista, junto al botón de eliminar.
- Al hacer clic, el textarea se popular con el body existente y el botón
  "Guardar" cambia a "Actualizar".
- Cola `window.__pendingNoteUpdates` con `{ key, noteId, body }`.
- `drainNotes` procesa la cola de updates vía `updateNoteManaged`.
- `editingNoteId` (closure en `setupNotes`) controla el modo edición;
  se limpia al guardar o al cambiar de locator.

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

- `pnpm vitest run` — 341 tests pasaban en esa ronda (incluye el test nuevo de B4).
- `pnpm --filter @clio-reader/desktop check` — limpio.
- `pnpm --filter @clio-reader/desktop build` — OK.

## Decisiones

- **Duplicados de nota en el mismo locator: permitidos** (comportamiento actual,
  sin `DuplicateLocatorError` para notas).
- **Flush al cerrar** vía `console-message` sentinel; `will-navigate`/`did-navigate`
  quedan como fallback sin gating (Electron `<webview>` no soporta `preventDefault`).
- **`selectedText`**: el contrato y la UI lo soportan; la captura de
  selección dentro del reader queda para una iteración posterior.

## Pendientes (fuera de este plan)

- Crear marcador desde el reader (`setupBookmark()` sigue siendo stub).
- `listAllNotes` global + vista de anotaciones de toda la biblioteca.
- Mobile (Android): integración completa.
- ~~Export/import de anotaciones en la UI~~ → ✅ hecho (`NotesExportDialog.tsx`,
  ver `13-exportar-notas-highlights-markdown.md`).

## Fase 6 — Highlights en desktop (EPUB/MD)

Resaltado de texto con el widget flotante de colores; los resaltados se listan
junto a las notas en `LibraryView` → "Notas y resaltados".

### Modelo

| Pieza           | Cambio                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Paleta fija     | `packages/annotations/src/highlight-colors.ts` — 6 colores (yellow/green/blue/pink/orange/purple) y registro CSS `clio-hl-<key>` |
| `Highlight`     | Ya existía en dominio y SQLite; ahora tiene UI y managers (`highlight-manager.ts`)                                               |
| Anclaje a texto | Mismo patrón que notas: `locatorStart/locatorEnd` con `anchor {start,end}` + `selectedText`                                      |
| Formato         | Solo EPUB y MD (texto refluible); el widget oculta colores para PDF y CBZ                                                        |

### Widget flotante (reader)

- Al seleccionar texto, un popover sobre la selección muestra 6 colores, nota y eliminar.
- Pintar / eliminar / recolorar son operaciones optimistas en cola
  (`__pendingHighlights` / `__pendingHighlightDeletes`) que se drenan con ack
  (`__highlightSaved` / `__highlightError`) igual que las notas.
- Recolorar = delete + create con el nuevo color.
- El pintado usa CSS Custom Highlight API:
  `paintHighlightRanges` / `clearHighlightRanges` en `reader-text-anchor.ts`
  y reglas `::highlight(clio-hl-*)` en `reader.css`, sin mutar el DOM del EPUB.

### Vista de anotaciones

- `LibraryView` → "Notas y resaltados": merge notas + highlights con orden por
  fecha o por posición (clave `progression/positionOrder/page * 1_000_000 + anchor.start`).
- Cada resaltado muestra un swatch con su color, la cita (`selectedText`) y metadatos.
- Eliminar con `removeHighlightManaged`; clic abre el libro en el locator.

### Tests

- `packages/annotations/tests/highlight-manager.test.ts` (CRUD gestionado).
- `annotation-validator.test.ts` (+validación de highlight).
- `reader-text-anchor.test.ts` (+pintado/limpieza de rangos).
- `reader-entry-order.test.ts` (+fuentes de highlights en init).
- Suite completa: 610 tests pasan (7-nov-2026, `pnpm validate`).

## Fase 5 — Notas ancladas al texto seleccionado

Las notas dejaron de ser "de página": ahora se atan al fragmento de texto que el
usuario seleccionó.

### Modelo

| Pieza                | Cambio                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `TextAnchor`         | Nuevo tipo en `packages/domain` (`start`, `end`, `prefix`, `suffix`)                      |
| `EpubLocator.anchor` | Offset del texto seleccionado en el texto plano del capítulo (+ `MarkdownLocator.anchor`) |
| `Note.selectedText`  | Ya existía en dominio y en SQLite (`notes.selected_text`); ahora el reader lo rellena     |
| Sin migración        | El ancla viaja dentro de `notes.locator_data` (JSON) y la cita en la columna existente    |

### Re-anclaje (`packages/reader-core/src/text-anchor.ts`)

1. **exact**: los offsets siguen apuntando a la cita.
2. **recovered**: el texto se desplazó → se busca la cita tolerando espaciado; si se
   repite, el contexto (`prefix`/`suffix`, 32 caracteres) desambigua.
3. **missing**: la cita ya no existe → la UI avisa y se queda en el capítulo.

### UI (reader)

- `selectionchange` (con debounce de 150 ms) → abre el panel de notas con la cita
  en un bloque con botón para quitar la selección.
- `Ctrl/Cmd+Enter` guarda la nota; sin selección sigue siendo nota de página.
- Resaltado del texto anotado con CSS Custom Highlight API (`::highlight(clio-note)`),
  sin mutar el DOM del EPUB.
- Clic en una nota → salta al ancla; desde la biblioteca se abre el libro en el texto.
- Toast "Nota reubicada" cuando el texto se movió, "No se encontró el texto" si falló.

## Archivos tocados

| Archivo                                           | Cambio                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `packages/annotations/src/note-manager.ts`        | B4 + exactOptionalPropertyTypes                       |
| `packages/annotations/src/bookmark-manager.ts`    | exactOptionalPropertyTypes                            |
| `packages/annotations/src/annotation-export.ts`   | tipos de repo acotado                                 |
| `packages/annotations/tests/note-manager.test.ts` | test de error tipado                                  |
| `apps/desktop/src/components/ReaderView.tsx`      | cola, drain, flush, managed, updates, sentinel        |
| `apps/desktop/src/reader-entry.ts`                | cola, syncLocator, ack/error, edit button, edit queue |
| `apps/desktop/src/reader.css`                     | .note-actions, .note-edit                             |
| `apps/desktop/src/components/LibraryView.tsx`     | vista Notas + fixes de tipo                           |
| `apps/desktop/src/themes.ts`                      | fix de tipo preexistente                              |
| `apps/desktop/tsconfig.json` / `vite.config.ts`   | alias annotations                                     |

### Fase 5 (anclaje a texto)

| Archivo                                             | Cambio                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/domain/src/index.ts`                      | `TextAnchor` + `anchor` en `EpubLocator`/`MarkdownLocator`              |
| `packages/reader-core/src/text-anchor.ts`           | helpers puros: `buildTextAnchor`, `resolveTextAnchor`, `normalizeQuote` |
| `packages/reader-core/tests/text-anchor.test.ts`    | exact / recovered / missing / citas repetidas                           |
| `packages/annotations/src/annotation-validator.ts`  | validación de `locator.anchor`                                          |
| `apps/desktop/src/reader-text-anchor.ts`            | Range ↔ offsets, índice de texto del capítulo, CSS Highlights           |
| `apps/desktop/src/reader-entry.ts`                  | captura de selección, cita previa, salto a la nota, resaltado           |
| `apps/desktop/src/components/ReaderView.tsx`        | propaga `selectedText` webview ↔ host                                   |
| `apps/desktop/reader.html` / `src/reader.css`       | bloque de cita + estilos de nota anclada                                |
| `packages/storage/tests/drizzle-repository.test.ts` | round-trip de `anchor` + `selected_text`                                |
