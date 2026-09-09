# Plan de implementación por fases

| Campo                             | Valor                                    |
| --------------------------------- | ---------------------------------------- |
| **Nombre**                        | clio_reader — Plan de implementación     |
| **Autor**                         | Manus AI                                 |
| **Fecha de creación**             | 28 de agosto de 2026                     |
| **Fecha de última actualización** | 28 de agosto de 2026                     |
| **Estado**                        | Plan aprobado para ejecución incremental |
| **Versión del documento**         | 1.0.0                                    |

## 1. Propósito

Este documento define cómo implementar clio_reader de forma incremental. Es complementario a la definición del MVP y a la arquitectura técnica; no reemplaza esos documentos. El producto inicial será una biblioteca local offline para EPUB, PDF y CBZ, con Windows y Android como plataformas primarias. No se implementarán perfiles, backend, nube ni sincronización durante estas fases.

El plan prioriza un código limpio, modular, testeable y documentado. Cada feature debe terminar con pruebas, documentación de uso o decisión técnica cuando la complejidad lo justifique, y una demostración ejecutable en las plataformas correspondientes.

## 2. Resultado objetivo del MVP

Al terminar las fases obligatorias, el usuario podrá importar una cantidad de libros limitada únicamente por el almacenamiento y las capacidades del dispositivo, organizarlos en una biblioteca local, abrir EPUB/PDF/CBZ, navegar, cambiar las preferencias aplicables, reanudar desde la última posición y administrar marcadores y notas.

| Área         | Resultado esperado                                                    |
| ------------ | --------------------------------------------------------------------- |
| Plataforma   | Aplicación funcional en Windows y Android                             |
| Datos        | Persistencia local sin cuentas ni servicios remotos                   |
| Formatos     | EPUB, PDF y CBZ                                                       |
| Lectura      | Apertura, navegación, progreso y reanudación                          |
| Preferencias | Tema, colores, tamaño de letra y opciones aplicables                  |
| Anotaciones  | Marcadores y notas locales                                            |
| Calidad      | Unit tests, integración, pruebas manuales y validación de rendimiento |

## 3. Principios de implementación

### 3.1 Separación de responsabilidades

La UI no debe conocer detalles de PDF.js, epub.js, ZIP, SQLite o APIs del sistema. La pantalla invoca casos de uso; los casos de uso dependen de interfaces; y los adaptadores traducen APIs externas a esas interfaces.

```text
UI → casos de uso → dominio/contratos → adaptadores → plataforma o biblioteca externa
```

### 3.2 Código limpio

Cada módulo tendrá una responsabilidad clara, nombres explícitos y funciones pequeñas. Se evitarán componentes monolíticos, estado global innecesario, duplicación entre plataformas y acceso directo a bases de datos desde la UI. Las reglas de negocio deberán ejecutarse fuera de los componentes visuales para probarlas sin montar una aplicación completa.

### 3.3 Tipado y validación

TypeScript se utilizará con modo estricto. Los datos que crucen fronteras —selector de archivos, WebView bridge, almacenamiento, importación y futuro API— se validarán en tiempo de ejecución mediante esquemas. No se aceptarán `any` sin justificación documentada.

### 3.4 Cambios pequeños y reversibles

Cada feature se implementará en un branch o cambio enfocado, con commits descriptivos y una migración independiente cuando modifique el modelo de datos. No se mezclará una refactorización amplia con una feature de producto sin documentar la razón.

### 3.5 Offline por defecto

Toda la funcionalidad del MVP debe funcionar sin red. No se añadirá una API remota como atajo para persistir datos locales. Las interfaces de repositorio se diseñarán de modo que una implementación SaaS pueda añadirse en el futuro.

## 4. Estructura de implementación

```text
apps/
  mobile/                 # Expo + React Native; Android primero, iOS posterior
  desktop/                # Electron + React; Windows primero
packages/
  domain/                 # Entidades y reglas puras
  reader-core/            # Contratos, eventos y ReaderFactory
  reader-epub/            # Adaptador EPUB
  reader-pdf/             # Adaptador PDF
  reader-cbz/             # Adaptador CBZ
  library/                # Casos de uso de biblioteca
  storage/                # Repositorios locales y migraciones
  ui/                     # Primitivas compartidas realmente portables
documentation/
  features/               # Especificaciones futuras
  05-plan-implementacion.md
```

El código de cada feature debe incluir sus pruebas cerca del módulo o en una estructura de tests coherente. Una convención posible es `src/feature.ts` junto a `src/feature.test.ts`, con pruebas de integración bajo `tests/integration/`.

## 5. Fases de ejecución

### Fase 0 — Preparación del repositorio y estándares

**Objetivo:** dejar una base reproducible antes de implementar funcionalidades.

Se deben configurar TypeScript estricto, formateador, linter, verificación de tipos, runner de pruebas, aliases, variables de entorno no sensibles y scripts de CI. También se debe definir la convención de commits, nombres de branches, plantilla de pull request y plantilla de especificación de feature.

**Entregables:** monorepo compilable, scripts `check`, `test`, `lint`, `format` y `build`, README de desarrollo y pipeline que ejecute validaciones.

**Pruebas:** prueba de humo que importe un paquete, prueba de compilación y prueba que confirme que el pipeline falla ante errores de tipos o tests fallidos.

**Salida:** cualquier colaborador puede clonar, instalar dependencias y ejecutar las validaciones con instrucciones documentadas.

### Fase 1 — Spike de plataformas Windows y Android

**Objetivo:** validar las dos plataformas primarias antes de construir el lector.

Se creará una pantalla mínima en Electron para Windows y Expo/React Native para Android. Se validarán selector de archivos, permisos, ciclo de vida, almacenamiento de prueba, WebView, teclado/ratón, gestos y navegación básica.

**Entregables:** dos shells ejecutables, bridge mínimo de mensajes y matriz inicial de compatibilidad.

**Pruebas:** smoke tests de arranque, selección de un archivo de prueba, apertura/cierre del WebView y recuperación después de suspender o minimizar la aplicación.

**Salida:** decisión registrada sobre el transporte de archivos, el WebView y el almacenamiento de cada shell. Si un supuesto falla, se actualiza la arquitectura antes de continuar.

### Fase 2 — Dominio, contratos y máquina de estados

**Objetivo:** crear la base que desacopla la UI de los formatos y de las plataformas.

Se implementarán `Book`, `BookFormat`, `ReadingProgress`, `ReaderPreferences`, `Bookmark`, `Note`, `ReaderAdapter`, `ReaderDocument`, eventos de lectura y estados de sesión. La `ReaderFactory` recibirá un formato detectado y devolverá el adaptador correspondiente.

**Pruebas obligatorias:** unit tests de validación de entidades, transición de estados, selección de factory, serialización de locators, cálculo de porcentaje y rechazo de formatos inválidos.

**Salida:** ningún componente de UI importa directamente un renderer; la aplicación puede ejecutar un flujo simulado con un adaptador fake.

### Fase 3 — Biblioteca local y persistencia

**Objetivo:** importar, indexar y administrar libros sin red.

Se implementarán repositorios locales para libros, preferencias, progreso y anotaciones. Se añadirán migraciones versionadas, detección de archivos perdidos, eliminación, reubicación y tratamiento de errores de almacenamiento. Se debe decidir si los documentos se copian al directorio de la aplicación o si se mantienen como referencias persistentes.

**Pruebas obligatorias:** CRUD de cada repositorio, migración desde una versión anterior, recuperación tras reinicio, aislamiento por `bookId`, archivo perdido, duplicados, poco espacio y escritura con debounce.

**Salida:** la biblioteca conserva su catálogo y preferencias después de cerrar y abrir la aplicación, sin utilizar un servicio remoto.

### Fase 4 — Renderer CBZ

**Objetivo:** implementar el formato más sencillo y validar el flujo real de lectura.

Se abrirá el contenedor ZIP, se filtrarán imágenes válidas, se ordenarán con orden natural y se mostrarán de forma secuencial. Se incorporarán ajuste a pantalla, zoom, página anterior/siguiente, dirección de lectura y locator basado en índice de imagen.

**Pruebas obligatorias:** ZIP válido, ZIP vacío, imágenes corruptas, nombres con números, carpetas ocultas, extensiones no soportadas, imágenes grandes, navegación, zoom y restauración de página.

**Salida:** un CBZ de prueba funciona en Windows y Android, y el usuario puede abandonar y reanudar la lectura.

### Fase 5 — Renderer PDF

**Objetivo:** renderizar PDF de forma eficiente y con controles de lectura básicos.

Se integrará PDF.js detrás de `PdfReaderAdapter`. Se configurará el worker correctamente, se renderizarán páginas bajo demanda y se evitará mantener todos los canvas en memoria. El locator incluirá página, porcentaje, zoom y viewport cuando aplique.

**Pruebas obligatorias:** PDF pequeño, PDF largo, PDF escaneado, fuentes complejas, página inválida, documento protegido, zoom, navegación, desplazamiento, liberación de páginas y restauración de la última página.

**Salida:** la aplicación muestra la primera página sin bloqueo permanente, navega un documento largo y conserva memoria dentro del presupuesto definido en el spike.

### Fase 6 — Renderer EPUB

**Objetivo:** implementar lectura refluible y preferencias tipográficas.

Se integrará epub.js dentro del renderer aislado. Se implementarán capítulos, tabla de contenido cuando esté disponible, paginación, tamaño de letra, fuente, interlineado, márgenes, temas y locator estable. El renderer no debe permitir navegación externa inesperada ni ejecutar contenido activo sin una política explícita.

**Pruebas obligatorias:** EPUB válido, EPUB con portada, capítulos múltiples, imágenes, CSS complejo, maquetación fija, recursos ausentes, caracteres internacionales, cambio de fuente, cambio de tamaño y restauración del locator.

**Salida:** un EPUB puede leerse y reanudarse después de cambiar tamaño de letra sin perder de forma injustificada la posición del usuario.

### Fase 7 — Progreso, settings y ciclo de vida

**Objetivo:** convertir el lector en una experiencia persistente.

Se conectarán los eventos del renderer con los repositorios. El progreso se guardará con debounce y al cerrar o suspender. Los settings globales se cargarán al iniciar; los settings por libro podrán sobrescribir los globales cuando el formato lo permita. Se documentarán los rangos válidos de colores, escalas, márgenes y tamaños.

**Pruebas obligatorias:** reanudación por formato, cierre abrupto simulado, segundo plano, migración de settings, valores inválidos, aislamiento por libro y comportamiento ante locator obsoleto.

**Salida:** reiniciar la aplicación no pierde preferencias ni la última posición válida.

### Fase 8 — Marcadores, notas e índices locales

**Objetivo:** incorporar anotaciones sin nube.

Se implementarán crear, listar, abrir, editar y eliminar para notas; y crear, listar, abrir y eliminar para marcadores. Cada registro se asociará a un `bookId`, locator, posición normalizada opcional, fecha y esquema de datos. La vista de anotaciones debe filtrar por libro y ordenar por posición o fecha.

**Pruebas obligatorias:** CRUD de marcadores/notas, aislamiento entre libros, ordenamiento, duplicados permitidos o rechazados según decisión, nota sin texto seleccionado, locator inválido, migración y persistencia después de reiniciar.

**Salida:** el usuario puede recuperar sus anotaciones en el libro correcto sin conexión y sin perfiles.

### Fase 9 — UX, accesibilidad y rendimiento

**Objetivo:** estabilizar la experiencia en Windows y Android.

Se revisarán estados vacíos, carga, error, archivo perdido, feedback de acciones, navegación con teclado, targets táctiles, contraste, etiquetas, foco, orientación y gestos. Se medirán tiempo a primera página, memoria, scroll, zoom y tiempo de importación.

**Pruebas obligatorias:** pruebas de accesibilidad, pruebas manuales en hardware o emuladores, documentos grandes, biblioteca con muchos libros, interrupciones de llamadas o suspensión y recuperación de errores.

**Salida:** no existen caminos muertos, controles sin acción ni errores de consola conocidos sin ticket.

### Fase 10 — Release del MVP

**Objetivo:** preparar una versión instalable y trazable.

Se crearán builds de Windows y Android, configuración de nombre/icono, permisos mínimos, notas de versión, guía de instalación, política de datos locales y procedimiento de rollback. La distribución deberá conservar los datos locales durante una actualización compatible.

**Pruebas obligatorias:** instalación limpia, actualización sobre datos existentes, desinstalación, importación desde ubicaciones comunes, recuperación de base local y verificación de que no se envían documentos a la red.

**Salida:** versión etiquetada, artefactos reproducibles, documentación de release y checklist firmado.

## 6. Definición de terminado por feature

Una feature no se considerará terminada solo porque funcione en el caso feliz. Debe cumplir lo siguiente:

| Requisito     | Evidencia                                                                           |
| ------------- | ----------------------------------------------------------------------------------- |
| Código        | Tipado estricto, responsabilidades separadas y sin duplicación evitable             |
| Pruebas       | Unitarias y de integración relevantes; prueba manual multiplataforma cuando aplique |
| Errores       | Estados de carga, vacío, error y recuperación definidos                             |
| Documentación | README o especificación en `documentation/features` si la complejidad lo amerita    |
| Datos         | Migración y compatibilidad documentadas si cambia el esquema                        |
| Accesibilidad | Labels, foco, teclado o targets táctiles según plataforma                           |
| Rendimiento   | Métrica o límite definido para operaciones costosas                                 |
| Revisión      | Pull request revisado y CI verde                                                    |

## 7. Estrategia de pruebas

Las pruebas unitarias validarán reglas puras y adaptadores aislados. Las pruebas de integración recorrerán casos como importar → abrir → leer → guardar → cerrar → reanudar. Las pruebas de contrato comprobarán que todos los adaptadores cumplen `ReaderAdapter` y que los mensajes del bridge son válidos.

Las pruebas end-to-end se reservarán para flujos críticos: añadir libro, abrir cada formato, cambiar settings, crear nota, crear marcador, volver a la biblioteca y reanudar. Windows y Android son obligatorios para el MVP. iOS se incorporará a la matriz en la fase posterior de soporte de plataformas.

## 8. Documentación requerida durante la implementación

Cada decisión que limite una biblioteca, plataforma o formato debe registrarse en un ADR breve. Las features complejas deben tener una especificación bajo `documentation/features`. Los módulos deben documentar contratos públicos, supuestos, errores y ejemplos de uso; no se requiere comentar cada línea obvia.

La documentación de usuario debe explicar importar, abrir, eliminar, localizar archivos perdidos, cambiar preferencias, crear anotaciones y entender que los datos son locales. La documentación de desarrollo debe explicar instalación, scripts, estructura, pruebas y builds.

## 9. Riesgos y decisiones de control

| Riesgo                             | Control                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| WebView consume demasiada memoria  | Renderizado bajo demanda, límites y medición desde CBZ/PDF   |
| Locator EPUB cambia con el reflujo | Guardar CFI/contexto/posición y estrategia de recuperación   |
| Archivos movidos o eliminados      | Hash opcional, estado `missing` y acción “localizar archivo” |
| Módulo no compatible con Windows   | Adaptadores y spike temprano; no acoplar el dominio          |
| Datos corruptos por cierre abrupto | Transacciones, debounce y recuperación de migraciones        |
| Crecimiento de alcance por nube    | Mantener nube, perfiles y SaaS en `documentation/features`   |
| Regresiones entre plataformas      | CI más matriz manual Windows/Android por release             |

## 10. Orden de ejecución resumido

La secuencia recomendada es **fundación → spike Windows/Android → dominio → persistencia → CBZ → PDF → EPUB → progreso/settings → anotaciones → calidad → release**. Esta secuencia reduce incertidumbre temprano y evita construir una UI compleja antes de comprobar el acceso local a archivos y el rendimiento del renderer.

## 11. Documentos relacionados

- [`01-definicion-mvp.md`](./01-definicion-mvp.md)
- [`02-arquitectura-tecnica.md`](./02-arquitectura-tecnica.md)
- [`03-arquitectura-data-y-metadata.md`](./03-arquitectura-data-y-metadata.md)
- [`04-features-futuros.md`](./04-features-futuros.md)
- [`features/`](./features/)
