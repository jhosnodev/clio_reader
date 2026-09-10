# Cover Image Optimization - Future Work

## Current Implementation (v1)

Cover images are stored as **base64 data URIs** directly in the `Book.coverImage` field within the JSON state blob.

### Storage Format
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...
```

### How It Works
1. During EPUB import, `extractCoverImage()` extracts the cover from the EPUB ZIP
2. The raw bytes are converted to base64
3. A data URI is created with the correct MIME type
4. The data URI is stored in `Book.coverImage`
5. The entire state (including base64) is serialized to JSON on every save

### Pros
- Simple implementation
- No external file management
- Everything in one place (the state JSON)
- Works with any storage backend (localStorage, file, etc.)

### Cons
- **Size overhead**: Base64 increases image size by ~33%
- **JSON serialization**: Every state save serializes all cover images
- **Memory usage**: All covers loaded into memory when state is read

---

## When to Migrate

Consider migrating to file-based storage when:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Book count | > 100 books | Evaluate migration |
| Book count | > 200 books | Strongly consider migration |
| State JSON size | > 10MB | Migration recommended |
| Save latency | > 500ms | Migration recommended |
| User reports lag | Any | Investigate and consider migration |

### Performance Impact Estimates

| Books | Avg Cover Size | Base64 Size | JSON Size Impact |
|-------|---------------|-------------|------------------|
| 50 | 100KB | 133KB | ~6.5MB total |
| 100 | 100KB | 133KB | ~13MB total |
| 200 | 100KB | 133KB | ~26MB total |
| 500 | 100KB | 133KB | ~65MB total |

---

## Migration Plan: Base64 → File Storage

### Phase 1: Add File Storage Support

1. **Create a cover storage service**:
   ```typescript
   // packages/storage/src/cover-storage.ts
   export interface CoverStorage {
     save(bookId: string, data: Uint8Array, mimeType: string): Promise<string>;
     load(path: string): Promise<Uint8Array | null>;
     remove(path: string): Promise<void>;
     getLocalPath(bookId: string): string;
   }
   ```

2. **Implement for each platform**:
   - **Desktop (Electron)**: Save to app data directory
   - **Mobile (React Native)**: Use document directory
   - **Web**: Use IndexedDB or cache storage

3. **Update `Book` interface**:
   ```typescript
   // Change from:
   coverImage?: string; // base64 data URI
   
   // To:
   coverPath?: string; // file path or relative URL
   ```

### Phase 2: Migration Logic

1. **Add migration to `migrateState()`**:
   ```typescript
   function migrateCoverImages(
     books: Book[],
     coverStorage: CoverStorage,
   ): Promise<Book[]> {
     return Promise.all(
       books.map(async (book) => {
         if (book.coverImage && book.coverImage.startsWith('data:')) {
           // Extract base64 data
           const base64 = book.coverImage.split(',')[1];
           const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
           const mimeType = book.coverImage.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
           
           // Save to file
           const path = await coverStorage.save(book.id, bytes, mimeType);
           
           // Return updated book (remove base64, add path)
           const { coverImage, ...rest } = book;
           return { ...rest, coverPath: path };
         }
         return book;
       }),
     );
     }
   ```

2. **Increment schema version** to trigger migration

### Phase 3: Update UI Components

1. **Update image loading**:
   ```typescript
   // Before:
   <img src={book.coverImage} />
   
   // After:
   <img src={coverStorage.getLocalPath(book.coverPath)} />
   // or use a hook that handles loading
   ```

2. **Add loading states** for async cover loading

3. **Add fallback** for missing covers (keep existing placeholder)

### Phase 4: Cleanup

1. Remove base64 conversion from import flow
2. Update `extractCoverImage()` to return file path directly
3. Add background job to migrate existing covers (optional)

---

## Alternative Approaches

### Option A: Lazy Loading with Cache
- Store covers as files
- Use service worker / cache API for web
- Pros: Fast after first load
- Cons: More complex

### Option B: Thumbnail Generation
- Generate multiple sizes (thumb, medium, large)
- Store based on use case
- Pros: Better performance for lists
- Cons: More storage, more complexity

### Option C: CDN/Cloud Storage
- Upload covers to cloud storage
- Store URLs in Book
- Pros: Shared across devices
- Cons: Requires internet, privacy concerns

---

## Testing the Migration

Before deploying the migration:

1. **Test with large library**: Import 200+ books with covers
2. **Measure performance**: Time state saves before/after
3. **Verify data integrity**: All covers migrate correctly
4. **Test rollback**: Ensure users can downgrade if issues

---

## References

- [Base64 RFC 4648](https://tools.ietf.org/html/rfc4648)
- [Electron Storage Best Practices](https://www.electronjs.org/docs/latest/tutorial/storage)
- [React Native File System](https://github.com/itinance/react-native-fs)
