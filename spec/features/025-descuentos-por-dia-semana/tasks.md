# 025 · Descuentos de precio por día de la semana — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

- [x] Agregar modelo `ResourceWeekdayDiscount` a `prisma/schema.prisma` y la relación inversa en `Resource`.
- [x] Generar y aplicar la migración aditiva (`20260912010000_add_resource_weekday_discounts`, aplicada contra la base real vía `prisma db execute` + `prisma migrate resolve --applied`, mismo procedimiento manual que `018`/`019` porque `migrate dev` sigue bloqueado por el drift de checksum preexistente de `020260630185000`/`20260822060000`, ajeno a esta feature).
- [x] `yarn generate`.
- [x] Crear `weekdayDiscountSchema`/`updateWeekdayDiscountsSchema` en `validations/reservas/index.ts`.
- [x] Extender `resourceSelect` en `database/reservas/index.ts` con `weekdayDiscounts`.
- [x] Implementar `applyWeekdayDiscount` (helper puro) en `database/reservas/index.ts`.
- [x] Implementar `replaceWeekdayDiscounts` (transacción delete+createMany) en `database/reservas/index.ts`.
- [x] Usar `applyWeekdayDiscount` dentro de `createBooking` (incluye `weekdayDiscounts` en el `select` del slot).
- [x] Implementar `updateWeekdayDiscounts` en `services/reservas/index.ts` con el mismo guard de autorización que `updateResource`.
- [x] Agregar `effectiveHourlyPrice` a cada slot en `services/reservas/index.ts::listAvailability`.
- [x] Crear `pages/api/resources/[resourceId]/weekday-discounts/index.ts` (`PUT`, permiso `resources.manage`).
- [x] Tests de validación: rango de porcentaje, rango de día, días repetidos (`reservas.validation.test.ts`; de paso se corrigió un bug real preexistente ajeno: el archivo tenía un bloque de imports duplicado que rompía `yarn typecheck`).
- [x] Tests de servicio: autorización (Administrador/Gestor con alcance/sin alcance), reemplazo atómico, 404 si el recurso no existe (`services/reservas/reservas.service.test.ts`, nuevo archivo).
- [x] Test de `applyWeekdayDiscount`: sin descuento devuelve el precio base; con descuento aplica el porcentaje correcto; redondeo a 2 decimales; caso 100%.
- [x] Test de `listAvailability`: `effectiveHourlyPrice` correcto por slot según su día real.
- [x] Test de `replaceWeekdayDiscounts`: reemplazo completo y conjunto vacío.
- [ ] Test de `createBooking` con Postgres real confirmando el precio congelado — cubierto a nivel de lógica (`applyWeekdayDiscount` + su uso en el `select`), pero no verificado con una reserva real de punta a punta contra la base (requeriría un usuario de sesión real; no se levantó ese flujo completo en esta sesión).

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con los endpoints, no como paso final._

- [x] Registrar el nuevo endpoint y schemas en `documentation/schemas/reservas.ts` vía `registry.registerPath()`/`registry.register()`.
- [x] Verificar que `weekdayDiscounts` y `effectiveHourlyPrice` aparecen correctamente — verificado invocando `generateOpenApiSpec()` directamente (sin levantar el servidor), mismo método usado en la feature `023`.

## Cierre

- [ ] Validar contra los criterios de aceptación de `spec.md` — pendiente la verificación manual end-to-end de una reserva real con descuento aplicado (no ejecutada en esta sesión).
- [x] `yarn lint` limpio. `yarn typecheck`: 25 errores, todos preexistentes (bajó de 41 porque esta feature corrigió de paso un bug real de imports duplicados; no se introdujo ningún error nuevo). `yarn test`: 217 pruebas verdes, el único archivo que falla (`pricing.test.ts`) falla igual en `main` sin estos cambios (confirmado con `git stash`).
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md` — pendiente hasta la verificación end-to-end y hasta cerrar la contraparte `canchago-ionic` (`017-descuentos-por-dia-semana`).
