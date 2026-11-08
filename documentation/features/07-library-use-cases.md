# 07 - Library Use Cases

## Overview

The `@clio-reader/library` package contains the business logic use cases that orchestrate domain entities and storage repositories. It is the core of the application's functionality, sitting between the domain/storage layers and the UI layer.

## Architecture

```
UI Layer (apps/desktop, apps/mobile)
        │
        ▼
Library Use Cases (@clio-reader/library)   ← this package
        │
        ├──▶ @clio-reader/domain (entities, validation)
        └──▶ @clio-reader/storage (persistence)
```

### Design Principles

- **Dependency injection**: All use cases receive a `LibraryRepository` interface, not a concrete implementation. This allows testing with `InMemoryKeyValueStore` + `LocalRepository`.
- **No UI dependencies**: Pure TypeScript with no React, Electron, or Expo imports.
- **Functional style**: Use cases are exported functions, not classes.
- **Validation before persistence**: Domain validation (`createBook`, `validateReaderPreferences`, `createReadingProgress`) runs before any storage operation.
- **Typed errors**: Each error scenario throws a specific error class, never swallows exceptions.

## Use Cases

### 1. Import Book (`importBook`)

Adds a new book to the library.

**Input**: `ImportBookInput` — `{ id, title, author?, format, uri, addedAt? }`

**Output**: `Book`

**Error scenarios**:

- `DuplicateBookError` — A book with the same id already exists.
- `DomainValidationError` — Invalid id, title, or uri (empty strings).

**Flow**:

1. Check repository for existing book with same id.
2. Validate via `createBook()` from domain.
3. Persist via `repo.upsertBook()`.
4. Return created `Book`.

---

### 2. List Books (`listBooks`)

Retrieves all books with optional filtering and sorting.

**Input**: `ListBooksOptions?` — `{ format?, sortBy?, sortDirection? }`

**Output**: `readonly Book[]`

**Sorting**: By `title` or `addedAt`, ascending (default) or descending.

---

### 3. Get Book Details (`getBook`)

Returns a book along with its reading progress and per-book preferences.

**Input**: `bookId: string`

**Output**: `BookDetails` — `{ book, progress, preferences }`

**Error scenarios**:

- `BookNotFoundError` — No book with the given id exists.

---

### 4. Remove Book (`removeBook`)

Removes a book and all cascaded data (progress, bookmarks, notes, per-book preferences).

**Input**: `bookId: string`

**Output**: `void`

**Error scenarios**:

- `BookNotFoundError` — No book with the given id exists.

**Note**: Cascading is handled by `LocalRepository.removeBook()`. The library use case only validates existence.

---

### 5. Update Reading Progress (`updateProgress`)

Saves the current reading position for a book.

**Input**: `UpdateProgressInput` — `{ bookId, locator, percent }`

**Output**: `ReadingProgress`

**Error scenarios**:

- `BookNotFoundError` — No book with the given id exists.
- `DomainValidationError` — Invalid percent (non-finite).

**Debounce strategy**: This use case does not implement debounce internally. The caller (typically the reader UI) is responsible for debouncing calls to avoid excessive persistence writes during rapid page turns. A recommended debounce interval is 500–1000ms for locator changes, with an immediate save on session pause or book close.

---

### 6. Manage Preferences

Four functions for global and per-book reader preferences:

| Function                | Input                                | Output                       |
| ----------------------- | ------------------------------------ | ---------------------------- |
| `getGlobalPreferences`  | —                                    | `ReaderPreferences`          |
| `saveGlobalPreferences` | `ReaderPreferences`                  | `void`                       |
| `getBookPreferences`    | `bookId`                             | `Partial<ReaderPreferences>` |
| `saveBookPreferences`   | `bookId, Partial<ReaderPreferences>` | `void`                       |

**Error scenarios**:

- `DomainValidationError` — Invalid colors, fontScale (0.8–2), or lineHeight (1–2.5).

**Design**: Per-book preferences are stored as partial overrides. The storage layer merges them with global defaults when needed.

---

### 7. Manage Bookmarks

| Function         | Input                         | Output                |
| ---------------- | ----------------------------- | --------------------- |
| `createBookmark` | `{ bookId, locator, label? }` | `Bookmark`            |
| `listBookmarks`  | `bookId`                      | `readonly Bookmark[]` |
| `removeBookmark` | `bookmarkId, bookId`          | `void`                |

**Error scenarios**:

- `BookNotFoundError` — Book doesn't exist (on create).
- `BookmarkNotFoundError` — Bookmark doesn't exist (on remove).

**ID generation**: IDs are generated using `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)` — portable, no external dependencies.

---

### 8. Manage Notes

| Function     | Input                                                | Output            |
| ------------ | ---------------------------------------------------- | ----------------- |
| `createNote` | `{ bookId, locator, body, selectedText? }`           | `Note`            |
| `listNotes`  | `bookId`                                             | `readonly Note[]` |
| `updateNote` | `{ noteId, bookId, body?, locator?, selectedText? }` | `Note`            |
| `removeNote` | `noteId, bookId`                                     | `void`            |

**Error scenarios**:

- `BookNotFoundError` — Book doesn't exist (on create).
- `NoteNotFoundError` — Note doesn't exist (on update/remove).
- `DomainValidationError` — Empty note body (via storage validation).

**Note body validation**: Enforced by `LocalRepository.saveNote()`. Empty bodies are rejected.

---

### 9. Manage Highlights (`highlights.ts`)

| Function           | Input                                                                      | Output                 |
| ------------------ | -------------------------------------------------------------------------- | ---------------------- |
| `createHighlight_` | `{ bookId, locatorStart, locatorEnd, selectedText?, color, style, note? }` | `Highlight`            |
| `listHighlights`   | `bookId`                                                                   | `readonly Highlight[]` |
| `removeHighlight`  | `highlightId, bookId`                                                      | `void`                 |

Highlights are also managed through `@clio-reader/annotations` (`highlight-manager.ts`) for the desktop UI flows.

**Error scenarios**:

- `BookNotFoundError` — Book doesn't exist (on create).
- `HighlightNotFoundError` — Highlight doesn't exist (on remove).
- `DomainValidationError` — Invalid style or colors.

## Error Classes

| Error                    | Package | When                      |
| ------------------------ | ------- | ------------------------- |
| `BookNotFoundError`      | library | Book not found by id      |
| `DuplicateBookError`     | library | Import with existing id   |
| `BookmarkNotFoundError`  | library | Bookmark not found by id  |
| `NoteNotFoundError`      | library | Note not found by id      |
| `HighlightNotFoundError` | library | Highlight not found by id |
| `DomainValidationError`  | domain  | Invalid entity data       |

## Repository Interface

The `LibraryRepository` interface defines the contract between use cases and storage:

```typescript
interface LibraryRepository {
  listBooks(): Promise<readonly Book[]>;
  getBook(bookId: string): Promise<Book | undefined>;
  upsertBook(book: Book): Promise<void>;
  removeBook(bookId: string): Promise<void>;
  getProgress(bookId: string): Promise<ReadingProgress | undefined>;
  saveProgress(progress: ReadingProgress): Promise<void>;
  listAllProgress(): Promise<readonly ReadingProgress[]>;
  getGlobalPreferences(): Promise<ReaderPreferences>;
  saveGlobalPreferences(preferences: ReaderPreferences): Promise<void>;
  getBookPreferences(bookId: string): Promise<Partial<ReaderPreferences>>;
  saveBookPreferences(bookId: string, preferences: Partial<ReaderPreferences>): Promise<void>;
  listAllBookmarks(): Promise<readonly Bookmark[]>;
  listBookmarks(bookId: string): Promise<readonly Bookmark[]>;
  saveBookmark(bookmark: Bookmark): Promise<void>;
  removeBookmark(bookmarkId: string): Promise<void>;
  listNotes(bookId: string): Promise<readonly Note[]>;
  saveNote(note: Note): Promise<void>;
  removeNote(noteId: string): Promise<void>;
  listHighlights(bookId: string): Promise<readonly Highlight[]>;
  saveHighlight(highlight: Highlight): Promise<void>;
  removeHighlight(highlightId: string): Promise<void>;
  getUserSettings(): Promise<UserSettings>;
  saveUserSettings(settings: UserSettings): Promise<void>;
}
```

`DrizzleRepository` (desktop) and `LocalRepository` (mobile) satisfy this interface structurally (duck typing).

## Testing

Tests use `InMemoryKeyValueStore` + `LocalRepository` as the test double, providing full isolation between tests.

**Test coverage areas**:

- Happy path for each use case
- Error cases (not found, duplicates, validation)
- Data isolation between books
- Cascading removal behavior
- Preference merging (global vs per-book)
- Progress normalization (percent clamping)
- Sorting and filtering combinations
