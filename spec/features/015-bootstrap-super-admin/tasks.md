# 015 · Bootstrap y Protección del Super Admin — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

- [ ] Crear `services/users/role-guard.ts` con `assertCanAssignRoles(actingUser, roleIds)` y `assertKeepsAtLeastOneAdmin(tx, excludedUserId)`.
- [ ] Propagar `req.user` (`actingUser`) a `userService.create`/`userService.update` desde `pages/api/users/index.ts` y `pages/api/users/[userId].ts`.
- [ ] Integrar `assertCanAssignRoles` en `services/users/index.ts` (`create`, `update`) antes de `assignRolesToUser`.
- [ ] Integrar `assertCanAssignRoles` en `pages/api/users/[userId]/roles/index.ts` (`POST`) antes del loop de `addRoleToUser`.
- [ ] Envolver `services/users/index.ts.remove` en `prisma.$transaction`, llamando `assertKeepsAtLeastOneAdmin` antes de desactivar (`status: 'INACTIVE'`).
- [ ] Envolver `database/users/index.ts.addRoleToUser` y `removeRoleFromUser` en `prisma.$transaction` (hoy no lo están).
- [ ] Integrar `assertKeepsAtLeastOneAdmin` en `removeRoleFromUser` (cuando el rol removido es `administrador`) y en `assignRolesToUser` (cuando el reemplazo de roles quita `administrador` al usuario).
- [ ] Integrar `assertKeepsAtLeastOneAdmin` en `pages/api/users/[userId]/roles/[roleId].ts` (`DELETE`).
- [ ] Tests unitarios en `services/users/role-guard.test.ts`: usuario sin rol `Administrador` intenta asignar `Administrador` → `403`; único administrador activo intenta ser removido/desactivado → `409`; administrador válido asignando roles no privilegiados → permitido sin cambios de comportamiento.
- [ ] Tests de integración: agregar casos a `tests/integration/roles-permisos.test.ts` (bloque "User Role Assignment") o crear `tests/integration/users.test.ts` (no existe hoy) cubriendo: payload manipulado intentando escalar a `Administrador`, protección del último administrador vía `DELETE /api/users/:userId`, vía `DELETE /api/users/:userId/roles/:roleId` y vía `PATCH /api/users/:userId` con `roleIds`.
- [ ] Verificar manualmente que `yarn asignar-rol --email <email> --rol administrador` sigue funcionando sin cambios (no pasa por `services/users`, no debería verse afectado, pero se confirma explícitamente).

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con los endpoints, no como paso final._

- [ ] Actualizar la `description` de `POST /api/users`, `PATCH /api/users/:userId`, `DELETE /api/users/:userId`, `POST /api/users/:userId/roles`, `DELETE /api/users/:userId/roles/:roleId` en `documentation/schemas/users.ts` con los nuevos casos `403` (rol de sistema) y `409` (último administrador).
- [ ] Confirmar que no hace falta un schema de error nuevo (se reutilizan los componentes de error ya registrados); si se decide crear uno específico, registrarlo con `registry.registerComponent()`.
- [ ] Verificar que las nuevas reglas de negocio aparecen en `GET /api/docs` para cada endpoint afectado.

## Cierre

- [ ] Validar contra los criterios de aceptación de `spec.md`.
- [ ] `yarn lint && yarn typecheck && yarn test && yarn build` sin errores.
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.
- [ ] Corregir en `../../constitution/roadmap.md` el ítem "Siguiente 🔜 → 010 · Consistencia de Permisos", punto 1 (`users.*` vs `usuarios.*`): verificado durante el discovery de esta feature que `prisma/seed.ts` y todas las rutas `pages/api/users/*` usan consistentemente `users.*` hoy — el defecto descrito ya no reproduce. Mantener o cerrar solo los puntos 2 (deriva de migraciones) y 3 (`role.db.ts` tipado) si siguen vigentes tras verificarlos de nuevo en ese momento.

## Mantenimiento (checklist recurrente)

- [ ] Cada vez que se agregue un nuevo permiso "amplio" tipo `<módulo>.manage`, revisar si también debería quedar sujeto al guardia de roles `isSystem` definido aquí.
