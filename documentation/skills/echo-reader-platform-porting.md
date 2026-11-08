# Guía de uso: `clio-reader-platform-porting`

## Propósito

`clio-reader-platform-porting` es un skill interno para planificar e implementar una versión de `clio_reader` en una plataforma adicional sin duplicar el dominio ni romper los contratos compartidos. Está versionado junto al proyecto en [`skills/echo-reader-platform-porting`](../../skills/echo-reader-platform-porting/).

> El skill guía el porting; no declara que una plataforma esté soportada. El soporte debe demostrarse con adaptadores funcionales, pruebas y validación del ciclo de vida.

## Cuándo usarlo

Usarlo cuando se solicite añadir iOS, macOS, Linux, web/PWA, tvOS u otra plataforma; migrar el shell de una plataforma existente; adaptar selección y persistencia de archivos; integrar un renderer específico; o evaluar la compatibilidad de una nueva plataforma con EPUB, PDF, CBZ y futuras capacidades.

No usarlo para añadir una feature puramente de dominio que no tenga impacto en el shell, el almacenamiento, el renderer o el ciclo de vida. En esos casos debe seguirse la arquitectura y la especificación de feature correspondiente.

## Cómo usarlo

1. Indicar la plataforma objetivo y el resultado esperado, por ejemplo: “Portar `clio_reader` a iOS manteniendo progreso, preferencias, marcadores, notas y funcionamiento offline”.
2. Revisar [`documentation/features/04-otras-plataformas.md`](../features/04-otras-plataformas.md), la matriz incluida en el skill y los contratos actuales del proyecto.
3. Ejecutar primero la validación existente (`pnpm validate`) y registrar el estado inicial.
4. Aplicar el flujo del `SKILL.md`: perfil de plataforma, clasificación de capacidades, shell, adaptadores, persistencia, documentación y pruebas.
5. Crear una especificación en [`documentation/features/`](../features/) cuando el porting sea no trivial. La referencia inicial es [`06-skill-portabilidad-plataformas.md`](../features/06-skill-portabilidad-plataformas.md).
6. No cerrar el trabajo hasta ejecutar nuevamente `pnpm validate` y completar los criterios de aceptación específicos del target.

## Estructura del skill

| Archivo                                                                                             | Uso                                                      |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`SKILL.md`](../../skills/echo-reader-platform-porting/SKILL.md)                                    | Flujo principal, decisiones y guardrails                 |
| [`platform-matrix.md`](../../skills/echo-reader-platform-porting/references/platform-matrix.md)     | Comparación de plataformas y riesgos                     |
| [`project-contracts.md`](../../skills/echo-reader-platform-porting/references/project-contracts.md) | Contratos compartidos, límites actuales y pruebas        |
| [`06-skill-portabilidad-plataformas.md`](../features/06-skill-portabilidad-plataformas.md)          | Especificación de esta feature y criterios de aceptación |

## Resultado esperado

Cada porting debe dejar una decisión explícita sobre qué se comparte y qué se adapta. Como mínimo, debe cubrir selector/importación de archivos, URI durable, almacenamiento local, apertura y cierre de documentos, navegación, locators serializables, suspensión/reanudación, errores de archivo faltante y accesibilidad. Las capacidades no implementadas deben marcarse como `limited` o `unsupported`, no ocultarse detrás de la UI.
