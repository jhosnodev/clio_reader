# Flujo del WebView — Lector de libros

| Campo                             | Valor                                        |
| --------------------------------- | -------------------------------------------- |
| **Nombre**                        | echo_reader — Flujo del WebView              |
| **Autor**                         | Manus AI                                     |
| **Fecha de creación**             | 28 de agosto de 2026                         |
| **Fecha de última actualización** | 28 de agosto de 2026                         |
| **Estado**                        | Implementado                                 |
| **Versión del documento**         | 1.0.0                                        |

## 1. Propósito

Este documento describe cómo el lector de libros utiliza un `<webview>` de Electron para renderizar contenido EPUB de forma aislada y segura. Explica la comunicación entre el shell de la aplicación y el contenido del lector.

## 2. Arquitectura del WebView

```text
┌─────────────────────────────────────────────┐
│  Shell (App.tsx)                            │
│  ┌───────────────────────────────────────┐  │
│  │  ReaderView.tsx                       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  <webview>                       │  │  │
│  │  │  ┌─────────────────────────────┐ │  │  │
│  │  │  │  reader.html                │ │  │  │
│  │  │  │  ┌───────────────────────┐  │ │  │  │
│  │  │  │  │  reader-entry.ts      │  │ │  │  │
│  │  │  │  │  ┌─────────────────┐  │  │ │  │  │
│  │  │  │  │  │  EpubReaderDoc  │  │  │ │  │  │
│  │  │  │  │  │  (reader-epub)  │  │  │ │  │  │
│  │  │  │  │  └─────────────────┘  │  │ │  │  │
│  │  │  │  └───────────────────────┘  │ │  │  │
│  │  │  └─────────────────────────────┘ │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 3. Flujo de apertura de un libro

### 3.1 Usuario hace clic en un libro

1. `LibraryView` recibe el evento `onOpenBook(book)`
2. `App.tsx` actualiza el estado `openBook`
3. Se renderiza `ReaderView` con `fileUri`, `format` y `onClose`

### 3.2 Verificación de archivo (ReaderView)

1. `ReaderView` llama a `bridge.checkFileExists(fileUri)` via IPC
2. Electron main process verifica si el archivo existe en disco
3. Si no existe → se muestra pantalla de error con opción de reubicar
4. Si existe → se carga el `<webview>` con la URL del reader

### 3.3 Carga del WebView

1. El `<webview>` carga `/reader.html?uri={uri}&format={format}`
2. Vite sirve `reader.html` como entry point separado
3. `reader.html` importa `reader-entry.ts` como módulo ES

### 3.4 Inicialización del lector (reader-entry.ts)

1. Se parsean los query params (`uri`, `format`)
2. Se valida que el formato sea soportado
3. Se crea el adaptador correspondiente (`EpubReaderDocument`)
4. Se llama a `document.open()`:
   - `fetch(uri)` obtiene el archivo EPUB
   - `parseEpub()` extrae OPF, spine, manifest
   - `extractToc()` extrae la tabla de contenidos
5. Se renderiza el primer capítulo
6. Se aplican estilos del tema
7. Se configuran los controles de navegación

### 3.5 Comunicación Shell ↔ WebView

El webview y el shell se comunican mediante `postMessage`:

| Mensaje                        | Dirección       | Descripción                         |
| ------------------------------ | --------------- | ----------------------------------- |
| `{ type: 'ready' }`           | WebView → Shell | El libro está cargado y listo       |
| `{ type: 'chapter-changed' }` | WebView → Shell | Se cambió de capítulo               |
| `{ type: 'error', message }`  | WebView → Shell | Ocurrió un error en el lector       |
| `{ type: 'close' }`           | WebView → Shell | El usuario quiere cerrar el libro   |

## 4. Navegación entre capítulos

### 4.1 Capítulo siguiente

1. Usuario hace clic en "Siguiente →"
2. `reader-entry.ts` llama a `document.goNext()`
3. `EpubReaderDocument` incrementa `currentChapterIndex`
4. Se obtiene el locator actualizado
5. Se renderiza el nuevo capítulo
6. Se actualizan los botones (deshabilitar "Siguiente" en el último capítulo)
7. Se envía `{ type: 'chapter-changed' }` al shell

### 4.2 Capítulo anterior

1. Usuario hace clic en "← Anterior"
2. `reader-entry.ts` llama a `document.goPrevious()`
3. `EpubReaderDocument` decrementa `currentChapterIndex`
4. Se obtiene el locator actualizado
5. Se renderiza el nuevo capítulo
6. Se actualizan los botones (deshabilitar "Anterior" en el primer capítulo)
7. Se envía `{ type: 'chapter-changed' }` al shell

## 5. Aislamiento y seguridad

### 5.1 Partition del WebView

El `<webview>` usa `partition="persist:reader"` para:
- Aislar las cookies y storage del lector
- Evitar contaminar la sesión principal
- Mantener el estado entre recargas

### 5.2 Políticas de contenido

- El contenido EPUB se renderiza en el contexto del webview
- No se permite navegación externa inesperada
- Los scripts activos del EPUB se ejecutan bajo las políticas del webview

### 5.3 Comunicación segura

- Solo se transmiten mensajes JSON serializables
- No se comparten referencias de objetos entre shell y webview
- Los message handlers validan el tipo de mensaje recibido

## 6. Manejo de errores

| Error                         | Causa                              | Manejo                                    |
| ----------------------------- | ---------------------------------- | ----------------------------------------- |
| `Falta parámetro uri`         | URL mal formada                    | Se muestra error en el webview            |
| `Formato no soportado`        | Extensión no reconocida            | Se muestra error con formatos válidos     |
| `Archivo no encontrado`       | URI inválida o archivo movido      | Se muestra error en ReaderView (shell)    |
| `Error de parseo EPUB`        | Archivo corrupto o inválido        | Se muestra error en el webview            |
| `Navegación en límite`        | Primer/último capítulo             | Se ignora silenciosamente                 |
| `Error de renderizado`        | CSS o HTML inválido del EPUB       | Se muestra error en el webview            |

## 7. Rendimiento

### 7.1 Carga bajo demanda

- Solo se carga el capítulo actual
- No se mantienen todos los capítulos en memoria
- El contenido HTML se renderiza directamente en el DOM

### 7.2 Limpieza de recursos

- Al cerrar el libro, se llama a `document.close()`
- Se libera la referencia al `Uint8Array` del EPUB
- Se resetea el índice del capítulo actual

### 7.3 Optimizaciones futuras

- Precarga del siguiente capítulo
- Caché de capítulos ya visitados
- Virtual scrolling para capítulos largos

## 8. Documentos relacionados

- [`02-arquitectura-tecnica.md`](../02-arquitectura-tecnica.md) — Capa de renderizado
- [`05-plan-implementacion.md`](../05-plan-implementacion.md) — Fase 6 (Renderer EPUB)
- [`adr/0002-reader-core-state-machine.md`](../adr/0002-reader-core-state-machine.md) — Máquina de estados
