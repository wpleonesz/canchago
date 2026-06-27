# 003 · Gestión de Usuarios — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

> **Prerequisito:** feature **002 · Autenticación Core** debe estar completada antes de iniciar esta.

## Validaciones

- [ ] Crear `validations/users/index.ts` con `createUserSchema`, `updateUserSchema`, `userQuerySchema` y `userParamsSchema`.
- [ ] Verificar que `userQuerySchema` valide `orderBy` contra la lista permitida `['name', 'email', 'createdAt']`.

## Errores

- [ ] Crear `errors/not-found-error.ts` (`404`) si no existe.
- [ ] Crear `errors/conflict-error.ts` (`409`) si no existe.

## Helper

- [ ] Crear `helper/pagination.ts` con `normalizePagination(query)` si no existe.

## Capa de datos

- [ ] Crear `database/users/index.ts` con `getAll`, `create` y `record(userId)`.
- [ ] Verificar que todas las consultas de `getAll` y `getUnique` filtren `deletedAt: null`.
- [ ] Manejar `PrismaClientKnownRequestError` `P2002` en `create` y convertirlo en `ConflictError`.

## Servicio

- [ ] Crear `services/users/index.ts` con `getAll`, `create`, `getById`, `update` y `remove`.
- [ ] Verificar que `getById` lance `NotFoundError` cuando Prisma devuelve `null`.
- [ ] Verificar que `create` lance `ConflictError` si el email ya existe.

## API Routes

- [ ] Crear `pages/api/users/index.ts` con handlers `GET` (lista) y `POST` (crear).
- [ ] Crear `pages/api/users/[userId].ts` con handlers `GET`, `PATCH` y `DELETE`.
- [ ] Verificar que cada handler aplique los middlewares `rateLimit`, `api`, `authenticated`, `authorized` y `parser` en el orden correcto.
- [ ] Verificar que `DELETE` responda `204` sin cuerpo.
- [ ] Verificar que `POST` responda `201` con `{ data: { id, email, name, active, createdAt } }`.

## Documentación Swagger (obligatorio)

_Crear en paralelo con cada endpoint, no al final._

- [ ] Crear `documentation/schemas/users.ts`.
- [ ] Registrar `UserResponse` con `registry.registerComponent('schemas', ...)` (solo campos públicos: sin `oauthSubject`, sin `deletedAt`).
- [ ] Registrar `CreateUserBody` y `UpdateUserBody` derivados de los schemas Zod del módulo.
- [ ] Registrar `UserListResponse` con datos y `PaginationMetaSchema` de `responses/common.ts`.
- [ ] Registrar `registry.registerPath()` para `GET /users` (query params, `200 UserListResponse`, `401`, `403`).
- [ ] Registrar `registry.registerPath()` para `POST /users` (body `CreateUserBody`, `201 UserResponse`, `400`, `401`, `403`, `409`).
- [ ] Registrar `registry.registerPath()` para `GET /users/{userId}` (`200 UserResponse`, `401`, `403`, `404`).
- [ ] Registrar `registry.registerPath()` para `PATCH /users/{userId}` (body `UpdateUserBody`, `200 UserResponse`, `401`, `403`, `404`).
- [ ] Registrar `registry.registerPath()` para `DELETE /users/{userId}` (`204`, `401`, `403`, `404`).
- [ ] Exportar `documentation/schemas/users.ts` desde `documentation/schemas/index.ts`.
- [ ] Verificar que los 5 endpoints aparecen en `GET /api/docs` con tag `Users` y `cookieAuth`.

## Tests

- [ ] Unitarios `services/users/index.test.ts`: `getAll` con filtros, `create` con email duplicado, `getById` con ID inexistente.
- [ ] Unitarios `database/users/index.test.ts`: soft delete establece `deletedAt` y `active = false`.
- [ ] Integración `tests/integration/users/list.test.ts`: paginación, filtros y ordenamiento.
- [ ] Integración `tests/integration/users/crud.test.ts`: ciclo completo create → get → update → delete.
- [ ] Integración: sin token → `401`; con token sin permiso → `403`.
- [ ] Integración: email duplicado → `409`; userId inexistente → `404`.

## Cierre

- [ ] Ejecutar `npm run lint && npm run typecheck && npm run test && npm run build` sin errores.
- [ ] Validar contra los criterios de aceptación de `spec.md`.
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.
