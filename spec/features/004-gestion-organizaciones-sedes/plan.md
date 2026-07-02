# 004 · Gestión de Organizaciones y Sedes — Plan

_Implementación respetando la constitución._

## Enfoque

Agregar tablas `Organization` y `Sede` al schema Prisma con relación 1:N (una org, muchas sedes). Implementar endpoints siguiendo la convención de routes (index + [id]). Validar con Zod. Proteger con autorización basada en permisos. Registrar en OpenAPI.

## Implementación

1. **`prisma/schema.prisma`** — Agregar modelos `Organization` (nombre, email, teléfono, dominio, createdAt, updatedAt, deletedAt) y `Sede` (organizationId FK, nombre, dirección, teléfono, email, createdAt, updatedAt, deletedAt). Índices en nombres + organizationId para filtros rápidos. Soft delete con queries default.

2. **`validations/organizaciones-sedes/`** — Crear schemas Zod:
   - `CreateOrganizationInput`, `UpdateOrganizationInput`
   - `CreateSedeInput`, `UpdateSedeInput`
   - Validar email, teléfono, nombres no vacíos

3. **`database/organizaciones-sedes/`** — Encapsular queries Prisma:
   - `getOrganizations(filters, page, pageSize)`
   - `getOrganizationById(id)`
   - `createOrganization(data)`
   - `updateOrganization(id, data)`
   - `deleteOrganization(id)` (soft)
   - `getSedes(organizationId, filters, page, pageSize)`
   - `getSedeById(id)`
   - `createSede(organizationId, data)`
   - `updateSede(id, data)`
   - `deleteSede(id)` (soft)

4. **`services/organizaciones-sedes/`** — Lógica de negocio:
   - `createOrganization(data)` → valida unicidad, crea
   - `updateOrganization(id, data)` → valida, actualiza
   - `deleteOrganization(id)` → transacción: marca org + sedes como deleted
   - Equivalentes para sedes
   - Coordinación con cache (invalidar en cambios)

5. **`pages/api/organizaciones/index.ts`** — GET + POST (listar/crear organizaciones)

6. **`pages/api/organizaciones/[organizationId].ts`** — GET + PATCH + DELETE (detalle/editar/eliminar organización)

7. **`pages/api/organizaciones/[organizationId]/sedes/index.ts`** — GET + POST (listar/crear sedes)

8. **`pages/api/organizaciones/[organizationId]/sedes/[sedeId].ts`** — GET + PATCH + DELETE (detalle/editar/eliminar sede)

9. **Tests** — Unitarios en `services/organizaciones-sedes/*.test.ts` y de integración en `tests/integration/organizaciones-sedes.test.ts`.

10. **`documentation/schemas/organizaciones-sedes.ts`** — Registra schemas y endpoints con `registry.registerComponent()` y `registry.registerPath()`. Exportar desde `documentation/schemas/index.ts`.

## Decisiones

- **Soft delete**: Todos los registros borrados marcan `deletedAt` para auditoría y recuperación, nunca hard delete.
- **Relación 1:N**: Una organización pueden tener muchas sedes; simplifica permisos y filtros.
- **Paginación obligatoria**: Prepararse para crecer; siempre incluir meta.
- **Transacción en eliminación de org**: Garantizar consistencia al borrar org + sedes.

## Riesgos

- **Borrado en cascada**: Si algún endpoint no respeta la transacción, puede quedar sedes huérfanas. **Mitigación**: Encapsular en servicio y tests de integración.
- **Validación de unicidad**: El check de nombres únicos por org puede ser racy. **Mitigación**: Constraint `@@unique` en Prisma + manejo de error 409.
