# Arquitectura técnica

| Campo                             | Valor                              |
| --------------------------------- | ---------------------------------- |
| **Nombre**                        | clio_reader — Arquitectura técnica |
| **Autor**                         | Manus AI                           |
| **Fecha de creación**             | 28 de agosto de 2026               |
| **Fecha de última actualización** | 28 de agosto de 2026               |
| **Estado**                        | Propuesta inicial                  |
| **Versión del documento**         | 1.0.0                              |

## 1. Decisión arquitectónica

El proyecto usará React y TypeScript con un núcleo compartido y shells específicos por plataforma. Windows será atendido inicialmente con Electron + React y Android con Expo + React Native. iOS quedará preparado, pero no será una plataforma primaria del primer lanzamiento.

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

El lector debe depender de una interfaz `ReaderAdapter`, no de PDF.js, epub.js o un parser ZIP directamente. La selección del adaptador se hará mediante una `ReaderFactory`, mientras que cada adaptador ocultará la API específica del renderer.

## 3. Monorepo propuesto

```text
apps/mobile/                 # Expo + React Native
apps/desktop/                # Electron + React
packages/domain/             # Book, progreso, settings y anotaciones
packages/reader-core/        # ReaderAdapter, factory y eventos
packages/reader-epub/        # EPUB y bridge WebView
packages/reader-pdf/         # PDF.js y bridge WebView
packages/reader-cbz/         # ZIP, orden natural e imágenes
packages/library/            # Casos de uso de biblioteca local
packages/storage/            # Contratos e implementaciones locales
packages/ui/                 # Componentes compartidos cuando sea viable
documentation/               # Decisiones y especificaciones
```

## 4. Patrones principales

| Patrón        | Uso                                                                   |
| ------------- | --------------------------------------------------------------------- |
| Adapter       | Convierte la API específica de cada renderer en el contrato común     |
| Factory       | Construye el adaptador adecuado a partir del formato detectado        |
| Strategy      | Permite que EPUB, PDF y CBZ resuelvan navegación de manera distinta   |
| Repository    | Aísla SQLite, JSON, AsyncStorage u otro mecanismo local               |
| State machine | Controla `idle`, `opening`, `ready`, `navigating`, `error` y `closed` |

## 5. Renderizado

EPUB se implementará inicialmente con epub.js dentro de un WebView; PDF con PDF.js y CBZ con extracción de imágenes desde ZIP. El bridge intercambiará mensajes JSON versionados entre el shell y el renderer. El contenido se abrirá bajo demanda y se liberarán recursos cuando se cierre el libro.

## 6. Plataformas y validación

La primera matriz de aceptación cubrirá Windows y Android. Se probarán selector de archivos, permisos, archivos grandes, teclado/ratón en Windows, gestos en Android, suspensión y reanudación. La compatibilidad iOS se validará después sin modificar el dominio ni los contratos.

## 7. Calidad

La arquitectura debe ser local-first, funcionar sin red, evitar cuentas y limitar el trabajo del hilo principal. Las pruebas cubrirán detector de formatos, adaptadores, persistencia, reanudación, navegación y errores de documentos inválidos.
