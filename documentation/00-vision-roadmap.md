# Visión y roadmap

| Campo                             | Valor                          |
| --------------------------------- | ------------------------------ |
| **Nombre**                        | clio_reader — Visión y roadmap |
| **Fecha de creación**             | 10 de noviembre de 2026        |
| **Fecha de última actualización** | 10 de noviembre de 2026        |
| **Estado**                        | Aprobada                       |
| **Versión del documento**         | 1.0.0                          |

> Este documento es la **fuente de verdad de la visión del producto**. El plan de
> fases (`05-plan-implementacion.md`), la definición del MVP
> (`01-definicion-mvp.md`), el índice de features futuras (`04-features-futuros.md`)
> y el README se alinean a este orden; si discrepan, manda este documento.

## 1. Knowledge Core

**Knowledge Core** es el nombre del ecosistema al que apunta clio_reader:

- Un **lector local** con notas locales, personales y privadas.
- Conocimiento **exportable y editable** fuera de la app (formatos abiertos:
  Markdown y JSON).
- **Integración con Obsidian** para llevar ese conocimiento a sistemas de notas
  tipo zettelkasten sin perder autonomía.
- Como horizonte futuro, una **IA que pueda servirse de las notas de tus libros**
  (F-011), sobre el material ya exportado y bajo control del usuario.

### Pilares

| Pilar             | Significado                                                    |
| ----------------- | -------------------------------------------------------------- |
| Local-first       | Sin cuentas, sin backend, sin red para leer ni anotar          |
| SQLite            | Persistencia local en desktop; JSON portable en móvil          |
| Portable          | Todo el conocimiento se exporta e importa en formatos legibles |
| Formatos abiertos | Markdown y JSON como canónicos; sin silos propietarios         |

Knowledge Core no es un paquete nuevo: es el **ecosistema formado por los
paquetes actuales** (`domain`, `reader-core`, `library`, `storage`,
`annotations`, `feedback`) **más sus contratos de exportación** y las
integraciones que lo conectan con otras herramientas de conocimiento.

## 2. Las tres etapas

```text
Knowledge Core
  Local-first · SQLite · Portable · Formatos abiertos
        │
        ├─ Etapa 1: Desktop    → Lectura y anotación (consolidar producto)
        ├─ Etapa 2: Obsidian   → Conocimiento (distribución y comunidad)
        └─ Etapa 3: Android    → Movilidad (expandir ecosistema)
```

No se lanzan tres aplicaciones a la vez. Se construye un ecosistema alrededor
de un núcleo común, validando cada etapa antes de abrir la siguiente.

### Etapa 1 — Desktop: consolidar el producto

**Prioridad actual.** Objetivo: un producto suficientemente estable para que
alguien lo adopte como su lector habitual.

- Pulir UX y navegación.
- Estabilizar biblioteca, lectura y anotaciones.
- Consolidar importación/exportación Markdown y JSON.
- Preservar datos y localizadores.
- Completar los contratos del Knowledge Core (exportación portátil).
- Preparar documentación y distribución.

**Criterio de salida:** una persona puede instalarlo, importar sus libros,
leer, anotar, exportar y recuperar su conocimiento sin depender de servicios
externos.

### Etapa 2 — Plugin de Obsidian: distribución y comunidad

**Segunda etapa.** Objetivo: conectar Clio con una comunidad que ya valora la
gestión del conocimiento.

- Plugin MVP.
- Importar notas y resaltados.
- Deep links entre ambas aplicaciones.
- Preservar IDs y metadatos.
- Detectar conflictos.
- Publicar documentación y repositorio abierto.

**Criterio de salida:** un usuario de Obsidian puede incorporar Clio a su flujo
de trabajo sin perder autonomía ni modificar sus hábitos fundamentales.

La regla de oro: el plugin **no debe parecer un exportador manual**. Abrir una
nota de Clio en Obsidian y volver debe ser un flujo natural.

### Etapa 3 — Android: expandir el ecosistema

**Tercera etapa.** Objetivo: llevar la experiencia de lectura y captura a
dispositivos móviles.

- React Native (base ya construida en la Fase 9).
- SQLite local / JSON portable.
- Reutilización del Knowledge Core.
- Lectura y anotaciones.
- Importación/exportación.
- Sincronización futura, solo cuando esté justificada.

**Criterio de salida:** continuidad de lectura y anotaciones entre dispositivos
sin sacrificar el enfoque local-first.

## 3. Por qué este orden

| Criterio                  | Desktop   | Obsidian | Android |
| ------------------------- | --------- | -------- | ------- |
| Validar el producto       | Muy alto  | Alto     | Medio   |
| Atraer comunidad          | Medio     | Muy alto | Medio   |
| Complejidad inicial       | Ya existe | Media    | Alta    |
| Reutilización del trabajo | Base      | Alta     | Alta    |
| Potencial de distribución | Alto      | Muy alto | Alto    |

El plugin de Obsidian puede validar si existe una comunidad interesada en el
flujo de trabajo propuesto **antes** de asumir el coste de mantener otra
aplicación completa.

No se espera a terminar absolutamente todo desktop para empezar Obsidian. La
secuencia es:

1. **Desktop:** estabilizar lo existente y formalizar los contratos del
   Knowledge Core.
2. **Obsidian:** MVP cuando Markdown y los deep links sean estables.
3. **Android:** cuando el dominio, los repositorios y los contratos estén
   suficientemente maduros.

## 4. Reglas de decisión

| Regla                                                            | Decisión                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Nada de sincronización entre dispositivos sin necesidad validada | SQLite local y exportación portátil bastan para las 3 etapas  |
| Nada de cuentas, backend ni nube en el MVP                       | Requiere validación del producto local primero                |
| Nada de IA en el alcance corto                                   | F-011 queda como horizonte sobre notas ya exportadas          |
| El usuario es dueño de sus datos                                 | Todo es exportable en formatos abiertos y sin red obligatoria |

## 5. Mapa etapas ↔ fases ↔ features

### Etapa 1 — Desktop

| Fuente                      | Contenido                                                  |
| --------------------------- | ---------------------------------------------------------- |
| `05-plan-implementacion.md`   | Fases 0–8 ✅ (en beta), Fase 10 (UX), Fase 11 (Release)         |
| `04-features-futuros.md`    | F-001 (export JSON), F-006 (UI preferencias), F-008 ✅     |
| `features/16`               | Feedback Core (Fase 1 desktop ✅)                          |
| `features/17`               | Continuous Release                                         |
| **Criterio de salida**      | Instalar → importar → leer → anotar → exportar → recuperar |

### Etapa 2 — Obsidian

| Fuente                   | Contenido                                                |
| ------------------------ | -------------------------------------------------------- |
| `04-features-futuros.md` | F-010 (plugin Obsidian), F-009 ✅ (portabilidad)         |
| `features/18`            | Spec ligera del plugin                                   |
| **Depende de**           | F-001 (paquete exportable), Markdown estable, deep links |
| **Criterio de salida**   | Usuario de Obsidian lo adopta sin perder autonomía       |

### Etapa 3 — Android

| Fuente                       | Contenido                                                       |
| ---------------------------- | --------------------------------------------------------------- |
| `05-plan-implementacion.md`  | Fase 9 (base construida, ⏸️ diferida)                           |
| `features/14`, `features/15` | Specs y guía de testing Android                                 |
| `04-features-futuros.md`     | F-004 (otras plataformas: iOS tras Android)                     |
| **Criterio de salida**       | Continuidad de lectura y anotaciones sin sacrificar local-first |

### Horizonte (fuera de las 3 etapas)

| ID    | Feature             | Nota                                                    |
| ----- | ------------------- | ------------------------------------------------------- |
| F-002 | Sincronización nube | Bloqueada hasta necesidad validada                      |
| F-003 | Arquitectura SaaS   | Depende de F-002                                        |
| F-007 | Resaltado en PDF    | Requiere text layer de PDF.js                           |
| F-011 | IA sobre las notas  | Sobre material ya exportado y controlado por el usuario |

## 6. Documentación relacionada

- [`01-definicion-mvp.md`](./01-definicion-mvp.md) — alcance del MVP (solo Desktop)
- [`04-features-futuros.md`](./04-features-futuros.md) — índice de features futuras
- [`05-plan-implementacion.md`](./05-plan-implementacion.md) — fases de ejecución
- [`features/18-plugin-obsidian.md`](./features/18-plugin-obsidian.md) — spec F-010
