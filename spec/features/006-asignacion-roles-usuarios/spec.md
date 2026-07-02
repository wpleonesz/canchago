# 006 · Asignación de Roles a Usuarios

**Estado:** propuesta

## Qué hace

Extiende la gestión de usuarios (feature 003) permitiendo asignar roles a usuarios al crear o editar. Los administradores pueden:

- Asignar uno o múltiples roles a un usuario al crearlo (`POST /api/users` con `roleIds[]`).
- Actualizar roles de un usuario existente (`PATCH /api/users/:userId` con `roleIds[]`).
- Ver los roles asignados al obtener detalles del usuario (`GET /api/users/:userId`).
- Listar, agregar o remover roles específicos de un usuario mediante endpoints dedicados.

## Por qué

Sin asignación de roles, los usuarios no pueden tener permisos en el sistema. Esto integra las features 003 (usuarios) y 005 (roles) para que la gestión de acceso sea completa: crear usuario → asignarle roles → heredar permisos de esos roles.

## Criterios de aceptación

- [ ] Tabla `UserRole` (M:N) creada en schema Prisma con restricciones de integridad referencial.
- [ ] `POST /api/users` acepta parámetro `roleIds[]` (opcional); si se proporciona, crea usuario + asigna roles en transacción.
- [ ] `PATCH /api/users/:userId` acepta parámetro `roleIds[]`; reemplaza roles previos en transacción.
- [ ] `GET /api/users/:userId` devuelve array `roles` con detalles (id, name, description).
- [ ] `GET /api/users/:userId/roles` devuelve roles paginados del usuario.
- [ ] `POST /api/users/:userId/roles` asigna nuevos roles al usuario (requiere permiso `users.manage`).
- [ ] `DELETE /api/users/:userId/roles/:roleId` remueve un rol específico.
- [ ] Validación: `roleIds` contra roles válidos de la organización del usuario; rechazar roles de otras orgs (422).
- [ ] Autorización: solo usuarios con permiso `users.manage` pueden asignar/modificar roles; `users.read` para ver.
- [ ] Transacciones: asignación/remoción de roles es atómica con creación/edición de usuario.
- [ ] Tests: unitarios para servicios, integración para endpoints nuevos y modificados.

### Documentación (obligatorio)

- [ ] Endpoints modificados y nuevos registrados en `documentation/schemas/users-roles.ts`.
- [ ] Schemas `UserResponse` actualizado para incluir `roles[]`.
- [ ] Schemas `CreateUserBody` y `UpdateUserBody` actualizados con `roleIds[]` (opcional).
- [ ] Nuevo schema `UserRole` (id, name, description, organizationId).
- [ ] Visible y correcto en `GET /api/docs`.

## Fuera de alcance

- Permisos derivados de roles (se resuelven en runtime según roles del usuario).
- Auditoría de cambios de rol (feature futura).
- Cambio de roles por el propio usuario (solo back-office).
