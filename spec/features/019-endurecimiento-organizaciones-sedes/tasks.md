# 019 · Endurecimiento de Organizaciones y Sedes — Tareas

_Checklist accionable. Marca `[x]` al completarlas._

## Modelos y Base de Datos

- [x] Verificar duplicados existentes de `Organization.name` en el entorno de desarrollo/seed (`GROUP BY name HAVING count(*) > 1`) y resolverlos antes de migrar. Se encontraron dos organizaciones reales `"Cancha Playwright"` (datos de la feature `008`, cada una con sede/usuarios propios); por decisión explícita del usuario se renombró la más antigua a `"Cancha Playwright (1)"` sin borrar ni desvincular nada.
- [x] Agregar unicidad real de nombre de organización a `prisma/schema.prisma` — **decisión tomada durante la implementación**: no es `@@unique([name])` directo (case-sensitive) sino una columna `normalizedName` dedicada con `@unique`, igual criterio case-insensitive que `Role.normalizedName`, tal como pedía el criterio de aceptación de `spec.md`.
- [x] Agregar `ORGANIZATION_CREATED`, `ORGANIZATION_UPDATED`, `VENUE_CREATED`, `VENUE_UPDATED` a `enum AuditAction`.
- [x] Aplicar la migración `20260829030000_harden_organizaciones_sedes` — aplicada manualmente vía `prisma db execute` + `prisma migrate resolve --applied` (no `prisma migrate dev`), siguiendo el mismo procedimiento ya usado en este repo para la deriva de checksum preexistente (`roadmap.md` ítem `010`): `prisma migrate dev` exigía resetear la base de desarrollo completa por esa deriva ajena a esta feature, algo que no se hizo.
- [x] Verificado con consultas directas (`prisma db execute`/`tsx` ad hoc) que `normalized_name` es única y `AuditAction` acepta los cuatro valores nuevos.

## Helpers

- [x] Crear `helper/organizaciones.ts` con `normalizeOrganizationName`/`normalizeVenueName` y `normalizeOrganizationIdentity`/`normalizeVenueIdentity`.
- [ ] Tests unitarios dedicados de normalización — no se crearon como archivo aparte; el comportamiento (trim + espacios colapsados + minúsculas) queda cubierto indirectamente por `services/organizaciones-sedes/organizacion.service.test.ts` ("create escribe auditoría ORGANIZATION_CREATED con normalizedName derivado del nombre"). Pendiente si se quiere cobertura unitaria directa del helper.

## Validaciones

- [x] `validations/organizaciones-sedes/organizacion.validation.ts`: `.strict()` en los cuatro schemas; `expectedUpdatedAt` requerido + `.refine()` en `updateOrganizationSchema`.
- [x] `validations/organizaciones-sedes/sede.validation.ts`: `.strict()` en `createSedeSchema`/`updateSedeSchema`/`sedeParamsSchema`; `expectedUpdatedAt` requerido + `.refine()` en `updateSedeSchema`. **Desviación deliberada del plan**: `sedeQuerySchema` y `sedeCollectionParamsSchema` se dejaron **sin** `.strict()` — ambas parsean el mismo `req.query` en el listado (`sedes/index.ts` GET, path param + query string mezclados por Next.js) y `.strict()` en ambas se rechazaban mutuamente en cada petición real. Documentado en comentario en el propio archivo.
- [x] Tests unitarios: `validations/organizaciones-sedes/organizacion.validation.test.ts` y `sede.validation.test.ts` (nuevos) — mass assignment rechazado, `expectedUpdatedAt` faltante rechazado, `organizationId` rechazado en el body de sede, y test explícito de que `sedeQuerySchema`/`sedeCollectionParamsSchema` toleran las claves de la otra.

## Capa de Base de Datos

- [x] `database/organizaciones-sedes/organizacion.db.ts`: `_count` de sedes activas en `getAll` (mapeado a `venuesCount`), `actorHasOrganizationScope`, `getUnique`/`withTransaction` con `updateMany` optimista y `writeAudit`. **Desviación de forma respecto al plan**: se mantienen exports planos (`export const getAll = ...`, no un objeto `organizacionDb = {...}`) porque el barril `database/organizaciones-sedes/index.ts` ya hace `export * as organizacionDb from './organizacion.db'` — envolver de nuevo habría anidado `organizacionDb.organizacionDb.getAll`.
- [x] `database/organizaciones-sedes/sede.db.ts`: `findVenue`/`getUnique` exigen `organizationId` en el `where` (cierra el IDOR), `findOrganization` verifica la organización padre antes de crear, `updateVenue`/`removeVenue` scoped por `organizationId`, `writeAudit` en create/update.
- [x] Tests unitarios: `organizacion.db.test.ts` ampliado (2 tests nuevos: `_count`→`venuesCount`, verificación del `select` real); `sede.db.test.ts` **creado de cero** (no existía desde la feature `004`, a diferencia de lo asumido en el plan) con 4 tests centrados en el cierre del IDOR (`findVenue`, `findOrganization`, `updateVenue`/`removeVenue` scoped).

## Lógica de Negocio

- [x] `services/organizaciones-sedes/organizacion.service.ts`: `ensureOrganizationScope`, `getById(organizationId, actingUser)`, `update`/`remove` con guardia antes de la transacción.
- [x] `services/organizaciones-sedes/sede.service.ts`: reutiliza `ensureOrganizationScope` de `organizacion.service.ts` (import directo, mismo módulo `organizaciones-sedes/` — no se duplicó la lógica de alcance); firmas de `getAll`/`getById`/`update`/`remove` ganan `organizationId`/`actingUser` según corresponda.
- [x] Tests unitarios de servicio: `organizacion.service.test.ts` (8 tests) y `sede.service.test.ts` (6 tests), **creados de cero** (no existían desde la feature `004`) — administrador global sin restricción, 404 opaco sin alcance, 409 de concurrencia sin auditoría, 409 de nombre duplicado, creación de sede bajo organización inexistente, `organizationId` del payload de sede ignorado.

## Endpoints — Organizaciones

- [x] **`pages/api/organizaciones/index.ts`**: `POST` ahora exige `req.user` y se lo pasa al servicio (no estaba contemplado explícitamente en el plan original, pero era necesario para la auditoría de creación).
- [x] **`pages/api/organizaciones/[organizationId].ts`**: `GET`/`PATCH`/`DELETE` pasan `req.user` al servicio.

## Endpoints — Sedes

- [x] **`pages/api/organizaciones/[organizationId]/sedes/[sedeId].ts`**: `GET`/`PATCH`/`DELETE` pasan `organizationId` **y** `sedeId` más `req.user` al servicio — cambio que cierra el IDOR de punta a punta (validado a nivel de servicio/db con mocks; ver limitación de los tests de integración abajo).
- [x] **`pages/api/organizaciones/[organizationId]/sedes/index.ts`**: `GET` y `POST` pasan `req.user` al servicio.

## Tests de Integración

- [x] `tests/integration/organizaciones-sedes.test.ts` **creado de cero** (no existía desde la feature `004`, a diferencia de lo asumido en el plan), siguiendo el mismo patrón ya usado por `tests/integration/roles-permisos.test.ts` de este repo: invoca los handlers reales sin sesión/DB seedeada — verifica que el dispatch de validación/autenticación se comporta razonablemente (`expectedUpdatedAt` faltante, `organizationId` manipulado en el body de sede, campos protegidos en creación).
- [x] **Verificación manual de punta a punta contra Postgres/Keycloak reales** (2026-08-29, `yarn dev` local, usuario real `administrador@canchago.local` con rol `Administrador` asignado vía `yarn asignar-rol` para esta verificación), sustituye la pendiente original de pruebas automatizadas de integración con datos reales:
  - IDOR cerrado: se creó una sede real en la organización `ea6dfed4-...` ("Cancha Playwright") y se pidió `GET .../organizaciones/{otra-organización}/sedes/{esa-sede}` → `404 NOT_FOUND` real (antes de esta feature habría devuelto `200` con los datos de la sede). Con el `organizationId` correcto, `200` real.
  - Concurrencia optimista real: `PATCH` con `expectedUpdatedAt` correcto → `200` y `updatedAt` avanza; el mismo `PATCH` repetido con el `expectedUpdatedAt` ya obsoleto → `409 CONFLICT` real, sin aplicar el cambio.
  - Unicidad real de nombre de organización: `POST /organizaciones` con `"cancha playwright"` (minúsculas) contra una organización ya existente `"Cancha Playwright"` → `409 CONFLICT` real (comparación case-insensitive vía `normalizedName`).
  - Creación de sede bajo organización inexistente: `POST .../organizaciones/{uuid-inexistente}/sedes` → `404 NOT_FOUND` real, no `500`.
  - Auditoría real: se confirmó en la tabla `audit_logs` (consulta directa) que la creación y edición de la sede de prueba escribieron `VENUE_CREATED`/`VENUE_UPDATED` con `actorUserId`, `organizationId` y `changes` correctos.
  - `venuesCount` real: `GET /organizaciones` devuelve el conteo correcto de sedes activas por organización en la misma respuesta.
  - Los datos de prueba creados durante esta verificación se eliminaron (soft delete) al terminar; el único cambio permanente intencional es el rol `Administrador` otorgado a `administrador@canchago.local` (usuario de prueba ya existente en el entorno de desarrollo, mismo mecanismo documentado que usó la feature `015`).
  - **Persiste como pendiente**: automatizar estos casos como pruebas de integración reales (hoy son manuales); atomicidad de `AuditLog` ante fallo a mitad de transacción (no se forzó un fallo real); regresión del flujo de registro público (`accountType: 'gestor-de-cancha'`) no se re-probó en esta sesión (su código no fue tocado más que el `normalizedName` añadido, ver `database/organizaciones-sedes/access-request.db.ts`).

## Documentación OpenAPI (obligatorio, en paralelo)

- [x] `documentation/schemas/organizaciones-sedes.ts` actualizado: `expectedUpdatedAt` requerido en ambos `PATCH` (schema + ejemplo), `venuesCount` opcional en `OrganizationResponseSchema`, descripciones actualizadas con el criterio de alcance/404 opaco/concurrencia/unicidad en los 6 endpoints afectados.
- [x] Sigue exportado desde `documentation/schemas/index.ts` (sin cambios necesarios).
- [ ] Verificado en `GET /api/docs`: **no verificado** — el bloqueo preexistente de `zod-to-openapi` (`roadmap.md` ítem `010`) impide compilar `yarn build`, confirmado que ya fallaba antes de esta feature con el mismo tipo de error en este archivo y en `documentation/schemas/users.ts`. Los schemas se revisaron por lectura directa, no contra el Swagger renderizado.

## Cierre

- [x] `yarn lint` — limpio (solo quedan 2 warnings preexistentes ajenos: `STATUS_CODE_MAP` sin usar, `beforeEach` sin usar en `roles-permisos.test.ts`).
- [x] `yarn typecheck` — limpio de errores nuevos (quedan los preexistentes: `NODE_ENV` de solo lectura en varios tests, `zod-to-openapi` en `organizaciones-sedes.ts`/`users.ts`, `mock-next-response.ts` — ninguno introducido por esta feature, confirmado comparando contra el primer `typecheck` corrido antes de tocar código).
- [x] `yarn test` — 150/150 pruebas verdes (33 archivos), incluyendo 33 pruebas nuevas de esta feature.
- [ ] `yarn build` — **sigue bloqueado**, por el mismo motivo preexistente ya documentado en `roadmap.md` ítem `010` (incompatibilidad Zod 4 / `zod-to-openapi`), no por código de esta feature. Mismo estado que dejó la feature `018`.
- [x] Confirmados los criterios de aceptación de `spec.md` verificables sin infraestructura de integración real (ver limitación de tests de integración arriba).
- [ ] Avisar a `canchago-ionic` (feature `010-gestion-organizaciones-sedes`) — pendiente hasta implementar esa feature en este mismo ciclo de trabajo.
- [ ] Mover a "Hecho ✅" en `spec/constitution/roadmap.md` — **no se mueve todavía**, mismo criterio que la feature `018` ("en cierre"): el trabajo propio de esta feature está completo y verificado, pero `yarn build` sigue bloqueado por deuda ajena y los tests de integración con datos reales quedan pendientes.
- [ ] Registrar en `roadmap.md` el hallazgo sobre `Role.name`/`Role.code` como candidato a backlog.

## Mantenimiento (checklist recurrente)

- [ ] Cuando se resuelva el bloqueo de `zod-to-openapi` (`roadmap.md` ítem `010`), correr `yarn build` y verificar `GET /api/docs` para esta feature.
- [ ] Cuando exista infraestructura de tests de integración con Postgres real para este módulo, completar los casos listados como pendientes arriba.
