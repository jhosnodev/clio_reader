# Contratos actuales del proyecto

## Capas compartidas

`packages/domain` contiene `Book`, `ReadingProgress`, `ReaderPreferences`, `Bookmark`, `Note` y `ReaderLocator`. Sus tipos no deben importar APIs de plataforma. Los locators son datos serializables y deben ser la única representación persistida de la posición de lectura.

`packages/reader-core` define `FileSource`, `ReaderCapabilities`, `ReaderDocument`, `ReaderAdapter` y `ReaderFactory`. Un renderer nuevo debe implementar `ReaderAdapter` y cubrir apertura, cierre, navegación y recuperación del locator. El detalle de la librería de renderizado no debe escapar del adaptador.

`packages/storage` define `KeyValueStore`, `LocalRepository`, `PersistenceState`, migración de estado y operaciones para libros, progreso, preferencias, marcadores y notas. Cada plataforma debe proporcionar el almacenamiento local mediante el contrato, no reimplementar las reglas de negocio.

## Estado actual y puntos incompletos

Los shells de `apps/desktop` y `apps/mobile` están implementados, con UI funcional (biblioteca + lector) y adaptadores concretos para EPUB (`packages/reader-epub`, parser propio con jszip), PDF (`packages/reader-pdf`, PDF.js), CBZ (`packages/reader-cbz`) y Markdown (`packages/reader-md`). `BookFormat` incluye `md` y su adaptador ya está registrado en `ReaderFactory`.

Permanecen sin contrato explícito: file picker, ciclo de vida (suspensión/resume), importación durable de archivos y errores de archivo perdido, que hoy se resuelven de forma ad hoc en cada shell. El porting debe definir esos contratos antes de acoplar una nueva plataforma.

## Contratos recomendados para el shell

```ts
interface PlatformFilePicker {
  pick(): Promise<FileSource | undefined>;
  retain(source: FileSource): Promise<FileSource>;
  verify(source: FileSource): Promise<'available' | 'missing'>;
}

interface PlatformLifecycle {
  onSuspend(listener: () => Promise<void> | void): () => void;
  onResume(listener: () => Promise<void> | void): () => void;
}
```

Estos contratos son orientación de diseño, no una orden de añadirlos sin necesidad. Si se incorporan al repositorio, deben tener pruebas unitarias con dobles y documentación de la decisión.

## Requisitos de prueba

Mantener pruebas para validación de dominio, normalización de progreso, registro de adaptadores, persistencia/migración y aislamiento de anotaciones. Para una plataforma nueva, añadir pruebas de selección y retención de archivos, ciclo de vida, restauración de estado, errores de permisos, renderer bridge y matriz de formatos. Usar fixtures pequeños y deterministas; reservar pruebas manuales para gestos, accesibilidad, rendimiento y distribución.
