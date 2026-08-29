# 019 · Endurecimiento de Organizaciones y Sedes

**Estado:** propuesta

## Qué hace

Cierra siete gaps reales de seguridad y robustez encontrados en el CRUD de `Organization`/`Venue` (feature `004`, hecho ✅ desde 2026-06-30) al inspeccionarlo para la nueva pantalla administrativa del frontend (`canchago-ionic`, feature `010-gestion-organizaciones-sedes`). Aplica al módulo `organizaciones-sedes` exactamente el mismo patrón de robustez ya validado en producción por la feature `018` (roles): guardia de alcance por organización, concurrencia optimista, transacciones con auditoría, y schemas Zod estrictos.

Concretamente:

1. Impide que un actor lea, edite o borre una sede de una organización distinta a la que indica la URL (IDOR real hoy).
2. Aplica el mismo filtro de alcance por organización que ya usa el listado (`GET /organizaciones`) también en las operaciones por ID de organización y de sede.
3. Convierte la creación de una sede bajo un `organizationId` inexistente o borrado en un `404` claro, no en un `500` genérico.
4. Añade concurrencia optimista (`expectedUpdatedAt`) a `PATCH /organizaciones/{id}` y `PATCH /organizaciones/{id}/sedes/{id}`.
5. Hace real la unicidad de `Organization.name` (hoy es código muerto: el `ConflictError` existe pero Postgres nunca lo dispara).
6. Registra auditoría (`AuditLog`) de creación y edición de organizaciones y sedes, igual que ya existe para roles.
7. Expone el conteo de sedes por organización (`_count`) en el listado, para que el frontend pueda mostrarlo sin una petición por fila.

## Por qué

El backend expone hoy un CRUD funcional de organizaciones/sedes, pero con garantías más débiles que el resto de la administración: cualquier actor con `organizaciones.read`/`.manage` puede leer, editar o borrar la sede de **cualquier** organización con solo conocer su `sedeId`, sin que el `organizationId` de la URL se valide contra ella — un IDOR real, no teórico. La feature `018` ya resolvió exactamente esta misma familia de problemas para `Role` (`ensureOrganizationScope`, `expectedUpdatedAt`, transacciones con auditoría); esta feature aplica ese mismo patrón, ya probado, al módulo de organizaciones/sedes para que la nueva pantalla administrativa de `canchago-ionic` (feature `010`) pueda dejar de documentar estos puntos como "gap de backend sin cerrar" en su spec.

## Criterios de aceptación

_Condiciones verificables, redactadas para comprobarse con un sí/no. Marca `[x]` al cumplirse._

**Alcance por organización (IDOR)**

- [ ] `GET/PATCH/DELETE /organizaciones/{organizationId}/sedes/{sedeId}` con un `sedeId` real que pertenece a **otra** organización responde `404` (opaco: mismo mensaje que "sede no existe", no revela que existe en otra organización), nunca `200` con los datos de esa sede.
- [ ] `GET/PATCH/DELETE /organizaciones/{organizationId}` con un `organizationId` fuera del alcance de un actor no-administrador global responde `404` opaco (no `403`, para no confirmar la existencia del recurso — mismo criterio que `ensureOrganizationScope(..., opaque: true)` en roles).
- [ ] Un administrador global (`isAdministrator`) sigue accediendo sin restricción a cualquier organización/sede, igual que hoy.
- [ ] Un actor con `UserRole` directo sobre la organización, o vía un rol de esa organización, puede acceder a sus propias organización/sedes sin falsos negativos (regresión del filtro que ya usa `GET /organizaciones`).

**Creación de sede bajo organización inexistente**

- [ ] `POST /organizaciones/{organizationId}/sedes` con un `organizationId` sintácticamente válido (UUID) pero inexistente o soft-borrado responde `404`, nunca `500`.

**Concurrencia optimista**

- [ ] `PATCH /organizaciones/{organizationId}` exige `expectedUpdatedAt` en el body (ISO datetime); si no coincide con el `updatedAt` real, responde `409` sin aplicar ningún cambio.
- [ ] `PATCH /organizaciones/{organizationId}/sedes/{sedeId}` exige `expectedUpdatedAt` con el mismo comportamiento.
- [ ] Dos ediciones concurrentes sobre el mismo recurso: la segunda en llegar (con el `updatedAt` ya desactualizado) recibe `409`, nunca sobrescribe en silencio a la primera.

**Unicidad real de nombre de organización**

- [ ] `POST /organizaciones` con un `name` ya existente (comparación case-insensitive tras normalizar espacios, igual que `Role.normalizedName`) responde `409`, no `201`.
- [ ] `PATCH /organizaciones/{organizationId}` que renombra a un `name` ya usado por otra organización responde `409`.
- [ ] La restricción es real a nivel de base de datos (`@@unique`), no solo aplicativa — dos escrituras concurrentes con el mismo nombre no pueden colar ambas.
- [ ] La migración que añade la restricción se aplica sin resetear datos existentes; si ya existen duplicados en el entorno de desarrollo/seed, se resuelven antes de aplicar la migración (ver Riesgos de `plan.md`).

**Auditoría**

- [ ] Crear o editar una organización registra un `AuditLog` (`action: ORGANIZATION_CREATED`/`ORGANIZATION_UPDATED`, `entityType: 'Organization'`, `entityId`, `organizationId` = la propia organización, `actorUserId`, `changes` con los campos modificados) dentro de la misma transacción que la escritura — todo o nada.
- [ ] Crear o editar una sede registra un `AuditLog` (`action: VENUE_CREATED`/`VENUE_UPDATED`, `entityType: 'Venue'`, `organizationId` = la de la sede) en la misma transacción.
- [ ] Los eventos de auditoría no incluyen información sensible (no aplica aquí: los campos de organización/sede no son sensibles, pero se sigue el mismo criterio que roles).
- [ ] `DELETE` (soft delete) de organización/sede **no** se audita en esta feature — mismo criterio ya vigente para roles (`deleteRole` tampoco escribe `AuditLog`); no se introduce una inconsistencia nueva respecto al patrón existente.

**Conteo de sedes por organización**

- [ ] `GET /organizaciones` incluye `venuesCount` (o campo equivalente) por organización, resuelto con `_count` en la misma consulta `findMany` — sin una consulta adicional por organización (cero N+1, verificable contando queries en el test de integración).
- [ ] El conteo excluye sedes con `deletedAt` no nulo.

**Compatibilidad**

- [ ] El flujo de registro público y aprobación de solicitudes de acceso (feature `016`, `access-request.db.ts`) sigue funcionando sin cambios: sigue creando `Organization`/`Venue` en `PENDING_APPROVAL` fuera de `organizacionDb`/`sedeDb`, sin pasar por los nuevos guardias de alcance (no aplica: en ese flujo no hay `actingUser` con sesión, es post-registro).
- [ ] Los permisos sembrados `sedes.read`/`sedes.manage` (código muerto hoy, documentado en `api-integration.md` de `canchago-ionic`) no se activan ni se usan en ningún endpoint como parte de esta feature — se deja explícitamente fuera de alcance (ver abajo) para no ampliar el cambio más allá de lo pedido.
- [ ] `canchago-ionic` (feature `010`) puede actualizar su documentación de dependencia de backend a "resuelto" una vez esta feature esté hecha — no se requiere ningún cambio adicional de contrato más allá de `expectedUpdatedAt` (nuevo campo requerido en `PATCH`) y `venuesCount` (nuevo campo opcional en el listado).

### Documentación (obligatorio)

- [ ] `documentation/schemas/organizaciones-sedes.ts` actualizado: los `PATCH` de organización y sede documentan `expectedUpdatedAt` como campo requerido del body; se agregan las respuestas `404` (alcance/organización inexistente) y `409` (concurrencia, nombre duplicado) donde falten; el schema de `Organization` en las respuestas de listado documenta `venuesCount`.
- [ ] Todos los schemas de entrada y salida siguen registrados con `registry.registerComponent()` en el mismo archivo (ya existe desde la feature `004`; se actualizan los ya existentes, no se duplican).
- [ ] El módulo sigue exportado desde `documentation/schemas/index.ts` (sin cambios, ya lo está).
- [ ] Los endpoints y schemas actualizados son visibles y correctos en `GET /api/docs` — sujeto a que se resuelva primero el bloqueo de build de `zod-to-openapi` ya registrado en `roadmap.md` (ítem `010`, deuda preexistente y ajena a esta feature); si sigue bloqueado, se verifica igualmente contra `documentation/schemas/index.ts` y el spec JSON generado en `tests/`.

## Fuera de alcance

- **Extender esta misma unicidad/scope/auditoría a `Role`.** Se verificó, al implementar esta feature, que `Role.name`/`Role.code` tampoco tienen `@@unique` real en el schema (`prisma/schema.prisma`, modelo `Role`) — el mismo tipo de código muerto que se corrige aquí para `Organization` existe también en la feature `018`, ya cerrada. Se documenta como hallazgo para una feature futura separada; no se toca `018` desde aquí.
- **Activar los permisos `sedes.read`/`sedes.manage`.** Existen sembrados pero ningún endpoint los verifica; decidir si deben reemplazar a `organizaciones.*` para sedes (permitiendo roles que gestionan sedes sin gestionar la organización completa) es una decisión de producto distinta al endurecimiento de seguridad de esta feature, y cambiaría el contrato que ya consume `canchago-ionic` feature `010`. Fuera de alcance.
- **Bloquear la creación/edición de sedes en organizaciones `PENDING_APPROVAL`.** Es una regla de negocio nueva, no un endurecimiento de seguridad; no está pedida y cambiaría comportamiento hoy permitido. No se agrega.
- **Transición de `Organization`/`Venue` a un estado terminal al rechazar una solicitud de acceso** (hoy quedan permanentemente en `PENDING_APPROVAL`). Pertenece al dominio de la feature `016`/`access-requests`, no al CRUD administrativo que endurece esta feature.
- **Eliminar el código muerto de los permisos `sedes.*` del seed.** Se documenta como conocido; removerlo es un cambio de datos de seed que excede el alcance de "endurecer el CRUD existente".
- **Cambiar el envelope no estándar `{organizations, meta}`/`{venues, meta}`** a `{data, meta}`. Es una decisión de compatibilidad con el frontend ya consumido; cambiarlo rompería `canchago-ionic` sin necesidad — no forma parte de este endurecimiento.
