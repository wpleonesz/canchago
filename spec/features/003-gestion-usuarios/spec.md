# 003 · Gestión de Usuarios

**Estado:** propuesta

## Qué hace

Permite a los administradores gestionar las cuentas de usuario de la plataforma mediante un CRUD completo:

```
GET    /api/users              → lista paginada y filtrable de usuarios
POST   /api/users              → crea un nuevo usuario
GET    /api/users/:userId      → devuelve un usuario por ID
PATCH  /api/users/:userId      → actualiza datos del usuario
DELETE /api/users/:userId      → desactiva el usuario (soft delete)
```

Cada usuario puede tener roles asignados y un estado activo/inactivo que controla si puede autenticarse.

## Por qué

La gestión de usuarios es una operación central de back-office para cualquier organización en la plataforma. Sin ella, los administradores no pueden incorporar personal, revocar accesos ni gestionar perfiles. Depende de la feature **002** (autenticación) para proteger los endpoints.

## Criterios de aceptación

### Documentación (obligatorio)

- [ ] Todos los endpoints `/api/users/*` están registrados en `documentation/schemas/users.ts` mediante `registry.registerPath()`.
- [ ] Los schemas `UserResponse`, `CreateUserBody`, `UpdateUserBody`, `UserListResponse` y `UserQueryParams` están registrados con `registry.registerComponent()`.
- [ ] `documentation/schemas/users.ts` está exportado desde `documentation/schemas/index.ts`.
- [ ] Los endpoints aparecen en `GET /api/docs` con tag `Users`, `cookieAuth` en todos y los permisos requeridos documentados en `description`.

### Comportamiento

- [ ] `GET /api/users` devuelve `{ data: [...], meta: { page, pageSize, total, totalPages } }` con paginación por defecto de 20 registros.
- [ ] El listado admite filtros por `organizationId`, `active` y búsqueda parcial por `name` o `email`; los campos de filtro están validados contra una lista permitida.
- [ ] El listado admite ordenamiento por `name`, `email` y `createdAt`; el campo de ordenamiento está validado.
- [ ] `POST /api/users` crea el usuario, devuelve `201` con `{ data: { id, email, name, active, createdAt } }` y no expone campos internos (`oauthSubject`, hash de contraseñas si aplica).
- [ ] `GET /api/users/:userId` devuelve `{ data: { id, email, name, active, roles, createdAt, updatedAt } }` o `404` si no existe.
- [ ] `PATCH /api/users/:userId` actualiza solo los campos enviados (partial update); devuelve `200` con el usuario actualizado.
- [ ] `DELETE /api/users/:userId` realiza soft delete (`active = false`, `deletedAt = now()`); devuelve `204`.
- [ ] Todos los endpoints requieren autenticación (`middleware/auth`) y el permiso correspondiente: `users.read`, `users.create`, `users.update`, `users.delete`.
- [ ] Un usuario sin los permisos requeridos recibe `403`.
- [ ] Intentar actualizar o eliminar un usuario que no existe devuelve `404`.
- [ ] Crear un usuario con `email` duplicado devuelve `409`.
- [ ] Los listados no devuelven usuarios con `deletedAt` establecido.
- [ ] El endpoint aplica rate limiting.

## Fuera de alcance

- Asignación de roles y permisos (feature separada: **RBAC y Árbol de Permisos**).
- Restablecimiento de contraseña (la autenticación es OAuth; no hay contraseñas locales).
- Gestión de perfiles por el propio usuario (esto es administración back-office).
- Invitaciones por correo electrónico (puede ser una feature posterior).
