# Flujo del WebView — Lector de libros

| Campo                             | Valor                           |
| --------------------------------- | ------------------------------- |
| **Nombre**                        | clio_reader — Flujo del WebView |
| **Autor**                         | Manus AI                        |
| **Fecha de creación**             | 28 de agosto de 2026            |
| **Fecha de última actualización** | 7 de noviembre de 2026          |
| **Estado**                        | Implementado                    |
| **Versión del documento**         | 1.1.0                           |

## 1. Propósito

Este documento describe cómo el lector utiliza un `<webview>` de Electron (y en Android un `react-native-webview`) para renderizar contenido **EPUB, PDF, CBZ y Markdown** de forma aislada y segura. Explica la comunicación entre el shell de la aplicación y el contenido del lector.

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
│  │  │  │  │  │ ReaderFactory   │  │  │ │  │  │
│  │  │  │  │  │ → adaptador     │  │  │ │  │  │
│  │  │  │  │  │  epub/pdf/cbz/md│  │  │ │  │  │
│  │  │  │  │  └─────────────────┘  │  │ │  │  │
│  │  │  │  └───────────────────────┘  │ │  │  │
│  │  │  └─────────────────────────────┘ │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

El adaptador concreto se elige dentro del webview con `ReaderFactory.create(source, format)`. El shell no conoce el detalle de cada formato.

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

1. Se leen `uri` y `format` de los query params (o de `window.__clioHostParams` en mobile)
2. Se valida que el formato sea soportado
3. El **host** (`ReaderView`) lee el archivo con `bridge.readFile`, lo pasa en base64 y llama a `window.__initFromHost({ locale, fileDataB64, preferences, metadata, notes, highlights, savedProgress })` vía `executeJavaScript`
4. El reader crea el adaptador correspondiente con `ReaderFactory.create(...)` y llama a `document.open(bytes)`
5. Se renderiza la primera página/capítulo/imagen, se aplican estilos del tema y se configuran los controles
6. El host inyecta la paleta activa con `window.__applyPalette(cssVars)`

### 3.5 Comunicación Shell ↔ WebView

La comunicación **no usa `postMessage`**. Hay dos canales:

#### Shell → WebView: `executeJavaScript`

| Llamada                                                                   | Descripción                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `window.__initFromHost(initData)`                                         | Arranque: locale, bytes del archivo, prefs, metadata, anotaciones, progreso |
| `window.__applyPalette(cssVars)`                                          | Aplica la paleta activa de la app al reader                                 |
| `window.__updateRank(rank)`                                               | Empuja un cambio de rating sin reinicializar                                |
| `window.__getCurrentLocator()`                                            | Lee el locator actual (retorno como string JSON)                            |
| `window.__pendingNotes` / `__pendingNoteUpdates` / `__pendingNoteDeletes` | Colas de notas a persistir (el host hace el drain)                          |
| `window.__pendingHighlights` / `__pendingHighlightDeletes`                | Colas de resaltados a persistir                                             |
| `window.__noteSaved()` / `__noteError()`                                  | Acks de confirmación/error de cada operación                                |

#### WebView → Shell: sentinelas por `console.log` + evento `console-message`

| Sentinela        | Payload                  | Acción en el shell                                                                 |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `__clio_back__`  | —                        | Cerrar el libro (además de `will-navigate`/`did-navigate` a la raíz como fallback) |
| `__clio_rank__`  | JSON `{ rank }`          | `onSaveRank(rank)` → repositorio                                                   |
| `__clio_prefs__` | JSON `ReaderPreferences` | `repository.saveGlobalPreferences(prefs)`                                          |

El host detecta estas sentinelas en el evento `console-message` del `<webview>` (`ReaderView.tsx`), validando tipo y payload antes de actuar. Las colas de notas/resaltados se drenan con un `setInterval` de 1 s (el reader encola, el host persiste y devuelve el ack).

> En mobile el mismo mecanismo de sentinelas se reenvía mediante un shim de
> `console.log` inyectado antes de cargar el contenido.

## 4. Navegación y progreso

### 4.1 Navegación (formatos refluibles y de página fija)

1. El usuario activa siguiente/anterior (o teclado/gesto)
2. `reader-entry.ts` llama a `document.goNext()` / `goPrevious()`
3. El adaptador devuelve el locator actualizado y se re-renderiza
4. Se actualizan los botones y el indicador de posición

### 4.2 Progreso (poll + debounce)

1. Un `setInterval` de 1 s en el shell llama a `window.__getCurrentLocator()`
2. El locator y `percent` se cachean en refs
3. Tras 800 ms sin cambios (debounce) se llama a `updateProgress(repository, …)`
4. Al cerrar la ventana (`beforeunload`) se hace flush inmediato del progreso pendiente y se drenan las colas de notas

## 5. Aislamiento y seguridad

### 5.1 Partition del WebView

El `<webview>` usa `partition="persist:reader"` para:

- Aislar las cookies y storage del lector
- Evitar contaminar la sesión principal
- Mantener el estado entre recargas

### 5.2 Políticas de contenido

- El contenido se renderiza en el contexto del webview
- No se permite navegación externa inesperada (navegación a la raíz = "atrás")
- Los recursos se resuelven dentro del contenedor del documento (`resolveResources`)
- El Markdown/HTML se sanitiza antes de renderizar

### 5.3 Comunicación segura

- El host valida el tipo y el payload de cada sentinela antes de actuar
- No se comparten referencias de objetos entre shell y webview
- El archivo cruza como bytes (base64 en `__initFromHost`), no por URLs arbitrarias

## 6. Manejo de errores

| Error                   | Causa                         | Manejo                                               |
| ----------------------- | ----------------------------- | ---------------------------------------------------- |
| `Falta parámetro uri`   | URL mal formada               | Se muestra error en el webview                       |
| `Formato no soportado`  | Extensión no reconocida       | Se muestra error con formatos válidos                |
| `Archivo no encontrado` | URI inválida o archivo movido | Se muestra error en ReaderView (shell)               |
| `Error de parseo`       | Archivo corrupto o inválido   | Se muestra error en el webview con reintentar/volver |
| `Navegación en límite`  | Primera/última página         | Se deshabilita el control                            |
| `did-fail-load`         | Fallo de carga del webview    | Se muestra pantalla de error en ReaderView           |

## 7. Rendimiento

### 7.1 Carga bajo demanda

- Solo se renderiza el capítulo/página actual
- No se mantienen todas las páginas en memoria (PDF: canvas bajo demanda)
- El contenido HTML se renderiza directamente en el DOM

### 7.2 Limpieza de recursos

- Al cerrar el libro, se llama a `document.close()`
- Se libera el `Uint8Array` del archivo y los canvas
- Se resetea el estado del documento

### 7.3 Optimizaciones futuras

- Precarga de la siguiente página
- Caché de capítulos ya visitados
- Virtual scrolling para capítulos largos

## 8. Documentos relacionados

- [`02-arquitectura-tecnica.md`](./02-arquitectura-tecnica.md) — Capa de renderizado
- [`05-plan-implementacion.md`](./05-plan-implementacion.md) — Fase 6 (Renderer EPUB/MD)
- [`adr/0002-reader-core-state-machine.md`](./adr/0002-reader-core-state-machine.md) — Máquina de estados
- [`features/14-lector-mobile-android.md`](./features/14-lector-mobile-android.md) — Mismo flujo en Android
