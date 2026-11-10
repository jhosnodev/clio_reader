# AGENTS.md — Contexto del proyecto Clio Reader

## 1. Estado del proyecto

| Fase | Nombre                  | Estado      |
| ---- | ----------------------- | ----------- |
| 0    | Preparación repo        | ✅ Completa |
| 1    | Spike Windows/Android   | ✅ Completa |
| 2    | Dominio/contratos       | ✅ Completa |
| 3    | Biblioteca/persistencia | ✅ Completa |
| 4    | Renderer CBZ            | ✅ Completa |
| 5    | Renderer PDF            | ✅ Completa |
| 6    | Renderer EPUB           | ✅ Completa |
| 7    | Progreso/settings       | ⚠️ Parcial  |
| 8    | Marcadores/notas        | ⚠️ Parcial  |
| 9    | Mobile Android (MVP)    | ⚠️ Parcial  |
| 10   | Clio Feedback Core      | ⚠️ Parcial  |

## 2. Arquitectura

```text
UI por plataforma (apps/desktop Electron, apps/mobile Expo)
  ↓
Casos de uso y estado (packages/library)
  ↓
Dominio TypeScript y contratos (packages/domain, packages/reader-core)
  ↓
Adaptadores de formato (packages/reader-epub, reader-pdf, reader-cbz, reader-md)
  ↓
Persistencia (packages/storage)
  ↓
Electron/Windows o Expo/Android
```

### Patrones

| Patrón        | Uso                                                           |
| ------------- | ------------------------------------------------------------- |
| Adapter       | Convierte API de cada renderer en contrato común              |
| Factory       | Construye adaptador según formato detectado                   |
| Strategy      | EPUB, PDF y CBZ resuelven navegación distinto                 |
| Repository    | Aísla SQLite (desktop) o JSON/KeyValueStore (mobile)          |
| State machine | Controla idle → opening → ready → navigating → error → closed |

### Architecture Decision Records

| ADR                                                      | Decisión                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `documentation/adr/0001-dominio-y-persistencia-local.md` | Dominio TypeScript independiente, repositorio local, esquema versionado |
| `documentation/adr/0002-reader-core-state-machine.md`    | ReaderFactory, detectBookFormat, máquina de estados de sesión           |

## 3. Tech stack

- **Runtime**: Node.js 22+
- **Package manager**: pnpm 12.16.1
- **Language**: TypeScript (modo estricto)
- **Desktop**: Electron + React
- **Mobile**: Expo + React Native
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **DB local**: better-sqlite3

## 4. Estructura del monorepo

```text
apps/
  desktop/          # Electron + React (Windows/Linux)
  mobile/           # Expo + React Native (Android/iOS)
packages/
  domain/           # Entidades y reglas puras (Book, Bookmark, Note, etc.)
  reader-core/      # Contratos abstractos, ReaderAdapter, ReaderFactory, eventos
  reader-epub/      # Adaptador EPUB (parser propio con jszip)
  reader-pdf/       # Adaptador PDF (PDF.js)
  reader-cbz/       # Adaptador CBZ (ZIP + imágenes)
  reader-md/        # Adaptador Markdown
  reader-session/   # Gestión de sesión de lectura
  storage/          # Repositorios locales y migraciones
  library/          # Casos de uso de biblioteca
  annotations/      # Gestión de anotaciones
  feedback/         # Clio Feedback Core (contrato, servicio, contexto)
```

### Convenciones de paquetes

- Nombre: `@clio-reader/<nombre>`
- Cada paquete tiene `package.json`, `tsconfig.json` y `src/`
- Tests junto al módulo: `src/feature.ts` + `src/feature.test.ts`

## 5. Modelo de dominio

### Entidades principales

```typescript
type BookFormat = 'epub' | 'pdf' | 'cbz' | 'md';
type ReadingStatus = 'unread' | 'opened' | 'reading';
type BookStatus = 'available' | 'missing';
type PaletteMode = 'dark' | 'light';

interface Book {
  id: string;
  uri: string;
  title: string;
  author?: string;
  format: BookFormat;
  fileHash?: string;
  addedAt: number;
  lastOpenedAt?: number;
  readingStatus?: ReadingStatus;
  language?: string;
  status: BookStatus;
  rank?: Rank;
  coverImage?: string;
}

interface ReadingProgress {
  bookId: string;
  locator: ReaderLocator;
  percent: number;
  updatedAt: number;
}

interface ReaderPreferences {
  theme: 'light' | 'dark' | 'sepia' | 'custom';
  backgroundColor: string;
  foregroundColor: string;
  accentColor: string;
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
  updatedAt?: number;
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

interface TextAnchor {
  start: number;
  end: number;
  prefix?: string;
  suffix?: string;
}

interface Highlight {
  id: string;
  bookId: string;
  locatorStart: ReaderLocator;
  locatorEnd: ReaderLocator;
  selectedText?: string;
  color: string;
  style: 'highlight' | 'underline';
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface UserSettings {
  paletteId: string;
  mode: PaletteMode;
}
```

### IDs generados

El helper portable vive en `packages/library/src/id.ts` y lo usan libros y anotaciones:

```typescript
// Portable, sin dependencias externas
const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
```

## 6. Contratos del reader

### ReaderAdapter (contrato común)

```typescript
interface ReaderAdapter {
  readonly format: BookFormat;
  createDocument(source: FileSource): ReaderDocument;
}
```

### ReaderDocument (documento abierto)

```typescript
interface ReaderDocument {
  readonly format: BookFormat;
  readonly capabilities: ReaderCapabilities;
  open(preloadedData?: Uint8Array): Promise<void>;
  close(): Promise<void>;
  getLocator(): Promise<ReaderLocator>;
  goNext(): Promise<ReaderLocator>;
  goPrevious(): Promise<ReaderLocator>;
  // Opcionales según formato
  goToChapter?(idx: number): Promise<ReaderLocator>;
  goToTocHref?(href: string): Promise<ReaderLocator>;
  goToPage?(pageIndex: number): Promise<ReaderLocator>;
  getCurrentChapterContent?(): Promise<string>;
  getChapterCount?(): Promise<number>;
  getCurrentChapterIndex?(): Promise<number>;
  getTotalPages?(): Promise<number>;
  getCurrentPageIndex?(): Promise<number>;
  applyPreferences?(prefs: ReaderPreferences): Promise<string>;
  resolveResources?(html: string): Promise<string>;
  getImageData?(href: string): Promise<{ data: Uint8Array; mimeType: string } | null>;
  getToc?(): Promise<TocTree>;
}
```

### ReaderCapabilities (capacidades del adaptador)

```typescript
interface ReaderCapabilities {
  readonly reflowable: boolean;
  readonly supportsFontScale: boolean;
  readonly supportsZoom: boolean;
  readonly supportsAnnotations: boolean;
  readonly supportsTOC?: boolean;
}
```

### ReaderFactory

```typescript
// Registra adaptadores (la factory usa format como clave)
ReaderFactory.register(new EpubAdapter());
ReaderFactory.register(new PdfAdapter());
ReaderFactory.register(new CbzAdapter());
ReaderFactory.register(new MarkdownAdapter());

// Crea el documento según fuente + formato detectado
const doc = ReaderFactory.create(source, book.format);
```

### detectBookFormat

```typescript
// Detección por extensión (prioridad) y MIME (fallback); lanza UnsupportedBookFormatError
function detectBookFormat(fileName: string, mimeType?: string): BookFormat;
// Ejemplo: "libro.epub" → 'epub', "comic.cbz" → 'cbz'
```

## 7. Locators por formato

El locator es específico por formato y es la fuente de verdad para reanudar. `percent` solo se usa para mostrar en UI.

| Formato | Locator                        | Ejemplo                                          | Notas                                   |
| ------- | ------------------------------ | ------------------------------------------------ | --------------------------------------- |
| EPUB    | `href` + CFI/progreso + ancla  | `{format:'epub', href:'text/c1.xhtml', cfi:'…'}` | `positionOrder` calculado por adaptador |
| PDF     | Página + zoom/scroll           | `{format:'pdf', page:5, zoom:1.5, scrollY:120}`  | Página 0-based en dominio               |
| CBZ     | Página + escala/scroll         | `{format:'cbz', page:12, scale:1, scrollY:0}`    | Orden natural por nombre                |
| MD      | Offset/href + progreso + ancla | `{format:'md', href:'#intro', offset:45}`        | Contexto textual para recuperación      |

### UI del lector (desktop)

El lector (`apps/desktop/reader.html` + `reader-entry.ts`) ofrece:

- Paneles de **información**, **índice (TOC)**, **búsqueda**, **notas** y **ajustes de lectura**.
- Ajustes de tema (papel/sepia/noche), tipografía, tamaño de letra e interlineado.
- **Márgenes** con slider de 8 a 120 px (paso 2, default 48) que persiste en `ReaderPreferences.margin`.
- **Modo Zen**: oculta los cintillos y expande la página a todo el ancho (`max-width: none`); se entra/sale con el botón o el botón flotante.
- Selección de texto con widget de 6 colores para resaltar o crear nota (EPUB/MD).

### Recuperación de locator

Si un locator deja de existir (página eliminada, capítulo reorganizado), el adaptador intenta recuperar la posición más cercana y muestra un indicador de "posición no exacta".

### Anclaje de anotaciones al texto (EPUB/MD)

Las notas y highlights se atan al texto seleccionado con dos selectores
redundantes (patrón Web Annotation):

| Selector | Dónde vive                     | Contenido                                                   |
| -------- | ------------------------------ | ----------------------------------------------------------- |
| Posición | `locator.anchor`               | `start`/`end` sobre el texto plano del capítulo             |
| Cita     | `Note.selectedText`            | Cita literal normalizada                                    |
| Contexto | `locator.anchor.prefix/suffix` | 32 caracteres a cada lado, para desambiguar citas repetidas |

Resolución (`resolveTextAnchor` en `packages/reader-core`):

| Resultado   | Cuándo                                                 | UI                              |
| ----------- | ------------------------------------------------------ | ------------------------------- |
| `exact`     | Los offsets siguen apuntando a la cita                 | Resaltado normal                |
| `recovered` | El texto se desplazó; la cita se localizó por búsqueda | Toast "Nota reubicada"          |
| `missing`   | La cita ya no existe en el capítulo                    | Toast "No se encontró el texto" |

El texto base se mide sobre los nodos de texto de `#page`, excluyendo `<style>`
y `<script>` (hojas del tema y del EPUB).

## 8. State machine de sesión

```text
idle → opening → ready → navigating → error → closed
                  ↓         ↑
                  └─────────┘
```

| Estado       | Descripción                                            |
| ------------ | ------------------------------------------------------ |
| `idle`       | Sin documento abierto                                  |
| `opening`    | Cargando documento                                     |
| `ready`      | Documento listo para lectura                           |
| `navigating` | Navegando entre páginas/capítulos                      |
| `error`      | Error recuperable (archivo corrupto, formato inválido) |
| `closed`     | Documento cerrado                                      |

### Transiciones inválidas

Las transiciones inválidas lanzan `InvalidSessionTransitionError` en vez de ignorar silenciosamente el evento.

```typescript
// Ejemplo: navegar desde idle es inválido
transitionReaderSession(INITIAL_READER_SESSION, { type: 'navigationStarted' });
// → InvalidSessionTransitionError: Cannot apply navigationStarted while reader session is idle
```

## 9. Persistencia y migraciones

### Arquitectura por plataforma

| Plataforma             | Motor                               | Paquete                        | Entry point                              |
| ---------------------- | ----------------------------------- | ------------------------------ | ---------------------------------------- |
| **Desktop** (Electron) | SQLite via Drizzle + better-sqlite3 | `@clio-reader/storage/drizzle` | `electron/main.ts` → `DrizzleRepository` |
| **Mobile** (Expo)      | JSON via KeyValueStore              | `@clio-reader/storage`         | `bridges/storage.ts` → `LocalRepository` |

### KeyValueStore (abstracción para mobile)

```typescript
interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

### LocalRepository (JSON - mobile)

Implementa `LibraryRepository` usando `KeyValueStore`. Persiste un único blob JSON bajo la clave `clio-reader.state`.

### DrizzleRepository (SQLite - desktop)

Implementa `LibraryRepository` usando Drizzle ORM + better-sqlite3. Tablas normalizadas con FK cascade, soft delete para sync, y FTS5 para búsqueda.

### Ubicación del archivo SQLite

#### Desktop (SQLite)

Se deriva de `app.getPath('userData')` + `/clio-reader/clio.db` en `apps/desktop/electron/main.ts`:

- **Linux**: `~/.config/clio-reader/clio-reader/clio.db`
- **Windows**: `%APPDATA%\clio-reader\clio-reader\clio.db`
- **macOS**: `~/Library/Application Support/clio-reader/clio-reader/clio.db`

`main.ts` fija `app.setName('clio-reader')`, por lo que la ruta no usa el nombre del paquete (`@clio-reader/desktop`). En desarrollo (`app.isPackaged === false`) se usa un `userData` separado con sufijo `-dev` (p. ej. `~/.config/clio-reader-dev/`), fijado con `app.setPath('userData', ...)` antes del single-instance lock, para no compartir DB ni lock con la build de producción.

El campo `margin` se guarda en SQLite como texto numérico (`"48"`) y se normaliza a número al leer; los valores legacy `compact`/`comfortable`/`wide` se migran a 16/48/96.

Los archivos `-shm`/`-wal` son temporales del journal WAL; solo se respalda `clio.db`.

#### Mobile (JSON)

En mobile no hay SQLite; se persiste un blob JSON por clave bajo `documentDirectory` de `expo-file-system` (`apps/mobile/src/bridges/storage.ts`):

- **Android**: `/data/user/0/<applicationId>/files/clio-reader/`
- **iOS**: `<AppContainer>/Documents/clio-reader/` (sandbox, solo accesible por la app)

### Migración JSON → SQLite (one-time)

La función `migrateJsonToSqlite()` en `packages/storage/src/migrate-json.ts` migra datos existentes del JSON a SQLite al iniciar la app.

### Esquema versionado

```typescript
const CURRENT_SCHEMA_VERSION = 3;

interface PersistenceState {
  schemaVersion: number;
  books: Book[];
  progress: ReadingProgress[];
  preferences: {
    global: ReaderPreferences;
    byBook: Record<string, Partial<ReaderPreferences>>;
  };
  bookmarks: Bookmark[];
  notes: Note[];
  highlights: Highlight[];
  userSettings: UserSettings;
}
```

### Persistencia de palette

```typescript
// En SQLite: tabla user_settings (singleton, id=1)
// En JSON (mobile): dentro de PersistenceState.userSettings
// Default: { paletteId: 'clio-3', mode: 'dark' }
```

## 10. Error handling

### Clores de error

| Error                           | Package     | Uso                             |
| ------------------------------- | ----------- | ------------------------------- |
| `BookNotFoundError`             | library     | Libro no encontrado por id      |
| `DuplicateBookError`            | library     | Importar libro con id existente |
| `BookmarkNotFoundError`         | library     | Marcador no encontrado          |
| `NoteNotFoundError`             | library     | Nota no encontrada              |
| `HighlightNotFoundError`        | library     | Highlight no encontrado         |
| `DomainValidationError`         | domain      | Datos de entidad inválidos      |
| `InvalidSessionTransitionError` | reader-core | Transición de estado inválida   |

### Patrones

- **Typed errors**: Cada escenario lanza una clase específica, nunca traga excepciones
- **Validación antes de persistir**: Dominio valida antes de storage
- **Recuperación**: Errores de archivo muestran estado `missing` con acción "localizar archivo"
- **Cierre abrupto**: Transacciones y debounce previenen corrupción

## 11. Convenciones de código

- **Sin `any`** sin justificación documentada
- **Sin comentarios** a menos que el usuario lo pida
- **CSS vars** en vez de colores inline (ver `documentation/STYLE-GUIDE.md`)
- **Nombres explícitos**, funciones pequeñas, una responsabilidad por módulo
- **Nunca importar directamente** un renderer desde UI; siempre vía contratos
- **Dependencia inyectada**: Use cases reciben interfaces, no implementaciones concretas
- **Funciones puras**: Lógica de negocio fuera de componentes React
- **Error classes**: Nunca lanzar strings o errores genéricos

## 12. Validaciones y rangos

| Campo              | Rango válido                  | Default |
| ------------------ | ----------------------------- | ------- |
| `fontScale`        | 0.8 – 2.0                     | 1.0     |
| `lineHeight`       | 1.0 – 2.5                     | 1.5     |
| `theme`            | light, dark, sepia, custom    | dark    |
| `fontFamily`       | system, serif, sans, dyslexic | system  |
| `margin`           | 8 – 120 px                    | 48      |
| `readingDirection` | ltr, rtl                      | ltr     |
| `percent`          | 0 – 100                       | 0       |

### Colores

- Usar CSS vars (`var(--gold)`, `var(--tx-lo)`, etc.)
- Colores hardcoded solo en definiciones de temas
- Validar contraste mínimo WCAG AA (4.5:1)

## 13. Scripts disponibles

```bash
pnpm build          # Build recursivo de todos los paquetes
pnpm check          # Type-check completo
pnpm format         # Formateo con Prettier
pnpm format:check   # Verificación de formato (sin escribir)
pnpm lint           # Linting con ESLint
pnpm test           # Ejecutar tests con Vitest
pnpm test:watch     # Tests en modo watch
pnpm next-version   # Siguiente tag de release único (ver features/17)
pnpm validate       # Validación completa (format + check + lint + test)
```

### Aplicación desktop

```bash
pnpm --filter @clio-reader/desktop dev        # Desarrollo con HMR
pnpm --filter @clio-reader/desktop build      # Build de producción
pnpm --filter @clio-reader/desktop build:win        # Windows: NSIS; Linux/macOS: zip portable (prepara binarios win32)
pnpm --filter @clio-reader/desktop build:win:nsis  # Instalador NSIS (requiere Windows o wine)
pnpm --filter @clio-reader/desktop build:win:portable # Build portable Windows
pnpm --filter @clio-reader/desktop build:linux        # AppImage + .deb
pnpm --filter @clio-reader/desktop build:linux:appimage # Solo AppImage
pnpm --filter @clio-reader/desktop build:reader-mobile  # Bundle del reader para mobile
pnpm --filter @clio-reader/desktop preview     # Vista previa del build web
pnpm --filter @clio-reader/desktop generate-icons
```

### CI (GitHub Actions)

| Workflow            | Trigger                         | Qué ejecuta                                   |
| ------------------- | ------------------------------- | --------------------------------------------- |
| `quality.yml`       | push a `main` + PR              | `pnpm validate`                               |
| `build-checks.yml`  | PR (paths de `apps/desktop/**`) | `build:linux` + `build:win` (sin artefactos)  |
| `windows-build.yml` | tags `v*` + manual              | `build:win` → artefacto `clio-reader-windows` |
| `linux-build.yml`   | tags `v*` + manual              | `build:linux` → artefacto `clio-reader-linux` |

### Aplicación mobile (Android)

El lector de mobile reutiliza el bundle del reader de desktop dentro de
`react-native-webview`. El HTML autocontenido (`apps/mobile/assets/reader.html`)
se genera desde `apps/desktop/vite.reader.mobile.config.ts` y está en `.gitignore`; hay que
construirlo antes de empaquetar.

```bash
pnpm build                                                # Requerido: dist de packages
pnpm --filter @clio-reader/mobile build:reader            # Genera assets/reader.html
pnpm --filter @clio-reader/mobile start                   # Metro
pnpm --filter @clio-reader/mobile android                 # Metro + dispositivo/emulador
pnpm --filter @clio-reader/mobile ios                     # Metro + simulador iOS
pnpm --filter @clio-reader/mobile check                   # Type-check
pnpm --filter @clio-reader/mobile lint                    # Type-check sin emitir
```

Notas:

- pnpm + Metro: los `metro.config.cjs`/`babel.config.cjs` son CJS (el paquete es
  `"type": "module"`); el entry es `index.js` (no `expo/AppEntry.js`).
- Los paquetes `reader-*` compilan a `dist/src/index.js` (ver `tsconfig.build.json`
  con `rootDir: "."` y `paths: {}`), y Metro resuelve vía `package.json` `exports`.
- La comunicación reader→host usa sentinelas de `console.log` (`__clio_back__`,
  `__clio_rank__`, `__clio_prefs__`) reenviadas por un shim de `console.log`
  inyectado antes de cargar el contenido. Desktop usa el mismo mecanismo vía
  `webview` (`console-message`); mobile inyecta
  `window.__clioHostParams = { uri, format }` y llama a `window.__initFromHost(data)`.

## 14. Estrategia de tests

- **Unitarias**: Reglas puras y adaptadores aislados (`src/feature.test.ts` junto a `src/feature.ts`)
- **Integración**: Flujos importar → abrir → leer → guardar → cerrar → reanudar (`tests/` de cada paquete, p. ej. `packages/library/tests/`)
- **Contrato**: Todos los adaptadores cumplen `ReaderAdapter`
- **End-to-end**: Flujos críticos en Windows y Android

### Test doubles

- `InMemoryKeyValueStore` para aislamiento de tests
- `LocalRepository` con store en memoria
- Sin mocks externos; dependencias inyectadas

### Cobertura por use case

| Use case          | Escenarios a probar               |
| ----------------- | --------------------------------- |
| importBook        | Happy path, duplicado, validación |
| listBooks         | Filtros, sorting, vacío           |
| getBook           | Encontrado, no encontrado         |
| removeBook        | Cascada, no encontrado            |
| updateProgress    | Validación, debounce              |
| managePreferences | Globales, por libro, rangos       |
| manageBookmarks   | CRUD, aislamiento                 |
| manageNotes       | CRUD, body vacío                  |

## 15. Definición de terminado por feature

| Requisito     | Evidencia                                                                      |
| ------------- | ------------------------------------------------------------------------------ |
| Código        | Tipado estricto, responsabilidades separadas, sin duplicación                  |
| Pruebas       | Unitarias y de integración; manual multiplataforma cuando aplique              |
| Errores       | Estados de carga, vacío, error y recuperación definidos                        |
| Documentación | README o especificación en `documentation/features/` si complejidad lo amerita |
| Datos         | Migración y compatibilidad si cambia esquema                                   |
| Accesibilidad | Labels, foco, teclado o targets táctiles                                       |
| Rendimiento   | Métrica o límite para operaciones costosas                                     |
| Revisión      | PR revisado y CI verde                                                         |

## 16. Workflow de desarrollo

### Branches

| Tipo     | Prefijo     | Ejemplo                     |
| -------- | ----------- | --------------------------- |
| Feature  | `feature/`  | `feature/bookmarks-crud`    |
| Fix      | `fix/`      | `fix/epub-locator-recovery` |
| Chore    | `chore/`    | `chore/update-deps`         |
| Refactor | `refactor/` | `refactor/reader-session`   |

### Commits

Convencional commits:

```
feat: add bookmark CRUD operations
fix: handle missing EPUB chapter gracefully
chore: update vitest to 2.1.4
docs: add ADR for locator strategy
test: add integration tests for progress persistence
```

### Pull Requests

- Título descriptivo y conciso
- Revisión obligatoria antes de merge
- CI verde: `quality.yml` (`pnpm validate`) y, para cambios en `apps/desktop/**`, `build-checks.yml` (builds Linux y Windows)
- Documentar decisiones técnicas en ADR si aplica

## 17. Performance objetivo

| Métrica                   | Objetivo       |
| ------------------------- | -------------- |
| Tiempo a primera página   | < 2s           |
| Memoria (PDF 100 páginas) | < 150MB        |
| Scroll latency            | < 16ms (60fps) |
| Importación (100MB)       | < 5s           |
| Apertura CBZ              | < 1s           |
| Apertura EPUB             | < 1.5s         |

### Estrategias

- Renderizado bajo demanda (no precargar todas las páginas)
- Liberar recursos al cerrar documento
- Debounce en writes de progreso (500-1000ms)
- Guardado inmediato al cerrar/suspender

## 18. Documentación

### Documentos principales

| Documento                                          | Descripción                          |
| -------------------------------------------------- | ------------------------------------ |
| `documentation/01-definicion-mvp.md`               | Definición del MVP                   |
| `documentation/02-arquitectura-tecnica.md`         | Arquitectura técnica                 |
| `documentation/03-arquitectura-data-y-metadata.md` | Datos y metadata                     |
| `documentation/04-features-futuros.md`             | Features futuros                     |
| `documentation/05-plan-implementacion.md`          | Plan de implementación por fases     |
| `documentation/06-desarrollo-local.md`             | Guía de desarrollo local             |
| `documentation/07-flujo-webview.md`                | Flujo de comunicación con la WebView |
| `documentation/STYLE-GUIDE.md`                     | Guía de estilos y tokens de diseño   |
| `documentation/diseño-de-DB.md`                    | Esquema SQLite, FTS5 y rutas         |
| `documentation/diseño-de-DB-uso.md`                | Guía para ampliar el esquema         |
| `documentation/development/`                       | Guías de entorno (README, Windows)   |
| `documentation/skills/`                            | Guías de uso de los skills           |

### Architecture Decision Records

| ADR                                                      | Decisión                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `documentation/adr/0001-dominio-y-persistencia-local.md` | Dominio independiente, repositorio local, esquema versionado |
| `documentation/adr/0002-reader-core-state-machine.md`    | ReaderFactory, detección de formatos, máquina de estados     |
| `documentation/adr/0003-lector-sigue-paleta-app.md`      | El lector sigue la paleta activa de la app                   |

### Feature specifications

| Feature                       | Documento                                                         |
| ----------------------------- | ----------------------------------------------------------------- |
| Compartir metadata            | `documentation/features/01-compartir-metadata-data.md`            |
| Sincronización nube           | `documentation/features/02-sincronizacion-nube.md`                |
| Arquitectura SaaS             | `documentation/features/03-arquitectura-saas.md`                  |
| Otras plataformas             | `documentation/features/04-otras-plataformas.md`                  |
| Lectura Markdown              | `documentation/features/05-lectura-markdown.md`                   |
| Skill portabilidad            | `documentation/features/06-skill-portabilidad-plataformas.md`     |
| Library use cases             | `documentation/features/07-library-use-cases.md`                  |
| Plan notas                    | `documentation/features/08-feature-notas-plan.md`                 |
| Release MVP                   | `documentation/features/10-release-mvp.md`                        |
| Paletas de color              | `documentation/features/11-paletas-color-customizacion.md`        |
| Preferencias por libro        | `documentation/features/12-preferencias-por-libro.md`             |
| Exportar/importar anotaciones | `documentation/features/13-exportar-notas-highlights-markdown.md` |
| Lector mobile                 | `documentation/features/14-lector-mobile-android.md`              |
| Testing/deploy Android        | `documentation/features/15-guia-android-testing-deploy.md`        |
| Clio Feedback Core            | `documentation/features/16-clio-feedback-core.md`                 |
| Continuous Release            | `documentation/features/17-continuous-release.md`                 |
| Cover optimization            | `documentation/features/cover-image-optimization.md`              |

## 19. Plataformas objetivo

### Windows (primaria)

- **Runtime**: Electron
- **Almacenamiento**: better-sqlite3, filesystem
- **WebView**: electron webview
- **Input**: Teclado + ratón
- **Selector de archivos**: Electron dialog

### Android (primaria)

- **Runtime**: Expo + React Native
- **Almacenamiento**: JSON sobre `expo-file-system` (`LocalRepository` / `KeyValueStore`)
- **WebView**: react-native-webview
- **Input**: Gestos táctiles
- **Selector de archivos**: expo-document-picker
- **Permisos**: Lectura de almacenamiento

### iOS (preparada, no prioridad MVP)

- Misma base que Android via Expo
- Validar diferencias en ciclo de vida y permisos

### Notas por plataforma

- WebView difiere entre Electron y React Native
- File access: filesystem vs Content URI
- Lifecycle: `beforeunload` (Electron) vs AppState (RN)
- Storage: SQLite (desktop) vs JSON en `expo-file-system` (mobile)

## 20. Features pendientes

### Fase 7 — Completar

- [x] Conectar eventos del renderer con repositorios
- [x] Guardar progreso con debounce y al cerrar/suspender
- [x] Settings globales al iniciar (carga + guardado)
- [ ] Settings por libro desde la UI (infraestructura existe: `getBookPreferences`; falta pantalla de escritura)
- [ ] Documentar rangos válidos de colores, escalas, márgenes, tamaños (viven en `AGENTS.md` §12; falta moverlos a `documentation/`)

### Fase 8 — Implementar

- [x] CRUD de notas en el reader (crear/listar/editar/eliminar)
- [ ] CRUD de marcadores: crear desde el reader (resto del CRUD ya existe). **Pendiente: no funcional.** Icono de marcadores comentado en `LibraryView.tsx` (rail) y en `reader.html` (`r-mark`) hasta completar el CRUD.
- [x] Asociar a `bookId`, locator, posición normalizada, fecha
- [x] Notas ancladas al texto seleccionado (`locator.anchor` + `selectedText`)
- [x] Resaltado de texto en EPUB/MD (widget flotante, 6 colores, optimista + persistencia)
- [x] Vista de anotaciones filtrada por libro (`LibraryView` → Notas y resaltados)
- [x] Ordenamiento por posición o fecha
- [x] Integrar `@clio-reader/annotations` en desktop (filtro/orden/búsqueda/export)
- [x] Exportar/importar anotaciones por libro como Markdown (sección de notas)
- [ ] Reemplazar el stub `setupBookmark()` del reader
- [ ] Mobile (Android): notas (fuera de alcance desktop)

### Fase 9 — Mobile Android (MVP A–D)

Spec: `documentation/features/14-lector-mobile-android.md`

- [x] Bundle del reader reutilizable en WebView (`vite.reader.mobile.config.ts`)
- [x] Importar, abrir, eliminar y rank de libros
- [x] Progreso (locator + percent) y preferencias globales desde el reader
- [x] Persistencia JSON sobre `expo-file-system` (`LocalRepository`)
- [ ] Validar en dispositivo: worker PDF, memoria de archivos grandes, carga `file://` (ver riesgos en la spec)

### Clio Feedback Core (Fase 10)

Spec: `documentation/features/16-clio-feedback-core.md`

- [x] Contrato y validación en `packages/domain` (`Feedback*`, `createFeedback`)
- [x] Servicio y contexto en `packages/feedback` (`FeedbackService`, `collectFeedbackContext`)
- [x] Cola local SQLite: tabla `feedback` + métodos en `DrizzleRepository`
- [x] Bridge desktop (IPC `repo:*-feedback`, `get-app-info`, preload, `feedback-bridge.ts`)
- [x] UI `FeedbackPanel` (reacciones, categoría, comentario, aviso de privacidad)
- [x] Entradas: Rail "Compartir feedback" + "Reportar problema" en `LoadErrorState`
- [x] Identificador de instalación aleatorio (`localStorage`)
- [ ] Fase 1 en Mobile (UI + `LocalRepository`)
- [ ] Fase 2: API de recepción + sincronización de la cola
- [ ] Fase 3: revisión/grupos + GitHub Issues
- [ ] Fase 4: dashboards y notificaciones de seguimiento
- [ ] Decisiones pendientes: retención, backend, límites de frecuencia

### Features futuras (fuera del MVP)

| ID    | Feature                     | Documento                                |
| ----- | --------------------------- | ---------------------------------------- |
| F-001 | Compartir/exportar metadata | `features/01-compartir-metadata-data.md` |
| F-002 | Sincronización nube         | `features/02-sincronizacion-nube.md`     |
| F-003 | Arquitectura SaaS           | `features/03-arquitectura-saas.md`       |
| F-004 | Otras plataformas           | `features/04-otras-plataformas.md`       |
| F-006 | Preferencias por libro      | `features/12-preferencias-por-libro.md`  |
| F-007 | Resaltado en PDF            | `04-features-futuros.md`                 |

> F-005 (lectura Markdown) y F-008 (exportar/importar anotaciones) ya están implementadas.
