# 014 · Autenticación móvil nativa — Tareas

## Revisión ROPC (reemplaza la versión Authorization Code de esta feature)

- [x] `keycloak/realm-canchago.json`: `canchago-mobile.directAccessGrantsEnabled = true`.
- [x] `lib/oauth/index.ts`: nueva `passwordGrant`; `exchangeCode` revertido a su forma simple; `verifyIdToken` con `nonce` opcional.
- [x] Eliminar `pages/api/auth/mobile/token.ts`, `validations/auth/mobile-token.validation.ts`, `tests/integration/auth/mobile-token.test.ts`.
- [x] `validations/auth/mobile-login.validation.ts` nuevo.
- [x] `pages/api/auth/mobile/login.ts` nuevo, con mensaje de error genérico (nunca el de Keycloak).
- [x] `lib/config/env.ts`: eliminar `OAUTH_MOBILE_REDIRECT_URI` (sin uso).
- [x] `.env` / `.env.example`: actualizar comentarios y quitar la variable eliminada.

## Documentación Swagger (obligatorio)

- [x] Reemplazar `MobileTokenRequest/Response` por `MobileLoginRequest/Response` en `documentation/schemas/auth.ts`.
- [x] Registrar `POST /auth/mobile/login`, con la advertencia del riesgo ROPC en la descripción.
- [x] Verificar en `GET /api/docs`.

## Validación real (obligatoria antes de marcar la feature como hecha)

- [x] Recrear Keycloak (`docker compose down && up -d`) para tomar `directAccessGrantsEnabled`.
- [x] `POST /api/auth/mobile/login` con `futbolista`/`canchago123` real → `sessionToken` válido, sin ningún navegador.
- [x] `GET /api/auth/session`, `POST /api/auth/refresh` con ese Bearer → funcionan.
- [x] Contraseña incorrecta → `401` con mensaje genérico en español, sin filtrar el texto de Keycloak.
- [x] `POST /api/auth/logout` con Bearer → `204`, y el mismo token reenviado después → `401`.
- [x] Flujo de cookie del cliente web (`canchago-api`) sigue funcionando sin cambios (regresión).

## Tests

- [x] `tests/integration/auth/mobile-login.test.ts`: camino feliz, validación de body, credenciales incorrectas con mensaje genérico (3 tests).
- [x] `tests/integration/auth/session.test.ts`: caso Bearer (heredado de la versión anterior, sigue vigente).

## Cierre

- [x] `yarn lint && yarn typecheck && yarn test` — sin errores nuevos (los 19 fallos de `roles-permisos.test.ts` son preexistentes, confirmado con `git stash`, no relacionados).
- [x] Roadmap actualizado con la revisión.
