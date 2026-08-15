# 014 · Autenticación móvil nativa — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque (revisado — ver "Revisión" en spec.md)

Reutilizar `sessionService`, `encrypt`/`decrypt`, `findOrSyncByOAuth`, `verifyIdToken` — igual que la versión anterior de esta feature. El único cambio real es *cómo* se obtienen los tokens de Keycloak: `grant_type=password` (ROPC) en vez de `grant_type=authorization_code` (PKCE). Todo lo demás (sesión, Bearer, refresh, logout, `clientId` guardado por sesión) es idéntico.

## Implementación

1. **`keycloak/realm-canchago.json`** — `canchago-mobile.directAccessGrantsEnabled = true`. `canchago-api` no se toca.
2. **`lib/oauth/index.ts`** — nueva función `passwordGrant(username, password)` (POST a `OAUTH_TOKEN_URL`, `grant_type=password`, `client_id=OAUTH_MOBILE_CLIENT_ID`, sin `Authorization: Basic`). `exchangeCode` se revirtió a su forma simple original (ya no necesita soportar clientes públicos — eso solo lo usaba el endpoint de code-exchange, que se eliminó). `verifyIdToken` ahora trata `nonce` como opcional en `OAuthMetadata` — ROPC no lo tiene.
3. **`validations/auth/mobile-login.validation.ts`** (reemplaza a `mobile-token.validation.ts`) — `{ username: string().min(1), password: string().min(1) }`.
4. **`pages/api/auth/mobile/login.ts`** (reemplaza a `mobile/token.ts`) — valida body, `passwordGrant`, mapea cualquier error a un `401` genérico en español (nunca el detalle de Keycloak), `verifyIdToken` sin `nonce`, `findOrSyncByOAuth`, `sessionService.create` con `clientId`, sella y devuelve `sessionToken`.
5. **`lib/config/env.ts`** — se elimina `OAUTH_MOBILE_REDIRECT_URI` (sin uso: ROPC no redirige a ningún lado). `OAUTH_MOBILE_CLIENT_ID` se mantiene.
6. **`documentation/schemas/auth.ts`** — reemplaza `MobileTokenRequest/Response` por `MobileLoginRequest/Response`, y el `registry.registerPath()` de `/auth/mobile/login`, con la advertencia del riesgo ROPC en la descripción (visible en `/api/docs` para que quede documentado, no escondido).
7. **Tests** — `tests/integration/auth/mobile-token.test.ts` eliminado, `tests/integration/auth/mobile-login.test.ts` nuevo (camino feliz, validación de body, credenciales incorrectas con mensaje genérico).

## Decisiones

- **ROPC solo para `canchago-mobile`, nunca para `canchago-api`** — el cliente web sigue con el estándar de la industria (Authorization Code + PKCE); el riesgo se acota al mínimo necesario, no se generaliza.
- **Mensaje de error genérico, nunca el texto real de Keycloak** — evita enumeración de cuentas y no expone detalles internos del IdP, consistente con AGENTS.md §10 ("no exponer... detalles internos al cliente").
- **`nonce` opcional en `verifyIdToken` en vez de una segunda función de verificación** — ROPC y Authorization Code comparten toda la lógica de verificación de firma/issuer/audience; solo difieren en si hay `nonce` que comprobar. Una función con un campo opcional es más simple que duplicar la función entera.
- **Se eliminó el código de la versión anterior (Authorization Code para móvil) en vez de dejarlo en paralelo** — el usuario pidió reemplazar el flujo, no añadir una alternativa; dejar ambos habría sido superficie de auth muerta y confusión sobre cuál usa la app.

## Riesgos (heredados y nuevos de ROPC)

- **La contraseña pasa por el código de la app y por este endpoint** — a diferencia de Authorization Code, donde solo Keycloak la ve. Mitigación parcial: HTTPS obligatorio en producción (ver `.env.production` del frontend), la contraseña nunca se loguea ni se persiste, solo se reenvía a Keycloak y se descarta.
- **Sin protección CSRF/replay adicional** — ROPC es una llamada API directa, no un handshake de redirección; no aplica el mismo modelo de amenaza que Authorization Code, pero tampoco sus mismas protecciones (no hay `state` que validar). Mitigación: HTTPS + rate limiting de Keycloak a nivel de realm (no verificado en esta feature, ver Fuera de alcance).
- **MFA/social login futuro requeriría reabrir esta decisión** — ROPC no tiene forma limpia de soportarlos. Documentado explícitamente para que no sea sorpresa más adelante.
