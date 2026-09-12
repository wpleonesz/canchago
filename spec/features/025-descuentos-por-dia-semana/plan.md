# 025 · Descuentos de precio por día de la semana — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

Nueva tabla `ResourceWeekdayDiscount` (una fila por cancha+día con descuento), en vez de un campo JSON en `Resource`: mantiene el mismo estilo relacional que el resto del esquema (`AvailabilitySlot`, `UserRole`, etc.), permite `@@unique([resourceId, weekday])` real en base de datos y no requiere Zod para validar la forma de un blob JSON. Se expone con un único endpoint de reemplazo atómico (`PUT`), igual patrón que ya usa el proyecto para "reemplazo completo de un conjunto" (feature `020`, permisos de un rol) en vez de altas/bajas incrementales por día.

El cálculo del precio efectivo vive en `database/reservas/index.ts` junto a `calculateTotalPrice` (mismo archivo, mismo nivel de pureza) y se reutiliza en dos puntos: al listar disponibilidad (para mostrarlo) y al confirmar una reserva (para congelarlo). Nunca se calcula en el cliente.

## Implementación

1. **`prisma/schema.prisma`** — nuevo modelo `ResourceWeekdayDiscount` (`id`, `resourceId`, `weekday Int`, `discountPercent Decimal(5,2)`, timestamps, `@@unique([resourceId, weekday])`, `onDelete: Cascade` desde `Resource`); agregar la relación inversa `weekdayDiscounts` en `Resource`.
2. **Migración** — nueva migración aditiva; no toca datos existentes.
3. **`validations/reservas/index.ts`** — `weekdayDiscountSchema` (`weekday: 0-6`, `discountPercent: >0 y <=100`) y `updateWeekdayDiscountsSchema` (`{ discounts: weekdayDiscountSchema[] }`, máx. 7, sin días repetidos).
4. **`database/reservas/index.ts`**:
   - Extender `resourceSelect` con `weekdayDiscounts: { select: { weekday: true, discountPercent: true }, orderBy: { weekday: 'asc' } }`.
   - `applyWeekdayDiscount(hourlyPrice, weekday, discounts)` — helper puro junto a `calculateTotalPrice`.
   - `replaceWeekdayDiscounts(resourceId, discounts)` — transacción: `deleteMany` + `createMany` (si el arreglo no está vacío) + devuelve el conjunto final.
   - `listAvailability` — sin cambio de firma; el cálculo de `effectiveHourlyPrice` se hace en el servicio, que ya tiene el recurso completo vía `getResource`.
   - `createBooking` — el `select` del slot ya trae `resource.hourlyPrice`; agregar `resource.weekdayDiscounts` al mismo `select` y usar `applyWeekdayDiscount` antes de `calculateTotalPrice`.
5. **`services/reservas/index.ts`**:
   - `updateWeekdayDiscounts(resourceId, body, user)` — mismo guard que `updateResource` (`isAdministrator` o `actorCanManageResource`), 404 si el recurso no existe, delega en `repository.replaceWeekdayDiscounts`.
   - `listAvailability` — capturar el recurso ya obtenido (`const resource = await getResource(resourceId)`) y mapear cada slot agregando `effectiveHourlyPrice: repository.applyWeekdayDiscount(resource.hourlyPrice, slot.startsAt.getUTCDay(), resource.weekdayDiscounts)`.
6. **`pages/api/resources/[resourceId]/weekday-discounts/index.ts`** — nueva ruta, `PUT` con `access('resources.manage')`, valida params + body, responde `{ data: weekdayDiscounts }`.
7. **`documentation/schemas/reservas.ts`** (o el archivo de documentación existente del módulo) — registrar el nuevo endpoint y schema, y agregar `weekdayDiscounts`/`effectiveHourlyPrice` a los schemas de respuesta ya documentados de recurso/disponibilidad.

## Decisiones

- **Tabla relacional en vez de JSON en `Resource`** — consistente con el resto del esquema, permite `@@unique` real y no reinventa validación de forma dentro de una columna libre.
- **Reemplazo atómico completo en vez de altas/bajas por día** — un solo `PUT` es más simple de razonar y probar que 7 endpoints de día individual; coincide con el patrón ya usado en `020` para permisos de rol.
- **Cálculo de precio efectivo centralizado en `database/reservas/index.ts`, nunca en el cliente** — mismo principio que ya rige toda la disponibilidad/reserva ("el backend revalida todos los invariantes").
- **Día de la semana derivado de `startsAt` en UTC (`getUTCDay()`)** — coherente con el invariante "UTC siempre" del proyecto; se documenta como limitación conocida que una franja de últimas horas de la noche local puede caer en el día UTC siguiente, igual que ya ocurre hoy con cualquier otro cálculo de fecha en el dominio.
- **Sin expiración ni rango de fechas para el descuento** — decisión explícita del usuario: el descuento es una propiedad permanente de la cancha, no una promoción temporal.

## Riesgos

- **Cambiar el precio de un recurso con reservas futuras publicadas** — ya es un riesgo preexistente con `hourlyPrice` (una franja publicada no lleva un precio propio, se calcula al confirmar); no se agrava con esta feature, se documenta el mismo comportamiento ya aceptado.
- **N+1 al incluir `weekdayDiscounts` en cada fila de `GET /api/resources`** — acotado: como máximo 7 filas por recurso, resuelto con el mismo `include`/`select` de Prisma en una sola consulta, sin queries adicionales por fila.
- **Discrepancia de weekday por huso horario en franjas nocturnas** — ver decisión de arriba; documentado, no se resuelve en esta feature.
