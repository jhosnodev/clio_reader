# RFC-001 --- Knowledge Core

**Estado:** Propuesta para revisión\
**Versión:** 0.1.0\
**Fecha:** 2026-11-05\
**Producto:** Clio (nombre de trabajo; confirmar nombre definitivo)\
**Ámbito:** Desktop Electron, Mobile React Native, persistencia SQLite\
**Formatos:** EPUB, PDF, Markdown y CBZ

------------------------------------------------------------------------

## 1. Resumen

Este RFC define el núcleo de conocimiento de la aplicación: el conjunto
de entidades, contratos, persistencia y servicios que permiten gestionar
documentos, progreso de lectura, notas, resaltados, bookmarks,
colecciones, búsqueda e integraciones.

El objetivo no es reconstruir el lector existente. La aplicación ya
dispone de lectura, visualización de notas y resaltados, y exportación
Markdown. El propósito es estabilizar esas capacidades y convertirlas en
una plataforma extensible a cuatro formatos y a integraciones externas.

El Knowledge Core será:

-   **Local-first:** SQLite local es la fuente de verdad de cada
    instalación.
-   **Portable:** las anotaciones y metadatos pueden exportarse en
    formatos abiertos.
-   **Format-aware:** cada Reader Engine conserva los localizadores
    propios de su formato.
-   **Platform-independent:** el dominio y los casos de uso no dependen
    de Electron, React Native ni de un driver SQLite concreto.
-   **AI-provider independent:** las funciones de IA pueden usar modelos
    locales o proveedores elegidos por el usuario.
-   **Integration-safe:** Obsidian, NotebookLM y agentes MCP acceden
    mediante contratos; nunca mediante SQL directo.

### 1.1 Objetivos

1.  Formalizar el modelo de documentos y anotaciones.
2.  Preservar compatibilidad con el formato de exportación actual
    `clio:annotations`.
3.  Definir localizadores universales y específicos para EPUB, PDF,
    Markdown y CBZ.
4.  Definir migraciones SQLite y repositorios.
5.  Establecer contratos TypeScript compartidos.
6.  Separar Reader Engines del Knowledge Core.
7.  Definir importación/exportación idempotente y segura.
8.  Preparar una interfaz MCP local, inicialmente de solo lectura.

### 1.2 No objetivos de este RFC

-   Implementar sincronización cloud.
-   Definir un proveedor de IA.
-   Implementar OCR.
-   Definir una tienda o marketplace.
-   Diseñar toda la interfaz del lector.
-   Definir un sistema de cuentas o autenticación remota.
-   Sincronizar directamente archivos SQLite entre dispositivos.
-   Garantizar que todos los PDF o EPUB permitan selección de texto;
    esto depende del documento y del motor.

------------------------------------------------------------------------

## 2. Estado actual y compatibilidad

### 2.1 Capacidades existentes confirmadas

A partir de la implementación mostrada:

-   Biblioteca y lector funcionales.
-   Vista de notas y resaltados por libro.
-   Conteo de notas y resaltados.
-   Filtro por documento.
-   Ordenamiento por fecha.
-   Eliminación de anotaciones desde la vista.
-   Exportación Markdown.
-   Metadatos YAML con `clio: annotations` y `version: 1`.
-   Marcadores HTML con payload JSON:
    -   `<!-- clio:highlight {...} -->`
    -   `<!-- clio:note {...} -->`
-   IDs de anotación y de libro.
-   Para EPUB, localizadores con CFI, href, progression, positionOrder y
    contexto.

El ejemplo real contiene campos como:

``` yaml
---
clio: annotations
version: 1
bookId: mv15brgrarndfz
bookTitle: "Sönke Ahrens - El método Zettelkasten"
format: epub
exportedAt: 2026-11-05T18:03:11.890Z
---
```

Y payloads de anotación con `id`, `bookId`, `locator`, `locatorStart`,
`locatorEnd`, `selectedText`, `color`, `style`, `body`, `createdAt` y
`updatedAt`.

### 2.2 Decisión de compatibilidad

El formato actual se considera **Clio Annotations Markdown v1** y no
debe romperse.

El nuevo importador deberá:

-   Reconocer `clio: annotations` con `version: 1`.
-   Reconocer comentarios HTML `clio:highlight` y `clio:note`.
-   Conservar IDs, fechas, color, estilo, texto seleccionado y
    localizadores.
-   Aceptar notas sin texto seleccionado cuando el formato lo permita.
-   Tolerar bloques Markdown y espacios adicionales entre anotaciones.
-   No ejecutar ni interpretar HTML como contenido activo.
-   Informar de entradas inválidas sin descartar silenciosamente las
    válidas.

El exportador podrá seguir produciendo v1 mientras se formaliza el
formato. Una futura versión v2 solo se publicará cuando haya pruebas de
ida y vuelta y una estrategia de migración.

### 2.3 Observación sobre los timestamps

El ejemplo usa timestamps Unix en segundos dentro de los comentarios
JSON y una fecha ISO 8601 en `exportedAt`. El dominio almacenará fechas
UTC en milisegundos o ISO 8601 de forma consistente. El adaptador v1
convertirá los timestamps existentes sin alterar el instante original.

------------------------------------------------------------------------

## 3. Arquitectura

### 3.1 Principio

La arquitectura se organiza en cuatro capas:

1.  **Presentation:** Electron renderer y React Native.
2.  **Application:** casos de uso y orquestación.
3.  **Domain:** entidades, value objects, reglas e interfaces.
4.  **Infrastructure:** SQLite, filesystem, motores de lectura e
    integraciones.

El dominio no importa dependencias de Electron, React Native, DOM,
SQLite ni librerías concretas de lectura.

### 3.2 Diagrama lógico

``` mermaid
flowchart TB
    subgraph Apps["Aplicaciones"]
      Desktop["Electron Renderer"]
      Mobile["React Native"]
    end

    subgraph AppLayer["Application Layer"]
      UseCases["Use cases"]
      Services["Application services"]
      Ports["Ports / interfaces"]
    end

    subgraph Domain["Domain Layer"]
      Entities["Documents · Annotations · Collections"]
      Locations["DocumentLocation"]
      Events["Domain events"]
      Rules["Validation and policies"]
    end

    subgraph Infrastructure["Infrastructure Adapters"]
      SQLiteDesktop["SQLite adapter · Desktop"]
      SQLiteMobile["SQLite adapter · Mobile"]
      Files["Filesystem / document storage"]
      Readers["Reader Engines"]
      ImportExport["Markdown / JSON import-export"]
      MCP["Local MCP server"]
      Obsidian["Obsidian adapter"]
      NotebookLM["Google Docs / NotebookLM export"]
    end

    Desktop --> UseCases
    Mobile --> UseCases
    UseCases --> Entities
    UseCases --> Locations
    UseCases --> Ports
    Ports --> SQLiteDesktop
    Ports --> SQLiteMobile
    Ports --> Files
    Ports --> Readers
    Ports --> ImportExport
    Ports --> MCP
    Ports --> Obsidian
    Ports --> NotebookLM
    Entities --> Events
```

### 3.3 Flujo de anotación

``` mermaid
sequenceDiagram
    participant UI as Reader UI
    participant Engine as Reader Engine
    participant UC as CreateAnnotation
    participant Repo as Annotation Repository
    participant DB as SQLite

    UI->>Engine: getSelection()
    Engine-->>UI: selectedText + DocumentLocation
    UI->>UC: execute(input)
    UC->>UC: validate document and locator
    UC->>Repo: create(annotation)
    Repo->>DB: INSERT annotation
    DB-->>Repo: persisted record
    Repo-->>UC: Annotation
    UC-->>UI: Annotation created
```

### 3.4 Separación por plataforma

**Electron** - SQLite vive en el proceso `main`. - El renderer no accede
directamente a la base de datos ni al filesystem privilegiado. - La
comunicación se realiza mediante IPC tipado y una API limitada en
`preload`. - El servidor MCP, si se ejecuta como proceso local, utiliza
los mismos casos de uso y permisos.

**React Native** - Utiliza un adaptador SQLite propio. - No comparte el
driver de Electron. - Comparte dominio, casos de uso, contratos,
validaciones y migraciones compatibles. - El acceso a archivos se
abstrae mediante un puerto de filesystem.

**Regla:** compartir contratos y comportamiento; no forzar que ambas
plataformas compartan una implementación nativa.

------------------------------------------------------------------------

## 4. Organización del monorepo

Estructura de referencia, no obligación de adoptar todas las carpetas
desde el primer sprint:

``` text
reader-platform/
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   │   ├── main/
│   │   │   │   ├── database/
│   │   │   │   ├── ipc/
│   │   │   │   ├── filesystem/
│   │   │   │   └── mcp/
│   │   │   └── preload/
│   │   └── renderer/
│   └── mobile/
│       └── src/
├── packages/
│   ├── domain/
│   ├── application/
│   ├── contracts/
│   ├── database/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── adapters/
│   ├── readers/
│   │   ├── epub/
│   │   ├── pdf/
│   │   ├── markdown/
│   │   └── cbz/
│   ├── import-export/
│   │   ├── markdown/
│   │   └── json/
│   └── integrations/
│       ├── obsidian/
│       ├── mcp/
│       └── google-docs/
└── docs/
    ├── architecture/
    ├── decisions/
    └── formats/
```

No es necesario introducir Turborepo, pnpm ni una estructura de monorepo
si el repositorio actual no lo necesita. La regla arquitectónica
importante es que `domain` y `application` no importen módulos
específicos de plataforma.

------------------------------------------------------------------------

## 5. Modelo de dominio

### 5.1 Entidades principales

-   **Document:** identidad lógica del libro o documento.
-   **DocumentFile:** archivo físico asociado a un documento; permite
    reemplazos o variantes.
-   **Annotation:** nota, resaltado, comentario o anotación de región.
-   **Bookmark:** punto de navegación guardado.
-   **Collection:** agrupación de documentos.
-   **Tag:** etiqueta reutilizable.
-   **ReadingProgress:** posición de lectura por dispositivo o perfil
    local.
-   **ExternalMapping:** relación con una nota o recurso externo.
-   **SyncEvent:** evento preparado para una futura sincronización; no
    implica que exista cloud sync.

### 5.2 Decisión: una tabla unificada de anotaciones

Se propone una entidad `Annotation` con un campo `kind`:

-   `highlight`
-   `note`
-   `comment`
-   `region`

Los bookmarks se mantienen como entidad independiente porque su ciclo de
vida y comportamiento de navegación son diferentes.

Ventajas: - Una sola API para listar y filtrar anotaciones. - Una nota
puede existir sin selección de texto. - Una nota puede asociarse a un
resaltado mediante `parent_annotation_id`. - Se preservan los tipos
actuales `clio:highlight` y `clio:note` mediante el adaptador v1. - Es
más sencillo exportar, etiquetar y consultar anotaciones.

### 5.3 Relaciones ER

``` mermaid
erDiagram
    DOCUMENT ||--o{ DOCUMENT_FILE : has
    DOCUMENT ||--o{ ANNOTATION : contains
    DOCUMENT ||--o{ BOOKMARK : contains
    DOCUMENT ||--o{ READING_PROGRESS : tracks
    DOCUMENT ||--o{ COLLECTION_DOCUMENT : grouped
    COLLECTION ||--o{ COLLECTION_DOCUMENT : contains
    ANNOTATION ||--o{ ANNOTATION : parent_of
    ANNOTATION ||--o{ ANNOTATION_TAG : tagged
    TAG ||--o{ ANNOTATION_TAG : assigned
    DOCUMENT ||--o{ DOCUMENT_TAG : tagged
    TAG ||--o{ DOCUMENT_TAG : assigned
    DOCUMENT ||--o{ EXTERNAL_MAPPING : mapped
    ANNOTATION ||--o{ EXTERNAL_MAPPING : mapped
    DOCUMENT ||--o{ SYNC_EVENT : emits

    DOCUMENT {
      text id PK
      text title
      text format
      text metadata_json
      text created_at
      text updated_at
      text deleted_at
    }
    DOCUMENT_FILE {
      text id PK
      text document_id FK
      text uri
      text file_name
      text mime_type
      text content_hash
      integer file_size
    }
    ANNOTATION {
      text id PK
      text document_id FK
      text parent_annotation_id FK
      text kind
      text selected_text
      text body
      text locator_json
      text color
      text style
      text created_at
      text updated_at
    }
    BOOKMARK {
      text id PK
      text document_id FK
      text label
      text locator_json
      text created_at
      text updated_at
    }
    COLLECTION {
      text id PK
      text name
      text description
      text created_at
      text updated_at
    }
    TAG {
      text id PK
      text name
      text color
    }
    READING_PROGRESS {
      text id PK
      text document_id FK
      text locator_json
      real progression
      text updated_at
    }
    EXTERNAL_MAPPING {
      text id PK
      text entity_type
      text entity_id
      text provider
      text external_id
      text external_uri
    }
    SYNC_EVENT {
      text id PK
      text entity_type
      text entity_id
      text operation
      text payload_json
      text created_at
    }
```

### 5.4 Identificadores

-   Usar UUID para nuevas entidades.
-   Los IDs cortos existentes, como `mv15brgrarndfz`, deben conservarse
    durante la importación.
-   No regenerar IDs de anotaciones cuando se importan archivos propios.
-   El ID de un documento debe ser estable aunque cambie el nombre del
    archivo.
-   No usar el path del archivo como identidad del documento.

UUID v7 es una opción recomendada para nuevas entidades por su orden
temporal, pero el dominio debe tratar los IDs como strings opacos. No
debe asumir el formato UUID para los IDs históricos.

### 5.5 Fechas

-   Guardar instantes en UTC.
-   Representar fechas en SQLite como texto ISO 8601 UTC
    (`YYYY-MM-DDTHH:mm:ss.sssZ`) para facilitar inspección.
-   Convertir los timestamps Unix de Clio v1 en el adaptador.
-   `created_at` no cambia durante una importación idempotente.
-   `updated_at` cambia solo cuando el contenido realmente cambia.

### 5.6 Borrado

-   Usar `deleted_at` para documentos, anotaciones, bookmarks y
    colecciones cuando sea necesario conservar trazabilidad.
-   La papelera y la recuperación pueden implementarse en la aplicación.
-   No exponer borrado irreversible mediante MCP en la primera versión.
-   Una exportación de backup debe poder incluir entidades eliminadas si
    el usuario selecciona esa opción.

------------------------------------------------------------------------

## 6. Localizadores universales

### 6.1 Principio

`DocumentLocation` es una envoltura tipada para conservar localizadores
específicos de cada formato. No debe reducirse todo a un número de
página o porcentaje.

El localizador debe ser suficientemente rico para: - Volver a una
selección. - Navegar al punto de lectura. - Recuperar una anotación si
cambió ligeramente el archivo. - Mostrar una referencia comprensible en
exportaciones.

### 6.2 Contratos TypeScript

``` typescript
export type DocumentFormat = "epub" | "pdf" | "markdown" | "cbz";

export interface TextAnchor {
  exact?: string;
  prefix?: string;
  suffix?: string;
  startOffset?: number;
  endOffset?: number;
}

export interface BaseLocation {
  format: DocumentFormat;
  progression?: number; // 0..1
  anchor?: TextAnchor;
  sourceHash?: string;
}

export interface EpubLocation extends BaseLocation {
  format: "epub";
  href: string;
  cfi?: string;
  positionOrder?: number;
}

export interface PdfLocation extends BaseLocation {
  format: "pdf";
  pageIndex: number; // zero-based
  pageLabel?: string;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  coordinateSpace?: "normalized" | "pdf-points";
}

export interface MarkdownLocation extends BaseLocation {
  format: "markdown";
  headingPath?: string[];
  headingId?: string;
  lineStart?: number;
  lineEnd?: number;
  charStart?: number;
  charEnd?: number;
}

export interface CbzLocation extends BaseLocation {
  format: "cbz";
  pageIndex: number;
  pageFileName?: string;
  region?: { x: number; y: number; width: number; height: number };
  coordinateSpace?: "normalized";
}

export type DocumentLocation =
  | EpubLocation
  | PdfLocation
  | MarkdownLocation
  | CbzLocation;
```

### 6.3 Reglas de coordenadas

-   Las coordenadas normalizadas deben estar entre 0 y 1.
-   Para PDF, si se almacenan puntos PDF, debe indicarse explícitamente
    `coordinateSpace`.
-   Para CBZ, las regiones normalizadas son relativas al tamaño de la
    imagen original, no al viewport.
-   `pageIndex` es zero-based internamente; la interfaz puede mostrar
    páginas desde 1.
-   `progression` debe estar entre 0 y 1 y se considera una aproximación
    de navegación, no una identidad de posición.

### 6.4 Resolución de anotaciones

Al abrir un documento: 1. Comparar el `sourceHash` guardado con el
archivo actual. 2. Si coincide, intentar resolver el localizador nativo.
3. Si no coincide, intentar recuperar mediante anchor (`exact`,
`prefix`, `suffix`) cuando el formato sea textual. 4. Para PDF/CBZ,
intentar página y geometría si el documento es equivalente. 5. Si no se
puede resolver, conservar la anotación y marcarla como `needs_review`;
nunca eliminarla.

------------------------------------------------------------------------

## 7. Contratos de Reader Engines

### 7.1 Contrato común

El Reader Engine interpreta un formato. No es propietario de las
anotaciones ni persiste datos directamente.

``` typescript
export interface DocumentMetadata {
  title?: string;
  authors?: string[];
  language?: string;
  publisher?: string;
  publishedAt?: string;
  pageCount?: number;
  coverUri?: string;
  extra?: Record<string, unknown>;
}

export interface ReaderCapabilities {
  textSelection: boolean;
  textSearch: boolean;
  regionAnnotation: boolean;
  reflowable: boolean;
  toc: boolean;
  pagination: boolean;
}

export interface ReaderSelection {
  text: string;
  start: DocumentLocation;
  end: DocumentLocation;
}

export interface SearchResult {
  text: string;
  location: DocumentLocation;
  contextBefore?: string;
  contextAfter?: string;
}

export interface ReaderEngine {
  readonly format: DocumentFormat;
  open(source: DocumentSource): Promise<void>;
  close(): Promise<void>;
  getMetadata(): Promise<DocumentMetadata>;
  getCapabilities(): ReaderCapabilities;
  getCurrentLocation(): Promise<DocumentLocation | null>;
  navigateTo(location: DocumentLocation): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getSelection?(): Promise<ReaderSelection | null>;
}
```

`DocumentSource` y `SearchOptions` deben definirse en `contracts` y no
contener tipos de Electron, DOM o React Native.

### 7.2 EPUB Engine

Responsabilidades: - Parsear metadatos y tabla de contenidos. - Navegar
por `href` y CFI. - Capturar selección de texto. - Producir
`EpubLocation` con `href`, `cfi`, `progression`, `positionOrder` y
anchor. - Buscar texto. - Restaurar la posición de lectura.

No debe: - Guardar directamente anotaciones en SQLite. - Suponer que CFI
seguirá siendo válido tras modificar el EPUB. - Descartar anchors cuando
exista CFI.

### 7.3 PDF Engine

Responsabilidades: - Renderizar páginas. - Obtener metadatos y cantidad
de páginas. - Capturar selección de texto cuando el PDF lo permita. -
Producir localizadores con `pageIndex` y geometría. - Buscar texto si
existe capa textual.

Limitaciones: - Un PDF escaneado puede no tener texto seleccionable. -
OCR queda fuera de este RFC. - Las geometrías deben indicar su sistema
de coordenadas.

### 7.4 Markdown Engine

Responsabilidades: - Renderizar Markdown de forma segura. - Navegar por
encabezados. - Capturar selecciones y líneas. - Buscar texto. - Producir
`MarkdownLocation` con heading path y offsets.

El importador Markdown de anotaciones Clio es distinto del Reader Engine
Markdown: uno interpreta el documento de lectura; el otro interpreta el
formato de intercambio.

### 7.5 CBZ Engine

Responsabilidades: - Leer el archivo como colección ordenada de
imágenes. - Navegar por página. - Guardar bookmarks. - Permitir
anotaciones de región. - Producir `CbzLocation`.

No debe forzar highlights textuales en páginas que no contienen texto.
OCR y reconocimiento de texto son capacidades futuras y opcionales.

------------------------------------------------------------------------

## 8. SQLite: esquema inicial

Este esquema es una base de diseño para revisión. Debe adaptarse a las
tablas que ya existan antes de ejecutar migraciones en una base de datos
con usuarios.

### 8.1 Configuración

``` sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

`WAL` mejora la convivencia entre lecturas y escrituras, pero la
aplicación debe cerrar conexiones correctamente y no copiar una base de
datos activa como si fuera un único archivo independiente.

### 8.2 Migración inicial

``` sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  format TEXT NOT NULL CHECK (format IN ('epub', 'pdf', 'markdown', 'cbz')),
  description TEXT,
  language TEXT,
  authors_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  cover_uri TEXT,
  source_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_documents_title ON documents(title);
CREATE INDEX idx_documents_format ON documents(format);
CREATE INDEX idx_documents_updated_at ON documents(updated_at);
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at);

CREATE TABLE document_files (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  content_hash TEXT,
  file_size INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_document_files_document_id ON document_files(document_id);
CREATE INDEX idx_document_files_hash ON document_files(content_hash);

CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  parent_annotation_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('highlight', 'note', 'comment', 'region')),
  selected_text TEXT,
  body TEXT,
  locator_json TEXT NOT NULL,
  color TEXT,
  style TEXT,
  source_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_review', 'orphaned')),
  origin TEXT NOT NULL DEFAULT 'local',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_annotation_id) REFERENCES annotations(id) ON DELETE SET NULL
);

CREATE INDEX idx_annotations_document_id ON annotations(document_id);
CREATE INDEX idx_annotations_kind ON annotations(kind);
CREATE INDEX idx_annotations_parent_id ON annotations(parent_annotation_id);
CREATE INDEX idx_annotations_updated_at ON annotations(updated_at);
CREATE INDEX idx_annotations_deleted_at ON annotations(deleted_at);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  label TEXT,
  locator_json TEXT NOT NULL,
  source_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_bookmarks_document_id ON bookmarks(document_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(name)
);

CREATE TABLE annotation_tags (
  annotation_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (annotation_id, tag_id),
  FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE document_tags (
  document_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE collection_documents (
  collection_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, document_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_collection_documents_position
  ON collection_documents(collection_id, position);

CREATE TABLE reading_progress (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  device_id TEXT,
  locator_json TEXT NOT NULL,
  progression REAL CHECK (progression IS NULL OR (progression >= 0 AND progression <= 1)),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(document_id, device_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE external_mappings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('document', 'annotation', 'collection')),
  entity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_uri TEXT,
  last_exported_at TEXT,
  last_exported_version INTEGER,
  sync_status TEXT NOT NULL DEFAULT 'not_synced'
    CHECK (sync_status IN ('not_synced', 'exported', 'conflict', 'error')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, provider),
  UNIQUE(provider, external_id)
);

CREATE INDEX idx_external_mappings_entity
  ON external_mappings(entity_type, entity_id);

CREATE TABLE sync_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('created', 'updated', 'deleted')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed'))
);

CREATE INDEX idx_sync_events_status_created
  ON sync_events(status, created_at);
```

### 8.3 Búsqueda FTS5

``` sql
CREATE VIRTUAL TABLE annotation_search USING fts5(
  annotation_id UNINDEXED,
  document_id UNINDEXED,
  selected_text,
  body,
  content='',
  tokenize='unicode61'
);
```

La tabla FTS es una proyección de búsqueda, no la fuente de verdad. La
aplicación debe mantenerla mediante repositorios o triggers probados.
Antes de adoptar triggers, validar su comportamiento con la versión
SQLite incluida en Electron y disponible en React Native.

No indexar contenido completo de libros por defecto en esta primera
migración. La búsqueda de anotaciones y metadatos es el primer alcance.

### 8.4 Consideraciones de migración

-   Usar migraciones versionadas e incrementales.
-   Hacer backup antes de migraciones destructivas.
-   No asumir que todas las instalaciones parten de una base vacía.
-   Crear índices después de evaluar el tamaño de bibliotecas reales.
-   Validar FTS5 en ambas plataformas.
-   No guardar rutas absolutas como única referencia portable; usar un
    identificador de archivo y un URI administrado por el adaptador de
    filesystem.
-   Revisar la política `ON DELETE` antes de aplicarla a datos
    existentes.

------------------------------------------------------------------------

## 9. Contratos de repositorio y casos de uso

### 9.1 Repositorios

``` typescript
export interface DocumentRepository {
  getById(id: string): Promise<Document | null>;
  findByHash(hash: string): Promise<Document | null>;
  list(query?: DocumentQuery): Promise<Document[]>;
  save(document: Document): Promise<void>;
  softDelete(id: string): Promise<void>;
}

export interface AnnotationRepository {
  getById(id: string): Promise<Annotation | null>;
  listByDocument(documentId: string, query?: AnnotationQuery): Promise<Annotation[]>;
  search(query: string, filters?: AnnotationFilters): Promise<Annotation[]>;
  save(annotation: Annotation): Promise<void>;
  saveMany(annotations: Annotation[]): Promise<void>;
  softDelete(id: string): Promise<void>;
}

export interface ReadingProgressRepository {
  get(documentId: string, deviceId?: string): Promise<ReadingProgress | null>;
  save(progress: ReadingProgress): Promise<void>;
}
```

### 9.2 Servicio de conocimiento

``` typescript
export interface KnowledgeService {
  getDocument(id: string): Promise<Document | null>;
  listDocuments(query?: DocumentQuery): Promise<Document[]>;
  searchDocuments(query: string): Promise<Document[]>;
  searchAnnotations(query: string, filters?: AnnotationFilters): Promise<Annotation[]>;
  getDocumentAnnotations(documentId: string): Promise<Annotation[]>;
  createAnnotation(input: CreateAnnotationInput): Promise<Annotation>;
  updateAnnotation(id: string, input: UpdateAnnotationInput): Promise<Annotation>;
  deleteAnnotation(id: string): Promise<void>;
  saveReadingProgress(input: SaveReadingProgressInput): Promise<void>;
}
```

### 9.3 Reglas de aplicación

-   Validar que la anotación pertenece al documento indicado.
-   Validar que `locator.format` coincide con `document.format`.
-   Permitir una nota sin `selectedText` ni localizador textual si es
    una nota general de documento; definir un localizador opcional para
    ese caso.
-   No modificar IDs al actualizar.
-   Actualizar `updated_at` solo si hay cambios.
-   Ejecutar escrituras relacionadas dentro de una transacción.
-   Emitir eventos de dominio después de persistir correctamente.

------------------------------------------------------------------------

## 10. Importación y exportación

### 10.1 Formatos soportados

**Markdown Clio v1** - Compatibilidad con el formato ya generado. - YAML
frontmatter. - Comentarios HTML `clio:highlight` y `clio:note`. - Texto
seleccionado y cuerpo de nota en bloques Markdown.

**JSON** - Backup estructurado. - Incluye documentos, archivos
(referencias, no necesariamente los binarios), anotaciones, bookmarks,
tags, colecciones y progreso. - Debe incluir `schemaVersion`,
`exportedAt` y metadatos de origen.

### 10.2 Contrato de exportación

``` typescript
export type ExportFormat = "clio-markdown" | "json";

export interface ExportOptions {
  includeDocumentMetadata?: boolean;
  includeAnnotations?: boolean;
  includeBookmarks?: boolean;
  includeReadingProgress?: boolean;
  includeDeleted?: boolean;
}

export interface ExportArtifact {
  fileName: string;
  mimeType: string;
  content: string | Uint8Array;
}

export interface ExportResult {
  success: boolean;
  exportedCount: number;
  artifacts: ExportArtifact[];
  warnings: string[];
  errors: string[];
}

export interface Exporter {
  readonly id: string;
  readonly format: ExportFormat;
  export(documentIds: string[], options?: ExportOptions): Promise<ExportResult>;
}
```

### 10.3 Contrato de importación

``` typescript
export type ImportConflictPolicy =
  | "skip"
  | "merge"
  | "replace"
  | "duplicate";

export interface ImportOptions {
  dryRun?: boolean;
  conflictPolicy?: ImportConflictPolicy;
  preserveIds?: boolean;
}

export interface ImportIssue {
  code: string;
  message: string;
  line?: number;
  entityId?: string;
}

export interface ImportPreview {
  documentsToCreate: number;
  annotationsToCreate: number;
  annotationsToUpdate: number;
  skipped: number;
  issues: ImportIssue[];
}

export interface ImportResult extends ImportPreview {
  success: boolean;
  importedCount: number;
  errors: ImportIssue[];
}

export interface Importer {
  readonly id: string;
  canImport(input: string | Uint8Array): Promise<boolean>;
  preview(input: string | Uint8Array, options?: ImportOptions): Promise<ImportPreview>;
  import(input: string | Uint8Array, options?: ImportOptions): Promise<ImportResult>;
}
```

### 10.4 Política de conflictos

-   `skip`: si existe el ID, no modificar la entidad local.
-   `merge`: actualizar solo campos que el importador pueda reconciliar
    de forma segura; documentar precedencia.
-   `replace`: reemplazar la entidad coincidente después de mostrar una
    vista previa.
-   `duplicate`: crear una copia con nuevo ID y registrar el ID original
    en metadatos de origen.

El valor por defecto recomendado es `skip` o `merge` con vista previa;
no `replace`.

### 10.5 Idempotencia

Importar dos veces el mismo archivo no debe duplicar anotaciones.

La identidad primaria será `annotation.id` cuando se preserve el ID. Si
no existe, usar una clave de deduplicación calculada con documento,
tipo, texto seleccionado, localizador y fecha de creación. La clave
secundaria debe tratarse como heurística, no como identidad absoluta.

### 10.6 Preservación de cambios externos

Una exportación no es sincronización.

-   No sobrescribir automáticamente notas editadas en Obsidian.
-   Mantener IDs estables.
-   Registrar `external_mappings` cuando se conozca una relación.
-   Distinguir contenido originado en el lector de contenido externo.
-   Si hay conflicto, presentar una vista previa y dejar que el usuario
    decida.

### 10.7 Pruebas de ida y vuelta

El formato v1 debe tener fixtures basados en exportaciones reales,
incluyendo: - Resaltado sin nota. - Nota asociada a texto
seleccionado. - Nota sin selección. - Varias anotaciones en una misma
ubicación. - Caracteres Unicode, comillas y saltos de línea. -
Comentarios HTML con JSON escapado. - IDs históricos no UUID. - Fechas
Unix en segundos. - Localizadores EPUB con CFI y anchors.

Criterio de aceptación: exportar → importar → exportar conserva
semánticamente los IDs, textos, notas, colores, estilos, fechas y
localizadores.

------------------------------------------------------------------------

## 11. Integraciones

### 11.1 Obsidian

Primera versión basada en filesystem:

-   Configurar Vault y carpeta destino.
-   Exportar una nota por documento o colección.
-   Usar frontmatter con IDs estables.
-   No requerir plugin de Obsidian.
-   No sobrescribir archivos editados externamente sin una política de
    conflicto.
-   Mantener una sección claramente delimitada para contenido generado
    por Clio.

Ejemplo de frontmatter futuro:

``` yaml
---
clio_id: "document-id"
title: "Título del documento"
source_format: epub
source_hash: "..."
---
```

### 11.2 NotebookLM

El primer alcance es generar documentos compatibles como fuentes
(Markdown o Google Docs mediante APIs disponibles). No se debe asumir
que existe una API pública para administrar notebooks o añadir fuentes
automáticamente sin verificar las capacidades vigentes.

El usuario elige qué contenido exportar. No enviar bibliotecas completas
por defecto.

### 11.3 Hermes Agent mediante MCP

El servidor MCP será un adaptador sobre `KnowledgeService`, no una
conexión directa a SQLite.

Primera versión: herramientas de solo lectura.

Herramientas propuestas:

  ----------------------------------------------------------------------------
  Tool                         Entrada                 Resultado
  ---------------------------- ----------------------- -----------------------
  `list_documents`             filtros, límite, cursor Metadatos de documentos

  `get_document`               documentId              Metadatos de un
                                                       documento

  `search_documents`           query, filtros, límite  Documentos coincidentes

  `search_annotations`         query, documentId,      Notas y resaltados
                               kind, tags              

  `get_document_annotations`   documentId              Anotaciones del
                                                       documento

  `get_reading_progress`       documentId              Progreso y localizador
  ----------------------------------------------------------------------------

Reglas: - Exponer solo documentos autorizados por el usuario. - Limitar
resultados y tamaño de texto. - No enviar archivos completos por
defecto. - No exponer paths locales sensibles salvo que sea
imprescindible y autorizado. - No ofrecer borrado en MCP inicial. - Las
futuras herramientas de escritura (`create_note`, por ejemplo)
requerirán consentimiento y permisos explícitos.

### 11.4 Contrato de permisos MCP

``` typescript
export interface McpAccessPolicy {
  allowedTools: string[];
  allowedDocumentIds?: string[];
  allowAnnotationWrite: boolean;
  allowDocumentContent: boolean;
  maxResults: number;
  maxTextLength: number;
}
```

El servidor local debe ejecutarse bajo el usuario del sistema operativo
y utilizar un canal local (por ejemplo, STDIO cuando el cliente lo
soporte). No abrir un puerto de red sin autenticación.

------------------------------------------------------------------------

## 12. Seguridad y privacidad

-   Tratar EPUB, PDF, Markdown y CBZ como archivos no confiables.
-   No ejecutar scripts o HTML embebido de documentos.
-   Sanitizar HTML de Markdown.
-   Validar tamaños y límites de archivos comprimidos, especialmente
    CBZ.
-   Prevenir path traversal al extraer archivos.
-   Limitar recursos consumidos al procesar documentos.
-   No transmitir contenido a servicios externos sin acción explícita.
-   No recopilar telemetría por defecto.
-   No incluir contenido de libros en logs de errores.
-   Proteger los endpoints IPC y validar argumentos.
-   Mantener las herramientas MCP bajo permisos mínimos.

------------------------------------------------------------------------

## 13. Estrategia de pruebas

### 13.1 Dominio

-   Validación de `DocumentLocation`.
-   Compatibilidad entre formato y localizador.
-   Relaciones parent/child de anotaciones.
-   Reglas de timestamps e IDs.
-   Estados `active`, `needs_review` y `orphaned`.

### 13.2 Persistencia

-   Migraciones desde base vacía.
-   Migraciones desde la base actual (pendiente de inspección).
-   Integridad referencial.
-   Transacciones.
-   Borrado lógico.
-   FTS5 en desktop y mobile.

### 13.3 Reader Engines

Cada motor debe probar: - Abrir y cerrar documento. - Obtener
metadatos. - Leer y restaurar localizador. - Navegar a localizador. -
Buscar texto cuando el formato lo permita. - Capturar selección o región
según capacidad.

### 13.4 Importación/exportación

-   Fixtures reales v1.
-   Importación repetida.
-   Conflictos de IDs.
-   JSON inválido.
-   YAML inválido.
-   Comentarios HTML malformados.
-   Unicode.
-   Pérdida o alteración de localizadores.
-   Archivos grandes y entradas parciales.

### 13.5 Integraciones

-   Obsidian: no sobrescribir modificaciones externas.
-   MCP: validar permisos, límites y aislamiento.
-   NotebookLM: exportar solo elementos seleccionados por el usuario.

------------------------------------------------------------------------

## 14. Plan de implementación

El orden propuesto minimiza el riesgo de reescribir capacidades
existentes.

  -----------------------------------------------------------------------
  Fase                    Trabajo                 Resultado
  ----------------------- ----------------------- -----------------------
  0                       Auditar código y SQLite Mapa de lo existente y
                          actuales                brechas

  1                       Formalizar tipos de     Contratos TypeScript
                          dominio                 

  2                       Adaptar repositorios    Persistencia compatible
                          SQLite                  

  3                       Implementar             Localizadores por
                          `DocumentLocation`      formato
                          discriminado            

  4                       Encapsular Reader       Motores independientes
                          Engines                 del Knowledge Core

  5                       Formalizar Clio         Importador/exportador
                          Markdown v1             probado

  6                       Añadir JSON backup      Portabilidad completa
                                                  de metadatos

  7                       Implementar FTS de      Búsqueda de
                          anotaciones             conocimiento

  8                       Obsidian adapter        Exportación segura a
                                                  Vault

  9                       MCP read-only           Consulta local desde
                                                  agentes

  10                      NotebookLM export       Fuentes seleccionadas

  11                      Preparar eventos de     Base para sync futuro,
                          sincronización          sin cloud sync aún
  -----------------------------------------------------------------------

### Primera tarea técnica

Antes de crear migraciones, realizar una auditoría del repositorio:

1.  Identificar tablas actuales de libros, notas, highlights y progreso.
2.  Identificar el modelo y servicio que generan el Markdown actual.
3.  Localizar la implementación de EPUB y cómo obtiene CFI/anchors.
4.  Identificar dónde se guardan los archivos originales.
5.  Documentar los IDs y timestamps existentes.
6.  Crear fixtures de exportación real.
7.  Diseñar migraciones incrementales desde el esquema existente.

**No ejecutar el SQL de este RFC directamente sobre una instalación
existente sin comparar primero el esquema actual.**

------------------------------------------------------------------------

## 15. Decisiones pendientes

  -----------------------------------------------------------------------
  Decisión                Estado                  Criterio
  ----------------------- ----------------------- -----------------------
  Nombre definitivo del   Pendiente               Branding
  producto                                        

  Esquema SQLite actual   Requiere auditoría      Evitar migración
                                                  destructiva

  Librería EPUB           No especificada         CFI, selección y
                                                  compatibilidad

  Librería PDF            No especificada         Texto, geometría y
                                                  rendimiento

  Workflow React Native   No especificado         Expo o bare

  Driver SQLite mobile    No especificado         Compatibilidad y
                                                  mantenimiento

  IDs nuevos              Propuesta UUID v7       Estabilidad
                                                  multiplataforma

  Licencia                Pendiente               Revisar estrategia de
                                                  sostenibilidad

  Formato de exportación  No iniciar todavía      Mantener v1 hasta tener
  v2                                              fixtures

  Sincronización          Fuera de alcance        Validar primero modelo
                          inicial                 local
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Criterios de aceptación del RFC

El RFC podrá considerarse implementable cuando:

-   [ ] El esquema actual esté auditado y exista una estrategia de
    migración incremental.
-   [ ] Las entidades y relaciones estén acordadas.
-   [ ] Los contratos `DocumentLocation` estén definidos para los cuatro
    formatos.
-   [ ] Cada Reader Engine tenga capacidades explícitas.
-   [ ] El formato Clio Markdown v1 tenga especificación y fixtures.
-   [ ] Importar y exportar sea idempotente y preserve IDs.
-   [ ] SQLite sea la fuente de verdad local.
-   [ ] Los adaptadores de integración no accedan directamente a SQL.
-   [ ] MCP empiece con permisos de solo lectura.
-   [ ] Exista una política documentada de seguridad y privacidad.

## 17. Principio rector

> The Knowledge Core belongs to the user.
>
> It must remain local-first, portable and independent from any AI
> provider or hosted service. Integrations may extend the user's
> workflow, but they must never become gatekeepers of the user's
> library, annotations or personal knowledge.

------------------------------------------------------------------------

## Apéndice A --- Glosario

-   **Document:** identidad lógica de un libro o documento.
-   **DocumentFile:** archivo físico asociado a un documento.
-   **Annotation:** nota, resaltado, comentario o región.
-   **Bookmark:** punto guardado de navegación.
-   **Locator:** referencia específica a una posición dentro del
    documento.
-   **Anchor:** contexto textual usado para recuperar una selección.
-   **Reader Engine:** adaptador que interpreta un formato.
-   **Knowledge Core:** dominio, casos de uso y persistencia de
    documentos y conocimiento.
-   **BYOK:** Bring Your Own Key; el usuario utiliza sus propias
    credenciales de un proveedor.
-   **MCP:** Model Context Protocol; protocolo para exponer herramientas
    y contexto a clientes compatibles.
