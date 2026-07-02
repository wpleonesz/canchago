# 006 · Asignación de Roles a Usuarios — Tareas

_Checklist accionable. Marca `[x]` al completarlas._

## Modelos y Base de Datos

- [ ] Agregar modelo `UserRole` a `prisma/schema.prisma` con relación M:N (userId FK, roleId FK, índices, integridad referencial).
- [ ] Ejecutar `yarn migrate-dev` y nombrar migración `add_user_roles`.
- [ ] Verificar estructura en `yarn prisma-studio`.

## Validaciones

- [ ] Actualizar `validations/users/index.ts`:
  - Agregar `roleIds?: string[]` a `createUserSchema` y `updateUserSchema`.
  - Validar que los roleIds sean UUIDs válidos.
- [ ] Tests unitarios: validar input inválido, roleIds vacío, UUIDs malformados.

## Capa de Base de Datos

- [ ] Actualizar `database/users/index.ts`:
  - `getRolesByUserId(userId)` — retorna roles con detalles.
  - `assignRolesToUser(userId, roleIds)` — transacción: limpia previos, asigna nuevos.
  - `addRoleToUser(userId, roleId)` — agrega un rol.
  - `removeRoleFromUser(userId, roleId)` — remueve un rol.
- [ ] Tests unitarios: verificar M:N, transacciones, queries.

## Lógica de Negocio

- [ ] Actualizar `services/users/index.ts`:
  - `create(body)` — si `roleIds` se proporciona, llamar a `assignRolesToUser` en transacción.
  - `update(userId, body)` — si `roleIds` se proporciona, llamar a `assignRolesToUser` en transacción.
  - `getRolesByUserId(userId)` — retorna roles con detalles.
  - `assignRolesToUser(userId, roleIds)` — valida roleIds contra org del usuario, asigna en transacción.
  - `addRoleToUser(userId, roleId)` — valida roleId, agrega.
  - `removeRoleFromUser(userId, roleId)` — remueve.
- [ ] Validación: rechazar roleIds de otra organización con error 422.
- [ ] Tests unitarios: casos de error, transacciones, validaciones, pertenencia a org.

## Endpoints - Modificaciones

- [ ] **Modificar `pages/api/users/index.ts` (POST)**:
  - Schema actualizado para aceptar `roleIds?: string[]`.
  - Handler pasa `roleIds` a `userService.create`.
  - Respuesta incluye `roles[]`.
  - Tests: crear usuario con/sin roles, roles inválidos.

- [ ] **Modificar `pages/api/users/[userId].ts` (PATCH)**:
  - Schema actualizado para aceptar `roleIds?: string[]`.
  - Handler pasa `roleIds` a `userService.update`.
  - Respuesta incluye `roles[]`.
  - Tests: actualizar roles, roles inválidos, reemplazo de roles previos.

- [ ] **Modificar `pages/api/users/[userId].ts` (GET)**:
  - Respuesta incluye `roles[]` (id, name, description, organizationId).
  - Tests: verificar roles en respuesta.

## Endpoints - Nuevos

- [ ] **`pages/api/users/[userId]/roles/index.ts`**:
  - GET: listar roles del usuario (paginados, requiere `users.read`).
  - POST: asignar nuevos roles (body: `roleIds[]`, requiere `users.manage`).
  - Tests: paginación, roles válidos/inválidos, permisos.

- [ ] **`pages/api/users/[userId]/roles/[roleId].ts`**:
  - DELETE: remover rol específico (requiere `users.manage`).
  - Tests: remover rol existente/inexistente, verificar que rol se remueve.

## Tests de Integración

- [ ] Test: crear usuario con roleIds, verificar roles asignados.
- [ ] Test: crear usuario sin roleIds, verificar roles vacío.
- [ ] Test: asignar roleIds de otra organización, rechazar con 422.
- [ ] Test: actualizar usuario con nuevos roleIds, verificar reemplazo.
- [ ] Test: GET usuario, verificar roles en respuesta.
- [ ] Test: listar roles de usuario, verificar paginación.
- [ ] Test: agregar rol a usuario, verificar adición.
- [ ] Test: remover rol de usuario, verificar remoción.
- [ ] Test: acceso denegado sin permiso `users.manage` (403).
- [ ] Test: roleId inválido rechazado (422).

## Documentación OpenAPI (obligatorio, en paralelo)

- [ ] Crear o actualizar `documentation/schemas/users-roles.ts`.
- [ ] Registrar schemas con `registry.registerComponent()`:
  - `UserRole` (id, name, description, organizationId)
  - `UserResponse` con campo `roles?: UserRole[]`
  - `CreateUserBody` con campo `roleIds?: string[]`
  - `UpdateUserBody` con campo `roleIds?: string[]`
  - `Error422`, `Error403`, `Error404`, `Error409`
- [ ] Registrar endpoints con `registry.registerPath()`:
  - `POST /api/users` (modificado, ahora con roleIds)
  - `PATCH /api/users/{userId}` (modificado, ahora con roleIds)
  - `GET /api/users/{userId}` (modificado, ahora retorna roles)
  - `GET /api/users/{userId}/roles`
  - `POST /api/users/{userId}/roles`
  - `DELETE /api/users/{userId}/roles/{roleId}`
- [ ] Exportar desde `documentation/schemas/index.ts`.
- [ ] Verificar en `GET /api/docs`: todos los endpoints visibles, ejemplos correctos.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build` — todo debe pasar.
- [ ] Confirmar todos los criterios de aceptación de `spec.md`.
- [ ] Actualizar `spec/constitution/roadmap.md`: mover feature 006 a "Hecho ✅".
