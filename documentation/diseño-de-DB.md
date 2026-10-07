# Diseño de Base de Datos - Clio Reader

## Resumen

- **Motor:** SQLite con FTS5 (Desktop), JSON (Mobile)
- **ORM:** Drizzle
- **Sync:** Diseñado para futuro backend (columnas `updated_at` + `deleted_at` para soft delete)
- **Búsqueda:** Full-text search en notas y highlights

---

## Ubicación del archivo SQLite

### Desktop (SQLite)

La BD vive en el directorio `userData` de Electron + la carpeta `clio-reader`. Se deriva de `app.getPath('userData')` en `apps/desktop/electron/main.ts` (funciones `getDataPath()` / `getDbPath()`):

| Plataforma  | Ruta del archivo `clio.db`                                               |
| ----------- | ------------------------------------------------------------------------ |
| **Linux**   | `~/.config/@clio-reader/desktop/clio-reader/clio.db`                     |
| **Windows** | `%APPDATA%\@clio-reader\desktop\clio-reader\clio.db`                     |
| **macOS**   | `~/Library/Application Support/@clio-reader/desktop/clio-reader/clio.db` |

```text
<userData>/
└── clio-reader/
    ├── clio.db                    ← base SQLite
    ├── clio.db-shm / clio.db-wal  ← WAL (journal, se regeneran)
    └── clio-reader.state.backup.json  ← backup del JSON migrado
```

**Notas:**

- WAL habilitado: los archivos `-shm`/`-wal` son temporales y no deben copiarse como respaldo (se regeneran al abrir). Para respaldar, copiar solo `clio.db`.
- Durante la migración, el JSON original se renombra a `clio-reader.state.backup.json` en el mismo directorio.
- Abrir con cualquier cliente SQLite (`sqlite3`, DBeaver, VS Code + extensión).

### Mobile (JSON)

En mobile no hay SQLite: se persiste un blob JSON por clave bajo el directorio de documentos de la app (`expo-file-system`, `apps/mobile/src/bridges/storage.ts`). La clave principal es `clio-reader.state` + `.json`, en `documentDirectory`:

| Plataforma  | Ruta del directorio de datos                                        |
| ----------- | ------------------------------------------------------------------- |
| **Android** | `/data/user/0/<applicationId>/files/clio-reader/`                   |
| **iOS**     | `<AppContainer>/Documents/clio-reader/` (solo accesible por la app) |

Dentro de ese directorio se guardan `clio-reader.state.json` (blob principal), `clio-reader.progress.json`, etc. (un archivo por clave de estado).

---

## Diagrama ER

```
┌──────────────────────┐          ┌──────────────────────┐
│       books          │          │  reading_progress     │
├──────────────────────┤          ├──────────────────────┤
│ PK id           TEXT │◄────────┐│ PK,FK book_id   TEXT │
│    title        TEXT │   1:1   │    locator_format TEXT │
│    author       TEXT │         │    locator_data  TEXT │
│    format       TEXT │         │    percent       REAL │
│    uri          TEXT │         │    updated_at   INT   │
│    file_hash    TEXT │         └──────────────────────┘
│    added_at     INT  │
│    last_opened  INT  │         ┌──────────────────────┐
│    reading_stat TEXT │         │ book_preferences      │
│    language     TEXT │         ├──────────────────────┤
│    status       TEXT │         │ PK,FK book_id   TEXT │
│    rank        REAL  │         │    theme        TEXT │
│    cover_image TEXT  │         │    bg_color     TEXT │
│    created_at   INT  │         │    fg_color     TEXT │
│    updated_at   INT  │         │    accent_color TEXT │
│    deleted_at   INT  │         │    font_family  TEXT │
└──────────┬───────────┘         │    font_scale   REAL │
           │                     │    line_height  REAL │
           │ 1:N                 │    margin       TEXT │
           │                     │    read_dir     TEXT │
           ▼                     │    updated_at   INT  │
┌──────────────────────┐         └──────────────────────┘
│     bookmarks        │
├──────────────────────┤         ┌──────────────────────┐
│ PK id           TEXT │         │ reader_preferences   │
│ FK book_id      TEXT │         ├──────────────────────┤
│    loc_format   TEXT │         │ PK id=1        INT   │ (singleton)
│    loc_data     TEXT │         │    theme        TEXT │
│    label        TEXT │         │    bg_color     TEXT │
│    created_at   INT  │         │    fg_color     TEXT │
│    updated_at   INT  │         │    accent_color TEXT │
│    deleted_at   INT  │         │    font_family  TEXT │
└──────────────────────┘         │    font_scale   REAL │
                                 │    line_height  REAL │
┌──────────────────────┐         │    margin       TEXT │
│       notes          │         │    read_dir     TEXT │
├──────────────────────┤         │    updated_at   INT  │
│ PK id           TEXT │         └──────────────────────┘
│ FK book_id      TEXT │
│    loc_format   TEXT │         ┌──────────────────────┐
│    loc_data     TEXT │         │     notes_fts         │
│    selected_txt TEXT │◄──FTS──►├──────────────────────┤
│    body         TEXT │         │    body          TEXT │
│    created_at   INT  │         │    selected_text TEXT │
│    updated_at   INT  │         └──────────────────────┘
│    deleted_at   INT  │
└──────────────────────┘         ┌──────────────────────┐
                                 │     highlights        │
┌──────────────────────┐         ├──────────────────────┤
│ highlights_fts       │         │ PK id           TEXT │
├──────────────────────┤         │ FK book_id      TEXT │
│    selected_text TEXT │◄──FTS──►│    loc_format   TEXT │
│    note         TEXT │         │    loc_start    TEXT │
└──────────────────────┘         │    loc_end      TEXT │
                                 │    selected_text TEXT │
                                 │    color        TEXT │
                                 │    style        TEXT │
                                 │    note         TEXT │
                                 │    created_at   INT  │
                                 │    updated_at   INT  │
                                 │    deleted_at   INT  │
                                 └──────────────────────┘

┌──────────────────────┐
│    user_settings     │
├──────────────────────┤
│ PK id=1        INT   │ (singleton)
│    palette_id  TEXT   │
│    mode        TEXT   │
│    updated_at  INT    │
└──────────────────────┘
```

### Relaciones

| Padre      | Hijo             | Tipo | Cascade     |
| ---------- | ---------------- | ---- | ----------- |
| books      | reading_progress | 1:1  | DELETE      |
| books      | book_preferences | 1:1  | DELETE      |
| books      | bookmarks        | 1:N  | DELETE      |
| books      | notes            | 1:N  | DELETE      |
| books      | highlights       | 1:N  | DELETE      |
| notes      | notes_fts        | FTS5 | Sync manual |
| highlights | highlights_fts   | FTS5 | Sync manual |

---

## Tablas

### books

```sql
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  format TEXT NOT NULL CHECK(format IN ('epub','pdf','cbz','md')),
  uri TEXT NOT NULL,
  file_hash TEXT,
  added_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  reading_status TEXT CHECK(reading_status IN ('unread','opened','reading')),
  language TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','missing')),
  rank REAL CHECK(rank >= 0 AND rank <= 5),
  cover_image TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER
);

CREATE INDEX idx_books_status ON books(status, deleted_at);
CREATE INDEX idx_books_reading_status ON books(reading_status, deleted_at);
```

### reading_progress

```sql
CREATE TABLE reading_progress (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  locator_format TEXT NOT NULL,
  locator_data TEXT NOT NULL,
  percent REAL NOT NULL DEFAULT 0 CHECK(percent >= 0 AND percent <= 1),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_reading_progress_percent ON reading_progress(percent);
```

### reader_preferences

```sql
CREATE TABLE reader_preferences (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
  theme TEXT NOT NULL DEFAULT 'light',
  background_color TEXT NOT NULL DEFAULT '#ffffff',
  foreground_color TEXT NOT NULL DEFAULT '#1f2937',
  accent_color TEXT NOT NULL DEFAULT '#2563eb',
  font_family TEXT NOT NULL DEFAULT 'system',
  font_scale REAL NOT NULL DEFAULT 1,
  line_height REAL NOT NULL DEFAULT 1.5,
  margin TEXT NOT NULL DEFAULT 'comfortable',
  reading_direction TEXT NOT NULL DEFAULT 'ltr',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### book_preferences

```sql
CREATE TABLE book_preferences (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  theme TEXT,
  background_color TEXT,
  foreground_color TEXT,
  accent_color TEXT,
  font_family TEXT,
  font_scale REAL,
  line_height REAL,
  margin TEXT,
  reading_direction TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### bookmarks

```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  locator_format TEXT NOT NULL,
  locator_data TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER
);

CREATE INDEX idx_bookmarks_book ON bookmarks(book_id, deleted_at);
```

### notes

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  locator_format TEXT NOT NULL,
  locator_data TEXT NOT NULL,
  selected_text TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER
);

CREATE INDEX idx_notes_book ON notes(book_id, deleted_at);
```

### highlights

```sql
CREATE TABLE highlights (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  locator_format TEXT NOT NULL,
  locator_start TEXT NOT NULL,
  locator_end TEXT NOT NULL,
  selected_text TEXT,
  color TEXT NOT NULL DEFAULT '#ffff00',
  style TEXT NOT NULL DEFAULT 'highlight' CHECK(style IN ('highlight','underline')),
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deleted_at INTEGER
);

CREATE INDEX idx_highlights_book ON highlights(book_id, deleted_at);
CREATE INDEX idx_highlights_color ON highlights(color, deleted_at);
```

### user_settings

```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
  palette_id TEXT NOT NULL DEFAULT 'clio-3',
  mode TEXT NOT NULL DEFAULT 'dark' CHECK(mode IN ('dark','light')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### notes_fts

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  body, selected_text,
  content='notes', content_rowid='rowid'
);
```

### highlights_fts

```sql
CREATE VIRTUAL TABLE highlights_fts USING fts5(
  selected_text, note,
  content='highlights', content_rowid='rowid'
);
```

---

## Conceptos Clave

### FTS5 (Full-Text Search)

**FTS5** es un módulo nativo de SQLite para búsquedas de texto completas, indexadas y de alto rendimiento.

**Qué resuelve:**

Sin FTS, para buscar "resiliencia" en 1000 notas:

```sql
-- LENTO: escanea cada nota completa
SELECT * FROM notes WHERE body LIKE '%resiliencia%';
-- O(n) - cada query recorre todo el texto
```

Con FTS5:

```sql
-- RÁPIDO: usa un índice invertido
SELECT * FROM notes_fts WHERE notes_fts MATCH 'resiliencia';
-- O(log n) - búsqueda indexada
```

**Índice invertido:**

```
TEXT ORIGINAL:              ÍNDICE FTS:
"La resiliencia es         resiliencia → [nota_1, nota_5, nota_23]
 valiosa"                   valiosa     → [nota_1, nota_12]
"Ser valiosa es             ser         → [nota_1, nota_5, nota_8]
 necesario"                 necesario   → [nota_8]
```

Cada palabra unique apunta a los documentos que la contienen.

**Queries soportadas:**

```sql
-- Búsqueda simple
WHERE fts MATCH 'resiliencia'

-- Búsqueda con comillas (frase exacta)
WHERE fts MATCH '"resiliencia humana"'

-- Operadores booleanos
WHERE fts MATCH 'resiliencia OR fortaleza'
WHERE fts MATCH 'resiliencia AND NOT debilidad'

-- Búsqueda con prefijo
WHERE fts MATCH 'resili*'

-- Ranking por relevancia
SELECT *, rank FROM notes_fts WHERE fts MATCH 'resiliencia' ORDER BY rank
```

**Sincronización manual:**

FTS5 no actualiza automáticamente. Hay que sincronizar:

```sql
-- Insertar en FTS cuando se inserta en la tabla real
INSERT INTO notes_fts(rowid, body, selected_text)
  SELECT rowid, body, selected_text FROM notes WHERE id = ?;

-- Para mantener sincronizado, se usa triggers o lógica en la app
```

### Highlights (Subrayados/Resaltados)

Un **highlight** es una anotación visual que se renderiza sobre el texto del libro. A diferencia de un bookmark (que es solo un puntero a una posición), un highlight necesita:

1. **Rango de texto** - Posición de inicio y fin (no solo un punto)
2. **Texto seleccionado** - El contenido real que se subrayó
3. **Color** - Para diferenciar tipos de anotaciones
4. **Estilo** - Highlight (fondo coloreado) o Underline (línea bajo el texto)
5. **Nota opcional** - Comentario adicional del usuario

**Diferencia técnica con bookmarks:**

| Aspecto     | Bookmark         | Highlight                         |
| ----------- | ---------------- | --------------------------------- |
| Locator     | Punto único      | Rango (inicio + fin)              |
| Renderizado | Icono en esquina | Overlay visual sobre texto        |
| Datos extra | Label opcional   | Color, estilo, texto seleccionado |
| EPUB        | CFI puntual      | CFI range (start-end)             |
| PDF/CBZ     | Página           | Coordenadas del rectángulo        |

**Ejemplo en EPUB:**

```typescript
// Bookmark: "Estoy en la página 42"
{ format: 'epub', cfi: 'epubcfi(/6/4[chapter2]!/4/2/1:10)' }

// Highlight: "Subrayé de aquí hasta aquí"
{ format: 'epub', cfiStart: 'epubcfi(/6/4/2/1:10)', cfiEnd: 'epubcfi(/6/4/2/3:45)' }
```

### User Settings (Configuración de Usuario)

La tabla `user_settings` almacena la configuración global de la aplicación (singleton, id=1):

- `palette_id`: ID del tema de color (ej: 'clio-3', 'clio-5')
- `mode`: Modo del tema ('dark' o 'light')

**Migración desde localStorage:**

Antes de la migración a SQLite, la paleta se almacenaba en `localStorage` bajo la clave `clio-palette`. La migración one-time (`migrateJsonToSqlite`) lee este valor y lo inserta en la tabla `user_settings`.

---

## Stack

| Capa                 | Tecnología             |
| -------------------- | ---------------------- |
| Runtime DB (Desktop) | `better-sqlite3`       |
| Runtime DB (Mobile)  | JSON via KeyValueStore |
| Query builder        | `drizzle-orm`          |
| Migraciones          | `drizzle-kit`          |
| Búsqueda             | SQLite FTS5 (nativo)   |

---

## Migración desde JSON

La función `migrateJsonToSqlite()` en `packages/storage/src/migrate-json.ts` ejecuta la migración one-time:

1. Lee `clio-reader.state.json` (blob JSON existente)
2. Inserta cada entidad en su tabla correspondiente dentro de una transacción
3. Sincroniza tablas FTS (triggers automáticos)
4. Renombra el JSON a `clio-reader.state.backup.json`

```typescript
import { migrateJsonToSqlite } from '@clio-reader/storage/drizzle';

const result = migrateJsonToSqlite(db, {
  jsonPath: '/path/to/clio-reader.state.json',
  backupPath: '/path/to/clio-reader.state.backup.json',
});

// result: { migrated: true, booksCount: 42, notesCount: 15, ... }
```

**Coexistencia:** La migración es idempotente y se ejecuta solo si la BD está vacía y existe el JSON.

---

## Sync-Ready (Futuro Backend)

Las siguientes columnas están diseñadas para soportar sincronización futura:

- `deleted_at` - Soft delete para diff con backend
- `updated_at` - Detectar cambios para sync
- `created_at` - Ordering y resolución de conflictos
