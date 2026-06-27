# 002 · Autenticación Core (Login)

**Estado:** en curso

## Qué hace

Permite que los usuarios inicien sesión en la plataforma mediante OAuth 2.0 Authorization Code Flow con PKCE. Una vez autenticados, reciben una cookie de sesión cifrada que identifica y autoriza sus solicitudes posteriores. También cubre la renovación de sesión y el cierre de sesión.

Endpoints expuestos:

```
GET  /api/auth/login     → redirige al proveedor OAuth
GET  /api/auth/callback  → procesa el código, crea la sesión
GET  /api/auth/session   → devuelve los datos del usuario autenticado
POST /api/auth/refresh   → renueva la sesión antes de que expire
POST /api/auth/logout    → invalida y elimina la cookie de sesión
```

## Por qué

Es la puerta de entrada al sistema. Sin autenticación no existe autorización, y sin autorización ningún endpoint protegido puede operar de forma segura. Debe completarse antes que cualquier feature que requiera identidad de usuario.

## Criterios de aceptación

### Documentación (obligatorio)

- [ ] Todos los endpoints `/api/auth/*` están registrados en `documentation/schemas/auth.ts` mediante `registry.registerPath()`.
- [ ] Los schemas de respuesta de sesión (`SessionResponseSchema`) y de error (`ErrorResponseSchema`) están registrados con `registry.registerComponent()`.
- [ ] `documentation/schemas/auth.ts` está exportado desde `documentation/schemas/index.ts`.
- [ ] Los endpoints aparecen en `GET /api/docs` con tag `Auth`, security vacía en los públicos (`/login`, `/callback`) y `cookieAuth` en los protegidos.

### Comportamiento

- [ ] `GET /api/auth/login` redirige al proveedor OAuth con `state`, `code_challenge` y `code_challenge_method=S256`.
- [ ] `GET /api/auth/callback` valida `state`, intercambia el código por tokens, verifica firma/issuer/audience/expiración y crea la sesión interna.
- [ ] La cookie de sesión se establece con `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` y tiempo de expiración.
- [ ] `GET /api/auth/session` devuelve `{ data: { id, email, name, roles, permissions } }` para sesiones válidas y `401` si la cookie no existe o es inválida.
- [ ] `POST /api/auth/refresh` renueva la sesión cuando el access token está próximo a expirar y devuelve `204`.
- [ ] `POST /api/auth/logout` elimina la cookie y devuelve `204`.
- [ ] Un proveedor con OpenID Connect devuelve `nonce` validado durante el callback.
- [ ] Intentos de reuso del mismo `state` o `code` devuelven `400`.
- [ ] Los endpoints `/login` y `/callback` no requieren autenticación previa (son públicos).
- [ ] Ningún token, cookie completa, código OAuth ni secreto aparece en los logs.

## Fuera de alcance

- Autenticación con usuario/contraseña local (queda excluida por `constitution/tech-stack.md`).
- OAuth 2.0 Implicit Flow o Resource Owner Password Credentials.
- Gestión administrativa de usuarios (eso es la feature **003**).
- Registro de nuevos usuarios desde la aplicación; el proveedor OAuth es el origen de verdad de la identidad.
