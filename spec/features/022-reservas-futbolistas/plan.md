# 022 · Reservas para futbolistas y alcance de gestores — Plan

## Enfoque

Primero se corrige la validación de alcance por tipo real de rol. Después se incorpora un dominio modular de recursos, reglas de disponibilidad y reservas. La disponibilidad se calcula en backend y la confirmación usa una garantía de exclusión en PostgreSQL, además de una transacción, para que la carrera entre consulta y reserva termine en un 409 controlado y nunca en doble reserva.

## Implementación

1. **Auditoría de datos y migración** — consultar asignaciones actuales de `futbolista` con `organizationId`/`venueId`; diseñar una migración aditiva y reversible que preserve usuarios y elimine solo alcance administrativo inválido del rol global.
2. **`validations/users/index.ts` y `services/users/`** — hacer opcional `organizationId` en el payload y validar la combinación contra los roles resueltos: roles globales sin alcance; roles tenant con organización obligatoria y coherente.
3. **`database/users/`** — persistir cada `UserRole` con el alcance derivado del rol validado, nunca copiando ciegamente un `organizationId` común.
4. **`prisma/schema.prisma` y migración nueva** — agregar `Resource`, ventanas semanales de disponibilidad, bloqueos excepcionales y `Booking`, con UTC, estados cerrados, soft delete, índices y `onDelete` explícitos.
5. **Garantía anti-solapamiento** — crear en SQL de migración una restricción de exclusión PostgreSQL sobre recurso+rango para estados bloqueantes (con `btree_gist` si el entorno lo requiere). Traducir la violación a `ConflictError` sin filtrar detalles SQL.
6. **`validations/resources/` y `validations/bookings/`** — schemas Zod estrictos para parámetros, paginación, filtros, intervalos y transiciones permitidas.
7. **`database/resources/` y `database/bookings/`** — encapsular queries con filtros de activo/soft delete, cálculo de ocupación y operación transaccional de confirmación.
8. **`services/resources/` y `services/bookings/`** — aplicar reglas de habilitación, ventanas, duración, ownership, estados y alcance multi-tenant sin conocer HTTP.
9. **`pages/api/resources/`, `pages/api/bookings/` y rutas administrativas anidadas** — encadenar `auth`, `access`, parsing y respuesta estándar; el ID del futbolista siempre sale de `req.user`.
10. **`prisma/seed.ts`** — incorporar permisos efectivos y menús justificados; conceder permisos mínimos al rol global Futbolista y administrativos al Gestor sin ampliar su alcance.
11. **Pruebas** — cubrir CRUD/edición de Futbolista sin organización, reglas de roles globales/tenant, IDOR, ownership, disponibilidad, límites y una prueba concurrente real contra PostgreSQL.
12. **`documentation/schemas/reservas.ts`** — registrar componentes y paths junto con cada endpoint; exportar desde `documentation/schemas/index.ts`.
13. **Verificación integrada** — `yarn generate`, validación de migraciones en base compatible, `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build` y comprobación de `/api/docs`.

## Decisiones

- **`Resource` y no `Court`** — la constitución exige un motor agnóstico al tipo de espacio reservable.
- **Ownership desde sesión** — `bookedByUserId` nunca se recibe del cliente, cerrando manipulación horizontal por ID.
- **Alcance derivado de cada rol** — un único `organizationId` de formulario no puede aplicarse indiscriminadamente a roles globales y tenant.
- **Restricción PostgreSQL de exclusión** — una comprobación previa aislada no evita carreras; la base debe arbitrar el solapamiento.
- **Ventanas y bloqueos separados de reservas** — diferencia horario operativo, cierres excepcionales y ocupación real sin sobrecargar `Booking`.
- **UTC en persistencia y API** — la zona local se resuelve únicamente en límites de presentación.

## Riesgos

- **Datos heredados de Futbolistas con alcance** — auditar antes de migrar y no borrar roles ni usuarios.
- **Restricción parcial por estado** — los estados bloqueantes deben quedar fijados en migración y pruebas para evitar deriva con el enum.
- **Compatibilidad Prisma/PostgreSQL** — la exclusión se expresa en SQL de migración y se verifica con integración real, porque Prisma no modela toda la restricción.
- **Build backend ya documentado como roto** — distinguir fallos preexistentes de regresiones, pero no declarar la feature completa mientras sus gates exigidos sigan fallando.
- **Zona horaria/DST** — persistir UTC y probar límites; la app transforma a hora local.

