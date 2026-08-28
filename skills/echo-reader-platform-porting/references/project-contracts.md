# Contratos actuales del proyecto

## Capas compartidas

`packages/domain` contiene `Book`, `ReadingProgress`, `ReaderPreferences`, `Bookmark`, `Note` y `ReaderLocator`. Sus tipos no deben importar APIs de plataforma. Los locators son datos serializables y deben ser la única representación persistida de la posición de lectura.

`packages/reader-core` define `FileSource`, `ReaderCapabilities`, `ReaderDocument`, `ReaderAdapter` y `ReaderFactory`. Un renderer nuevo debe implementar `ReaderAdapter` y cubrir apertura, cierre, navegación y recuperación del locator. El detalle de la librería de renderizado no debe escapar del adaptador.

`packages/storage` define `KeyValueStore`, `LocalRepository`, `PersistenceState`, migración de estado y operaciones para libros, progreso, preferencias, marcadores y notas. Cada plataforma debe proporcionar el almacenamiento local mediante el contrato, no reimplementar las reglas de negocio.

## Puntos aún incompletos

`packages/library` y los shells de `apps/desktop` y `apps/mobile` todavía son esqueletos. No existe una UI funcional, ni adaptadores EPUB/PDF/CBZ concretos, ni contratos explícitos para file picker, ciclo de vida, importación durable, errores de archivo perdido o bridge WebView. El skill debe crear esos contratos antes de acoplar una nueva plataforma.

Aunque `BookFormat` incluye `md` y existe `MarkdownLocator`, el `ReaderFactory` no obtiene soporte automáticamente. El porting debe tratar Markdown como una capacidad separada y añadir su adaptador y pruebas si el alcance lo exige.

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
