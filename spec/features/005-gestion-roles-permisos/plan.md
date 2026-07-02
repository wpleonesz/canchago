# 005 · Gestión de Roles y Permisos — Plan

_Implementación respetando la constitución._

## Enfoque

Agregar tablas `Role`, `Permission` y `RolePermission` al schema Prisma. `Role` es la entidad editable por organización; `Permission` es un catálogo global de permisos disponibles (inmutable). Relación M:N mediante `RolePermission`. Implementar endpoints para CRUD de roles y asignación de permisos. Validar con Zod. Proteger con autorización basada en permisos. Registrar en OpenAPI.

## Implementación

1. **`prisma/schema.prisma`** — Agregar modelos:
   - `Permission` (nombre único global, descripción, resource, action, createdAt).
   - `Role` (organizationId FK, nombre, descripción, createdAt, updatedAt, deletedAt).
   - `RolePermission` (roleId FK, permissionId FK, relación M:N).
   - Índices en `Role.organizationId` + nombre para filtros rápidos.
   - Constraint `@@unique([organizationId, name])` en Role.

2. **`prisma/seeds/permissions.ts`** — Catálogo de permisos iniciales (ej: `usuarios.read`, `usuarios.write`, `organizaciones.read`, `organizaciones.manage`, `roles.read`, `roles.manage`, etc.). Ejecutar en seed.

3. **`validations/roles-permisos/`** — Crear schemas Zod:
   - `CreateRoleInput` (organizationId, nombre, descripción, permissionIds[]).
   - `UpdateRoleInput` (nombre, descripción).
   - `UpdateRolePermissionsInput` (permissionIds[]).
   - Validar nombres no vacíos, permissionIds contra lista blanca de permisos válidos.

4. **`database/roles-permisos/`** — Encapsular queries Prisma:
   - `getRoles(organizationId, page, pageSize)`
   - `getRoleById(id, organizationId)`
   - `createRole(organizationId, data)`
   - `updateRole(id, data)`
   - `deleteRole(id)` (soft)
   - `getPermissions(page, pageSize)`
   - `getPermissionsByRole(roleId)`
   - `assignPermissionsToRole(roleId, permissionIds)` (reemplaza permisos previos)
   - `removePermissionFromRole(roleId, permissionId)`

5. **`services/roles-permisos/`** — Lógica de negocio:
   - `createRole(organizationId, data)` → valida unicidad, crea rol + permisos.
   - `updateRole(id, data)` → valida, actualiza.
   - `deleteRole(id)` → transacción: marca rol como deleted, limpia RolePermission.
   - `assignPermissionsToRole(roleId, permissionIds)` → transacción: reemplaza.
   - `removePermissionFromRole(roleId, permissionId)`.
   - Coordinación con cache (invalidar en cambios).

6. **`pages/api/roles/index.ts`** — GET + POST (listar/crear roles por organización)

7. **`pages/api/roles/[roleId].ts`** — GET + PATCH + DELETE (detalle/editar/eliminar rol)

8. **`pages/api/roles/[roleId]/permisos/index.ts`** — GET (listar permisos asignados a un rol)

9. **`pages/api/roles/[roleId]/permisos`** — PATCH (asignar/remover permisos de un rol)

10. **`pages/api/permisos/index.ts`** — GET (listar todos los permisos disponibles, paginados)

11. **Tests** — Unitarios en `services/roles-permisos/*.test.ts` y de integración en `tests/integration/roles-permisos.test.ts`.

12. **`documentation/schemas/roles-permisos.ts`** — Registra schemas y endpoints. Exportar desde `documentation/schemas/index.ts`.

## Decisiones

- **Catálogo global de permisos**: `Permission` es inmutable y global; simplifica validación y reusabilidad.
- **Roles por organización**: Cada org define sus roles; `Role` incluye organizationId.
- **M:N mediante tabla explícita**: `RolePermission` permite queries eficientes y auditoría.
- **Soft delete en Role**: Soporta recuperación; `RolePermission` se limpia en transacción.
- **Seed de permisos**: Inicializar con lista predefinida; agregar nuevos vía seed en el futuro.

## Riesgos

- **Inconsistencia en transacción**: Si asignación de permisos falla a mitad, role queda sin permisos. **Mitigación**: Transacción ACID en Prisma.
- **Permisos huérfanos**: Si permiso es eliminado pero rol lo usa. **Mitigación**: Nunca eliminar permisos; solo deprecar marcándolos `deprecated: true` (feature futura).
