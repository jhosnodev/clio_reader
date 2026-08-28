# F-001: Compartir metadata y data de lectura

| Campo                             | Valor                                |
| --------------------------------- | ------------------------------------ |
| **Nombre**                        | Compartir metadata y data de lectura |
| **Autor**                         | Manus AI                             |
| **Fecha de creación**             | 28 de agosto de 2026                 |
| **Fecha de última actualización** | 28 de agosto de 2026                 |
| **Estado**                        | Feature futura — fuera del MVP       |
| **Versión del documento**         | 1.0.0                                |

## Objetivo

Permitir exportar e importar metadata bibliográfica y data generada por el usuario: última posición, marcadores, notas, texto seleccionado y contexto. La primera entrega puede ser completamente local, sin nube ni cuentas.

## Formatos

Se recomiendan dos salidas. Markdown, HTML o TXT servirán para compartir un extracto legible con otras herramientas. Un paquete `.echo.json` conservará una representación reimportable por echo_reader. Como evolución, las anotaciones pueden mapearse al modelo W3C Web Annotation y las posiciones al modelo Readium Locator.

## Paquete canónico

```text
echo-reader-export/
  manifest.json
  metadata.json
  progress.json
  annotations.json
  README.txt
```

El manifiesto debe contener versión, formato original, hash del archivo, fecha de exportación y advertencias de compatibilidad. Marcadores y notas deben incluir `bookId`, locator, posición normalizada, porcentaje, texto seleccionado y contexto cuando exista.

## Compatibilidad

La exportación legible tendrá alta portabilidad, pero la reimportación exacta dependerá del lector receptor. EPUB puede utilizar CFI o selectores textuales; PDF puede utilizar página y viewport; CBZ puede utilizar índice de imagen, aunque su estabilidad disminuye si se reordenan páginas. No se debe prometer compatibilidad universal.

## MVP de esta feature futura

El primer corte debe exportar Markdown y `.echo.json`, e importar `.echo.json` en una instalación local. La exportación a W3C/Readium y los adaptadores para Kobo, Kindle u otros lectores serán incrementos posteriores.

## Criterios de aceptación

El usuario puede exportar un libro sin exponer documentos no seleccionados, abrir el Markdown en otra herramienta, reimportar el JSON y recuperar notas, marcadores y progreso cuando el hash o identificador del libro coincida. Si no coincide, se debe mostrar una advertencia y permitir importar como anotaciones no resueltas.
