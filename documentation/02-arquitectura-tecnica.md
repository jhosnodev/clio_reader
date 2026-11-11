# Arquitectura técnica

| Campo                             | Valor                              |
| --------------------------------- | ---------------------------------- |
| **Nombre**                        | clio_reader — Arquitectura técnica |
| **Autor**                         | Manus AI                           |
| **Fecha de creación**             | 28 de agosto de 2026               |
| **Fecha de última actualización** | 10 de noviembre de 2026            |
| **Estado**                        | Implementada (en uso)              |
| **Versión del documento**         | 1.2.0                              |

## 1. Decisión arquitectónica

El proyecto usará React y TypeScript con un núcleo compartido y shells específicos por plataforma. **Windows y Linux** (Electron + React) son la plataforma primaria de la Etapa 1; Android con Expo + React Native queda como Etapa 3 del [roadmap](./00-vision-roadmap.md). iOS quedará preparado, pero no será una plataforma primaria del primer lanzamiento.

La razón es separar lo que realmente puede compartirse —dominio, casos de uso, modelos, persistencia abstracta y contratos de lectores— de lo que necesita integración específica —selector de archivos, ciclo de vida, almacenamiento y ventana—.

## 2. Capas

```text
UI por plataforma
  ↓
Casos de uso y estado de aplicación
  ↓
Dominio TypeScript y contratos
  ↓
Adaptadores de formato y persistencia
  ↓
Electron/Windows o Expo/Android
```

El lector depende de una interfaz `ReaderAdapter`, no de PDF.js, el parser EPUB o un parser ZIP directamente. La selección del adaptador se hace mediante una `ReaderFactory`, mientras que cada adaptador oculta la API específica del renderer.

## 3. Monorepo propuesto

```text
apps/mobile/                 # Expo + React Native (Android/iOS)
apps/desktop/                # Electron + React (Windows/Linux)
packages/domain/             # Book, progreso, settings y anotaciones
packages/reader-core/        # ReaderAdapter, ReaderFactory, eventos y máquina de estados
packages/reader-epub/        # EPUB (parser propio con jszip)
packages/reader-pdf/         # PDF.js
packages/reader-cbz/         # ZIP, orden natural e imágenes
packages/reader-md/          # Markdown (parser propio, refluible)
packages/reader-session/     # Sesión, progreso con debounce y settings
packages/annotations/        # Notas, bookmarks y highlights
packages/library/            # Casos de uso de biblioteca local
packages/storage/            # Repositorios locales (SQLite/Drizzle + JSON) y migraciones
documentation/               # Decisiones y especificaciones
```

## 4. Patrones principales

| Patrón        | Uso                                                                   |
| ------------- | --------------------------------------------------------------------- |
| Adapter       | Convierte la API específica de cada renderer en el contrato común     |
| Factory       | Construye el adaptador adecuado a partir del formato detectado        |
| Strategy      | Permite que EPUB, PDF y CBZ resuelvan navegación de manera distinta   |
| Repository    | Aísla SQLite/Drizzle (desktop) o JSON sobre `KeyValueStore` (mobile)  |
| State machine | Controla `idle`, `opening`, `ready`, `navigating`, `error` y `closed` |

## 5. Renderizado

EPUB se implementa con un parser propio (`packages/reader-epub`, basado en `jszip`) dentro de un WebView; PDF con PDF.js, CBZ con extracción de imágenes desde ZIP y Markdown con un parser propio refluible. El bridge no usa `postMessage`: el host inyecta datos con `executeJavaScript` (`window.__initFromHost`, `window.__applyPalette`) y el reader emite sentinelas por `console.log` que el shell escucha en `console-message` (`__clio_back__`, `__clio_rank__`, `__clio_prefs__`); los detalles están en [`07-flujo-webview.md`](./07-flujo-webview.md). El contenido se abre bajo demanda y se liberan recursos al cerrar el libro.

## 6. Plataformas y validación

La primera matriz de aceptación cubre Windows y Linux: selector de archivos, permisos, archivos grandes, teclado/ratón, suspensión y reanudación. Android entra en la matriz en la Etapa 3 y la compatibilidad iOS se validará después (F-004), sin modificar el dominio ni los contratos.

## 7. Calidad

La arquitectura debe ser local-first, funcionar sin red, evitar cuentas y limitar el trabajo del hilo principal. Las pruebas cubrirán detector de formatos, adaptadores, persistencia, reanudación, navegación y errores de documentos inválidos.
