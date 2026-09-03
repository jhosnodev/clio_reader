# F-005: Lectura de archivos Markdown

| Campo                             | Valor                          |
| --------------------------------- | ------------------------------ |
| **Nombre**                        | Lectura de archivos Markdown   |
| **Autor**                         | Manus AI                       |
| **Fecha de creación**             | 28 de agosto de 2026           |
| **Fecha de última actualización** | 28 de agosto de 2026           |
| **Estado**                        | Feature futura — fuera del MVP |
| **Versión del documento**         | 1.0.0                          |

## Objetivo

Permitir importar y leer archivos `.md` desde la biblioteca local de clio_reader, manteniendo el funcionamiento offline y el mismo modelo de progreso, preferencias, marcadores y notas utilizado por los demás formatos.

## Alcance propuesto

El lector Markdown debe interpretar el contenido de forma segura y mostrar títulos, subtítulos, párrafos, listas, enlaces, tablas, bloques de código, citas, imágenes locales y separadores. El contenido se presentará como documento refluible, por lo que tamaño de letra, fuente, interlineado, márgenes y tema deben comportarse de forma similar al lector EPUB.

| Capacidad                                | Prioridad                 |
| ---------------------------------------- | ------------------------- |
| Importar y detectar `.md`                | Alta                      |
| Renderizar Markdown común                | Alta                      |
| Tabla de contenidos a partir de headings | Alta                      |
| Guardar última posición                  | Alta                      |
| Marcadores y notas                       | Alta                      |
| Tema y tamaño de letra                   | Alta                      |
| Syntax highlighting                      | Media                     |
| Mermaid, KaTeX y extensiones avanzadas   | Media, con sanitización   |
| Edición del Markdown                     | Fuera del alcance inicial |
| Sincronización cloud                     | Feature separada          |

## Seguridad

El Markdown debe tratarse como contenido no confiable. El renderer debe sanitizar HTML embebido, bloquear scripts, controlar enlaces externos y evitar que imágenes o recursos remotos se carguen sin una política explícita. Las imágenes locales deben resolverse dentro del directorio autorizado del documento.

## Arquitectura

Se recomienda implementar un `MarkdownReaderAdapter` que convierta el contenido a un modelo renderizable o a HTML sanitizado dentro del mismo bridge utilizado para EPUB. El adaptador debe exponer capacidades de documento refluible, tabla de contenidos, navegación y locators por heading, posición de texto y porcentaje.

## Progreso y anotaciones

El progreso puede guardar el heading actual, un offset de texto y contexto cercano. Marcadores y notas deben utilizar el mismo contrato común, pero el locator debe conservar el path relativo del archivo y un selector textual para sobrevivir a cambios menores. Si el archivo se modifica, la aplicación debe detectar el cambio mediante hash y advertir que algunas posiciones podrían requerir reubicación.

## Pruebas requeridas

La feature debe incluir pruebas para Markdown vacío, headings anidados, listas, tablas, código, enlaces, imágenes, HTML embebido, caracteres internacionales, contenido malformado, scripts bloqueados, archivos grandes, navegación, progreso, marcadores, notas y cambios posteriores del archivo.

## Criterios de aceptación

El usuario puede agregar un `.md`, leerlo en Windows y Android, navegar por sus headings, cambiar preferencias, guardar la última posición y utilizar marcadores y notas. El contenido HTML peligroso no se ejecuta y los recursos fuera del directorio permitido no se cargan automáticamente.
