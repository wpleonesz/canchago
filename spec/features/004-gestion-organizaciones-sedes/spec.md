# 004 · Gestión de Organizaciones y Sedes

**Estado:** hecho ✅

## Qué hace

Implementa CRUD completo para organizaciones (tenants) y sus sedes asociadas. Los clientes pueden crear organizaciones, gestionar múltiples sedes por organización, y realizar operaciones de lectura, actualización y eliminación tanto de organizaciones como de sedes.

## Por qué

Las organizaciones son la unidad multi-tenant del sistema. Las sedes representan ubicaciones físicas donde se prestan servicios. Es la base para asignar recursos, espacios, y gestionar reservas a nivel de sede.

## Criterios de aceptación

- [x] CRUD de organizaciones: GET (listar + detalle), POST, PATCH, DELETE con paginación y filtros.
- [x] CRUD de sedes: GET (listar + detalle), POST, PATCH, DELETE con paginación y filtros; filtrable por organización.
- [x] Validación: nombres únicos por organización, teléfono/email válidos (sedes), campos requeridos.
- [x] Autorización: solo usuarios con permiso `organizaciones.manage` pueden crear/editar/eliminar; GET require `organizaciones.read`.
- [x] Soft delete: registros marcados con `deletedAt`; todas las queries excluyen borrados.
- [x] Paginación: respuestas con `meta` (página, pageSize, total, totalPages).
- [x] Errores: validación 422, no encontrado 404, no autorizado 403, conflicto 409 (duplicado).
- [x] Transacciones: eliminación en cascada de sedes al eliminar organización (dentro de transacción).
- [x] Tests: unitarios para servicios, integración para endpoints críticos.

### Documentación (obligatorio)

- [x] Endpoints registrados en `documentation/schemas/organizaciones-sedes.ts` con `registry.registerPath()`.
- [x] Schemas Zod registrados con `registry.registerComponent()`.
- [x] Módulo exportado desde `documentation/schemas/index.ts`.
- [x] Visible y correcto en `GET /api/docs`.

## Fuera de alcance

- Asignación de usuarios a organizaciones/sedes (feature 005).
- Permisos granulares por sede (feature 005).
- Validación de direcciones con APIs externas.
