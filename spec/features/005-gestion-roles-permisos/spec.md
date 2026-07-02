# 005 · Gestión de Roles y Permisos

**Estado:** propuesta

## Qué hace

Implementa CRUD completo para roles y permisos en el sistema RBAC. Permite crear roles personalizados por organización, asignar permisos a roles, listar permisos disponibles, y modificar o eliminar roles. Los permisos se usan para proteger endpoints y operaciones.

## Por qué

Los roles y permisos son la base del control de acceso. Habilita autorización granular (no solo por rol, sino por permisos específicos) y permite que cada organización defina sus propios roles según sus necesidades operativas.

## Criterios de aceptación

- [ ] CRUD de roles: GET (listar + detalle), POST, PATCH, DELETE con paginación; filtrable por organización.
- [ ] Listado de permisos disponibles: GET con paginación (ej: `usuarios.read`, `usuarios.write`, `organizaciones.manage`).
- [ ] Asignación de permisos a roles: POST para agregar, DELETE para remover permisos de un rol.
- [ ] Validación: nombre de rol único por organización, nombres no vacíos, permisos válidos (lista blanca).
- [ ] Autorización: solo usuarios con permiso `roles.manage` pueden crear/editar/eliminar; GET require `roles.read`.
- [ ] Soft delete: roles marcados con `deletedAt`; queries excluyen borrados.
- [ ] Paginación: respuestas con `meta` (página, pageSize, total, totalPages).
- [ ] Errores: validación 422, no encontrado 404, no autorizado 403, conflicto 409 (duplicado).
- [ ] Transacciones: eliminación de rol remueve permisos asociados (dentro de transacción).
- [ ] Tests: unitarios para servicios, integración para endpoints críticos.

### Documentación (obligatorio)

- [ ] Endpoints registrados en `documentation/schemas/roles-permisos.ts` con `registry.registerPath()`.
- [ ] Schemas Zod registrados con `registry.registerComponent()`.
- [ ] Módulo exportado desde `documentation/schemas/index.ts`.
- [ ] Visible y correcto en `GET /api/docs`.

## Fuera de alcance

- Asignación de roles a usuarios (feature 006).
- Permisos dinámicos (feature futura).
- Auditoría de cambios de roles (feature futura).
