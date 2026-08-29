# 019 · Endurecimiento de Organizaciones y Sedes — Plan

_Implementación respetando la constitución. Reutiliza, sin reinventarlo, el patrón ya probado por la feature `018` en `services/roles-permisos/role.service.ts` y `database/roles-permisos/role.db.ts`._

## Enfoque

`organizaciones-sedes` hoy es una capa muy delgada (`service` → `db` con casi ninguna regla propia) mientras que `roles-permisos` (feature `018`) ya resuelve exactamente esta misma familia de problemas: guardia de alcance por organización (`ensureOrganizationScope` + `actorHasOrganizationScope`), concurrencia optimista vía `updateMany` con `updatedAt` esperado, transacciones que agrupan escritura + auditoría, y schemas Zod `.strict()`. Este plan traslada ese mismo patrón a `Organization`/`Venue` sin copiar literalmente el código de roles (que vive en su propio módulo, ya cerrado) — cada archivo de `organizaciones-sedes` gana su propia versión del guardia, igual que hoy `users/role-guard.ts` y `roles-permisos` no comparten código entre sí pese a resolver alcance de forma parecida.

## Implementación

1. **`prisma/schema.prisma`** — Cambios aditivos:
   - `model Organization`: agregar `@@unique([name])`. Requiere resolver duplicados existentes antes de migrar (ver Riesgos).
   - `enum AuditAction`: agregar `ORGANIZATION_CREATED`, `ORGANIZATION_UPDATED`, `VENUE_CREATED`, `VENUE_UPDATED` (cambio de enum aditivo, sin impacto en filas existentes). `AuditLog.entityType` ya es `String` libre (no enum) — no requiere cambio, solo usar los literales `'Organization'`/`'Venue'` igual que hoy se usa `'Role'`.
   - Ejecutar `yarn migrate-dev`, nombrar la migración `harden_organizaciones_sedes`.

2. **`helper/organizaciones.ts`** (nuevo) — `normalizeOrganizationName`/`normalizeVenueName` (trim + colapsar espacios, mismo criterio que `helper/roles.ts:normalizeRoleName`) y `normalizeOrganizationIdentity` (versión en minúsculas para comparar unicidad, mismo criterio que `normalizeRoleIdentity`). No se reutiliza `helper/roles.ts` directamente para no acoplar un módulo ya cerrado (`018`) a este; es una duplicación deliberada y mínima (cuatro líneas), ver Decisiones.

3. **`validations/organizaciones-sedes/organizacion.validation.ts`** — Endurecer:
   - `createOrganizationSchema`/`updateOrganizationSchema`: agregar `.strict()`.
   - `updateOrganizationSchema` gana `expectedUpdatedAt: z.string().datetime({ offset: true })` (requerido) y un `.refine()` que exija al menos un campo editable además de `expectedUpdatedAt` — mismo patrón que `updateRoleInputSchema`.
   - `organizationQuerySchema`/`organizationParamsSchema`: agregar `.strict()`.

4. **`validations/organizaciones-sedes/sede.validation.ts`** — Mismo tratamiento: `.strict()` en los cuatro schemas existentes, `expectedUpdatedAt` requerido en `updateSedeSchema` con el mismo `.refine()`.

5. **`database/organizaciones-sedes/organizacion.db.ts`** — Reescribir siguiendo el patrón de `database/roles-permisos/role.db.ts`:
   - `selectOrganizationFields` gana `_count: { select: { venues: { where: { deletedAt: null } } } }` (Prisma soporta `where` dentro de `_count.select` desde la versión ya usada por el proyecto); el mapeo hacia `venuesCount` se hace en la capa `db` o `service`, no en el handler.
   - `getAll`: agrega el `_count` al `select` existente; el filtro de alcance por actor no cambia (ya es correcto).
   - Nueva función `actorHasOrganizationScope(userId, organizationId)`: misma consulta que ya usa el `where` de `getAll` para el caso no-administrador, extraída para poder reutilizarla como guardia puntual (`prisma.userRole.count({ where: { userId, role: { deletedAt: null }, OR: [{ organizationId }, { role: { organizationId } }] } }) > 0`).
   - `getUnique`/`update`/`remove` pasan a vivir dentro de una transacción (`withTransaction`, nuevo, mismo shape que `roleDb.withTransaction`) para agrupar validación + escritura + auditoría.
   - `update` cambia de "leer, luego `update`" a `updateMany({ where: { id: organizationId, updatedAt: expectedUpdatedAt, deletedAt: null }, data })`; `count === 0` distingue entre "no existe" (chequeado antes, `NotFoundError`) y "cambió" (`ConflictError`), igual que `roleDb.updateRole`.
   - `create`/`update` escriben `AuditLog` dentro de la misma transacción (`writeAudit`, mismo shape que roles).
   - `isPrismaUniqueConstraintError`/manejo de `P2002` no cambia — ahora sí es alcanzable para `Organization.name` gracias al paso 1.

6. **`database/organizaciones-sedes/sede.db.ts`** — Mismo tratamiento:
   - `record(sedeId)` se reemplaza por operaciones que **exigen `organizationId`**: `findVenue(venueId, organizationId)` usa `findFirst({ where: { id: venueId, organizationId, deletedAt: null } })` en vez de `findUnique({ where: { id: venueId } })` — este es el cambio que cierra el IDOR (criterio de aceptación 1).
   - `create(organizationId, data)`: antes de `venue.create`, verifica que la organización exista y no esté borrada (`prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null }, select: { id: true } })`); si no, `NotFoundError` — cierra el criterio de aceptación de creación bajo organización inexistente sin agregar ninguna regla sobre `status`.
   - `update`/`remove` reciben `organizationId` y usan el mismo patrón `updateMany({ where: { id: sedeId, organizationId, updatedAt: expectedUpdatedAt, deletedAt: null } })` para `update`; `remove` usa `updateMany({ where: { id: sedeId, organizationId, deletedAt: null }, data: { deletedAt: new Date() } })` (sin `expectedUpdatedAt`, igual que `roleDb` no exige concurrencia en `softDelete`).
   - `create`/`update` escriben `AuditLog` (`VENUE_CREATED`/`VENUE_UPDATED`, `organizationId` = la de la sede) dentro de la transacción.

7. **`services/organizaciones-sedes/organizacion.service.ts`** — Reescribir con el mismo shape que `role.service.ts`:
   - `ensureOrganizationScope(actingUser, organizationId, opaque = false)`: si `isAdministrator(actingUser)` retorna; si no, `organizacionDb.actorHasOrganizationScope(...)`; si no tiene alcance, `NotFoundError` (opaco) o `AuthorizationError` según el flag — misma firma que roles.
   - `getAll(filters, actingUser)`: sin cambios de firma (ya recibe `actingUser`).
   - `getById(organizationId, actingUser)`: **cambia de firma** — ahora exige `actingUser`, llama a `ensureOrganizationScope(..., true)` antes de leer.
   - `create(data, actingUser)`: sin guardia de alcance (crear una organización nueva no tiene un alcance previo que validar — cualquier actor con `organizaciones.manage` puede crear una); captura `P2002` → `ConflictError('Ya existe una organización con ese nombre.')` (ahora alcanzable).
   - `update(organizationId, data, actingUser)`: `ensureOrganizationScope(..., true)`, luego transacción (paso 5).
   - `remove(organizationId, actingUser)`: `ensureOrganizationScope(..., true)`, luego la transacción de soft-delete en cascada ya existente (sin auditoría, ver spec).

8. **`services/organizaciones-sedes/sede.service.ts`** — Mismo tratamiento, reutilizando `organizacionDb.actorHasOrganizationScope` (o una copia local mínima, ver Decisiones) para construir su propio `ensureOrganizationScope`:
   - `getAll(organizationId, filters, actingUser)`: gana `actingUser`, valida alcance antes de listar.
   - `getById(sedeId, organizationId, actingUser)`: **cambia de firma** — exige `organizationId` (ya lo tenía disponible el handler, pero no se lo pasaba) y `actingUser`.
   - `create(organizationId, data, actingUser)`: valida alcance, luego `sedeDb.create` (con el chequeo de organización existente del paso 6).
   - `update(sedeId, organizationId, data, actingUser)`: valida alcance, transacción.
   - `remove(sedeId, organizationId, actingUser)`: valida alcance, soft delete.

9. **`pages/api/organizaciones/[organizationId].ts`** — `GET`/`PATCH`/`DELETE` pasan `req.user` a `organizacionService.getById/update/remove`; `PATCH` valida `expectedUpdatedAt` como parte del body ya cubierto por el schema endurecido (paso 3).

10. **`pages/api/organizaciones/[organizationId]/sedes/[sedeId].ts`** — `GET`/`PATCH`/`DELETE` pasan **tanto `organizationId` como `sedeId`** (ya validados por `sedeParamsSchema`, hoy descartados tras la validación) y `req.user` a `sedeService.getById/update/remove` — este es el cambio de handler que efectivamente cierra el IDOR una vez que el servicio (paso 8) y la capa de datos (paso 6) lo soportan.

11. **`pages/api/organizaciones/[organizationId]/sedes/index.ts`** — `POST` pasa `req.user` a `sedeService.create` para la validación de alcance.

12. **Tests** — Actualizar/ampliar:
    - `database/organizaciones-sedes/organizacion.db.test.ts` y `sede.db.test.ts` (ya existen desde la feature `004`): agregar casos de `actorHasOrganizationScope`, `updateMany` con `updatedAt` desactualizado, `_count` de sedes, creación bajo organización inexistente.
    - `services/organizaciones-sedes/*.test.ts` (nuevos, no existen hoy — la feature `004` no dejó tests de servicio, solo de `db`): casos de alcance (admin global vs. actor scoped vs. actor sin alcance), 404 opaco, 409 de concurrencia, 409 de nombre duplicado.
    - `tests/integration/organizaciones-sedes.test.ts` (ya existe desde `004`): agregar el caso de IDOR cruzado entre organizaciones (petición real con `sedeId` de otra organización → `404`), el caso de conteo de sedes sin N+1 (contar queries emitidas o usar el mismo mecanismo que ya use el proyecto para eso), y los casos de concurrencia optimista.

13. **`documentation/schemas/organizaciones-sedes.ts`** — Actualizar (no crear, ya existe desde la feature `004`, 588 líneas): agregar `expectedUpdatedAt` a los `requestBody` de los dos `PATCH`, agregar `venuesCount` al schema de `Organization` en las respuestas de listado/detalle, agregar/completar las respuestas `404`/`409` en los endpoints afectados con `registry.registerComponent()`/`registry.registerPath()`. Se hace en el mismo paso que cada endpoint tocado (pasos 9–11), no al final.

## Decisiones

- **Reutilizar el patrón de `018`, no el código.** `roles-permisos` y `organizaciones-sedes` quedan como módulos independientes con su propia copia de `ensureOrganizationScope`/`actorHasOrganizationScope`/`withTransaction`, igual que ya ocurre entre `users/role-guard.ts` y `roles-permisos` hoy. Alternativa descartada: extraer un helper compartido genérico (`services/shared/organization-scope.ts`) — se descarta porque tocaría `018` (ya cerrada) sin necesidad, y porque la consulta real difiere ligeramente entre "actor con alcance sobre roles de una organización" y "actor con alcance sobre la organización misma" aunque hoy coincidan.
- **`Organization.name` único globalmente, no por ningún scope.** Es la única lectura consistente con el mensaje de error ya existente en el código (`'Ya existe una organización con ese nombre.'`, sin mención de scope) y con que `Organization` es la unidad de tenant raíz, sin un padre contra el que componer la unicidad (a diferencia de `Venue`, único por `[organizationId, name]`). **Pendiente de confirmación de producto**: si en el futuro se decide que dos tenants distintos sí pueden compartir nombre comercial, este criterio se revierte antes de implementar.
- **No se activan los permisos `sedes.read`/`sedes.manage`.** Cambiarlos activaría un contrato de autorización distinto al que ya consume `canchago-ionic` (que usa `organizaciones.*` para todo, ver `api-integration.md`); es una decisión de producto aparte, no un endurecimiento de seguridad.
- **`DELETE` no gana auditoría en esta feature.** Mantiene paridad exacta con el comportamiento ya aceptado en `018` (`deleteRole` tampoco audita) — no se introduce una asimetría nueva entre features.
- **El `_count` de sedes filtra `deletedAt: null` explícitamente en el `where` del `_count`.** Sin ese filtro, una organización con sedes borradas mostraría un número inflado — verificado que Prisma soporta `where` anidado dentro de `_count.select` en la versión de Prisma 7 que usa el proyecto.

## Riesgos

- **Migración de `@@unique([name])` puede fallar si ya existen duplicados** en cualquier entorno donde se aplique (desarrollo, seed, o — con más cuidado — producción). Mitigación: antes de `yarn migrate-dev`, correr una consulta de verificación (`GROUP BY name HAVING count(*) > 1`) y resolver manualmente los duplicados encontrados (renombrar o fusionar) antes de aplicar la migración; documentar el resultado de esa verificación en `tasks.md` al cerrar la feature.
- **Cambiar la firma de `organizacionService.getById`/`sedeService.getById/update/remove` para exigir `actingUser`/`organizationId`** es un cambio incompatible dentro del propio backend (no de la API pública) — cualquier otro caller interno de estas funciones que no sea el handler HTTP actualizado quedaría roto en tiempo de compilación (TypeScript lo atrapa, no en runtime). Mitigación: `yarn typecheck` como parte del cierre; búsqueda exhaustiva de otros usos de `organizacionService`/`sedeService` antes de tocar las firmas.
- **El endpoint de creación de organización (`POST /organizaciones`) no tiene guardia de alcance** (cualquier actor con `organizaciones.manage` puede crear una organización nueva sin pertenecer a ninguna) — comportamiento ya existente e intencional (alguien tiene que poder crear la primera organización), no se cambia; se documenta para que no se confunda con un gap sin resolver.
- **Tests de integración de concurrencia son inherentemente sensibles a timing.** Mitigación: forzar el conflicto manipulando `updatedAt` directamente en la aserción (no con dos requests paralelos de verdad), mismo enfoque que ya usan los tests de `018`.
- **`entityType: 'Venue'` en `AuditLog` para eventos de sede usa `organizationId` = la organización de la sede, no un `venueId` propio en una columna dedicada.** Es el mismo compromiso que ya acepta el modelo `AuditLog` (columna genérica `entityId` + `entityType`, sin relación tipada por entidad) — no se modela una columna `venueId` nueva solo para esto, coherente con cómo ya se audita `Role` sin una columna `roleId` dedicada.
