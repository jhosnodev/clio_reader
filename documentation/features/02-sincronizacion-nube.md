# F-002: Sincronización con la nube

| Campo | Valor |
|---|---|
| **Nombre** | Sincronización con la nube |
| **Autor** | Manus AI |
| **Fecha de creación** | 28 de agosto de 2026 |
| **Fecha de última actualización** | 28 de agosto de 2026 |
| **Estado** | Feature futura — fuera del MVP |
| **Versión del documento** | 1.0.0 |

## Objetivo

Sincronizar biblioteca, metadata, progreso, marcadores, notas y preferencias entre Windows, Android, iOS y futuras plataformas. La nube no debe ser necesaria para leer localmente.

## Principios

La sincronización debe ser opt-in, incremental, cifrada en tránsito y compatible con modo offline. El archivo original puede sincronizarse como objeto remoto separado de los metadatos; el usuario debe poder decidir si sube el libro o solo sincroniza progreso y anotaciones.

## Modelo técnico

Cada entidad deberá tener un identificador estable, `updatedAt`, `deviceId`, versión de esquema y, si se necesita resolución avanzada, una versión de registro. El cliente mantiene una cola de cambios local y confirma operaciones cuando el servidor responde. Las operaciones deben ser idempotentes.

## Conflictos

Para preferencias se puede usar “última escritura gana” con historial básico. Para progreso puede prevalecer el locator más reciente o solicitar elección del usuario. Para notas y marcadores se deben fusionar registros por `id`; los borrados requieren tombstones para no reaparecer en otro dispositivo.

## Dependencias

Esta feature requiere identidad, API autenticada, base de datos remota, almacenamiento de objetos, política de privacidad, recuperación de cuenta, límites de uso y observabilidad. No debe agregarse ninguno de estos componentes al MVP local.

## Criterios de aceptación

Dos dispositivos pueden iniciar sesión, sincronizar cambios offline al recuperar conectividad, resolver conflictos de forma visible, conservar anotaciones y eliminar datos conforme a la política de privacidad. La lectura local debe continuar si el servidor está caído.
