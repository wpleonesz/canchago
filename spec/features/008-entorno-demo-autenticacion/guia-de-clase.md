# Guía de clase — Autenticación y Autorización en Canchago

> Todo lo de abajo fue ejecutado y verificado contra la API real. No hay pseudocódigo.

> 👉 **Para dar la clase, usa [practica-swagger.md](./practica-swagger.md):** es la misma historia en 9 pasos, hecha íntegramente desde `/api/docs`, sin `curl` y sin escribir código. Este documento es la referencia técnica de respaldo.

## Idea central que deben entender los alumnos

Canchago **nunca ve la contraseña**. No existe un endpoint que reciba usuario y clave. El backend delega la identidad a un **Identity Provider** (Keycloak) mediante OAuth 2.0 Authorization Code + PKCE:

```
Navegador          Canchago (backend)              Keycloak (IdP)
    │                     │                             │
    │  GET /api/auth/login│                             │
    ├────────────────────>│  genera state + PKCE        │
    │                     │  los guarda en cookie temporal cifrada
    │<────────302─────────┤                             │
    │                                                   │
    │  el usuario tipea su clave AQUÍ, no en Canchago   │
    ├──────────────────────────────────────────────────>│
    │<─────────────302 con ?code=… &state=… ────────────┤
    │                     │                             │
    │ GET /api/auth/callback?code=…                     │
    ├────────────────────>│  valida state               │
    │                     │  canjea code + code_verifier│
    │                     ├────────────────────────────>│
    │                     │<────── access + id token ───┤
    │                     │  verifica firma (JWKS),     │
    │                     │  issuer, audience y nonce   │
    │                     │  crea/sincroniza el usuario │
    │<── cookie de sesión cifrada (HttpOnly, Secure) ───┤
```

La contraseña viaja al IdP. Canchago sólo recibe un **código de un solo uso** y lo canjea por tokens.

---

## 0. Levantar el entorno

```bash
docker compose up -d      # Keycloak en http://localhost:8081 (admin/admin)
yarn seed                 # catálogo de permisos
yarn seed-dev             # roles: Futbolista, Administrador, Gestor de Cancha
yarn dev                  # API en http://localhost:3000
```

Usuarios ya cargados en Keycloak (contraseña `canchago123` en los tres):

| Usuario | Email | Para el rol |
|---|---|---|
| `futbolista` | futbolista@canchago.local | Futbolista |
| `gestor` | gestor@canchago.local | Gestor de Cancha |
| `administrador` | administrador@canchago.local | Administrador |

En `.env` deben estar `BYPASS_AUTH=false` y `BYPASS_ACCESS_CONTROL=false`. Si están en `true`, la API inventa un usuario ficticio y no hay 401 ni 403 que mostrar.

---

## 1. Sin sesión no se entra (401)

```bash
curl -i http://localhost:3000/api/auth/session
```

```
HTTP/1.1 401 Unauthorized
{"error":{"code":"UNAUTHORIZED","message":"Missing session cookie"}}
```

---

## 2. Iniciar sesión

Abrir en el navegador:

```
http://localhost:3000/api/auth/login
```

Redirige a Keycloak → el alumno se autentica como `futbolista` / `canchago123` → Keycloak devuelve al callback → Canchago deja la cookie de sesión y muestra la sesión.

**Qué mostrar en clase (DevTools → Network):**

- La redirección lleva `code_challenge_method=S256`: eso es PKCE.
- La cookie `canchago_oauth_state` guarda `state`, `nonce` y `code_verifier` **cifrados**.
- La cookie final `canchago_session` sale con `HttpOnly; Secure; SameSite=Lax`. `HttpOnly` significa que **JavaScript no puede leerla**: ésa es la defensa contra XSS.

El usuario **no existía** en la base de Canchago: lo creó el callback en su primer login (`findOrSyncByOAuth`), enlazándolo al IdP por `authAccount(provider, sub)`.

---

## 3. Ver la sesión (200)

```bash
curl -i http://localhost:3000/api/auth/session -H "Cookie: canchago_session=<valor>"
```

```json
{
  "data": {
    "id": "c5e6374e-4552-404f-a61c-cb72b4a45fbc",
    "email": "futbolista@canchago.local",
    "name": "Mateo Vera",
    "roles": [],
    "permissions": []
  }
}
```

Recién autenticado: **está autenticado pero no autorizado a nada**. Ésa es exactamente la distinción que quieres enseñar.

---

## 4. Asignar el rol

```bash
yarn asignar-rol --email futbolista@canchago.local --rol futbolista
```

El rol **Futbolista** es global: se asigna sin organización, porque un futbolista puede jugar en cualquiera.

Para el gestor, el alcance sí importa — queda atado a su organización, y opcionalmente a una sede:

```bash
yarn asignar-rol --email gestor@canchago.local --rol gestor-de-cancha
yarn asignar-rol --email gestor@canchago.local --rol gestor-de-cancha --sede 9d2a6897-3c6d-4ccd-8e7f-1bbdc5e01605
```

> **Nota:** desde la feature 009 el rol aparece **de inmediato**, sin cerrar sesión: la cookie sólo lleva un id de sesión, y los roles se leen de la base en cada petición.

Al consultar la sesión:

```json
"roles": [{ "code": "futbolista", "name": "Futbolista" }],
"permissions": []
```

---

## 5. Autorización: tener rol ≠ tener permiso (403)

```bash
curl -i "http://localhost:3000/api/roles?organizationId=636a6008-f2eb-46f3-8c71-ab116e05c2a9" \
  -H "Cookie: canchago_session=<valor>"
```

```
HTTP/1.1 403 Forbidden
{"error":{"code":"FORBIDDEN","message":"Missing permissions: roles.read"}}
```

**401 vs 403 — la diapositiva clave:**

| | Significa | Middleware |
|---|---|---|
| **401** | No sé quién eres | `auth` |
| **403** | Sé quién eres, pero no puedes | `access` |

En cuanto le concedas el permiso `roles.read` al rol Futbolista, ese mismo `curl` responde **200** — sin necesidad de volver a iniciar sesión. (Verificado.)

---

## 6. Cerrar sesión

```bash
curl -i -X POST http://localhost:3000/api/auth/logout -H "Cookie: canchago_session=<valor>"
```

```
HTTP/1.1 204 No Content
Set-Cookie: canchago_session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/
```

### El logout invalida la sesión de verdad

Hace tres cosas: revoca el refresh token en Keycloak, **marca la sesión como revocada** en `user_sessions`, y borra la cookie.

Si copias el **valor** de la cookie antes del logout y lo reenvías a mano con `curl -H "Cookie: …"`, la API responde **`401 Session revoked or expired`**. La cookie sigue siendo criptográficamente válida, pero el servidor ya no reconoce esa sesión.

> Esto **no** era así al principio: la sesión iba entera dentro de la cookie y el logout era cosmético. Ver la feature 009.
