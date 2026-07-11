# 008 · Entorno de Demostración de Autenticación y Autorización

## Qué

Dejar operativo, de punta a punta y sin código inventado, el flujo de **inicio de sesión y cierre de sesión** que ya construyó la feature 002 (OAuth 2.0 Authorization Code + PKCE), y sembrar los **roles base del dominio** (Futbolista, Gestor de Cancha, Administrador) para poder demostrar autenticación y autorización sobre la API real.

## Por qué

La feature 002 quedó implementada pero **nunca fue ejecutable**: el `.env` apunta a un Identity Provider ficticio (`https://provider.example.com`) y los interruptores `BYPASS_AUTH` / `BYPASS_ACCESS_CONTROL` están encendidos, de modo que hoy la API responde con un usuario ficticio `dev-user` y deja pasar cualquier permiso.

Sin un IdP real no existe login posible: `GET /api/auth/login` no recibe credenciales, sólo redirige (302) al proveedor. Esta feature aporta el IdP real que faltaba y los datos base, sin modificar la lógica de autenticación ya construida.

## Alcance

### Dentro

- Identity Provider **Keycloak** local vía Docker Compose, con realm, cliente OIDC (confidencial, PKCE S256) y usuarios de prueba importados de forma reproducible.
- Configuración de `.env` / `.env.example` apuntando al IdP real.
- Semilla idempotente (`prisma/seed-dev.ts`) de los tres roles del dominio.
- Script idempotente de asignación de rol a usuario **respetando el alcance** (`organizationId` / `venueId`).
- Guía ejecutable de login y logout para uso en clase.

### Fuera

- **No** se implementa login por usuario/contraseña propio. El campo `User.passwordHash` existe en el schema pero ningún módulo lo lee ni lo escribe; introducir credenciales locales sería una feature nueva y contradice §10 de la constitución (OAuth 2.0 + PKCE obligatorio).
- **No** se otorgan permisos a los roles. Los roles nacen sin permisos, de forma deliberada, para poder demostrar el paso de 403 → 200 al concederlos después.
- **No** se modifica la lógica de `middleware/auth.ts`, `middleware/access.ts`, `lib/oauth/` ni `lib/session/`.

## Modelo de roles

El schema ya distingue dos conceptos, y el dominio de Canchago los usa así:

| Rol | `Role.organizationId` (dueño de la definición) | `UserRole.organizationId` (alcance de la asignación) |
|---|---|---|
| **Futbolista** | `null` — rol global de plataforma | `null` — puede reservar en cualquier organización |
| **Administrador** | `null` — rol global de plataforma | `null` — alcance total, no ligado a un tenant |
| **Gestor de Cancha** | organización dueña | esa organización, opcionalmente una sede concreta |

## Criterios de aceptación

1. `docker compose up -d` deja un Keycloak accesible con el realm `canchago` y el cliente `canchago-api` configurado con PKCE `S256` obligatorio.
2. `yarn seed` deja el catálogo de permisos poblado; `yarn seed-dev` deja exactamente los tres roles creados, y **ejecutarlo dos veces no duplica nada**.
3. Con `BYPASS_AUTH=false`, `GET /api/auth/session` sin cookie responde **401**.
4. `GET /api/auth/login` en el navegador redirige a Keycloak; tras autenticarse, el callback valida `state`, `nonce`, firma, issuer y audiencia, crea el usuario en Canchago vía `findOrSyncByOAuth` y deja una cookie de sesión cifrada.
5. `GET /api/auth/session` con esa cookie responde **200** con `id`, `email`, `name`, `roles` y `permissions` del usuario.
6. Con `BYPASS_ACCESS_CONTROL=false`, un usuario con rol **Futbolista** (sin permisos) que llame a `GET /api/users` recibe **403** con `Missing permissions: users.read`.
7. `POST /api/auth/logout` responde **204**, revoca el token en Keycloak y borra la cookie; una llamada posterior a `GET /api/auth/session` responde **401**.

## Riesgos y trampas conocidas

- **Colisión de email en el primer login.** `findOrSyncByOAuth` enlaza al usuario por `authAccount(provider, sub)`. Un usuario creado antes vía `POST /api/users` no tiene `authAccount`, así que en su primer login el callback intenta crear otro usuario con el mismo email y falla por unicidad (P2002). El orden correcto es: crear el usuario **en el IdP** → iniciar sesión → Canchago lo crea solo → asignar rol.
- **Unicidad de roles globales.** `@@unique([organizationId, name])` no impide duplicar roles globales, porque en PostgreSQL los `NULL` se consideran distintos entre sí. La semilla debe ser idempotente por búsqueda explícita, nunca confiar en la restricción única.
- **Roles globales no son creables por API.** `POST /api/roles` exige `organizationId` como UUID obligatorio en su Zod, y `roleDb.getRoles` filtra por `organizationId`. Futbolista y Administrador sólo pueden crearse por semilla y no aparecen en el listado del endpoint.
