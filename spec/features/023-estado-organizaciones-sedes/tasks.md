# 023 · Estado de organizaciones y sedes — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

- [x] Agregar `status: z.enum(['ACTIVE', 'INACTIVE']).optional()` a `updateOrganizationSchema` (`validations/organizaciones-sedes/organizacion.validation.ts`) y sumarlo al `.refine` de "al menos un campo".
- [x] Agregar el mismo campo a `updateSedeSchema` (`validations/organizaciones-sedes/sede.validation.ts`).
- [x] Agregar guard de `isAdministrator` en `organizacion.service.ts::update()` cuando `data.status !== undefined`, con `AuthorizationError` si no es Administrador.
- [x] Agregar el mismo guard en `sede.service.ts::update()`.
- [x] Pasar `status` al objeto `editable`/`data` de `updateOrganization`/`updateVenue` y a `changes` de `writeAudit` en ambos servicios.
- [x] Tests de validación: `organizacion.validation.test.ts` y `sede.validation.test.ts` — aceptar `ACTIVE`/`INACTIVE`, rechazar `PENDING_APPROVAL` y cualquier otro valor.
- [x] Tests de servicio: `organizacion.service.test.ts` y `sede.service.test.ts` — Administrador puede cambiar `status`; actor no administrador con scope real recibe 403 y no se llama a la actualización; auditoría incluye `status`.
- [x] Test de integración/db: una organización o sede `INACTIVE` no aparece en `listResources` aunque el resto de condiciones sea `ACTIVE` (`database/reservas/reservas.db.test.ts`, nuevo archivo).
- [x] Test que confirme que una reserva ya confirmada sigue visible en `listOwnBookings` tras desactivar la organización/sede de esa cancha (mismo archivo).
- [x] Test de concurrencia optimista: `expectedUpdatedAt` desactualizado junto con `status` responde 409.

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con los endpoints, no como paso final._

- [x] Actualizar `documentation/schemas/organizaciones-sedes.ts` para reflejar `status` en el body de actualización de organización y de sede, con su enum real y nota de "solo Administrador".
- [x] Verificar que el spec OpenAPI generado (`generateOpenApiSpec()`, lo mismo que sirve `GET /api/docs`) incluye `status: enum [ACTIVE, INACTIVE]` en `UpdateOrganizationBody` y `UpdateSedeBody` sin lanzar errores en tiempo de ejecución (verificado directamente con `tsx`, sin levantar Postgres/Keycloak).

## Cierre

- [x] Validar contra los criterios de aceptación de `spec.md`.
- [x] `yarn lint && yarn typecheck && yarn test` sin errores atribuibles a esta feature (41 errores de typecheck y 1 archivo de test fallido son deuda preexistente del ítem `010`/`pricing.test.ts`, verificados idénticos con `git stash`; `yarn build` no se ejecuta por el mismo bloqueo global de `010`).
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md` — pendiente hasta cerrar también la contraparte `canchago-ionic` (`015-estado-organizaciones-sedes`).
