# 022 · Reservas para futbolistas y alcance de gestores

**Estado:** propuesta

## Qué hace

Separa explícitamente las cuentas de cliente final de las cuentas administrativas. Un Futbolista puede existir sin organización ni sede, descubrir recursos deportivos habilitados, consultar su disponibilidad, reservar una franja y consultar o cancelar únicamente sus propias reservas. Un Gestor de Cancha conserva un alcance obligatorio por organización y, cuando corresponda, por sede, para administrar recursos y reservas dentro de ese alcance.

El dominio usa `Resource` como abstracción reservable, de acuerdo con la misión del proyecto; “cancha” es el término presentado al usuario, no el nombre rígido del modelo.

## Por qué

El registro público ya crea correctamente al Futbolista con un rol global y sin alcance administrativo. Sin embargo, el CRUD administrativo de usuarios exige `organizationId` para todos los usuarios. Además, el repositorio no contiene todavía modelos ni contratos de recursos, disponibilidad o reservas, por lo que el flujo solicitado no puede resolverse únicamente relajando una validación: requiere implementar el motor de reservas pendiente en el roadmap.

## Estado real y causa raíz verificada

- `User` no pertenece directamente a una organización, sede o cancha.
- El alcance vive opcionalmente en `UserRole.organizationId` y `UserRole.venueId`.
- `Futbolista` es un `Role` global (`Role.organizationId = null`) y el registro público crea su `UserRole` sin organización ni sede.
- `Gestor de Cancha` es un rol de organización. Tras aprobar una `OrganizationAccessRequest`, queda asignado con el alcance de la organización creada.
- `createUserSchema` exige hoy `organizationId`, y `createWithRoles` lo copia a todas las asignaciones. Esa generalización es la dependencia incorrecta para roles globales.
- No existen `Resource`, disponibilidad ni reserva en Prisma, `database/`, `services/`, `validations/`, `pages/api/` u OpenAPI. Tampoco existen reglas previas de duración o bloqueo que preservar.

## Criterios de aceptación

- [ ] El registro y la autenticación existentes de Futbolista siguen funcionando sin `organizationId` ni `venueId`.
- [ ] El CRUD administrativo permite crear o editar un Futbolista global sin organización ni sede.
- [ ] Una asignación de rol global rechaza alcances administrativos enviados por el cliente; una asignación de rol de organización exige un `organizationId` coherente con el rol.
- [ ] El Gestor de Cancha conserva un alcance administrativo obligatorio y solo opera sobre organizaciones, sedes, recursos y reservas dentro de él.
- [ ] Los usuarios existentes y sus asignaciones se preservan; las asociaciones heredadas de Futbolistas no otorgan capacidades administrativas y se diagnostican/migran de forma segura si existen.
- [ ] Un Futbolista autenticado lista únicamente recursos y sedes activos, con paginación y filtros en lista blanca.
- [ ] Un Futbolista consulta disponibilidad real por recurso y rango de fechas, en UTC, excluyendo cierres y reservas que bloqueen horario.
- [ ] Una reserva guarda al usuario autenticado como `bookedByUserId`; ese ID nunca se acepta desde el body.
- [ ] La reserva referencia el recurso y la franja seleccionados sin crear ni modificar `UserRole` o afiliaciones administrativas.
- [ ] El backend vuelve a validar habilitación y disponibilidad al confirmar, dentro de la misma operación atómica.
- [ ] Dos confirmaciones concurrentes solapadas para el mismo recurso no pueden crear dos reservas activas; una obtiene 201 y la otra 409.
- [ ] La duración es positiva, respeta los límites configurados del recurso y queda totalmente contenida en una ventana habilitada.
- [ ] Estados cancelados no bloquean disponibilidad; estados activos/confirmados sí la bloquean conforme al contrato cerrado de esta feature.
- [ ] Un Futbolista puede listar y consultar solo sus reservas, y cancelar solo una reserva propia cuando su estado lo permita.
- [ ] Un Futbolista recibe 403 al intentar administrar recursos, consultar reservas ajenas o manipular alcance mediante IDs.
- [ ] Un Gestor recibe 403 al usar IDs de otra organización o sede aunque tenga el permiso funcional requerido.
- [ ] Los endpoints mantienen los envelopes estándar y no exponen errores internos de Prisma/PostgreSQL.
- [ ] Hay pruebas unitarias y de integración para validaciones, alcance, ownership, disponibilidad, estados y concurrencia.

### Documentación (obligatorio)

- [ ] Todos los endpoints del módulo están registrados en `documentation/schemas/reservas.ts` mediante `registry.registerPath()`.
- [ ] Todos los schemas de entrada y salida están registrados con `registry.registerComponent()` en el mismo archivo.
- [ ] El módulo está exportado desde `documentation/schemas/index.ts`.
- [ ] Los endpoints y schemas son visibles y correctos en `GET /api/docs` (Swagger UI).

## Contrato REST propuesto

- `GET /api/resources` — autenticado; `resources.read`; lista recursos activos visibles para reservar.
- `GET /api/resources/{resourceId}` — autenticado; `resources.read`; detalle de un recurso activo.
- `GET /api/resources/{resourceId}/availability` — autenticado; `resources.read`; query `from`/`to` UTC y franjas disponibles.
- `POST /api/bookings` — autenticado; `bookings.create`; body `resourceId`, `startsAt`, `endsAt`; el usuario se toma de sesión.
- `GET /api/bookings` — autenticado; `bookings.read.own` devuelve exclusivamente reservas propias.
- `GET /api/bookings/{bookingId}` — autenticado; owner con `bookings.read.own`, o gestor dentro de alcance con permiso administrativo.
- `DELETE /api/bookings/{bookingId}` — autenticado; cancelación lógica propia o administrativa según permiso, ownership, alcance y estado.
- `POST/PATCH/DELETE /api/organizaciones/{organizationId}/sedes/{sedeId}/resources...` — administración de recursos protegida por permiso y alcance de organización/sede.
- Endpoints de reglas/ventanas de disponibilidad anidados bajo el recurso — protegidos por permiso y alcance administrativo.

Los nombres finales de permisos, shapes y estados se cerrarán en `plan.md` antes de implementar y se sembrarán/auditarán junto con los `access(...)` reales.

## Fuera de alcance

- Pagos, facturación, precios dinámicos, torneos, chat, reseñas o geolocalización avanzada.
- Reservas recurrentes y listas de espera.
- Convertir “cancha” en un modelo específico; se conserva la abstracción `Resource`.
- Reescribir autenticación OAuth/ROPC o el flujo de aprobación ya implementado.

