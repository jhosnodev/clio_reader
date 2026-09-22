# Flujo de Uso de la Base de Datos — Clio Reader

## Arquitectura de persistencia por plataforma

| Plataforma             | Motor                               | Paquete                        | Entry point                              |
| ---------------------- | ----------------------------------- | ------------------------------ | ---------------------------------------- |
| **Desktop** (Electron) | SQLite via Drizzle + better-sqlite3 | `@clio-reader/storage/drizzle` | `electron/main.ts` → `DrizzleRepository` |
| **Mobile** (Expo)      | JSON via KeyValueStore              | `@clio-reader/storage`         | `bridges/storage.ts` → `LocalRepository` |

Ambas implementaciones satisfacen el contrato `LibraryRepository` (`packages/library/src/repository.ts`).

---

## Cómo extender el esquema (nueva entidad)

### Paso 1 — Entidad de dominio

Agregar en `packages/domain/src/index.ts`:

```typescript
export interface MiNuevaEntidad {
  readonly id: string;
  readonly bookId: BookId;
  readonly locator: ReaderLocator;
  // ... más campos
  readonly createdAt: number;
  readonly updatedAt: number;
}
```

Exportar la interfaz y crear factory `createMiNuevaEntidad()` si aplica.

### Paso 2 — Tabla SQLite

Agregar en `packages/storage/src/schema.ts`:

```typescript
export const miEntidad = sqliteTable('mi_entidad', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  locatorFormat: text('locator_format').notNull(),
  locatorData: text('locator_data').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at'),
});
```

Crear migración SQL en `packages/storage/drizzle/` con `drizzle-kit generate`.

### Paso 3 — Métodos en repositorios

**DrizzleRepository** (`packages/storage/src/drizzle-repository.ts`):

```typescript
async listMiEntidad(bookId: string): Promise<readonly MiNuevaEntidad[]> {
  return this.db
    .select()
    .from(miEntidadTable)
    .where(
      and(
        eq(miEntidadTable.bookId, bookId),
        isNull(miEntidadTable.deletedAt),
      ),
    )
    .all()
    .map(this.mapMiEntidadFromDb);
}

async saveMiEntidad(entidad: MiNuevaEntidad): Promise<void> { ... }
async removeMiEntidad(entidadId: string): Promise<void> { ... }
```

**LocalRepository** (`packages/storage/src/index.ts`):

- Agregar array a `PersistenceState`
- Agregar CRUD methods
- Actualizar `migrateState()` para v3→v4

### Paso 4 — Contrato

Agregar en `packages/library/src/repository.ts`:

```typescript
listMiEntidad(bookId: string): Promise<readonly MiNuevaEntidad[]>;
saveMiEntidad(entidad: MiNuevaEntidad): Promise<void>;
removeMiEntidad(entidadId: string): Promise<void>;
```

### Paso 5 — Casos de uso

Crear `packages/library/src/mi-entidad.ts` siguiendo patrón de `bookmarks.ts`.

### Paso 6 — Tests

- Test de contrato: ambos repos satisfacen `LibraryRepository`
- Test de integración: CRUD completo
- Test de migración: v anterior → v nueva

---

## Patrones de consulta comunes

### Listar libros con progreso (sin N+1)

```typescript
// ❌ Mal: N+1 queries
const books = await repo.listBooks();
for (const book of books) {
  const progress = await repo.getProgress(book.id); // N queries
}

// ✅ Bien: bulk query
const allProgress = await repo.listAllProgress();
const progressMap = new Map(allProgress.map((p) => [p.bookId, p]));
const books = await repo.listBooks();
```

### Búsqueda FTS5

```typescript
// Solo disponible en SQLite (desktop)
db.select()
  .from(notesFts)
  .where(sql`${notesFts} MATCH ${query}`)
  .all();
```

### Cascade por FK

```typescript
// En SQLite: ON DELETE CASCADE se encarga
await repo.removeBook(bookId);
// reading_progress, bookmarks, notes, highlights, book_preferences
// se eliminan automáticamente
```

### Upsert de bookmark/note

```typescript
// Detectar insert vs update
const existing = await repo.getBookmark(bookmark.id);
if (existing) {
  await db.update(bookmarks).set({...}).where(eq(id, bookmark.id));
} else {
  await db.insert(bookmarks).values({...});
}
```

---

## Migraciones de esquema

### SQLite (drizzle-kit)

```bash
# Generar migración después de cambiar schema.ts
pnpm --filter @clio-reader/storage db:generate

# Aplicar migración en runtime
# (se ejecuta automáticamente al iniciar la app)
```

### JSON → SQLite (one-time)

La función `migrateJsonToSqlite()` en `packages/storage/src/migrate-json.ts`:

1. Lee `clio-reader.state.json`
2. Inserta cada entidad en su tabla correspondiente
3. Sincroniza tablas FTS (triggers automáticos)
4. Renombra JSON a `.backup.json`

Se ejecuta automáticamente al iniciar si existe JSON y la BD está vacía.

### Versionado

- **SQLite**: `drizzle-kit` maneja el historial de migraciones
- **JSON**: `CURRENT_SCHEMA_VERSION` en `packages/storage/src/index.ts`
- **Runtime**: `migrateState()` migra entre versiones del JSON

---

## Invariantes de integridad

1. **Validación antes de persistir**: el dominio valida antes de storage (`validateReaderPreferences`, `createHighlight`, etc.)
2. **Cascade por FK**: no borrar hijos a mano; usar `ON DELETE CASCADE`
3. **Soft delete para sync**: libros se marcan `deletedAt` pero no se borran físicamente
4. **Transacciones**: `db.transaction()` para operaciones atómicas (migración JSON→SQLite)
5. **Debounce en writes**: 500-1000ms para progreso, flush inmediato al cerrar

---

## Tabla de referencias rápida

| Entidad           | Tabla SQLite         | Ubicación dominio              | Ubicación repos                            |
| ----------------- | -------------------- | ------------------------------ | ------------------------------------------ |
| Book              | `books`              | `packages/domain/src/index.ts` | `DrizzleRepository.listBooks()`            |
| ReadingProgress   | `reading_progress`   | `packages/domain/src/index.ts` | `DrizzleRepository.getProgress()`          |
| ReaderPreferences | `reader_preferences` | `packages/domain/src/index.ts` | `DrizzleRepository.getGlobalPreferences()` |
| Bookmark          | `bookmarks`          | `packages/domain/src/index.ts` | `DrizzleRepository.listBookmarks()`        |
| Note              | `notes`              | `packages/domain/src/index.ts` | `DrizzleRepository.listNotes()`            |
| Highlight         | `highlights`         | `packages/domain/src/index.ts` | `DrizzleRepository.listHighlights()`       |
| UserSettings      | `user_settings`      | `packages/domain/src/index.ts` | `DrizzleRepository.getUserSettings()`      |
