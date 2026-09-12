# 023 · Estado de organizaciones y sedes — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

Reutilizar los `PATCH` de organización y sede que ya existen (`services/organizaciones-sedes/organizacion.service.ts` y `sede.service.ts`) en vez de crear endpoints nuevos (`/activate`, `/deactivate`): es el mismo patrón que ya usa `Resource.status` en su propio `PATCH` general. Se agrega `status` como campo opcional a los schemas Zod de actualización, y una guarda explícita de rol —no solo de permiso— en el servicio, porque la regla de negocio pedida ("solo Administrador global") es más estricta que lo que hoy garantiza el permiso `organizaciones.manage` por sí solo.

No se toca el schema de Prisma ni se necesita migración: `Organization.status`/`Venue.status` ya son `VARCHAR` libres que hoy solo escriben `'ACTIVE'` y `'PENDING_APPROVAL'`; esta feature solo amplía, a nivel de contrato Zod, los valores que este endpoint concreto puede escribir.

## Implementación

1. **`validations/organizaciones-sedes/organizacion.validation.ts`** — agregar `status: z.enum(['ACTIVE', 'INACTIVE']).optional()` a `updateOrganizationSchema` y sumarlo a la condición del `.refine` que exige al menos un campo editable.
2. **`validations/organizaciones-sedes/sede.validation.ts`** — mismo cambio en `updateSedeSchema`.
3. **`services/organizaciones-sedes/organizacion.service.ts`**, función `update()` — si `data.status !== undefined` y `!isAdministrator(actingUser)`, lanzar `AuthorizationError('Solo un administrador puede cambiar el estado de la organización.')` antes de abrir la transacción. Incluir `status` en el objeto `editable` que se pasa a `repository.updateOrganization(...)` y en `changes` de `writeAudit`.
4. **`services/organizaciones-sedes/sede.service.ts`**, función `update()` — mismo guard (`AuthorizationError('Solo un administrador puede cambiar el estado de la sede.')`) y mismo paso de `status` a `repository.updateVenue(...)` y a `writeAudit`.
5. **`database/organizaciones-sedes/organizacion.db.ts` / `sede.db.ts`** — sin cambios: `updateOrganization`/`updateVenue` ya reciben `Prisma.OrganizationUpdateManyMutationInput`/`Prisma.VenueUpdateManyMutationInput` genérico, así que `status` pasa igual que cualquier otro campo.
6. **`documentation/schemas/organizaciones-sedes.ts`** — actualizar el schema/ejemplo registrado del `PATCH` de organización y de sede para reflejar el nuevo campo `status` (enum `ACTIVE`/`INACTIVE`) y anotar en la descripción que es exclusivo de Administrador.

## Decisiones

- **Reutilizar los `PATCH` existentes en vez de endpoints `/activate`, `/deactivate`** — menos superficie de API nueva, coherente con cómo `Resource.status` ya se actualiza por el `PATCH` general de recurso.
- **Guard explícito de `isAdministrator` en el servicio, no solo el permiso `organizaciones.manage`** — hoy el seed no le da ese permiso a Gestor de Cancha, pero la regla de negocio pedida no debe depender de qué permisos existan en un seed dado; el servicio debe garantizarla siempre, sea cual sea el seed real.
- **No migrar `status` a un enum de Prisma en esta feature** — es una columna `VARCHAR` libre desde antes de esta feature (deuda ya señalada en `019`/`010`); convertirla implica decidir qué hacer con filas existentes y es un cambio de alcance mayor al pedido aquí.
- **Sin bloqueo por reservas/franjas futuras ni cascada automática de estado entre organización y sede** — decisión explícita confirmada con el usuario; el ocultamiento de canchas ya ocurre solo con que alguno de los dos deje de estar `ACTIVE`, porque `listResources` ya exige ambos `ACTIVE` a la vez.

## Riesgos

- **Confundir `INACTIVE` con el soft delete existente (`deletedAt`)** — mitigado documentando explícitamente en el schema OpenAPI y en el mensaje de error que `INACTIVE` es reversible y visible para el propio Administrador, mientras que el soft delete oculta el registro por completo.
- **Que un test asuma que desactivar cancela reservas** — la spec dice explícitamente que no; los tests de aceptación deben cubrir el caso contrario (reserva confirmada sigue visible tras desactivar).
