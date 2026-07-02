# 006 · Asignación de Roles a Usuarios — Plan

_Implementación respetando la constitución y extendiendo feature 003._

## Enfoque

Agregar tabla `UserRole` (M:N) al schema Prisma. Modificar endpoints `POST /api/users` y `PATCH /api/users/:userId` para aceptar `roleIds[]` y asignarlos en transacción. Agregar nuevos endpoints para listar, agregar y remover roles de usuario. Validar `roleIds` contra roles de la organización del usuario. Registrar en OpenAPI.

## Implementación

1. **`prisma/schema.prisma`** — Agregar modelo `UserRole` (userId FK, roleId FK, relación M:N). Índices en (userId, roleId) para queries eficientes. Constraint de integridad referencial.

2. **`validations/users/index.ts`** — Extender:
   - `createUserSchema` → agregar campo `roleIds?: string[]` (array de UUIDs, validar contra permisos).
   - `updateUserSchema` → agregar campo `roleIds?: string[]`.
   - `userRolesSchema` → nuevos validadores para listar/asignar/remover roles.

3. **`database/users/index.ts`** — Agregar queries:
   - `getRolesByUserId(userId)` → retorna roles asignados.
   - `assignRolesToUser(userId, roleIds)` → reemplaza roles (transacción).
   - `addRoleToUser(userId, roleId)` → agrega un rol.
   - `removeRoleFromUser(userId, roleId)` → remueve un rol.

4. **`services/users/index.ts`** — Modificar y agregar:
   - `create(body)` → si `roleIds` se proporciona, asignar en transacción.
   - `update(userId, body)` → si `roleIds` se proporciona, reemplazar en transacción.
   - `getRolesByUserId(userId)` → retorna roles con detalles (id, name, description).
   - `assignRolesToUser(userId, roleIds)` → valida roleIds contra org, asigna en transacción.
   - `addRoleToUser(userId, roleId)` → valida roleId, agrega.
   - `removeRoleFromUser(userId, roleId)` → remueve.

5. **Modificar `pages/api/users/index.ts`** (POST):
   - Actualizar schema para aceptar `roleIds[]`.
   - En handler, pasar `roleIds` a `userService.create`.
   - Respuesta incluye `roles[]` en usuario retornado.

6. **Modificar `pages/api/users/[userId].ts`** (PATCH):
   - Actualizar schema para aceptar `roleIds[]`.
   - En handler, pasar `roleIds` a `userService.update`.
   - Respuesta incluye `roles[]`.

7. **Modificar `pages/api/users/[userId].ts`** (GET):
   - Respuesta incluye `roles[]` (id, name, description, organizationId).

8. **`pages/api/users/[userId]/roles/index.ts`** — GET + POST:
   - GET: listar roles del usuario (paginados).
   - POST: asignar nuevos roles al usuario (body: `roleIds[]`, requiere `users.manage`).

9. **`pages/api/users/[userId]/roles/[roleId].ts`** — DELETE:
   - DELETE: remover rol específico del usuario (requiere `users.manage`).

10. **Tests** — Unitarios para nuevas/modificadas funciones en `services/users/`. Integración en `tests/integration/users/` cubrir:
    - Crear usuario con roles.
    - Actualizar roles de usuario.
    - Listar roles de usuario.
    - Agregar rol a usuario.
    - Remover rol de usuario.
    - Validación: roleId inválido, role de otra org, transacciones.

11. **`documentation/schemas/users-roles.ts`** (o actualizar `users.ts`):
    - Schema `UserRole` (id, name, description, organizationId).
    - Schema `UserResponse` con campo `roles?: UserRole[]`.
    - Schema `CreateUserBody` y `UpdateUserBody` con `roleIds?: string[]`.
    - Registrar endpoints PUT/POST/DELETE con tag `UserRoles`.

## Decisiones

- **M:N explícita**: `UserRole` permite queries eficientes y auditoría futura.
- **Reemplazo en PUT**: `assignRolesToUser` reemplaza todos los roles previos (idempotente).
- **Agregar/Remover específicos**: Endpoints POST/DELETE para cambios granulares.
- **Validación por org**: Rechazar asignación de roles de otra organización.
- **Transacción**: Crear usuario + asignar roles es atómico.

## Riesgos

- **Inconsistencia de transacción**: Si asignación de rol falla, usuario se crea sin roles. **Mitigación**: Transacción Prisma en servicio.
- **Validación de roleIds**: Todos los roleIds deben pertenecer a la org del usuario. **Mitigación**: Query en `database/` para validar antes de asignar.
- **Permisos derivados**: Si usuario hereda permisos de rol y rol se modifica, permisos no se recalculan hasta siguiente login. **Mitigación**: Doc en roadmap; feature de invalidación de sesiones futura.
