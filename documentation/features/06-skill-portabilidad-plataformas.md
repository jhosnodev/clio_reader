# F-006: Skill para portabilidad multiplataforma

| Campo                             | Valor                                          |
| --------------------------------- | ---------------------------------------------- |
| **Nombre**                        | Skill de portabilidad multiplataforma          |
| **Autor**                         | Manus AI                                       |
| **Fecha de creación**             | 28 de agosto de 2026                           |
| **Fecha de última actualización** | 28 de agosto de 2026                           |
| **Estado**                        | Propuesta implementada como skill reutilizable |
| **Versión del documento**         | 1.0.0                                          |

## Objetivo

Proporcionar un procedimiento repetible para añadir iOS, macOS, Linux, web u otra plataforma a `clio_reader` sin duplicar dominio, progreso, preferencias, anotaciones ni contratos de lectura. El skill debe guiar el análisis de compatibilidad, el diseño de adaptadores, la implementación del shell, la documentación y la validación.

## Análisis de la base existente

La creación del skill es viable porque el repositorio ya separa las piezas principales: `packages/domain` contiene el modelo y validaciones; `packages/reader-core` contiene `ReaderAdapter` y `ReaderFactory`; `packages/storage` aísla el estado local detrás de `KeyValueStore` y `LocalRepository`; y las aplicaciones de escritorio y móvil están previstas como shells independientes [1] [2]. La documentación existente también establece explícitamente que dominio, casos de uso, locators, repositorios y contratos de lectores deben permanecer compartidos, mientras que selector de archivos, almacenamiento, ciclo de vida y shell son específicos de cada plataforma [3].

El análisis identificó límites importantes: los shells todavía son esqueletos; no existen adaptadores reales para EPUB, PDF o CBZ; no hay contratos concretos para file picker, URI durable, lifecycle o bridges; y `md` aparece en el dominio pero no está registrado por sí mismo en `ReaderFactory`. Por ello, el skill debe impedir que una compilación exitosa se interprete como soporte de plataforma.

## Decisión

Crear el skill `clio-reader-platform-porting` fuera del repositorio de aplicación, con un `SKILL.md` breve y dos referencias progresivas:

| Recurso                           | Propósito                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `SKILL.md`                        | Flujo de ocho pasos, decisiones, guardrails y navegación de referencias    |
| `references/platform-matrix.md`   | Comparación de shells, almacenamiento, URI, input y riesgos por plataforma |
| `references/project-contracts.md` | Contratos compartidos, límites actuales, extensiones sugeridas y pruebas   |

No se añaden scripts al skill porque el trabajo actual es de análisis y arquitectura; los scripts deterministas deberán incorporarse únicamente cuando exista una operación repetitiva que no dependa de APIs o credenciales del entorno.

## Alcance del primer skill

El skill cubre el análisis del repositorio, la clasificación `shared`/`adapter`/`limited`/`unsupported`, el diseño de shells, la integración incremental de formatos, la persistencia local, los archivos faltantes, el ciclo de vida, la especificación de features y la validación. No implementa todavía una plataforma concreta ni declara soporte de producción para iOS, macOS, Linux o web.

## Criterios de aceptación

1. El skill contiene metadatos válidos, instrucciones imperativas y una descripción clara de cuándo debe activarse.
2. El cuerpo del skill permanece por debajo de 500 líneas y remite los detalles variables a referencias de primer nivel.
3. El procedimiento exige revisar el repositorio y ejecutar la validación antes de modificar código.
4. El procedimiento exige encapsular selector de archivos, almacenamiento, ciclo de vida y renderer detrás de adaptadores.
5. El procedimiento exige documentación en `documentation/features` cuando el porting sea no trivial.
6. El procedimiento exige pruebas unitarias, de adaptadores e integración apropiadas, además de `pnpm validate`.
7. El skill pasa el validador oficial de skills.
8. La validación actual del repositorio continúa pasando sin modificaciones funcionales.

## Plan de aplicación futura

Para portar una plataforma real, comenzar con un spike del shell y de la retención de archivos. Después definir contratos, implementar el selector y almacenamiento, integrar los adaptadores de formato, conectar la UI compartida y cerrar con pruebas de suspensión, accesibilidad, archivos grandes y distribución. La prioridad recomendada por el proyecto es iOS después de estabilizar Windows y Android; macOS y Linux pueden compartir Electron, mientras que web requiere una decisión explícita sobre persistencia y acceso a archivos [4].

## Referencias

[1]: ../../README.md 'README del proyecto clio_reader'
[2]: ../02-arquitectura-tecnica.md 'Arquitectura técnica de clio_reader'
[3]: 04-otras-plataformas.md 'F-004: Soporte para otras plataformas'
[4]: ../04-features-futuros.md 'Features futuros'
