# 002 · Autenticación Core (Login) — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

## Entorno y configuración

- [ ] Agregar variables `OAUTH_*` y `SESSION_*` a `.env.example`.
- [ ] Crear `lib/config/env.ts` con esquema Zod que valide todas las variables al inicio y exporte un objeto `env` tipado.

## Módulos base

- [ ] Crear `lib/pkce/index.ts` con `generateVerifier`, `generateChallenge` y `generateState`.
- [ ] Crear `lib/oauth/index.ts` con `buildAuthorizationUrl`, `exchangeCode`, `verifyIdToken`, `refreshAccessToken` y `revokeToken`.
- [ ] Crear `lib/session/index.ts` con `encrypt`, `decrypt`, `setSessionCookie` y `clearSessionCookie`.

## Middlewares

- [ ] Crear `middleware/auth.ts`: desencripta la cookie, adjunta `request.user`, lanza `AuthenticationError` si falla.
- [ ] Crear `middleware/access.ts`: comprueba permisos en `request.user.permissions`, lanza `AuthorizationError` si no los tiene.

## Capa de datos

- [ ] Agregar `findOrSyncByOAuth(oauthSubject, email, name)` en `database/users/index.ts`.

## Errores

- [ ] Crear `errors/app-error.ts` con la clase base `AppError`.
- [ ] Crear `errors/authentication-error.ts` (`401`).
- [ ] Crear `errors/authorization-error.ts` (`403`).

## API Routes

- [ ] Crear `pages/api/auth/login.ts`: genera state/PKCE, fija cookie temporal, redirige al proveedor.
- [ ] Crear `pages/api/auth/callback.ts`: valida state, intercambia código, verifica token, sincroniza usuario, crea sesión.
- [ ] Crear `pages/api/auth/session.ts`: devuelve datos del usuario autenticado.
- [ ] Crear `pages/api/auth/refresh.ts`: renueva el access token y actualiza la sesión.
- [ ] Crear `pages/api/auth/logout.ts`: revoca token, elimina cookie, responde `204`.

## Documentación Swagger (obligatorio)

_Crear en paralelo con cada endpoint, no al final._

- [ ] Crear `documentation/schemas/auth.ts`.
- [ ] Registrar `cookieAuth` como security scheme con `registry.registerComponent('securitySchemes', ...)`.
- [ ] Registrar `SessionResponse` schema con `registry.registerComponent('schemas', ...)`.
- [ ] Registrar `registry.registerPath()` para `GET /auth/login` (público, redirige, `302`).
- [ ] Registrar `registry.registerPath()` para `GET /auth/callback` (público, `302` / `400`).
- [ ] Registrar `registry.registerPath()` para `GET /auth/session` (cookieAuth, `200` / `401`).
- [ ] Registrar `registry.registerPath()` para `POST /auth/refresh` (cookieAuth, `204` / `401`).
- [ ] Registrar `registry.registerPath()` para `POST /auth/logout` (cookieAuth, `204`).
- [ ] Exportar `documentation/schemas/auth.ts` desde `documentation/schemas/index.ts`.
- [ ] Verificar que los 5 endpoints aparecen en `GET /api/docs` con tag `Auth`.

## Tests

- [ ] Unitarios para `lib/pkce/`.
- [ ] Unitarios para `lib/session/` (cifrado/descifrado, flags de cookie).
- [ ] Unitarios para `lib/oauth/` mockeando el proveedor externo.
- [ ] Integración `tests/integration/auth/login.test.ts`: flujo completo callback → sesión → logout.
- [ ] Integración: reuso de `state` devuelve `400`.
- [ ] Integración: cookie expirada devuelve `401` en `/api/auth/session`.

## Cierre

- [ ] Ejecutar `npm run lint && npm run typecheck && npm run test && npm run build` sin errores.
- [ ] Validar contra los criterios de aceptación de `spec.md`.
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.
