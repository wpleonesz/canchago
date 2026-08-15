# 014 · Autenticación móvil nativa (cliente público + Bearer token)

**Estado:** implementado ✅

## Revisión 2026-08-14 — de Authorization Code a Resource Owner Password Credentials

Esta feature se implementó originalmente con Authorization Code + PKCE + navegador in-app (Custom Tabs/SFSafariViewController) para el cliente móvil, validada end-to-end. El usuario, tras verla funcionando, pidió explícitamente **reemplazarla**: quiere que la app móvil capture usuario y contraseña en un formulario nativo propio (estilo Facebook), no que abra una pantalla de Keycloak aparte. Eso es técnicamente Resource Owner Password Credentials (ROPC) — el grant que `AGENTS.md` §10 prohíbe por defecto ("Nunca... Resource Owner Password"). Se le explicó la tensión explícitamente (contraseña expuesta al código de la app, pérdida de compatibilidad fácil con MFA/social login futuro) y **confirmó que quiere asumir ese riesgo** para el cliente móvil únicamente. El cliente web (`canchago-api`) no cambia: sigue exigiendo Authorization Code + PKCE sin excepción.

Lo que queda de la versión Authorization Code: nada en código (se eliminó `pages/api/auth/mobile/token.ts` y la generalización de `exchangeCode` para clientes públicos, que quedaban sin uso). Este documento describe la versión ROPC, que es la que está implementada hoy.

## Qué hace

Habilita `directAccessGrantsEnabled: true` **únicamente** en el cliente público `canchago-mobile` de Keycloak, y expone `POST /api/auth/mobile/login` para que la app móvil `canchago-ionic` mande usuario/contraseña directo desde un formulario nativo y reciba un **token de sesión opaco en el body JSON** — sin cookie, sin navegador externo, sin redirección. `middleware/auth.ts` acepta ese token vía `Authorization: Bearer <token>` como alternativa a la cookie, resolviendo exactamente la misma tabla `user_sessions` que ya usa el flujo web.

## Por qué

Decisión de producto explícita del usuario: quiere que el login de la app móvil se sienta 100% nativo (campos de usuario/contraseña propios de la app), no una redirección a una pantalla externa de Keycloak. Ver la Revisión arriba para el detalle completo de la conversación y el riesgo aceptado.

## Contrato de API

```
POST /api/auth/mobile/login
Body: { "username": string, "password": string }
```

- Sin autenticación previa.
- Llama a Keycloak con `grant_type=password` (ROPC), cliente público `canchago-mobile`, sin `client_secret`.
- Si Keycloak rechaza las credenciales, responde `401` con un mensaje genérico en español (`"Usuario o contraseña incorrectos."`) — **nunca** el `error_description` real de Keycloak (evita filtrar detalles y enumeración de cuentas).
- Verifica el `id_token` devuelto (firma, issuer, audience = `canchago-mobile`) — **sin `nonce`**: ROPC no tiene handshake de redirección al que fijárselo (`verifyIdToken` ahora trata `nonce` como opcional, solo lo exige cuando el llamador lo pasa).
- Crea/sincroniza el usuario (`findOrSyncByOAuth`) y la sesión (`sessionService.create`, con `clientId: OAUTH_MOBILE_CLIENT_ID`) exactamente igual que el flujo web.
- Responde `{ "data": { "sessionToken": string, "expiresAt": string } }` — mismo payload sellado (`@hapi/iron`) que hoy viaja en la cookie del flujo web.

`middleware/auth.ts`, `/api/auth/refresh` y `/api/auth/logout` no cambiaron respecto a la versión anterior de esta feature — siguen resolviendo la sesión desde `Authorization: Bearer` o cookie indistintamente, y usando el `clientId` guardado en la sesión para saber con qué cliente hablarle a Keycloak al refrescar/revocar.

## Criterios de aceptación

- [x] `canchago-mobile` es el único cliente del realm con `directAccessGrantsEnabled: true`; `canchago-api` (web) sigue en `false`.
- [x] `POST /api/auth/mobile/login` con credenciales reales (`futbolista`/`canchago123`) devuelve un `sessionToken` válido — probado contra Keycloak y Postgres reales, sin ningún navegador de por medio.
- [x] `GET /api/auth/session`, `POST /api/auth/refresh`, `POST /api/auth/logout` funcionan con `Authorization: Bearer <sessionToken>`.
- [x] Tras `logout`, el mismo `sessionToken` reenviado responde `401`.
- [x] Credenciales incorrectas → `401` con mensaje genérico en español, **sin** el texto real de Keycloak (`"Invalid user credentials"` nunca llega al cliente), y sin crear sesión.
- [x] El flujo de cookie del cliente web (`canchago-api`) sigue funcionando sin cambios.

### Documentación (obligatorio)

- [x] `POST /api/auth/mobile/login` registrado en `documentation/schemas/auth.ts` vía `registry.registerPath()`, con la advertencia explícita del riesgo de ROPC en la descripción.
- [x] Schemas de entrada (`username`, `password`) y salida (`sessionToken`, `expiresAt`) registrados.
- [x] Visible y correcto en `GET /api/docs`.

## Fuera de alcance

- Cambiar el cliente web/confidencial existente — sigue Authorization Code + PKCE sin excepción.
- MFA/social login para el cliente móvil — ROPC no lo soporta bien; si se necesita en el futuro, requiere reabrir esta decisión.
- Bloqueo de fuerza bruta / rate limiting específico del login móvil (Keycloak tiene su propio `bruteForceProtected` a nivel de realm, no se tocó ni se verificó en esta feature).
- Cualquier cambio en `canchago-ionic` — vive en su propio repo (`canchago-ionic/spec/features/003-autenticacion-nativa/`).
