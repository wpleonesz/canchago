# 018 · Gestión Administrativa de Roles — Tareas

_Checklist derivado de `plan.md`. Actualizado el 2026-08-29 tras la implementación; los gates no demostrados permanecen abiertos._

## Gate 0 — precondiciones

- [x] **T-001 (GAR-14)** Revalidar ambos repositorios y capturar contratos reales actuales con tests de caracterización.
- [x] **T-002 (GAR-13/14)** Reconciliar sin reset la migración divergente `20260630185000_add_roles_permissions_fields` antes de crear otra migración.
- [x] **T-003 (GAR-14)** Leer documentación local de Next.js 16.2.9 aplicable a Pages API Routes antes de código backend.
- [x] **T-004 (GAR-14)** Confirmar que no hay cambios concurrentes en archivos objetivo; preservar worktree ajeno.

## Backend — modelo, migración y seeds

- [x] **T-005 (GAR-06)** Agregar `Role.normalizedName` interno y constraints tenant de nombre normalizado/code, con estrategia explícita para `organizationId: null`.
- [x] **T-006 (GAR-06/14)** Crear migración aditiva con preflight de colisiones; no editar migraciones ya aplicadas ni usar `db push`.
- [x] **T-007 (GAR-13)** Incorporar `AuditLog` mínimo con actor, organización, entidad, acción, diff, timestamp, FKs/onDelete e índices.
- [x] **T-008 (GAR-06/08/14)** Backfill y seeds idempotentes sin cambiar IDs/codes ni protección de Administrador/Futbolista/Gestor.
- [ ] **T-009 (GAR-06)** Probar colisiones por caso/espacios y rollback seguro del backfill.

## Backend — validación y normalización

- [x] **T-010 (GAR-03/04)** Crear schemas Zod separados para query/params con UUID, paginación, search, isSystem, orderBy/order whitelist.
- [x] **T-011 (GAR-05/06/09)** Hacer create/update `.strict()`, mapear solo name/description/permissionIds/expectedUpdatedAt y rechazar claves extra.
- [x] **T-012 (GAR-06)** Implementar/probar trim, colapso de espacios, Unicode permitido, longitudes y description vacía→null.
- [x] **T-013 (GAR-06)** Generar code determinista solo en create; PATCH no acepta ni recalcula code.
- [x] **T-014 (GAR-07/09)** Rechazar permissionIds no UUID, inexistentes y duplicados antes de escribir.

## Backend — autorización y seguridad

- [x] **T-015 (GAR-01/04)** Implementar guard scoped por `UserRole`/organization o Administrador global; no confiar en organizationId del cliente.
- [x] **T-016 (GAR-04/09)** Devolver 404 opaco para rol inexistente, borrado o cross-tenant; 401/403 según auth/permisos.
- [x] **T-017 (GAR-08)** Bloquear POST/PATCH/DELETE inseguros sobre todo `Role.isSystem`, incluso mediante payload/ruta manual.
- [x] **T-018 (GAR-07)** Para actor no Administrador, exigir que permisos actuales y solicitados del rol sean subconjunto de sus capacidades.
- [ ] **T-019 (GAR-07/08)** Probar intento de autoescalamiento editando un rol propio y rol superior personalizado.
- [x] **T-020 (GAR-02/04)** Limitar catálogo de organizaciones del selector al alcance real del actor o definir proyección aprobada equivalente.
- [x] **T-021 (GAR-09)** Probar mass assignment de organizationId, roleId, code, isSystem, deletedAt, timestamps, counts y relaciones.

## Backend — acceso de datos y servicios

- [x] **T-022 (GAR-02/03)** Extender `role.db.ts` con filtros/orden/paginación DB y select fijo, sin N+1 ni user count engañoso.
- [x] **T-023 (GAR-04)** Mantener detalle filtrado por roleId + organizationId + deletedAt y permisos reales.
- [x] **T-024 (GAR-07)** Validar catálogo/IDs de permisos en una consulta y paginar RolePermission en DB, no en memoria.
- [ ] **T-025 (GAR-09)** Refactorizar `role-permission.db.ts` para usar transaction client exterior.
- [x] **T-026 (GAR-09/13)** Crear rol + permisos + auditoría en una única transacción; fallo revierte todo.
- [x] **T-027 (GAR-09/10/13)** Editar rol + permisos + touch updatedAt + auditoría en una única transacción compare-and-update.
- [x] **T-028 (GAR-06/09)** Eliminar Prisma directo del service y mapear P2002/errores por tipo, no por texto en inglés.
- [x] **T-029 (GAR-10)** Probar dos snapshots: primer PATCH 200, segundo 409 sin overwrite.
- [ ] **T-030 (GAR-11)** Probar que conceder/revocar permiso cambia la autorización del usuario asociado en su siguiente request sin relogin.
- [ ] **T-031 (GAR-13)** Probar audit diff cerrado, actor/rol/org correctos, sin secretos y rollback si falla auditoría.

## Backend — rutas, errores y OpenAPI

- [x] **T-032 (GAR-02/03/09)** Actualizar GET/POST `/api/roles` con schemas, actor y servicio endurecido.
- [x] **T-033 (GAR-04/08/10)** Actualizar GET/PATCH `/api/roles/{roleId}` con scope, system guard y expectedUpdatedAt.
- [x] **T-034 (GAR-07/09/10)** Alinear `/api/roles/{roleId}/permisos` con paginación DB, guardias, versión y transacción compartida.
- [x] **T-035 (GAR-07)** Mantener/expandir GET `/api/permisos` paginado solo con filtros realmente consumidos.
- [x] **T-036 (GAR-08)** Endurecer DELETE existente aunque siga fuera de UI; verificar que roles system no se eliminan.
- [ ] **T-037 (GAR-01/04/06–10)** Cubrir 400/401/403/404/409/500 con envelopes actuales y mensajes españoles sin detalles internos.
- [x] **T-038 (GAR-14)** Actualizar `documentation/schemas/roles-permisos.ts`, conservar export y eliminar silenciamientos solo al resolver tipos.
- [x] **T-039 (GAR-14)** Verificar contratos y ejemplos en GET `/api/docs`.

## Frontend — contrato, validación y API

- [x] **T-040 (GAR-14)** Actualizar `spec/constitution/api-integration.md` con contrato implementado antes de consumirlo.
- [x] **T-041 (GAR-02/04/05/10)** Ampliar `src/types/api/roles.ts` compatible con `UserRolesEditor`, sin any ni campos supuestos.
- [x] **T-042 (GAR-05/06/07)** Crear `src/validation/roles.ts` espejo UX y tests de nombres/description/permisos.
- [x] **T-043 (GAR-02/04/05)** Extender `services/api/endpoints/roles.ts` con lista/detalle/create/update y mappers de `_count`.
- [x] **T-044 (GAR-07)** Crear endpoint client paginado de permisos; cero listas hardcodeadas y cero petición por permiso.
- [x] **T-045 (GAR-02/03/04/07/10)** Crear hooks/query keys por organizationId, filtros, página, detalle y permisos.
- [x] **T-046 (GAR-02/05/10/12)** Crear mutaciones sin retry automático e invalidación/actualización selectiva tras commit.

## Frontend — navegación, listado y detalle

- [x] **T-047 (GAR-01)** Crear `RolesModule` con rutas exactas lista/new/detail/edit y orden correcto en React Router 5.
- [x] **T-048 (GAR-01)** Reemplazar el placeholder de `/admin/roles` en `AdminLayout` sin duplicar IonPage/layout.
- [x] **T-049 (GAR-01/04)** Ajustar/probar guards y navegación para permisos requeridos y URL manual.
- [x] **T-050 (GAR-02/03/12)** Crear `RolesListPage`: organización, debounce, filtro type real, orden, paginación y reset de página.
- [x] **T-051 (GAR-02/08)** Crear `RoleListItem` con campos reales, badge system y acciones autorizadas; omitir status/user count.
- [x] **T-052 (GAR-02/12)** Cubrir lista loading/empty/error/success, retry GET y cero llamadas por fila.
- [x] **T-053 (GAR-04/07/08)** Crear `RoleDetailPage` con permisos agrupados, system read-only y 404/403/error.

## Frontend — formulario reutilizable

- [x] **T-054 (GAR-05/06)** Crear un solo `RoleForm` para create/edit con información general y permisos.
- [x] **T-055 (GAR-07)** Renderizar catálogo real paginado/load-more agrupado por module, conservando selecciones persistidas.
- [x] **T-056 (GAR-05/12)** Mostrar errores junto al campo, feedback global accesible y controles táctiles.
- [ ] **T-057 (GAR-09/12)** Deshabilitar inputs/guardar durante submit y probar doble clic = una petición.
- [x] **T-058 (GAR-05/12)** Implementar cancelar/dirty warning compatible con patrón Ionic/Router existente.
- [x] **T-059 (GAR-10)** En 409 conservar borrador, informar conflicto y ofrecer recargar snapshot actual.
- [x] **T-060 (GAR-12)** Tras 201/200 actualizar lista/detalle sin reload global y navegar de forma coherente.
- [x] **T-061 (GAR-12)** Aplicar tokens/estilo existente, móvil una columna, escritorio ancho legible, dark mode/safe areas/reduced motion.

## Pruebas backend

- [ ] **T-062 (GAR-02/03)** Lista con/sin datos, páginas, búsqueda, isSystem, orden whitelist/inválido y query budget constante.
- [ ] **T-063 (GAR-05/06/09)** Creación válida, duplicado normalizado, caracteres/longitud, claves protegidas y rollback.
- [ ] **T-064 (GAR-04/05/10)** Edición válida, inexistente, soft-deleted, cross-tenant, expectedUpdatedAt obsoleto.
- [ ] **T-065 (GAR-07/08)** Permisos válidos/inválidos/duplicados, system role y escalamiento por permisos superiores.
- [ ] **T-066 (GAR-01/04/09)** Matriz sin sesión/sin permiso/con permiso/scope ajeno para GET y mutaciones; IDOR por path/query/body.
- [ ] **T-067 (GAR-11/13/14)** Sesión dinámica, auditoría y regresión de usuarios, asignación de roles, registro y super admin.

## Pruebas frontend

- [ ] **T-068 (GAR-02/03/12)** Componentes lista: loading/empty/error/success, debounce, filtros, orden, páginas y retry.
- [ ] **T-069 (GAR-01/04/08)** Menú/rutas: permisos, deep link, system sin editar, 401/403/404.
- [ ] **T-070 (GAR-05/06/07/09)** Form create/edit: defaults, validación, catálogo, payload cerrado, doble envío, cancelar/dirty.
- [ ] **T-071 (GAR-10/12)** Hooks/página: 201/200, 409, red/500, invalidación precisa y sesión expirada.
- [ ] **T-072 (GAR-12/14)** Cypress: menú → lista → crear → detalle → editar; viewports móvil/escritorio y regresiones críticas.

## Contratos y documentación

- [x] **T-073 (GAR-14)** Confirmar que tipos Ionic coinciden con respuestas backend reales, no solo OpenAPI.
- [x] **T-074 (GAR-14)** Confirmar que no hay roles/permisos/UUIDs privilegiados hardcodeados en Ionic.
- [x] **T-075 (GAR-13/14)** Documentar limitación de visor de auditoría y user count como fuera de alcance/backlog.

## Cierre

- [ ] **T-076 (GAR-01–14)** Validar todos los criterios de aceptación de `spec.md` con evidencia enlazable.
- [ ] **T-077 (GAR-14)** En backend: `yarn lint && yarn typecheck && yarn test && yarn build`; verificar `/api/docs`.
- [ ] **T-078 (GAR-14)** En Ionic: `yarn lint && yarn typecheck && yarn test && yarn build`.
- [x] **T-079 (GAR-12)** Ejecutar `yarn cap:sync` y validación Android/iOS solo si se tocó código/config nativa; si no, registrar “no aplica”. **No aplica: no se modificó código ni configuración nativa.**
- [ ] **T-080 (GAR-14)** Actualizar ambos roadmaps únicamente al completar implementación; mover 018 a Hecho en backend y retirar el backlog Ionic de roles.

## Mantenimiento (checklist recurrente)

- [ ] Si cambia `Role`, actualizar schema Zod, OpenAPI, DTO Ionic y tests en el mismo cambio.
- [ ] Al agregar un permiso al seed, verificar que Administrador lo recibe y que catálogo/formulario lo muestran sin hardcode.
- [ ] Al agregar un rol `isSystem`, comprobar que queda read-only por HTTP y que su code no puede alterarse.
- [ ] Al cambiar el alcance de `UserRole`, revalidar scope guard, IDOR, selector de organización y sesión.
- [ ] Si se define unicidad real de `UserRole`, reevaluar de forma separada el conteo de usuarios asignados.
