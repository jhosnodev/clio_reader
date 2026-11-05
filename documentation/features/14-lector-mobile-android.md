# Lector mobile Android (MVP A–D)

## Objetivo

Reutilizar el bundle del lector de escritorio dentro de `react-native-webview`
para ofrecer un lector funcional en Android (importar, leer EPUB/PDF/CBZ/MD,
guardar progreso) sin reimplementar los renderers.

## Arquitectura

```text
App.tsx (Expo)
  ├─ LibraryScreen (presentacional)
  └─ ReaderScreen
        ↓ WebView + file://reader.html
        ↓ window.__initFromHost({ preferences, fileDataB64, metadata, notes, highlights })
        ↓ console.log sentinelas → onMessage
     bridge (expo-document-picker / expo-file-system)
        ↓
     LocalRepository (JSON sobre expo-file-system)
        ↓
     @clio-reader/library (casos de uso)
```

El bundle `apps/mobile/assets/reader.html` se genera con
`vite.reader.mobile.config.ts` (JS + CSS inline, worker de PDF como
`data:text/javascript;base64`). Está en `.gitignore`; hay que construirlo antes
de empaquetar:

```bash
pnpm build
pnpm --filter @clio-reader/mobile build:reader
```

## Contrato host ↔ reader

| Dirección     | Mecanismo                               | Contenido                                                           |
| ------------- | --------------------------------------- | ------------------------------------------------------------------- |
| host → reader | `injectedJavaScriptBeforeContentLoaded` | `window.__clioHostParams = { uri, format }` + shim de `console.log` |
| host → reader | `injectedJavaScript` (`onLoadEnd`)      | `window.__initFromHost(data)`                                       |
| reader → host | sentinela `console.log`                 | `__clio_back__`, `__clio_rank__{"rank":n}`, `__clio_prefs__<JSON>`  |

- La uri del libro es local (`file://.../clio-reader/books/<id>-<name>`), copiada
  al almacenamiento de la app tras importar.
- Las sentinelas se interpretan con `interpretMessage` (`src/reader/host-messages.ts`).
- El reader no recibe query string; `uri`/`format` llegan por `__clioHostParams`.
- `resolveReaderHtmlUri` garantiza un path `.html` (el WebView resuelve el MIME
  por extensión) y copia el asset si Expo lo deja con otra extensión.

## Alcance y límites del MVP

Incluido:

- Importar (document picker), abrir, eliminar (borra el archivo copiado) y rank.
- Lectura EPUB/PDF/CBZ/MD vía adaptadores del desktop bundle.
- Progreso (locator + percent) y preferencias globales persistidas por el reader.
- Lifecycle: recarga de biblioteca/progreso al volver a primer plano.

Fuera del MVP (mobile):

- Notas, marcadores y resaltados (no se crean en mobile; se pasan `[]` al reader).
- `__applyPalette` (depende del módulo `themes` del desktop).
- Preferencias por libro en UI, búsqueda, TOC, settings.

## Riesgos pendientes de validar en dispositivo

Sin `adb`/emulador/`ANDROID_HOME` en el entorno de desarrollo, quedan por probar
en hardware real:

1. **Worker de PDF** (`new Worker('data:text/javascript;base64,...')`) desde un
   documento `file://`; si el WebView lo bloquea, evaluar modo "fake worker" o
   `source={{ html, baseUrl }}` con origen `https`.
2. **Memoria**: `fileDataB64` + `JSON.stringify` duplican el tamaño del archivo;
   un PDF grande puede acercarse al límite de memoria de Android.
3. **Timing** de `injectedJavaScriptBeforeContentLoaded` frente a la ejecución
   del módulo `type="module"`.
4. Carga de `file://` con `allowFileAccess` en Android 10+.

## Comandos

```bash
pnpm --filter @clio-reader/mobile build:reader   # genera assets/reader.html
pnpm --filter @clio-reader/mobile start          # Metro
pnpm --filter @clio-reader/mobile android        # Metro + dispositivo/emulador
```
