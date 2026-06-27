# 002 · Autenticación Core (Login) — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

Implementar el flujo OAuth 2.0 Authorization Code Flow + PKCE usando las API Routes de Next.js en `pages/api/auth/`. La sesión se cifra con `@hapi/iron` y se almacena en una cookie HttpOnly. Los módulos `lib/oauth/` y `lib/session/` encapsulan toda la lógica de integración OAuth y manejo de cookies; las rutas solo orquestan.

## Implementación

1. **Variables de entorno** — Agregar y documentar en `.env.example` todas las variables OAuth y de sesión definidas en `constitution/tech-stack.md` (`OAUTH_*`, `SESSION_*`). Crear `lib/config/env.ts` que valide con Zod al inicio.

2. **`lib/oauth/`** — Módulo con funciones:
   - `buildAuthorizationUrl(state, codeChallenge)` → URL de redirección al proveedor.
   - `exchangeCode(code, codeVerifier)` → obtiene `access_token`, `refresh_token` e `id_token`.
   - `verifyIdToken(idToken)` → valida firma (JWKS), issuer, audience, expiración y nonce.
   - `refreshAccessToken(refreshToken)` → renueva el access token.
   - `revokeToken(token)` → revoca en el proveedor si lo soporta.

3. **`lib/session/`** — Módulo con funciones:
   - `encrypt(payload)` → cifra con `@hapi/iron` usando `SESSION_SECRET`.
   - `decrypt(cookie)` → descifra y valida; lanza `AuthenticationError` si es inválida o expirada.
   - `setSessionCookie(response, payload)` → escribe la cookie con las flags correctas.
   - `clearSessionCookie(response)` → elimina la cookie.

4. **`lib/pkce/`** — Utilidades:
   - `generateVerifier()` → genera `code_verifier` aleatorio.
   - `generateChallenge(verifier)` → produce `code_challenge` con SHA-256.
   - `generateState()` → genera `state` opaco y seguro.

5. **`middleware/auth.ts`** — Lee la cookie, llama a `session.decrypt()`, adjunta el usuario autenticado a `request.user`. Lanza `AuthenticationError` si falla.

6. **`middleware/access.ts`** — Recibe la lista de permisos requeridos y comprueba que `request.user.permissions` los contenga. Lanza `AuthorizationError` si no.

7. **`pages/api/auth/login.ts`** — Genera `state` y `codeVerifier`, guarda ambos en una cookie temporal HttpOnly de corta vida, redirige al proveedor.

8. **`pages/api/auth/callback.ts`** — Lee la cookie temporal, valida `state`, llama a `exchangeCode`, `verifyIdToken`, busca o sincroniza el usuario en la base de datos, crea la sesión, llama a `setSessionCookie`, redirige al cliente.

9. **`pages/api/auth/session.ts`** — Ejecuta `middleware/auth`, devuelve `{ data: { id, email, name, roles, permissions } }`.

10. **`pages/api/auth/refresh.ts`** — Ejecuta `middleware/auth`, llama a `refreshAccessToken`, actualiza la sesión.

11. **`pages/api/auth/logout.ts`** — Ejecuta `middleware/auth`, llama a `revokeToken` si aplica, llama a `clearSessionCookie`, responde `204`.

12. **`database/users/index.ts`** — Función `findOrSyncByOAuth(oauthSubject, email, name)` que busca el usuario por `oauthSubject` y lo crea si no existe.

13. **`documentation/schemas/auth.ts`** — Registro en el OpenAPI registry:
   - `registry.registerComponent('securitySchemes', 'cookieAuth', ...)` para la cookie de sesión.
   - `registry.registerComponent('schemas', 'SessionResponse', ...)` con el schema `{ id, email, name, roles, permissions }`.
   - `registry.registerPath(...)` para cada endpoint: `GET /auth/login`, `GET /auth/callback`, `GET /auth/session`, `POST /auth/refresh`, `POST /auth/logout`.
   - Exportar desde `documentation/schemas/index.ts` (`export * from './auth'`).

14. **Tests** — Unitarios para `lib/oauth/`, `lib/session/`, `lib/pkce/`. Integración para los endpoints en `tests/integration/auth/`.

## Decisiones

- **`@hapi/iron` para sesiones** — Cifrado simétrico autenticado sin necesidad de almacén externo; la sesión es stateless. Se descarta JWT en cookie porque requeriría rotación de claves más compleja para revocar sesiones individuales.
- **PKCE obligatorio** — Mitiga ataques de intercepción del código incluso en flujos server-side. El proveedor puede no requerirlo pero se envía siempre.
- **Cookie temporal para `state` y `code_verifier`** — Evitar almacenar en Redis para este flujo de corta vida (< 5 min). Si el volumen de logins simultáneos creciera mucho, se migraría a Redis.
- **`findOrSyncByOAuth` en lugar de registro explícito** — El proveedor OAuth es el origen de verdad. El sistema crea el usuario local automáticamente en el primer login.

## Riesgos

- **Proveedor sin JWKS** — `verifyIdToken` requiere JWKS para validar la firma. Si el proveedor no lo expone, se debe configurar la clave pública manualmente. **Mitigación:** documentar en `.env.example` y lanzar error claro al inicio si falta.
- **Rotación de `SESSION_SECRET`** — Cambiar el secreto invalida todas las sesiones activas. **Mitigación:** implementar soporte para doble secreto (actual + anterior) en la función `decrypt`.
- **Expiración del `state`** — La cookie temporal puede expirar si el usuario tarda en autenticarse en el proveedor. **Mitigación:** fijar TTL de 10 minutos y devolver error descriptivo en el callback.
