# Tareas — 008

## Infraestructura

- [x] `docker-compose.yml` con Keycloak y montaje del realm. **Puerto 8081**, porque el 8080 ya lo ocupa otro contenedor de la máquina.
- [x] `keycloak/realm-canchago.json`: realm `canchago`, cliente `canchago-api` (confidencial, PKCE S256, redirect a `/api/auth/callback`), usuarios `futbolista`, `gestor`, `administrador`.
- [x] Verificado el discovery: issuer `http://localhost:8081/realms/canchago`, PKCE `S256` soportado.

## Configuración

- [x] `.env` apuntando a Keycloak, con `BYPASS_AUTH=false` y `BYPASS_ACCESS_CONTROL=false`.
- [x] `.env.example` actualizado.
- [x] `SESSION_SECRET` regenerado: tenía **un solo carácter**, y tanto el Zod de `env.ts` como `@hapi/iron` exigen 32.

## Datos

- [x] Corregido `prisma.config.ts`: faltaba `migrations.seed`, y por eso `yarn seed` fallaba y el catálogo de permisos estaba vacío.
- [x] `yarn seed` → 10 permisos creados.
- [x] `prisma/seed-dev.ts` idempotente. Reutiliza la organización existente "Cancha 2" en vez de crear otra. Verificada la idempotencia ejecutándolo dos veces.
- [x] `prisma/asignar-rol.ts` con alcance `organizationId` / `venueId`, expuesto como `yarn asignar-rol`.

## Verificación end-to-end

- [x] `GET /api/auth/session` sin cookie → **401**.
- [x] `GET /api/auth/login` → **302** a Keycloak con `code_challenge_method=S256`.
- [x] Callback → **302**, cookie `canchago_session` con `HttpOnly; Secure; SameSite=Lax`; usuario creado solo en Canchago.
- [x] `GET /api/auth/session` con cookie → **200** con `roles` y `permissions`.
- [x] Rol asignado → tras re-login aparece en la sesión.
- [x] Futbolista sin permisos → `GET /api/roles` responde **403** (`Missing permissions: roles.read`).
- [x] Concedido `roles.read` → el mismo endpoint responde **200**. Revertido después, para dejar los roles sin permisos.
- [x] `POST /api/auth/logout` → **204**, cookie expirada y token revocado en Keycloak.

## Cierre

- [x] `yarn lint` limpio en los archivos nuevos.
- [x] `yarn typecheck`: 50 errores, **los mismos 50 del baseline**. No se introdujo ninguno.
- [x] `yarn test`: 19 fallos, **idénticos al baseline**. No se introdujo ninguno.
- [ ] `yarn build`: **ya estaba roto antes de esta feature** (`role.db.ts` tipa `data` como `unknown`). Queda como tarea 009.
- [x] Guía de clase en `guia-de-clase.md`.
- [x] Práctica guiada desde Swagger en `practica-swagger.md` (9 pasos, sin `curl`).
- [x] Roadmap actualizado.

## Documentación OpenAPI (§7 de la constitución)

- [x] Corregidas las instrucciones de `GET /auth/login`: decían "haz clic en Execute", pero eso **no puede funcionar**. Swagger hace un `fetch`, el endpoint responde `302` a Keycloak (otro origen) y el navegador lo bloquea por CORS — verificado: Keycloak no envía `Access-Control-Allow-Origin`. El login exige navegación real del navegador.
- [x] Reescritas las descripciones de `/auth/callback`, `/auth/session` y `/auth/logout` con lo que realmente ocurre, incluida la advertencia de que el logout no invalida la sesión en el servidor.
- [x] Añadido `security: [{ cookieAuth: [] }]` a los **8 endpoints de roles/permisos** que estaban protegidos por middleware pero aparecían **sin candado 🔒** en Swagger. Ahora los 26 endpoints protegidos lo declaran.

## Hallazgos derivados (van a la feature 009)

1. **Los permisos del módulo de usuarios no existen.** El middleware pide `users.read` / `users.create` / `users.manage`; el catálogo define `usuarios.read` / `usuarios.write` / `usuarios.delete`. `/api/users` responderá 403 aunque se concedan todos los permisos del catálogo.
2. **El logout no invalida la sesión en el servidor.** La cookie sellada sigue siendo válida hasta 8 h después si alguien copió su valor. `UserSession` existe en el schema y no se usa.
3. **`yarn build` roto** por el tipado de `role.db.ts`.
