# Roadmap

_Orden y estado de las features. Es la vista de "qué hay hecho, qué toca ahora y qué viene". Cada entrada apunta a su carpeta en `features/`._

## Hecho ✅

_Features completadas, en orden de implementación._

1. **000 · Modelado de Base de Datos Core** — Creación del esquema Prisma multi-tenant (organizaciones, usuarios, RBAC) como base fundacional.
2. **001 · Pipeline Spec-Driven (SDD)** — Configuración del middleware `parser.js` para validación automática contra contratos OpenAPI.
3. **002 · Autenticación Core (Login)** — Flujo OAuth 2.0 Authorization Code + PKCE con sesiones cifradas en cookies HttpOnly mediante `@hapi/iron`, callback, refresh, logout y documentación OpenAPI completa.

## Siguiente 🔜

_Lo próximo a abordar. Idealmente una sola feature "en curso" a la vez._

## Backlog / ideas 💡

_Sin comprometer ni ordenar del todo. Ideas que respetan la constitución._

- **Gestión de Usuarios y Perfiles** — CRUD de cuentas de personal y clientes con asignación de roles y sedes.
- **Árbol de Permisos y Menús (RBAC)** — Generación dinámica de la navegación UI basada estrictamente en los permisos del usuario.
- **Motor Agnóstico de Reservas** — Catálogo de recursos y control transaccional en PostgreSQL para evitar solapamiento de horarios.

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `spec.md`, `plan.md` y `tasks.md` antes de tocar código.
