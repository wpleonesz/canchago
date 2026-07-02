# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en_ _`features/`._

## Hecho ✅

_Features completadas, en orden de implementación._

1. **000 · Modelado de Base de Datos Core** — Creación del esquema Prisma multi-tenant (organizaciones, usuarios, RBAC) como base fundacional.
2. **001 · Pipeline Spec-Driven (SDD)** — Configuración del middleware `parser.js` para validación automática contra contratos OpenAPI.
3. **002 · Autenticación Core (Login)** — Flujo OAuth 2.0 Authorization Code + PKCE con sesiones cifradas en cookies HttpOnly mediante `@hapi/iron`, callback, refresh, logout y documentación OpenAPI completa.
4. **003 · Gestión de Usuarios** — CRUD completo de usuarios (GET, POST, PATCH, DELETE) con paginación, búsqueda, filtros, ordenamiento, soft delete, validación de permisos y documentación OpenAPI.
5. **004 · Gestión de Organizaciones y Sedes** — CRUD completo para organizaciones (tenants) y sedes (venues/ubicaciones) con relación 1:N, paginación, filtros, soft delete, validación, autorización basada en permisos (`organizaciones.read`/`organizaciones.manage`), transacciones en eliminación en cascada y documentación OpenAPI completa.
6. **005 · Gestión de Roles y Permisos** — CRUD completo de roles por organización, catálogo global de permisos, asignación M:N de permisos a roles, soft delete transaccional, paginación, autorización basada en permisos (`roles.read`/`roles.manage`) y documentación OpenAPI completa.
7. **006 · Asignación de Roles a Usuarios por Organización** — Endpoints para asignar roles a usuarios en creación o actualización, listar, agregar y remover roles específicos con validación de integridad referencial, transacciones ACID, autorización basada en permisos (`users.manage`/`users.read`), y documentación OpenAPI completa.

## Siguiente 🔜

_Lo próximo a abordar. Idealmente una sola feature "en curso" a la vez._

_Por definir próxima feature según prioridades del proyecto._

## Backlog / ideas 💡

_Sin comprometer ni ordenar del todo. Ideas que respetan la constitución._

- **Motor Agnóstico de Reservas** — Catálogo de recursos y control transaccional en PostgreSQL para evitar solapamiento de horarios.

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `spec.md`, `plan.md` y `tasks.md` antes de tocar código.
