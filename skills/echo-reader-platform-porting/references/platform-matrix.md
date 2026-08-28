# Matriz de portabilidad de echo_reader

Usar esta matriz como punto de partida; sustituir `por validar` con resultados del spike y pruebas reales antes de declarar soporte.

| Capacidad              | Windows                  | Android                 | iOS                                         | macOS                   | Linux                | Web/PWA                           |
| ---------------------- | ------------------------ | ----------------------- | ------------------------------------------- | ----------------------- | -------------------- | --------------------------------- |
| Shell recomendado      | Electron + React         | Expo + React Native     | Expo + React Native                         | Electron o RN macOS     | Electron             | React + Vite/PWA                  |
| Selector de archivos   | Nativo de escritorio     | Document picker         | Document picker                             | Nativo de escritorio    | Nativo de escritorio | File System Access o input        |
| URI durable            | Ruta/bookmark de archivo | Permiso persistente/SAF | Security-scoped bookmark o copia gestionada | Ruta/bookmark           | Ruta                 | OPFS/IndexedDB y permisos         |
| Almacenamiento         | SQLite/JSON local        | SQLite/AsyncStorage     | SQLite/AsyncStorage                         | SQLite/JSON local       | SQLite/JSON local    | IndexedDB/OPFS                    |
| EPUB/PDF/CBZ           | por validar              | por validar             | por validar                                 | por validar             | por validar          | por validar                       |
| Gestos                 | limitada                 | principal               | principal                                   | limitada                | limitada             | táctil opcional                   |
| Teclado/ratón          | principal                | opcional                | opcional                                    | principal               | principal            | disponible                        |
| Suspensión/reanudación | por validar              | crítica                 | crítica                                     | por validar             | por validar          | pestaña suspendida                |
| Riesgo dominante       | empaquetado y firma      | permisos y lifecycle    | sandbox y acceso persistente                | firma y módulos nativos | distribución         | persistencia y APIs del navegador |

## Regla de clasificación

Para cada fila, usar una de estas etiquetas:

- `shared`: la capacidad se resuelve con paquetes compartidos y no requiere API nativa.
- `adapter`: requiere una implementación de plataforma detrás de un contrato estable.
- `limited`: funciona con restricciones que deben aparecer en la UI y en la documentación.
- `unsupported`: no debe exponerse como capacidad disponible.

## Mínimo de validación por target

Una plataforma solo puede pasar de `por validar` a soportada cuando abre EPUB, PDF y CBZ; guarda y restaura progreso, preferencias, marcadores y notas; detecta archivos faltantes; funciona sin red; sobrevive a suspensión y reanudación; y completa las pruebas de accesibilidad, rendimiento y empaquetado apropiadas al target.
