# echo_reader

**echo_reader** es un lector y gestor de biblioteca local para libros y cómics digitales.

## MVP

La primera versión estará orientada principalmente a **Windows y Android**. Permitirá al usuario agregar y leer archivos almacenados localmente en su dispositivo, sin necesidad de conexión a internet, cuenta o perfil.

Formatos previstos:

- `.epub`
- `.pdf`
- `.cbz`

El MVP incluirá una biblioteca local, navegación de lectura, guardado de la última posición, preferencias visuales, marcadores y notas. La cantidad de libros dependerá únicamente del espacio de almacenamiento y de las capacidades del dispositivo.

La sincronización con la nube, los perfiles, la arquitectura SaaS, la exportación avanzada y el soporte para otras plataformas se consideran funcionalidades futuras.

## Documentación

La documentación del proyecto se encuentra en [`documentation/`](./documentation/):

- [Definición del MVP](./documentation/01-definicion-mvp.md)
- [Arquitectura técnica](./documentation/02-arquitectura-tecnica.md)
- [Arquitectura de data y metadata](./documentation/03-arquitectura-data-y-metadata.md)
- [Features futuros](./documentation/04-features-futuros.md)
- [Plan de implementación por fases](./documentation/05-plan-implementacion.md)
- [Guía de desarrollo local](./documentation/06-desarrollo-local.md)
- [Documentos de features futuras](./documentation/features/)

## Estado

El proyecto se encuentra en fase de implementación inicial. La Fase 0 ya cuenta con monorepo, TypeScript estricto, Prettier, ESLint, Vitest, scripts de validación y CI. Las aplicaciones de plataforma todavía son esqueletos para continuar con el spike de Windows y Android.
