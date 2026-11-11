# F-010: Plugin de Obsidian

| Campo                             | Valor                               |
| --------------------------------- | ----------------------------------- |
| **Nombre**                        | Plugin de Obsidian para Clio Reader |
| **Fecha de creación**             | 10 de noviembre de 2026             |
| **Fecha de última actualización** | 10 de noviembre de 2026             |
| **Estado**                        | Feature futura — Etapa 2            |
| **Versión del documento**         | 1.0.0                               |

> Spec ligera. Se detalla al entrar en la Etapa 2 (ver
> [`../00-vision-roadmap.md`](../00-vision-roadmap.md)).

## Objetivo

Conectar Clio Reader con una comunidad que ya valora la gestión del conocimiento:
llevar notas y resaltados de lectura al vault de Obsidian, respetando su modelo
de zettelkasten y sin obligar al usuario a cambiar sus hábitos.

**Criterio de salida:** un usuario de Obsidian puede incorporar Clio a su flujo
de trabajo sin perder autonomía ni modificar sus hábitos fundamentales.

## Alcance MVP

| Capacidad                                         | Prioridad |
| ------------------------------------------------- | --------- |
| Plugin mínimo instalable en Obsidian (Desktop)    | Alta      |
| Importar notas y resaltados de Clio al vault      | Alta      |
| Deep links entre Clio ↔ Obsidian                  | Alta      |
| Preservar IDs y metadatos (estabilidad de enlace) | Alta      |
| Detección de conflictos (duplicados/editados)     | Alta      |
| Documentación pública y repositorio abierto       | Media     |

## Principios

- **Autonomía del usuario:** el vault es del usuario; Clio solo añade o actualiza
  entradas sin reescribir su organización.
- **Regla de oro:** abrir una nota de Clio en Obsidian y volver debe ser un flujo
  natural, no un exportador manual.
- **IDs estables:** cada anotación exportada conserva su `id` y `bookId` para
  que los deep links sigan funcionando tras reimportar.
- **Formatos abiertos:** los notas llegan como Markdown legible; el metadato
  mínimo vive en frontmatter o enlazado, sin base de datos propia del plugin.
- **Conflictos transparentes:** ante una nota editada en ambos lados, el plugin
  detecta el conflicto y propone resolución; nunca sobrescribe en silencio.

## Dependencias

| Dependencia                              | Por qué                                     |
| ---------------------------------------- | ------------------------------------------- |
| F-001 (paquete exportable JSON/Markdown) | Origen canónico de anotaciones y metadata   |
| F-005 (Markdown) ✅                      | Formato legible y reimportable de notas     |
| Deep links de desktop                    | Navegación Clio ↔ Obsidian                  |
| IDs estables de anotaciones              | Que los enlaces no se rompan entre sesiones |

## Fuera de alcance

- Sincronización bidireccional automática (ver F-002, horizonte).
- IA sobre las notas (F-011, horizonte).
- Publicación en el directorio oficial de plugins antes de validar el MVP con
  usuarios reales.

## Criterios de aceptación (MVP)

1. Con el plugin instalado, una nota creada en Clio aparece como Markdown
   legible en el vault con su metadata intacta.
2. Un deep link desde el vault abre el libro en Clio en la posición de la
   anotación, y un deep link desde Clio abre la nota en Obsidian.
3. Editar la nota en Obsidian y reimportar no duplica entradas ni pierde el ID.
4. Un mismo conflicto detectado se resuelve con decisión explícita del usuario.
5. El flujo completo funciona sin red.
