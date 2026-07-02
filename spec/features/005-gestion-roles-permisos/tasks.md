# 005 · Gestión de Roles y Permisos — Tareas

_Checklist accionable. Marca `[x]` al completarlas._

## Modelos y Base de Datos

- [ ] Agregar modelos `Permission`, `Role` y `RolePermission` a `prisma/schema.prisma` con relaciones, índices, constraint de unicidad y soft delete.
- [ ] Crear `prisma/seeds/permissions.ts` con catálogo inicial de permisos (usuarios.read, usuarios.write, organizaciones.read, organizaciones.manage, roles.read, roles.manage, sedes.read, sedes.manage, etc.).
- [ ] Ejecutar `yarn migrate-dev` y nombrar migración `add_roles_and_permissions`.
- [ ] Ejecutar `yarn seed-dev` para cargar permisos iniciales.
- [ ] Verificar estructura en `yarn prisma-studio`.

## Validaciones

- [ ] Crear `validations/roles-permisos/role.validation.ts` con schemas Zod para crear/actualizar roles.
- [ ] Crear `validations/roles-permisos/permission.validation.ts` con schemas Zod para validar permissionIds.
- [ ] Tests unitarios: validar input inválido, campos requeridos, permissionIds contra lista blanca.

## Capa de Base de Datos

- [ ] Crear `database/roles-permisos/role.db.ts` con queries encapsuladas (CRUD, filtros por organización).
- [ ] Crear `database/roles-permisos/permission.db.ts` con queries para listar permisos y obtener por rol.
- [ ] Crear `database/roles-permisos/role-permission.db.ts` con queries para asignar/remover permisos.
- [ ] Excluir roles con `deletedAt` en todas las queries por defecto.
- [ ] Tests unitarios: verificar paginación, filtros, soft delete, transacciones M:N.

## Lógica de Negocio

- [ ] Crear `services/roles-permisos/role.service.ts` con create, update, delete (con transacción para permisos).
- [ ] Crear `services/roles-permisos/permission.service.ts` con listado y búsqueda.
- [ ] Crear `services/roles-permisos/role-permission.service.ts` con assign/remove (transaccional).
- [ ] Validar lógica en servicios (no en endpoints).
- [ ] Tests unitarios: casos de error, transacciones, validaciones.

## Endpoints - Roles

- [ ] **`pages/api/roles/index.ts`**:
  - GET: listar roles de la organización (paginadas, filtrable por nombre).
  - POST: crear rol (requiere permiso `roles.manage`).
- [ ] **`pages/api/roles/[roleId].ts`**:
  - GET: detalle rol.
  - PATCH: actualizar nombre/descripción (requiere permiso `roles.manage`).
  - DELETE: borrar soft (requiere permiso `roles.manage`).

## Endpoints - Asignación de Permisos

- [ ] **`pages/api/roles/[roleId]/permisos/index.ts`**:
  - GET: listar permisos asignados a un rol (paginados).
- [ ] **`pages/api/roles/[roleId]/permisos`**:
  - PATCH: reemplazar permisos del rol (body: permissionIds[]) (requiere permiso `roles.manage`).
  - DELETE (opcional): remover un permiso específico vía query param `permissionId`.

## Endpoints - Permisos Disponibles

- [ ] **`pages/api/permisos/index.ts`**:
  - GET: listar todos los permisos disponibles (paginados, filtrable por resource/action).

## Tests de Integración

- [ ] Test: crear rol, verificar respuesta 201 + estructura.
- [ ] Test: editar rol, verificar cambios.
- [ ] Test: listar roles por organización, verificar paginación + meta.
- [ ] Test: asignar permisos a rol, verificar M:N.
- [ ] Test: eliminar rol, verificar soft delete + permisos limpios.
- [ ] Test: listar permisos disponibles, verificar catálogo.
- [ ] Test: acceso denegado sin permiso `roles.manage` (403).
- [ ] Test: validación fallida (422).
- [ ] Test: duplicado de rol en misma org (409).
- [ ] Test: permissionId inválido rechazado (422).

## Documentación OpenAPI (obligatorio, en paralelo)

- [ ] Crear `documentation/schemas/roles-permisos.ts`.
- [ ] Registrar schemas con `registry.registerComponent()`:
  - `Role`, `RoleInput`, `RolePaginated`
  - `Permission`, `PermissionPaginated`
  - `RolePermissions`, `UpdateRolePermissionsInput`
  - `Error422`, `Error403`, `Error404`, `Error409`
- [ ] Registrar endpoints con `registry.registerPath()`:
  - `GET /api/roles` (con paginación, ejemplos)
  - `POST /api/roles`
  - `GET /api/roles/{roleId}`
  - `PATCH /api/roles/{roleId}`
  - `DELETE /api/roles/{roleId}`
  - `GET /api/roles/{roleId}/permisos`
  - `PATCH /api/roles/{roleId}/permisos`
  - `GET /api/permisos`
- [ ] Exportar desde `documentation/schemas/index.ts`.
- [ ] Verificar en `GET /api/docs`: todos los endpoints visibles, ejemplos correctos, códigos de error documentados.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build` — todo debe pasar.
- [ ] Confirmar todos los criterios de aceptación de `spec.md`.
- [ ] Actualizar `spec/constitution/roadmap.md`: mover feature a "Hecho ✅" (005).
