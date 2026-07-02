# 004 · Gestión de Organizaciones y Sedes — Tareas

_Checklist accionable. Marca `[x]` al completarlas._

## Modelos y Base de Datos

- [ ] Agregar modelos `Organization` y `Sede` a `prisma/schema.prisma` con relaciones, índices y soft delete.
- [ ] Ejecutar `yarn migrate-dev` y nombrar migración `add_organizations_and_sedes`.
- [ ] Verificar estructura en `yarn prisma-studio`.

## Validaciones

- [ ] Crear `validations/organizaciones-sedes/organizacion.validation.ts` con schemas Zod para crear/actualizar organizaciones.
- [ ] Crear `validations/organizaciones-sedes/sede.validation.ts` con schemas Zod para crear/actualizar sedes.
- [ ] Tests unitarios: validar input inválido, campos requeridos, formatos (email, teléfono).

## Capa de Base de Datos

- [ ] Crear `database/organizaciones-sedes/organizacion.db.ts` con queries encapsuladas.
- [ ] Crear `database/organizaciones-sedes/sede.db.ts` con queries encapsuladas.
- [ ] Excluir registros con `deletedAt` en todas las queries por defecto.
- [ ] Tests unitarios: verificar paginación, filtros, soft delete.

## Lógica de Negocio

- [ ] Crear `services/organizaciones-sedes/organizacion.service.ts` con create, update, delete (con transacción).
- [ ] Crear `services/organizaciones-sedes/sede.service.ts` con create, update, delete.
- [ ] Validar lógica en servicios (no en endpoints).
- [ ] Tests unitarios: casos de error, transacciones, validaciones.

## Endpoints - Organizaciones

- [ ] **`pages/api/organizaciones/index.ts`**:
  - GET: listar organizaciones (paginadas, filtrable por nombre).
  - POST: crear organización (requiere permiso `organizaciones.manage`).
- [ ] **`pages/api/organizaciones/[organizationId].ts`**:
  - GET: detalle organización.
  - PATCH: actualizar (requiere permiso `organizaciones.manage`).
  - DELETE: borrar soft (requiere permiso `organizaciones.manage`).

## Endpoints - Sedes

- [ ] **`pages/api/organizaciones/[organizationId]/sedes/index.ts`**:
  - GET: listar sedes por organización (paginadas).
  - POST: crear sede (requiere permiso `organizaciones.manage`).
- [ ] **`pages/api/organizaciones/[organizationId]/sedes/[sedeId].ts`**:
  - GET: detalle sede.
  - PATCH: actualizar sede (requiere permiso `organizaciones.manage`).
  - DELETE: borrar soft sede (requiere permiso `organizaciones.manage`).

## Tests de Integración

- [ ] Test: crear organización, verificar respuesta 201 + estructura.
- [ ] Test: editar organización, verificar cambios.
- [ ] Test: listar organizaciones, verificar paginación + meta.
- [ ] Test: eliminar organización, verificar soft delete + sedes también marcadas.
- [ ] Test: acceso denegado sin permiso `organizaciones.manage` (403).
- [ ] Test: validación fallida (422).
- [ ] Test: duplicado (409).
- [ ] Equivalentes para sedes.

## Documentación OpenAPI (obligatorio, en paralelo)

- [ ] Crear `documentation/schemas/organizaciones-sedes.ts`.
- [ ] Registrar schemas con `registry.registerComponent()`:
  - `Organization`, `OrganizationInput`, `OrganizationPaginated`
  - `Sede`, `SedeInput`, `SedePaginated`
  - `Error422`, `Error403`, `Error404`, `Error409`
- [ ] Registrar endpoints con `registry.registerPath()`:
  - `GET /api/organizaciones` (con paginación, ejemplos)
  - `POST /api/organizaciones`
  - `GET /api/organizaciones/{organizationId}`
  - `PATCH /api/organizaciones/{organizationId}`
  - `DELETE /api/organizaciones/{organizationId}`
  - `GET /api/organizaciones/{organizationId}/sedes`
  - `POST /api/organizaciones/{organizationId}/sedes`
  - `GET /api/organizaciones/{organizationId}/sedes/{sedeId}`
  - `PATCH /api/organizaciones/{organizationId}/sedes/{sedeId}`
  - `DELETE /api/organizaciones/{organizationId}/sedes/{sedeId}`
- [ ] Exportar desde `documentation/schemas/index.ts`.
- [ ] Verificar en `GET /api/docs`: todos los endpoints visibles, ejemplos correctos, códigos de error documentados.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build` — todo debe pasar.
- [ ] Confirmar todos los criterios de aceptación de `spec.md`.
- [ ] Actualizar `spec/constitution/roadmap.md`: mover feature a "Hecho ✅" (004).
