# Plan técnico — 009

## La cookie, antes y después

| | Antes | Después |
|---|---|---|
| Contenido | usuario + access + refresh + id token | `{ sessionId, createdAt }` |
| Tamaño (`Set-Cookie`) | **5.336 bytes** ❌ | **429 bytes** ✅ |
| ¿Funciona en Chrome? | **No** (la descarta en silencio) | Sí |
| ¿Se puede revocar? | No | Sí |
| Roles al asignarlos | exigían re-login | inmediatos |

## Arquitectura

```
cookie (429 B)          user_sessions                users / roles / permissions
{ sessionId } ──────► sealed_tokens (iron)          roles y permisos vigentes
                      expires_at, revoked_at
        │                     │                                │
        └──── middleware/auth ┴────────────────────────────────┘
                  resuelve la sesión en CADA petición
```

Capas, respetando la constitución:

- `database/sessions/` — queries Prisma (`create`, `findActive`, `updateTokens`, `revoke`).
- `services/auth/session.service.ts` — reglas: crear, resolver, rotar, revocar.
- `middleware/auth.ts` — descifra la cookie, saca el `sessionId`, pide la sesión al servicio.
- `lib/session/` — sellado con `@hapi/iron`, tanto de la cookie como del token set.

`findActive` filtra por `revokedAt: null` **y** `expiresAt > now()`: una sola consulta cubre revocación y caducidad.

## Decisiones

**Los tokens se guardan sellados, no en claro.** La columna `sealed_tokens` contiene el token set cifrado con `@hapi/iron` y el mismo `SESSION_SECRET`. Un volcado de la base no expone los tokens de Keycloak. Se usa `ttl: 0` en el sello (sin caducidad propia): la caducidad la gobierna `expires_at`, no el sello.

**El usuario se carga de la base en cada petición** (`getSessionUser`). Cuesta una consulta y a cambio la autorización deja de estar congelada en la cookie. Es el intercambio central de la feature y conviene enseñarlo tal cual.

**`refresh` ya no reemite la cookie.** Los tokens rotan en `user_sessions`; el `sessionId` no cambia.

## Migración

`prisma migrate dev` **se negó a correr**: la migración `20260630185000_add_roles_permissions_fields` fue modificada después de aplicarse (su checksum no cuadra), y Prisma exigía **resetear la base**, lo que habría borrado organizaciones, sedes, usuarios y roles.

Se evitó el reset: la SQL se escribió a mano en `prisma/migrations/20260711140000_.../migration.sql`, se aplicó con `$executeRawUnsafe` y se registró con `prisma migrate resolve --applied`. La tabla estaba vacía (0 filas), así que no hubo migración de datos.

> ⚠️ **La deriva sigue ahí.** El próximo `prisma migrate dev` volverá a pedir un reset. Hay que arreglar el checksum de esa migración antes de tocar el schema otra vez.

## Lo que NO se hizo

- Los códigos de permiso siguen inconsistentes (`users.read` en el middleware vs `usuarios.read` en el catálogo). `/api/users` responde 403 aunque se concedan todos los permisos.
- `yarn build` sigue roto por `role.db.ts` (`data: unknown`).
