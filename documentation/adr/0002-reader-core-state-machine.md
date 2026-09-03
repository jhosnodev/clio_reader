# ADR-0002: Reader core y máquina de estados de sesión

| Campo                             | Valor                                                   |
| --------------------------------- | ------------------------------------------------------- |
| **Nombre**                        | Reader core, detección de formatos y máquina de estados |
| **Autor**                         | Manus AI                                                |
| **Fecha de creación**             | 28 de agosto de 2026                                    |
| **Fecha de última actualización** | 28 de agosto de 2026                                    |
| **Estado**                        | Aceptado para la implementación inicial                 |
| **Versión del documento**         | 1.0.0                                                   |

## Contexto

La aplicación debe abrir distintos formatos sin que la UI conozca los detalles de cada renderer. También necesita distinguir estados de apertura, navegación, error y cierre para evitar acciones inválidas y facilitar la recuperación.

## Decisión

`@clio-reader/reader-core` define `FileSource`, `ReaderAdapter`, `ReaderDocument` y `ReaderCapabilities`. `ReaderFactory` registra adaptadores por `BookFormat` y crea documentos mediante el contrato común.

`detectBookFormat` reconoce EPUB, PDF, CBZ y Markdown por extensión y utiliza MIME como fallback. Las extensiones se priorizan porque los selectores de archivos pueden proporcionar MIME vacío o genérico.

La sesión se modela como una función pura `transitionReaderSession(state, event)`. Los estados son `idle`, `opening`, `ready`, `navigating`, `error` y `closed`. Las transiciones inválidas lanzan `InvalidSessionTransitionError` en vez de ignorar silenciosamente el evento.

## Consecuencias

La lógica puede probarse sin montar React ni acceder a una plataforma. Los adaptadores futuros de EPUB, PDF, CBZ y Markdown quedan aislados. La UI puede renderizar estados explícitos de carga, error y recuperación. El contrato todavía no implementa páginas, capítulos ni renderizado: eso corresponde a las fases de cada formato.

## Pruebas

La cobertura inicial valida detección case-insensitive, fallback MIME, factory con adaptador registrado, rechazo de formatos no registrados, flujo apertura → ready → cierre y rechazo de navegación desde `idle`.
