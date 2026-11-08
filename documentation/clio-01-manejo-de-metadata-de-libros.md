# Plan: Manejo de Metadata de Libros

## Objetivo

Corregir y completar la metadata que se muestra en los cards de libros: título real del EPUB, autor real, portada real, rank/rating interactivo, y progreso de lectura desde la DB.

## Estado Actual

| Campo                 | Estado                                 | Acción                   |
| --------------------- | -------------------------------------- | ------------------------ |
| Tag estatus           | ✅ `Book.readingStatus`                | Ninguna                  |
| Porcentaje de lectura | ✅ `ReadingProgress.percent`           | Consultar DB en BookCard |
| Ruta archivo          | ✅ `Book.uri`                          | Ninguna                  |
| Marcadores            | ✅ `Bookmark[]` CRUD completo          | Ninguna                  |
| Notas                 | ✅ `Note[]` CRUD completo              | Ninguna                  |
| Última fecha apertura | ✅ `Book.lastOpenedAt`                 | Ninguna                  |
| Fecha agregado        | ✅ `Book.addedAt`                      | Ninguna                  |
| **Rank (rating)**     | ✅ `Book.rank` (0–5, 0.5)              | Ninguna (hecho)          |
| **Cover image**       | ✅ `Book.coverImage` (data URI)        | Ninguna (hecho)          |
| **Título real EPUB**  | ✅ Extraído del OPF (`epub-parser.ts`) | Ninguna (hecho)          |
| **Autor real EPUB**   | ✅ Extraído del OPF (`epub-parser.ts`) | Ninguna (hecho)          |

## Decisiones de Diseño

- **Rank**: 0-5 estrellas con incrementos de 0.5 (estilo Goodreads)
- **Cover image**: Base64 data URI en el JSON del state (v1). Documentar optimización futura a archivos separados.
- **Progreso**: No denormalizar en `Book`. Consultar `ReadingProgress.percent` desde el repository.
- **UI Rank**: Solo en card de biblioteca (click directo)
- **UI Progress**: Barra visual + porcentaje numérico

---

## Fase 1: Modelo de Dominio

**Archivo:** `packages/domain/src/index.ts`

### Cambios:

1. Agregar tipo `Rank`:

```typescript
export type Rank = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;
```

2. Agregar campos a la interfaz `Book`:

```typescript
readonly rank?: Rank;
readonly coverImage?: string; // base64 data URI
```

3. Agregar función `normalizeRank()`:

```typescript
export function normalizeRank(rank: number): Rank {
  const clamped = Math.min(5, Math.max(0, rank));
  return (Math.round(clamped * 2) / 2) as Rank;
}
```

4. Actualizar `createBook()` para aceptar los nuevos campos opcionales.

---

## Fase 2: Parser EPUB - Extraer Cover Image

**Archivo:** `packages/reader-epub/src/epub-parser.ts`

### Cambios:

1. Agregar a `OpfMetadata`:

```typescript
readonly coverImageId?: string;
```

2. En `parseMetadata()`, extraer cover image ID de:
   - `<meta name="cover" content="..."/>` (EPUB 2)
   - Item con `properties="cover-image"` del manifest (EPUB 3)

3. Agregar función `extractCoverImage()`:

```typescript
export async function extractCoverImage(
  data: Uint8Array,
  parsed: ParsedEpub,
): Promise<{ data: Uint8Array; mimeType: string } | null>;
```

---

## Fase 3: Importación con Metadata Real

**Archivo:** `packages/library/src/import-book.ts`

### Cambios:

1. `ImportBookInput.title` y `.author` ahora opcionales
2. Agregar campos:

```typescript
readonly rank?: Rank;
readonly coverImage?: string;
```

**Archivo:** `apps/desktop/src/App.tsx`

### Cambios:

1. En `handleImportBook()`, si el formato es EPUB:
   - Leer el archivo como `Uint8Array`
   - Llamar `parseEpub()` para obtener metadata del OPF
   - Llamar `extractCoverImage()` para obtener la portada
   - Convertir cover a base64 data URI
   - Usar title/author reales del OPF (fallback a filename)
2. Pasar metadata completa a `importBook()`

---

## Fase 4: Storage - Migración de Schema

**Archivo:** `packages/storage/src/index.ts`

### Cambios:

1. Incrementar `CURRENT_SCHEMA_VERSION` a `2`
2. En `migrateState()`, manejar books que no tengan los campos nuevos:
   - `rank` → `undefined`
   - `coverImage` → `undefined`

---

## Fase 5: UI Desktop - BookCard

**Archivo:** `apps/desktop/src/components/LibraryView.tsx`

### Cambios:

1. **Cover image**: En `BookCard`, si `book.coverImage` existe, renderizar `<img src={book.coverImage}>` con `object-fit: cover`. Fallback al gradiente placeholder actual.

2. **Rank interactivo**: Reemplazar estrellas decorativas (líneas 709-715) con componente que:
   - Muestra medias estrellas (SVG con clip-path para medias estrellas)
   - Hover preview del rating
   - Click guarda el rank en el Book vía `upsertBook()`

3. **Progress real**: En la barra de progreso del cover (línea 684):
   - Consultar `getProgress(book.id)` del repository
   - Usar `progress.percent` en vez de `38%` hardcodeado
   - Mostrar porcentaje numérico al lado de la barra

---

## Fase 6: UI Mobile - BookCard

**Archivo:** `apps/mobile/src/components/BookCard.tsx`

### Cambios:

Mismos cambios que desktop:

- Cover image real con fallback a placeholder
- Rank interactivo con medias estrellas
- Progress real desde DB

---

## Fase 7: Documentación de Optimización Futura

**Archivo:** `documentation/features/cover-image-optimization.md`

Documentar:

- Por qué se usó base64 en v1
- Cuándo migrar a archivos separados (umbral de ~100 libros)
- Cómo hacer la migración (guardar base64 como archivo, actualizar path)
- Impacto en rendimiento por número de libros

---

## Archivos a Modificar

| #   | Archivo                                       | Cambios                               |
| --- | --------------------------------------------- | ------------------------------------- |
| 1   | `packages/domain/src/index.ts`                | Tipo Rank, campos Book, normalizeRank |
| 2   | `packages/reader-epub/src/epub-parser.ts`     | Cover image extraction                |
| 3   | `packages/library/src/import-book.ts`         | ImportBookInput actualizado           |
| 4   | `apps/desktop/src/App.tsx`                    | Importar metadata real del EPUB       |
| 5   | `packages/storage/src/index.ts`               | Migración schema v2                   |
| 6   | `apps/desktop/src/components/LibraryView.tsx` | Cover real, rank, progress            |
| 7   | `apps/mobile/src/components/BookCard.tsx`     | Cover real, rank, progress            |

## Archivos a Crear

| #   | Archivo                                              | Contenido                            |
| --- | ---------------------------------------------------- | ------------------------------------ |
| 1   | `documentation/features/cover-image-optimization.md` | Documentación de optimización futura |

---

## Orden de Implementación

```
1. domain/index.ts        → tipos + normalización
2. epub-parser.ts         → extraer cover image
3. import-book.ts         → input actualizado
4. App.tsx                → importar con metadata real
5. storage/index.ts       → migración schema
6. LibraryView.tsx        → UI cover + rank + progress
7. BookCard.tsx (mobile)  → UI cover + rank + progress
8. documentation/features/cover-image-optimization.md → documentación de optimización futura
```
