# Plan técnico — 008

## Decisiones tomadas

### IdP: Keycloak local en Docker

El código de `lib/oauth/` ya implementa exactamente lo que Keycloak expone: authorization endpoint, token endpoint con `client_secret_basic`, verificación de ID token contra **JWKS remoto**, validación de `nonce`, refresh y revocación. No hay que escribir ni una línea de OAuth: sólo apuntar el `.env`.

Se descartó Google/Auth0 porque no permiten dar de alta usuarios de prueba bajo control del docente ni demostrar revocación con el mismo comportamiento que espera el código.

### Realm importado, no configurado a mano

El realm se declara en `keycloak/realm-canchago.json` y Keycloak lo importa al arrancar. Así el entorno es reproducible por cualquier alumno con un solo comando y queda versionado (la constitución prohíbe versionar secretos reales, pero éste es un IdP de desarrollo local con credenciales de juguete).

### Semilla en `prisma/seed-dev.ts`

`package.json` ya declara `"seed-dev": "tsx prisma/seed-dev.ts"`, pero **el archivo nunca existió**. Se crea ahí, sin inventar un script nuevo.

Idempotencia por búsqueda explícita (`findFirst`), no por `upsert`: la restricción `@@unique([organizationId, name])` no protege a los roles globales porque PostgreSQL trata cada `NULL` como distinto.

### Reutilización de datos existentes

La base ya tiene la organización **"Cancha 2"** (`636a6008-…`) y su sede **"Sede Principal"** (`9d2a6897-…`). Se reutilizan como tenant de demostración para el rol Gestor de Cancha en lugar de crear una organización nueva.

## Configuración OAuth resultante

| Variable | Valor |
|---|---|
| `OAUTH_ISSUER` | `http://localhost:8080/realms/canchago` (sin barra final: es el `iss` exacto que emite Keycloak) |
| `OAUTH_AUTHORIZATION_URL` | `…/protocol/openid-connect/auth` |
| `OAUTH_TOKEN_URL` | `…/protocol/openid-connect/token` |
| `OAUTH_JWKS_URL` | `…/protocol/openid-connect/certs` |
| `OAUTH_REVOCATION_URL` | `…/protocol/openid-connect/revoke` |
| `OAUTH_SUCCESS_REDIRECT_URL` | `http://localhost:3000/api/auth/session` — tras el login el alumno ve su sesión al instante |
| `BYPASS_AUTH` / `BYPASS_ACCESS_CONTROL` | `false` — sin esto no hay 401 ni 403 que mostrar |

`verifyIdToken` compara `issuer` y `audience` de forma estricta; el `aud` del ID token de Keycloak es el `client_id`, que coincide con `OAUTH_CLIENT_ID`.

## Notas de comportamiento

- Las cookies se emiten con `Secure` siempre (`lib/session/index.ts`). Los navegadores aceptan cookies `Secure` sobre `http://localhost` por considerarlo origen confiable, así que el flujo funciona en local sin TLS. `curl`, en cambio, no reenvía una cookie `Secure` sobre HTTP desde su cookie jar: en los ejemplos se pasa la cookie con `-H "Cookie: …"`, que sí se envía siempre.
- `SameSite=Lax` permite que la cookie temporal de `state`/PKCE viaje en el redirect de vuelta desde Keycloak, porque es una navegación GET de primer nivel.

## Orden de ejecución

1. `docker compose up -d` → Keycloak con realm y usuarios.
2. `yarn seed` → catálogo de permisos (hoy vacío).
3. `yarn seed-dev` → los tres roles.
4. Login en el navegador → Canchago crea el usuario solo.
5. `yarn asignar-rol` → asigna el rol con su alcance.
6. Repetir 4–5 para el gestor y el administrador.
