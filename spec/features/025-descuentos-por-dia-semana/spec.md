# 025 · Descuentos de precio por día de la semana

**Estado:** propuesta

## Qué hace

Un Gestor (o Administrador) define, por cancha, un porcentaje de descuento para uno o varios días de la semana (lunes a domingo) sobre el precio por hora ya existente (`Resource.hourlyPrice`). El descuento es permanente hasta que se cambie explícitamente — no está atado a un mes ni a una promoción temporal. Cuando un Futbolista consulta horarios o confirma una reserva, el precio que ve y el que se congela en la reserva ya refleja el descuento del día real de esa franja.

## Por qué

Hoy `Resource.hourlyPrice` es un único precio para todos los días. El Gestor pidió poder cobrar distinto ciertos días de la semana (por ejemplo, un descuento entre semana para incentivar ocupación en horarios de baja demanda), sin tener que crear una cancha separada ni reconfigurar el precio manualmente cada semana.

## Reglas de negocio

- El descuento se define por día de la semana (0=domingo … 6=sábado, mismo criterio que ya usa el cliente Ionic para la programación mensual), como un **porcentaje** sobre `hourlyPrice` (no un precio alternativo fijo).
- Un mismo recurso no puede tener dos descuentos para el mismo día de la semana (reemplazo atómico de todo el conjunto, no altas/bajas incrementales).
- Rango válido del porcentaje: mayor que 0 y hasta 100 inclusive. No enviar un día no lo descuenta (precio normal ese día).
- El descuento aplica de forma indefinida: no expira, no está atado a un mes ni a un rango de fechas; el Gestor lo cambia o lo quita explícitamente cuando quiera.
- El precio efectivo de una reserva se calcula y se congela **al confirmarla**, usando el día de la semana real de la franja (`AvailabilitySlot.startsAt`, en UTC — mismo criterio de "UTC siempre" que ya rige todo el dominio) y los descuentos vigentes de la cancha en ese momento. Cambios posteriores al descuento no afectan reservas ya confirmadas — mismo invariante de snapshot que ya existe para `hourlyPrice`/`totalPrice`.
- El precio efectivo también se expone al **consultar disponibilidad** (antes de reservar), para que el Futbolista vea el precio real de cada franja antes de confirmar, sin tener que calcularlo él mismo ni conocer las reglas de descuento.
- Solo quien puede administrar la cancha (Administrador, o Gestor con alcance real sobre ese recurso — mismo criterio que `PATCH /api/resources/{resourceId}`) puede definir sus descuentos.
- Eliminar/desactivar una cancha, sede u organización no elimina sus descuentos (quedan huérfanos pero inaccesibles vía la cancha oculta); si la cancha se reactiva, sus descuentos previos siguen vigentes tal cual quedaron.

## Criterios de aceptación

- [ ] Un Gestor con alcance sobre la cancha (o un Administrador) puede definir el conjunto completo de descuentos por día de semana de esa cancha en una sola operación atómica.
- [ ] Un actor sin alcance sobre esa cancha recibe 403/404 (mismo criterio que el resto de operaciones de gestión de recursos) y no se modifica nada.
- [ ] Enviar un porcentaje fuera de `(0, 100]`, un día de semana fuera de `[0, 6]`, o el mismo día repetido dos veces, se rechaza con 400 sin aplicar ningún cambio.
- [ ] `GET /api/resources` y `GET /api/resources/{resourceId}` incluyen los descuentos vigentes de cada cancha.
- [ ] `GET /api/resources/{resourceId}/availability` incluye, por cada franja, el precio por hora efectivo ya con el descuento de su día aplicado (o el precio base si ese día no tiene descuento).
- [ ] Confirmar una reserva en una franja de un día con descuento congela el precio ya descontado en `Booking.hourlyPrice`/`Booking.totalPrice`.
- [ ] Cambiar o quitar un descuento después de confirmar una reserva no altera el precio ya congelado de esa reserva.
- [ ] Quitar todos los descuentos de una cancha (enviar un conjunto vacío) elimina los existentes; la cancha vuelve a cobrar siempre `hourlyPrice` sin excepciones.

### Documentación (obligatorio)

- [ ] El nuevo endpoint y sus schemas están registrados en `documentation/schemas/reservas.ts` (o el módulo correspondiente) con `registry.registerPath()`/`registry.registerComponent()`.
- [ ] `GET /api/docs` muestra el nuevo endpoint, el campo `weekdayDiscounts` en las respuestas de recurso y `effectiveHourlyPrice` en disponibilidad.

## Fuera de alcance

- Promociones o descuentos atados a un rango de fechas concreto (solo por día de la semana, indefinido).
- Precios alternativos expresados como monto fijo en vez de porcentaje.
- Descuentos por franja horaria específica dentro de un día (solo granularidad de día completo).
- Cualquier UI o lógica en `canchago-ionic` (feature `017` de ese repositorio, separada).
