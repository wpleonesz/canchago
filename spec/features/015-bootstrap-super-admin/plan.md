# 015 · Bootstrap y Protección del Super Admin — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

Reutilizar lo que ya existe (`Role.isSystem`, el rol global `Administrador` ya sembrado, el script `yarn asignar-rol` ya idempotente) en vez de construir infraestructura nueva. Los únicos cambios de código son dos guardias de autorización a nivel de servicio — escalamiento de privilegios y último administrador — insertados en los mismos puntos donde hoy se asignan/remueven roles o se desactiva un usuario, envueltos en las transacciones Prisma que ya existen (o que se agregan donde faltan).

## Implementación

1. **`services/users/role-guard.ts`** (nuevo) — dos funciones puras sobre Prisma:
   - `assertCanAssignRoles(actingUser: SessionUser, roleIds: string[]): Promise<void>` — carga `prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id, isSystem } })`; si alguno tiene `isSystem: true` y `actingUser.roles` no incluye `{ code: 'administrador' }`, lanza `AuthorizationError('No tienes permiso para asignar un rol de sistema.')`.
   - `assertKeepsAtLeastOneAdmin(tx: Prisma.TransactionClient, excludedUserId: string): Promise<void>` — cuenta usuarios `status: 'ACTIVE'` distintos de `excludedUserId` con un `UserRole` cuyo `role.code === 'administrador'`; si el conteo es `0`, lanza `ConflictError('No es posible dejar la plataforma sin ningún administrador activo.')`. Recibe el cliente de transacción (`tx`), no `prisma` global, para que el conteo y la escritura corran en la misma transacción.
2. **`middleware/auth.ts` / `req.user`** — sin cambios: `assertCanAssignRoles` recibe el `SessionUser` que `auth` ya adjunta a `req.user`.
3. **`services/users/index.ts`**:
   - `create` — si `body.roleIds` está presente, llamar `assertCanAssignRoles(req.user, body.roleIds)` **antes** de `userData.create`/`assignRolesToUser` (requiere pasar `actingUser` como parámetro nuevo del servicio, propagado desde la ruta).
   - `update` — igual, antes de `assignRolesToUser` cuando `body.roleIds !== undefined`.
   - `remove` — antes de `userData.record(userId).remove()`, envolver en `prisma.$transaction(async (tx) => { await assertKeepsAtLeastOneAdmin(tx, userId); await tx.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } }); })` (hoy `record(userId).remove()` no está en transacción ni recibe `tx`; se adapta para aceptar un cliente transaccional opcional o se reimplementa el `update` puntual dentro del `$transaction`).
4. **`database/users/index.ts`**:
   - `assignRolesToUser(userId, roleIds)` — ya está en `$transaction`; agregar `await assertKeepsAtLeastOneAdmin(tx, userId)` **antes** de `deleteMany` cuando el usuario pierde el rol `administrador` en el reemplazo (comparar roles previos vs. `roleIds` nuevos dentro de la misma transacción).
   - `addRoleToUser(userId, roleId)` — envolver en `prisma.$transaction` (hoy no lo está) y ejecutar `assertCanAssignRoles` antes de `create` (esta función ya se llama desde la ruta con el `actingUser` disponible).
   - `removeRoleFromUser(userId, roleId)` — envolver en `prisma.$transaction`; antes de `deleteMany`, si el rol removido es `administrador`, llamar `assertKeepsAtLeastOneAdmin(tx, userId)`.
5. **`pages/api/users/index.ts`** (`POST`) y **`pages/api/users/[userId].ts`** (`PATCH`) — pasar `req.user` al servicio (`userService.create(parsed.data, req.user)` / `userService.update(parsedParams.data.userId, parsedBody.data, req.user)`).
6. **`pages/api/users/[userId]/roles/index.ts`** (`POST`) — pasar `req.user` a `userService.addRoleToUser(userId, roleId, req.user)` (o llamar `assertCanAssignRoles` directamente en la ruta antes del loop existente).
7. **`pages/api/users/[userId]/roles/[roleId].ts`** (`DELETE`) y **`pages/api/users/[userId].ts`** (`DELETE`) — sin cambios de firma visibles desde la ruta; el guardia vive en la capa `database/`/`services/` como se describe arriba.
8. **`documentation/schemas/users.ts`** — actualizar la `description` de `POST /users`, `PATCH /users/:userId`, `DELETE /users/:userId`, `POST /users/:userId/roles`, `DELETE /users/:userId/roles/:roleId` con los nuevos casos `403`/`409`. No se crea un schema Zod nuevo: se reutilizan los componentes de error ya registrados (`ErrorResponseSchema` u homólogo existente).

## Decisiones

- **Reusar `Role.isSystem` en vez de un campo nuevo tipo `isSuperAdmin`** — ya existe, ya distingue roles sembrados (`Administrador`, `Futbolista`, `Gestor de Cancha`) de roles creados vía API (`services/roles-permisos/role.service.ts` fuerza `isSystem: false` en `createRole`), así que ningún rol creado por un tenant puede activar accidentalmente el guardia.
- **Usar `code === 'administrador'` como chequeo de "eres super admin" en vez de un permiso nuevo** (p. ej. `roles.assign-privileged`) — evita expandir el catálogo de permisos y tocar la nomenclatura ya señalada como deuda técnica en el roadmap (ítem "010"); alternativa descartada por aumentar superficie sin necesidad comprobada.
- **Reusar `ConflictError` (409) y `AuthorizationError` (403) existentes en vez de introducir el código reservado `BUSINESS_RULE_ERROR` (422)** — ninguno de los dos casos necesita semántica nueva; introducir el primer uso de un código reservado sin necesidad ampliaría el contrato de errores sin justificación. Alternativa descartada: 422.
- **El bootstrap del primer super admin sigue siendo manual vía `yarn asignar-rol`, nunca un endpoint HTTP** — el script opera directo contra Prisma (`prisma.userRole.create`), fuera de `services/users`, por lo que los guardias de esta feature (que solo protegen los endpoints HTTP) no lo afectan. Se verifica explícitamente en tests/manual para no romper el único camino real de aprovisionamiento.
- **No se corrige aquí que `GET /api/roles` nunca devuelve roles globales** (`organizationId: null`) — es la razón por la que el guardia de escalamiento importa (el rol `Administrador` no es "solo otro rol" seleccionable desde una lista; es un caso especial), pero corregir esa consulta es un cambio de modelo de roles más amplio, fuera de esta feature.

## Riesgos

- **Condición de carrera en el conteo de "último administrador"** — bajo el nivel de aislamiento por defecto de Postgres (READ COMMITTED), dos peticiones concurrentes que remueven el rol a dos administradores distintos podrían leer el conteo antes de que la otra escriba. Mitigación: envolver conteo + escritura en la misma transacción (reduce la ventana, no la elimina). Riesgo residual aceptado explícitamente, consistente con el nivel de rigor ya usado en el proyecto (p. ej. la feature `003` acepta una race condition similar en la unicidad de `email`, mitigada solo con el catch de `P2002`, no con `SERIALIZABLE`).
- **Falso sentido de seguridad** — este guardia protege específicamente el rol `Administrador`; no sustituye una revisión más amplia del catálogo de permisos (`users.manage` sigue siendo un permiso amplio). Se documenta como mitigación puntual, no como solución completa de RBAC granular.
- **Cambiar la firma de `services/users/index.ts`** (agregar `actingUser`) toca las tres rutas que llaman `create`/`update`/`remove` — riesgo bajo (cambio mecánico), pero requiere actualizar también cualquier test unitario existente que llame a estas funciones sin ese argumento.
