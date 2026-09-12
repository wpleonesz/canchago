# 023 · Estado de organizaciones y sedes

**Estado:** propuesta

## Qué hace

Permite a un Administrador global desactivar (`INACTIVE`) y reactivar (`ACTIVE`) una organización o una sede ya aprobada, de forma independiente entre sí, reutilizando los endpoints `PATCH` de actualización que ya existen para cada una.

## Por qué

Hoy el `status` de `Organization`/`Venue` solo se mueve en un sentido: nace `PENDING_APPROVAL` (feature `016`) y pasa a `ACTIVE` cuando un Administrador aprueba la solicitud. No existe ningún camino de vuelta ni forma de dar de baja una organización o sede que ya estaba activa (por ejemplo, incumplimiento, cierre temporal, o un error al aprobar). `updateOrganizationSchema` y `updateSedeSchema` (`validations/organizaciones-sedes/`) no aceptan hoy el campo `status`, así que ni siquiera un Administrador puede escribirlo por API. Esto es lo que impide que `canchago-ionic` ofrezca esa acción: no hay contrato al que conectarse.

Esto es distinto del soft delete existente (`deletedAt`): desactivar es reversible y explícito, pensado para ocultar temporalmente sin perder el registro ni forzar un borrado en cascada.

## Reglas de negocio

- Solo un Administrador global (`isAdministrator`, mismo helper que ya usa `ensureOrganizationScope`) puede incluir `status` en el body de estos `PATCH`. Cualquier otro actor que lo envíe —incluso si tiene `organizaciones.manage` y scope real sobre esa organización— recibe 403, sin llegar a tocar la base de datos.
- Los únicos valores aceptados por este endpoint son `ACTIVE` e `INACTIVE`. `PENDING_APPROVAL` nunca es un valor válido aquí: ese estado solo lo controla el flujo de aprobación/rechazo de solicitudes (feature `016`), que no se modifica en esta feature.
- El estado de una organización y el de sus sedes se administran de forma independiente: desactivar una organización no cambia el `status` de sus sedes, ni viceversa. El ocultamiento de canchas ya ocurre solo con que **alguno** de los dos (organización o sede) deje de estar `ACTIVE`, porque `listResources` (`database/reservas/index.ts`) ya exige que organización, sede y recurso estén `ACTIVE` simultáneamente por defecto.
- No se bloquea la desactivación por reservas futuras confirmadas ni por franjas publicadas existentes: es una decisión explícita para esta feature. Desactivar solo oculta la organización/sede de nuevas búsquedas, catálogos y publicaciones; no cancela ni oculta reservas ya confirmadas en "Mis reservas" ni en el listado administrativo de reservas.
- El cambio de `status` se audita igual que cualquier otro campo editado (`ORGANIZATION_UPDATED` / `VENUE_UPDATED` en `AuditLog`, ya existente), incluyendo el actor y el valor nuevo.
- La concurrencia optimista (`expectedUpdatedAt`, ya obligatoria en ambos `PATCH`) aplica igual para este campo que para el resto.
- No se introduce un enum de Prisma para `Organization.status`/`Venue.status` en esta feature: la columna sigue siendo `VARCHAR` libre (deuda ya señalada en `019`/`010`); la restricción de valores válidos vive en Zod, a nivel de contrato de este endpoint.

## Criterios de aceptación

- [ ] Un Administrador cambia el `status` de una organización de `ACTIVE` a `INACTIVE` y de vuelta a `ACTIVE` vía `PATCH /api/organizaciones/:organizationId`.
- [ ] Un Administrador cambia el `status` de una sede de la misma forma vía `PATCH /api/organizaciones/:organizationId/sedes/:sedeId`.
- [ ] Un actor no administrador que envíe `status` (aunque tenga `organizaciones.manage` y scope real) recibe 403 y el registro no cambia.
- [ ] Enviar un valor de `status` distinto de `ACTIVE`/`INACTIVE` (incluido `PENDING_APPROVAL`) es rechazado por Zod con 400.
- [ ] Una organización o sede `INACTIVE` deja de aparecer en `GET /api/resources` para el Futbolista (comportamiento ya cubierto por el filtro existente; se agrega un test explícito para esta feature) y no permite crear/publicar canchas o franjas nuevas sobre ella.
- [ ] Reservas ya confirmadas de canchas de una organización/sede recién desactivada siguen visibles y sin cambios en "Mis reservas" y en el listado administrativo.
- [ ] El cambio de estado queda auditado con actor, entidad y valor nuevo.
- [ ] Enviar `expectedUpdatedAt` desactualizado junto con `status` responde 409, igual que con cualquier otro campo.

### Documentación (obligatorio)

- [ ] El campo `status` del body de actualización está reflejado en `documentation/schemas/organizaciones-sedes.ts` para ambos `PATCH` (organización y sede), incluyendo que es exclusivo de Administrador.
- [ ] `GET /api/docs` muestra el campo `status` en el schema de actualización de ambos recursos con su enum real (`ACTIVE` | `INACTIVE`).

## Fuera de alcance

- Un estado adicional tipo `SUSPENDED` distinto de `INACTIVE` (evaluado y descartado explícitamente para esta feature).
- Cascada automática de `status` entre organización y sus sedes.
- Bloquear la desactivación cuando existan reservas o franjas futuras (decisión explícita: no bloquear).
- Cambios al flujo de aprobación/rechazo de solicitudes de acceso (`016`) o a `Resource.status` (ya resuelto).
- Migrar `Organization.status`/`Venue.status` a un enum de Prisma (deuda preexistente, feature de hardening aparte).
