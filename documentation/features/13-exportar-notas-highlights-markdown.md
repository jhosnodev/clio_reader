# F-008: Exportar e importar notas y resaltados como Markdown

| Campo                             | Valor                                                |
| --------------------------------- | ---------------------------------------------------- |
| **Nombre**                        | Exportar e importar notas y resaltados como Markdown |
| **Autor**                         | Manus AI                                             |
| **Fecha de creación**             | 13 de octubre de 2026                                |
| **Fecha de última actualización** | 7 de noviembre de 2026                               |
| **Estado**                        | ✅ Implementada (paquete + UI desktop)               |
| **Versión del documento**         | 1.0.0                                                |

## Objetivo

Permitir exportar las notas y los resaltados de un libro a un único archivo Markdown legible y reimportarlo para restaurar esas anotaciones. Es un corte local de F-001, más acotado: solo notas y resaltados de un libro, en Markdown, sin nube ni cuentas.

## Alcance propuesto

| Capacidad                                                              | Prioridad         |
| ---------------------------------------------------------------------- | ----------------- |
| Exportar notas + resaltados de un libro a un `.md`                     | Alta              |
| Reimportar ese `.md` y reconstruir las anotaciones                     | Alta              |
| Preservar `selectedText`, `anchor` (offsets y contexto) y color/estilo | Alta              |
| Ordenar por posición de lectura                                        | Alta              |
| Exportar/importar marcadores en el mismo archivo                       | Media, incremento |
| Adjuntar el `.md` al libro o a un directorio elegido                   | Media             |
| Sincronización cloud del archivo                                       | Feature separada  |

## Formato Markdown propuesto

El archivo combina una parte legible (encabezado, cita y comentario) con un bloque legible por máquina por anotación, para que el mismo documento sirva a humanos y a reimportación. El locator exacto viaja en un comentario HTML con JSON; el resto es solo presentación.

```markdown
---
clio: annotations
version: 1
bookId: book-abc
bookTitle: 'El nombre del viento'
format: epub
fileHash: 'sha256:...'
exportedAt: 2026-10-13T00:00:00Z
---

# Notas y resaltados — El nombre del viento

## Capítulo 1

> El texto resaltado literal, tal como aparece en el libro.

- **Resaltado** — color `#e8c76a`, estilo `highlight`
  <!-- clio:highlight {"id":"hl-1","locatorStart":{"cfi":"epubcfi(/6/4!/4/2/1:0)","anchor":{"start":120,"end":168,"prefix":"...","suffix":"..."}},"locatorEnd":{"cfi":"epubcfi(/6/4!/4/2/1:48)"},"selectedText":"El texto resaltado literal","color":"#e8c76a","style":"highlight"} -->

> Otro pasaje subrayado.

- **Nota** — cuerpo del comentario del usuario
  <!-- clio:note {"id":"note-1","locator":{"cfi":"epubcfi(/6/4!/4/2/2:0)","anchor":{"start":42,"end":80}},"selectedText":"Otro pasaje subrayado","body":"cuerpo del comentario","createdAt":1730000000000,"updatedAt":1730000001000} -->
```

## Reimportación

- El parser lee los comentarios `<!-- clio:highlight -->` / `<!-- clio:note -->` y valida su JSON con los validadores existentes (`validateHighlightInput`, `validateNoteInput`/`validateNoteForExport`).
- La parte legible (blockquote, viñeta) se ignora al importar; sirve para lectura y para editar a mano con cuidado.
- Si un bloque `clio:*` falta o está corrupto, se intenta reconstruir la anotación a partir de `selectedText` + `anchor` y se marca como no resuelta.
- El libro destino se identifica por `bookId`; si no coincide, se puede emparejar por `fileHash` o mostrar advertencia y permitir importar como anotaciones no resueltas.
- Los ids existentes no se duplican (misma semántica que `importAnnotations`).

## Arquitectura

1. `packages/annotations/src/annotation-export.ts` incluye `bookmarks`, `notes` y `highlights` en `AnnotationExportData` (el payload original de solo `bookmarks` y `notes` se extendió con highlights para este feature).
2. Módulo `packages/annotations/src/annotation-markdown.ts` con `exportAnnotationsToMarkdown(...)` y `importAnnotationsFromMarkdown(...)`, puros y testeables, reutilizando `listHighlightsManaged`, `listNotesManaged` y los validadores.
3. Reporte de resultados: `{ notesImported, highlightsImported, skipped, unresolved }`.
4. UI desktop: botón "Exportar/Importar Markdown" en `LibraryView` → Notas y resaltados, usando `dialog` + `fs` de Electron (`NotesExportDialog.tsx`). La generación de los bytes queda en el paquete para poder reutilizarse en mobile más adelante.

**Implementado** en `packages/annotations/src/annotation-markdown.ts` (+ tests) y en la UI desktop.

## Casos límite

- Texto con caracteres Markdown especiales (`>`, `---`, backticks, `#`): usar bloques/cercas de longitud variable y no confiar en el texto legible para reconstruir.
- Archivo sin bloques `clio:*` (Markdown ajeno): no importar nada o pedir confirmación.
- `bookId`/`fileHash` no coincidentes: advertencia explícita.
- Resaltado sin `selectedText` o nota de cuerpo vacío: respetar la validación del dominio.
- UTF-8 con BOM y saltos CRLF; preservar fechas `createdAt`/`updatedAt`.
- Archivos muy grandes: escribir en streaming y no cargar todo en memoria.

## Pruebas requeridas

- Round-trip: export → import recupera notas y resaltados con sus locators, colores, estilos y textos.
- Escapado de Markdown especial y de cercas.
- Parseo de archivo sin bloques `clio:*` y con bloques corruptos.
- Marcadores excluidos del corte inicial.
- Ids repetidos no duplican anotaciones.

## Criterios de aceptación

El usuario puede exportar las notas y resaltados de un libro a un `.md` que se abre en cualquier editor, y al reimportarlo en una instalación local recupera las anotaciones con su posición y texto. La importación no duplica anotaciones existentes y advierte cuando el libro no coincide.
