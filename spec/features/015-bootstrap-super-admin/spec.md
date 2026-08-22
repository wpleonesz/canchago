# 015 · Bootstrap y Protección del Super Admin

**Estado:** propuesta

## Qué hace

Formaliza y endurece el mecanismo de aprovisionamiento del primer usuario con privilegios globales ("super admin") y protege ese privilegio frente a pérdida accidental o escalamiento no autorizado. **No crea un rol paralelo**: reutiliza el rol global `Administrador` que ya siembra `prisma/seed-dev.ts` (`isSystem: true`, `organizationId: null`, con todos los permisos del catálogo vía `grantAllPermissionsToAdmin`).

Define tres cosas:

1. **El script `yarn asignar-rol` como único mecanismo soportado de aprovisionamiento.** Ya existe (`prisma/asignar-rol.ts`), ya es idempotente (verifica un `UserRole` existente con el mismo alcance antes de crear) y ya no requiere credenciales hardcodeadas (opera sobre un usuario que ya existe porque inició sesión al menos una vez vía Keycloak — `findOrSyncByOAuth`). Esta feature **formaliza ese comportamiento como contrato**, sin sustituirlo por un endpoint HTTP ni por lógica de auto-provisión.
2. **Un guardia de "último administrador".** Ninguna operación (desactivar un usuario, remover un rol, reemplazar los roles de un usuario) puede dejar la plataforma con cero usuarios activos (`status: 'ACTIVE'`) portando el rol global `Administrador`.
3. **Un guardia de escalamiento de privilegios.** Los endpoints que asignan roles a un usuario (`POST /api/users`, `PATCH /api/users/:userId`, `POST /api/users/:userId/roles`) deben rechazar cualquier intento de asignar un rol marcado `isSystem: true` (como `Administrador`) a menos que quien hace la petición ya posea él mismo el rol `Administrador`.

## Por qué

Se verificó leyendo el código real (`database/users/index.ts`, `pages/api/users/[userId]/roles/index.ts`) que **hoy no existe ningún guardia de este tipo**: cualquier usuario autenticado con el permiso `users.manage` puede, con una petición HTTP directa (`POST /api/users/:userId/roles` con `roleIds: ["<id-del-rol-administrador>"]`), otorgarse a sí mismo o a un tercero el rol `Administrador` sin ninguna restricción adicional. En la práctica, `users.manage` equivale hoy a "super admin", lo cual contradice el principio de mínimo privilegio.

Tampoco existe ningún guardia contra remover el último `Administrador` activo: un `DELETE`, un reemplazo de roles o una desactivación de usuario mal dirigidos (accidentales o maliciosos) podrían dejar la plataforma sin ningún super admin operativo, sin más recurso que acceso directo a la base de datos.

## Criterios de aceptación

- `yarn asignar-rol --email <email> --rol administrador` sigue siendo la única vía soportada para conceder el rol `Administrador` a un usuario ya existente; no introduce contraseñas, tokens ni secretos nuevos en el repositorio, fixtures o specs.
- Ejecutar `yarn asignar-rol` dos veces con el mismo `--email`/`--rol`/alcance no crea asignaciones duplicadas — comportamiento ya existente (`findFirst` antes de `create`); este criterio lo documenta como contrato, no lo modifica.
- `POST /api/users` (con `roleIds`), `PATCH /api/users/:userId` (con `roleIds`) y `POST /api/users/:userId/roles` responden `403` si alguno de los `roleIds` enviados corresponde a un rol con `isSystem: true` y quien hace la petición no tiene asignado el rol global `Administrador` — incluso si el frontend fue alterado para enviar ese `roleId` directamente.
- Un usuario autenticado con únicamente el permiso `users.manage` (sin el rol `Administrador`) que intenta asignarse a sí mismo o a otro usuario el rol `Administrador` recibe `403` y la asignación no se produce (verificable con un `GET` posterior).
- `DELETE /api/users/:userId` responde `409` si el usuario objetivo es el único usuario activo con el rol global `Administrador` asignado; el usuario no queda desactivado.
- `DELETE /api/users/:userId/roles/:roleId` y `PATCH /api/users/:userId` con `roleIds` (reemplazo completo vía `assignRolesToUser`) responden `409` si la operación resultante dejaría cero usuarios activos con el rol `Administrador`.
- El chequeo de "rol de sistema" y el de "último administrador" se ejecutan dentro de la misma transacción Prisma que la escritura que protegen (hoy `addRoleToUser`/`removeRoleFromUser` no están en transacción — deben envolverse).
- Los mensajes de error no revelan cuántos administradores existen ni sus identidades: mensaje genérico en español, sin filtrar el conteo real.
- El bootstrap por script (`yarn asignar-rol`) sigue funcionando sin cambios: opera directo contra Prisma y no pasa por los guardias de los endpoints HTTP (se verifica explícitamente para no romper el único camino real de aprovisionamiento).

### Documentación (obligatorio)

- [ ] Las nuevas reglas de negocio (403 por rol de sistema, 409 por último administrador) están reflejadas en la `description` de los endpoints afectados en `documentation/schemas/users.ts`, ya registrados con `registry.registerPath()`.
- [ ] Si se decide introducir un schema de error específico para estos casos, se registra con `registry.registerComponent()`; si se reutilizan `ErrorResponseSchema`/`ConflictError`/`AuthorizationError` ya existentes, no hace falta un schema nuevo.
- [ ] `documentation/schemas/users.ts` sigue exportado desde `documentation/schemas/index.ts` (ya lo está).
- [ ] Los endpoints muestran la nueva regla de negocio en `GET /api/docs`.

## Fuera de alcance

- Crear un rol, tabla o campo paralelo de "super admin" — se reutiliza `Role.isSystem` y el rol `Administrador` ya sembrado.
- Automatizar el aprovisionamiento del primer super admin vía un endpoint HTTP o durante el flujo OAuth — se mantiene manual y explícito (`yarn asignar-rol`), precisamente para no abrir una vía de red hacia el privilegio máximo.
- Exponer roles globales (`Administrador`, `Futbolista`) a través de `GET /api/roles` — ese endpoint exige `organizationId` y hace coincidencia estricta, por lo que nunca devuelve roles con `organizationId: null`; corregirlo es un cambio de modelo de roles más amplio (relacionado con el backlog "Asignación de roles con alcance vía API"), no parte de esta feature.
- Rate limiting de `/api/users` y `/api/auth` — dependencia instalada (`rate-limiter-flexible`) pero no conectada en ningún endpoint hoy; gap real, documentado en el roadmap, resuelto en una feature aparte.
- Auditoría (`AuditLog`) de cambios de roles/usuarios — ya diferida explícitamente por las features `005` y `006`; esta feature no la reabre.
- Validación cross-organización de `roleIds` en `assignRolesToUser`/`addRoleToUser` (hoy no verifican que el rol pertenezca a la organización del usuario) — gap real distinto y más amplio que "proteger al super admin"; queda anotado para una feature futura de endurecimiento RBAC general.
- Prevenir filas `UserRole` duplicadas al llamar `POST /api/users/:userId/roles` dos veces con el mismo `roleId` — gap de integridad de datos no relacionado con privilegios; fuera de alcance.
- Cualquier cambio en `canchago-ionic` — ese repositorio consume este contrato desde su propia feature `005-gestion-usuarios` y depende de que esta feature esté implementada antes de considerar segura la asignación de roles desde su UI; no se toca ese repo desde aquí.
