# F-004: Soporte para otras plataformas

| Campo                             | Valor                          |
| --------------------------------- | ------------------------------ |
| **Nombre**                        | Soporte para otras plataformas |
| **Autor**                         | Manus AI                       |
| **Fecha de creación**             | 28 de agosto de 2026           |
| **Fecha de última actualización** | 10 de noviembre de 2026        |
| **Estado**                        | Feature futura — fuera del MVP |
| **Versión del documento**         | 1.1.0                          |

## Objetivo

Ampliar el lector más allá de Desktop (Windows y Linux, Etapa 1 del [roadmap](../00-vision-roadmap.md)). Android es la Etapa 3 sobre la base ya construida (Fase 9); después de Android llegará iOS, y luego se evaluarán macOS y web según demanda y compatibilidad de los renderers.

## Estrategia

El dominio, casos de uso, contratos de lectores, modelo de locators y repositorios deben permanecer compartidos. Cada plataforma implementará su shell, selector de archivos, almacenamiento y ciclo de vida. No se debe asumir que una biblioteca nativa de Android o Windows funciona sin cambios en iOS o macOS.

| Plataforma   | Estrategia inicial                    | Riesgo principal                                             |
| ------------ | ------------------------------------- | ------------------------------------------------------------ |
| Android      | Expo + React Native (base Fase 9 ✅)  | Permisos, ciclo de vida y validación en dispositivo          |
| iOS          | Expo + React Native                   | Permisos, sandbox, selección y acceso persistente a archivos |
| macOS        | Evaluar Electron o React Native macOS | Distribución, firma y módulos nativos                        |
| Web          | React + Vite/PWA                      | Persistencia, acceso a archivos y restricciones de WebView   |
| tvOS u otras | Spike independiente                   | Gestos, input y APIs no equivalentes                         |

> Linux ya está disponible en la Etapa 1 (AppImage + `.deb`), por lo que no es una plataforma futura.

## Matriz de compatibilidad

Cada feature debe registrarse por plataforma: soportada, adaptada, limitada o no disponible. La matriz debe incluir formatos, selector de archivos, gestos, teclado, almacenamiento, suspensión, exportación y accesibilidad.

## Criterios de aceptación

La nueva plataforma debe abrir todos los formatos, conservar progreso y preferencias, manejar archivos perdidos, mantener el funcionamiento offline y pasar pruebas de rendimiento y accesibilidad. Una plataforma no se considerará soportada solo porque la aplicación compile.

## Orden recomendado

Seguir el orden del [roadmap](../00-vision-roadmap.md): consolidar Desktop (Etapa 1), validar Obsidian (Etapa 2), retomar Android (Etapa 3) y después evaluar iOS. macOS y web deben priorizarse únicamente si el modelo de almacenamiento local y los renderers ofrecen una experiencia consistente.
