# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en_ _`features/`._

## Hecho ✅

_Features completadas, en orden de implementación._

1. **000 · Modelado de Base de Datos Core** — Creación del esquema Prisma multi-tenant (organizaciones, usuarios, RBAC) como base fundacional.
2. **001 · Pipeline Spec-Driven (SDD)** — Configuración del middleware `parser.js` para validación automática contra contratos OpenAPI.
3. **002 · Autenticación Core (Login)** — Flujo OAuth 2.0 Authorization Code + PKCE con sesiones cifradas en cookies HttpOnly mediante `@hapi/iron`, callback, refresh, logout y documentación OpenAPI completa.
4. **003 · Gestión de Usuarios** — CRUD completo de usuarios (GET, POST, PATCH, DELETE) con paginación, búsqueda, filtros, ordenamiento, soft delete, validación de permisos y documentación OpenAPI.

## Siguiente 🔜

_Lo próximo a abordar. Idealmente una sola feature "en curso" a la vez._

**Árbol de Permisos y Menús (RBAC)** — Generación dinámica de la navegación UI basada estrictamente en los permisos del usuario.

## Backlog / ideas 💡

_Sin comprometer ni ordenar del todo. Ideas que respetan la constitución._

- **Motor Agnóstico de Reservas** — Catálogo de recursos y control transaccional en PostgreSQL para evitar solapamiento de horarios.

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `spec.md`, `plan.md` y `tasks.md` antes de tocar código.
