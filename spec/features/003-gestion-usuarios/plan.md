# 003 · Gestión de Usuarios — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

CRUD estándar siguiendo la convención de API Routes de `constitution/tech-stack.md`: dos archivos en `pages/api/users/`, capa `database/users/` con toda la lógica Prisma, `services/users/` con reglas de negocio y `validations/users/` con esquemas Zod. Los middlewares de autenticación (`auth`) y autorización (`access`) de la feature **002** protegen cada handler.

## Implementación

1. **`validations/users/index.ts`** — Esquemas Zod:
   - `createUserSchema` — `{ email, name, organizationId }` con reglas de formato.
   - `updateUserSchema` — versión parcial de `createUserSchema` (`.partial()`).
   - `userQuerySchema` — `{ page?, pageSize?, organizationId?, active?, search?, orderBy?, order? }` con campos de ordenamiento validados contra lista permitida (`['name','email','createdAt']`).
   - `userParamsSchema` — `{ userId: z.string().uuid() }`.

2. **`database/users/index.ts`** — Capa Prisma:
   - `getAll(filters)` → consulta paginada excluyendo `deletedAt != null`.
   - `create(data)` → inserta y devuelve el usuario creado.
   - `record(userId)` → retorna el objeto con:
     - `getUnique()` → busca por ID, excluye eliminados.
     - `update(data)` → actualiza campos parciales.
     - `remove()` → soft delete (`active = false`, `deletedAt = new Date()`).
   - `findOrSyncByOAuth(oauthSubject, email, name)` — ya definido en la feature **002**.

3. **`services/users/index.ts`** — Capa de negocio:
   - `getAll(query)` → llama a `userData.getAll`, aplica paginación normalizada, devuelve `{ data, meta }`.
   - `create(body)` → verifica email único (`ConflictError` si existe), llama a `userData.create`.
   - `getById(userId)` → llama a `userData.record(userId).getUnique()`, lanza `NotFoundError` si es `null`.
   - `update(userId, body)` → verifica existencia, llama a `userData.record(userId).update(body)`.
   - `remove(userId)` → verifica existencia, llama a `userData.record(userId).remove()`.

4. **`pages/api/users/index.ts`** — Colección:
   ```
   GET  → [rateLimit, api, authenticated, authorized(['users.read']),  parser({query: userQuerySchema})]  → userService.getAll
   POST → [rateLimit, api, authenticated, authorized(['users.create']), parser({body: createUserSchema})] → userService.create → 201
   ```

5. **`pages/api/users/[userId].ts`** — Recurso individual:
   ```
   GET    → [rateLimit, api, authenticated, authorized(['users.read']),   parser({query: userParamsSchema})] → userService.getById
   PATCH  → [rateLimit, api, authenticated, authorized(['users.update']), parser({query: userParamsSchema, body: updateUserSchema})] → userService.update → 200
   DELETE → [rateLimit, api, authenticated, authorized(['users.delete']), parser({query: userParamsSchema})] → userService.remove → 204
   ```

6. **`errors/`** — Si aún no existen, crear `not-found-error.ts` (`404`) y `conflict-error.ts` (`409`).

7. **`helper/pagination.ts`** — Si aún no existe, función `normalizePagination(query)` que calcula `skip`, `take` y devuelve `meta`.

8. **`documentation/schemas/users.ts`** — Registro en el OpenAPI registry:
   - `registry.registerComponent('schemas', 'UserResponse', ...)` — campos públicos del usuario.
   - `registry.registerComponent('schemas', 'CreateUserBody', ...)` — derivado de `createUserSchema`.
   - `registry.registerComponent('schemas', 'UpdateUserBody', ...)` — derivado de `updateUserSchema`.
   - `registry.registerComponent('schemas', 'UserListResponse', ...)` — wraps `UserResponse[]` + `PaginationMetaSchema`.
   - `registry.registerPath(...)` para los 5 endpoints: `GET /users`, `POST /users`, `GET /users/{userId}`, `PATCH /users/{userId}`, `DELETE /users/{userId}`.
   - Exportar desde `documentation/schemas/index.ts` (`export * from './users'`).

9. **Tests** — Unitarios para `services/users/` y `database/users/`. Integración en `tests/integration/users/`.

## Decisiones

- **Soft delete con `deletedAt`** — Preserva el historial de auditoría. Los listados filtran `deletedAt: null` en todas las consultas de `database/users/`.
- **Validación de campos de ordenamiento con lista permitida** — Previene inyección de columnas arbitrarias. La lista se define en `validations/users/` como constante exportable.
- **`update` parcial con `.partial()` de Zod** — Permite `PATCH` semántico sin enviar todos los campos. Prisma acepta objetos con solo las claves presentes.
- **No exponer `oauthSubject` ni campos internos en respuestas** — El servicio selecciona explícitamente los campos de salida con `select` de Prisma.

## Riesgos

- **Consultas sin índice en filtros de texto** — Búsqueda parcial por `name`/`email` con `ILIKE` puede ser lenta en tablas grandes. **Mitigación:** asegurar índice `GIN` o `trgm` en el modelo Prisma antes de habilitar el filtro en producción.
- **Condición de carrera en unicidad de email** — Verificar unicidad en el servicio y luego insertar no es atómico. **Mitigación:** manejar `PrismaClientKnownRequestError` con código `P2002` y convertirlo en `ConflictError`.
- **Dependencia de feature 002** — Los middlewares `auth` y `access` deben estar operativos. **Mitigación:** esta feature no se implementa hasta que **002** esté completa.
