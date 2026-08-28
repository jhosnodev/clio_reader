# F-004: Soporte para otras plataformas

| Campo                             | Valor                          |
| --------------------------------- | ------------------------------ |
| **Nombre**                        | Soporte para otras plataformas |
| **Autor**                         | Manus AI                       |
| **Fecha de creación**             | 28 de agosto de 2026           |
| **Fecha de última actualización** | 28 de agosto de 2026           |
| **Estado**                        | Feature futura — fuera del MVP |
| **Versión del documento**         | 1.0.0                          |

## Objetivo

Ampliar el lector más allá de Windows y Android, que son las plataformas primarias del MVP. El primer objetivo adicional será iOS; después se evaluarán macOS, Linux y web según demanda y compatibilidad de los renderers.

## Estrategia

El dominio, casos de uso, contratos de lectores, modelo de locators y repositorios deben permanecer compartidos. Cada plataforma implementará su shell, selector de archivos, almacenamiento y ciclo de vida. No se debe asumir que una biblioteca nativa de Android o Windows funciona sin cambios en iOS o macOS.

| Plataforma   | Estrategia inicial                    | Riesgo principal                                             |
| ------------ | ------------------------------------- | ------------------------------------------------------------ |
| iOS          | Expo + React Native                   | Permisos, sandbox, selección y acceso persistente a archivos |
| macOS        | Evaluar Electron o React Native macOS | Distribución, firma y módulos nativos                        |
| Linux        | Electron                              | Empaquetado y diferencias de integración del sistema         |
| Web          | React + Vite/PWA                      | Persistencia, acceso a archivos y restricciones de WebView   |
| tvOS u otras | Spike independiente                   | Gestos, input y APIs no equivalentes                         |

## Matriz de compatibilidad

Cada feature debe registrarse por plataforma: soportada, adaptada, limitada o no disponible. La matriz debe incluir formatos, selector de archivos, gestos, teclado, almacenamiento, suspensión, exportación y accesibilidad.

## Criterios de aceptación

La nueva plataforma debe abrir los tres formatos, conservar progreso y preferencias, manejar archivos perdidos, mantener el funcionamiento offline y pasar pruebas de rendimiento y accesibilidad. Una plataforma no se considerará soportada solo porque la aplicación compile.

## Orden recomendado

Primero validar iOS una vez estabilizado Android y Windows. Después decidir si macOS comparte shell con Electron o requiere React Native macOS. Linux y web deben priorizarse únicamente si el modelo de almacenamiento local y los renderers ofrecen una experiencia consistente.
