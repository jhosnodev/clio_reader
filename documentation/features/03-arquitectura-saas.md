# F-003: Arquitectura SaaS

| Campo                             | Valor                            |
| --------------------------------- | -------------------------------- |
| **Nombre**                        | Arquitectura SaaS de clio_reader |
| **Autor**                         | Manus AI                         |
| **Fecha de creación**             | 28 de agosto de 2026             |
| **Fecha de última actualización** | 28 de agosto de 2026             |
| **Estado**                        | Feature futura — fuera del MVP   |
| **Versión del documento**         | 1.0.0                            |

## Objetivo

Definir una evolución comercial opcional para cuentas, sincronización, almacenamiento remoto y planes SaaS. Esta arquitectura no forma parte de la biblioteca local inicial.

## Componentes previstos

```text
Cliente Windows/Android/iOS
        ↓
API autenticada
        ↓
Servicios de identidad, biblioteca, sync y billing
        ↓
Base de datos + almacenamiento de objetos
```

El sistema deberá separar identidad, catálogo personal, metadatos, anotaciones, progreso y archivos. Un usuario podrá sincronizar solo metadata y anotaciones, o también documentos si su plan y la política de derechos lo permiten.

## Multi-tenant

Todas las entidades remotas deben estar ligadas a un `tenantId` o `userId`, con aislamiento validado en cada consulta. Los documentos y anotaciones requieren autorización independiente. Las tareas de sincronización deben ser idempotentes y auditablemente asociadas a un dispositivo.

## Planes y facturación

Los planes podrían diferenciar almacenamiento, número de dispositivos, historial, exportaciones y soporte. La lógica de producto no debe confiar únicamente en el cliente para limitar planes; la API debe aplicar las reglas. Billing, reembolsos y cumplimiento legal requieren decisiones separadas antes del lanzamiento.

## Seguridad y privacidad

Se requieren sesiones revocables, cifrado en tránsito, protección de secretos, borrado de cuenta, exportación de datos, backups y límites contra abuso. El contenido de libros puede tener restricciones de copyright y no debe subirse automáticamente.

## Migración desde local

La migración debe comenzar con una importación explícita desde `.echo.json` o una base local, mostrar un resumen de datos y permitir seleccionar qué se sube. No se debe reemplazar silenciosamente la biblioteca local.

## Criterios de preparación

La feature estará lista para diseño detallado cuando el MVP local tenga un modelo estable de entidades, exportación/importación, métricas de uso, política de privacidad y una decisión comercial sobre almacenamiento de archivos frente a sincronización exclusiva de metadatos.
