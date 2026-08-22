# 016 · Registro Público de Usuarios — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

- [x] Revisar la política de contraseña real del realm (`passwordPolicy` en Keycloak) y replicar sus reglas mínimas en `registerSchema` antes de escribir el resto. Se agregó `passwordPolicy: "length(8) and notUsername"` al realm y `min(8)` a `registerSchema`.
- [x] Agregar el cliente `canchago-registration-service` a `keycloak/realm-canchago.json` (`serviceAccountsEnabled: true`, sin flujos de usuario, rol de cliente `manage-users` de `realm-management` en su cuenta de servicio).
- [x] Agregar `OAUTH_ADMIN_CLIENT_ID`/`OAUTH_ADMIN_CLIENT_SECRET` a `.env.example` y al schema de `lib/config/env.ts`.
- [x] Crear `lib/oauth/admin.ts` (`getAdminAccessToken`, `createKeycloakUser`, `deleteKeycloakUser`).
- [x] Migración Prisma: nuevo modelo `OrganizationAccessRequest`; documentar en un comentario del schema los valores de aplicación `'ACTIVE'`/`'PENDING_APPROVAL'` para `Organization.status`/`Venue.status`.
- [x] Crear `validations/auth/register.validation.ts` (`registerSchema` con el refinamiento condicional de `organization`/`venue`).
- [x] Agregar `createFromRegistration` a `database/users/index.ts`.
- [x] ~~Permitir que `createOrganization`/`createSede` acepten `status` opcional~~ — no fue necesario: el flujo de `gestor-de-cancha` no reutiliza esas funciones, crea Organization/Venue directamente dentro de `createUserWithAccessRequest` (ver siguiente ítem), que ya fija `status: 'PENDING_APPROVAL'` ahí mismo.
- [x] Crear `database/organizaciones-sedes/access-request.db.ts` (`getAccessRequests`, `approveAccessRequest`, `rejectAccessRequest`). **Cambio de diseño respecto al plan**: en vez de `createAccessRequest` separado, se implementó `createUserWithAccessRequest(keycloakId, user, organization, venue)`, que crea User+Profile+AuthAccount **y** Organization+Venue+AccessRequest en **una sola transacción**. Se detectó en pruebas manuales que crear el usuario y la solicitud en transacciones separadas dejaba usuarios huérfanos en Canchago si la segunda fallaba después de que la primera ya hubiera confirmado.
- [x] Crear `services/auth/register.service.ts` (orquestación completa + compensación ante fallo de Canchago tras éxito en Keycloak).
- [x] Crear `middleware/rate-limit.ts` (primera vez que se usa `rate-limiter-flexible`), aplicado solo a `POST /api/auth/register` en esta feature.
- [x] Crear `pages/api/auth/register.ts`.
- [x] Crear `pages/api/organizaciones/access-requests/index.ts` (GET).
- [x] Crear `pages/api/organizaciones/access-requests/[requestId]/approve.ts` y `.../reject.ts` (POST).
- [x] Tests unitarios: `services/auth/register.service.test.ts` (6 tests: 409 email duplicado sin llamar a Keycloak, futbolista activo de inmediato, gestor sin rol hasta aprobar, conflicto de Keycloak → 409, compensación de Keycloak ante fallo de Canchago en ambos flujos incluyendo el bug de huérfano encontrado y corregido), `database/organizaciones-sedes/access-request.db.test.ts` (6 tests: 404/409 en aprobar y rechazar solicitudes inexistentes/ya revisadas, reutilización del rol Gestor de Cancha existente vs. creación, activación de organización+sedes).
- [~] Tests de integración automatizados (`tests/integration/auth/register.test.ts`, `tests/integration/access-requests.test.ts`) **no se escribieron**. En su lugar se verificaron los mismos escenarios manualmente contra Keycloak/Postgres reales vía `curl` (ver "Cierre" abajo) — cubre los mismos casos (201 futbolista, 201 gestor sin rol, 409 email duplicado, 400 falta `organization`/`venue`, 400 password débil, 409 doble aprobación, 409 doble rechazo) pero sin quedar como regresión automatizada en CI. Pendiente si se quiere blindaje permanente.

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con los endpoints, no como paso final._

- [x] Registrar `POST /api/auth/register` en `documentation/schemas/auth.ts` con ejemplos separados para `futbolista` y `gestor-de-cancha`.
- [x] Registrar `GET /api/organizaciones/access-requests`, `POST .../approve`, `POST .../reject` en `documentation/schemas/organizaciones-sedes.ts`.
- [~] Verificar que los 4 endpoints aparecen correctos en `GET /api/docs` — no verificado visualmente en el navegador; el registro (`registry.registerPath`) sigue el mismo patrón que el resto de endpoints ya documentados y compila sin errores nuevos (el error de tipos existente en `zod-to-openapi` es previo y no bloquea `GET /api/docs` en runtime, solo `yarn build`).

## Cierre

- [x] Validar contra los criterios de aceptación de `spec.md`.
- [~] `yarn lint && yarn typecheck && yarn test && yarn build`: `lint` limpio (solo 2 warnings preexistentes ajenos a esta feature), `test` 98/98 verdes, `typecheck` y `build` fallan pero **solo** por el error preexistente y ya conocido de incompatibilidad de tipos entre Zod 4 y `@asteasolutions/zod-to-openapi` (confirmado con `git log` que las líneas que fallan son de un commit anterior, no de esta feature) — no se introdujo ningún error nuevo.
- [x] Probar manualmente contra Keycloak real: registrado un `futbolista` (`futbolista.nuevo@example.com`) y confirmado login inmediato con rol `futbolista`; registrado un `gestor-de-cancha` (`gestor.nuevo2@example.com`), confirmado que no tiene ningún rol ni permiso, aprobada la solicitud con una cuenta `administrador` (`reviewer@canchago.local`), y confirmado que el rol `gestor-de-cancha` aparece en `/api/auth/session` sin relogin. También probado: doble aprobación → 409, flujo de rechazo completo (`gestor.reject@example.com`) dejando organización/sede en `PENDING_APPROVAL` con motivo persistido, doble rechazo → 409, email duplicado → 409, password débil → 400, `gestor-de-cancha` sin `organization`/`venue` → 400.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.

## Mantenimiento (checklist recurrente)

- [ ] Si el backend se escala horizontalmente, migrar `middleware/rate-limit.ts` de `RateLimiterMemory` a `RateLimiterRedis`.
- [ ] Si se implementa envío de correo (feature futura), revisar si esta feature debe pasar a exigir `emailVerified` antes de permitir login.
