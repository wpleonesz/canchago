# 020 · Gestión de Permisos Asociados a Roles — Tareas

_Checklist accionable derivada del `plan.md`. Actualizado el 2026-09-04 tras la implementación; los gates globales o integrados no demostrados permanecen abiertos._

## Gate 0 — precondiciones

- [x] **T-001 (GPR-12)** Revalidar ambos repositorios, sus `AGENTS.md`, worktrees y contratos antes de tocar código; preservar cambios ajenos.
- [x] **T-002 (GPR-05/06/12)** Leer la documentación local de Next.js 16.2.9 aplicable a Pages API Routes y confirmar scripts reales de ambos `package.json`.
- [ ] **T-003 (GPR-02/03/05)** Crear pruebas de caracterización de GET rol, GET catálogo y PATCH asociaciones con envelopes/códigos reales.
- [x] **T-004 (GPR-12)** Confirmar que no se necesita schema/migración, permiso nuevo, endpoint nuevo ni dependencia; detener y actualizar spec/plan si el supuesto cambia.

## Backend — contrato, autorización y persistencia

- [x] **T-005 (GPR-06)** Verificar/probar `updateRolePermissionsSchema.strict()` con UUID, máximo 500, duplicados y `expectedUpdatedAt`.
- [x] **T-006 (GPR-06/07)** Probar mass assignment con campos ajenos al contrato en el schema estricto; ampliar la matriz HTTP completa permanece en T-045.
- [ ] **T-007 (GPR-02/07)** Probar lectura válida, rol inexistente, borrado y cross-tenant con 404 opaco; manipular roleId/organizationId no permite IDOR.
- [ ] **T-008 (GPR-01/07)** Probar matriz sin sesión, solo `roles.read`, sin `permisos.read`, con `roles.manage` y alcance válido para cada endpoint.
- [x] **T-009 (GPR-07)** Probar en servicio el bloqueo de todo rol `isSystem`, incluido actor Administrador.
- [x] **T-010 (GPR-07)** Probar en servicio actor no Administrador con permisos actuales/solicitados superiores; el E2E de rol propio permanece en T-045/T-053.
- [ ] **T-011 (GPR-07/12)** Probar que el Administrador global conserva el bypass central existente sin volver editable su rol global ni depender de ID/email/username.
- [x] **T-012 (GPR-05/06)** Probar en servicio reemplazo con combinación de altas/bajas y diff de auditoría; persistencia DB real permanece en T-044.
- [x] **T-013 (GPR-05/06)** Probar permiso inexistente y duplicado antes de escritura; carrera DB real permanece en T-044.
- [ ] **T-014 (GPR-05)** Confirmar que validación de IDs, replace, touch `updatedAt` y auditoría usan el mismo transaction client; sin Prisma en route/service.
- [ ] **T-015 (GPR-08)** Probar dos administradores con el mismo `expectedUpdatedAt`: primer PATCH 200, segundo 409 y cero overwrite.
- [ ] **T-016 (GPR-10)** Probar `ROLE_UPDATED`: actor, organización, rol, `permissionsAdded/Removed`, sin secretos/payload extra; fallo de auditoría revierte todo.

## Backend — sesiones, rendimiento y documentación

- [ ] **T-017 (GPR-09)** Integración: permiso añadido habilita el siguiente request autenticado de un usuario asociado sin relogin/token nuevo.
- [ ] **T-018 (GPR-09)** Integración: permiso retirado deniega el siguiente request para todos los usuarios asociados, sin privilegio residual.
- [ ] **T-019 (GPR-03/05)** Verificar catálogo/asociaciones sin N+1, una consulta de validación para IDs y ninguna carga de usuarios del rol.
- [ ] **T-020 (GPR-02/03)** Probar paginación, búsqueda, filtro module, orden estable y listas vacías del catálogo/asociaciones.
- [ ] **T-021 (GPR-05/06/07/08)** Confirmar envelopes y códigos 400/401/403/404/409/422/500 reales; mensajes españoles sin Prisma/SQL/stack.
- [x] **T-022 (GPR-01–10)** Verificar/corregir `documentation/schemas/roles-permisos.ts` para GET/PATCH subrecurso y GET catálogo, sin duplicar schemas.
- [ ] **T-023 (GPR-12)** Conservar export en `documentation/schemas/index.ts` y validar paths, security, ejemplos y respuestas en `GET /api/docs`. El export se conserva; falta verificación HTTP por el build global bloqueado.

## Frontend — contrato y estado remoto

- [x] **T-024 (GPR-12)** Actualizar `spec/constitution/api-integration.md` antes del consumo dedicado.
- [x] **T-025 (GPR-02/05/08)** Añadir `UpdateRolePermissionsRequest`/response en `src/types/api/roles.ts`, reutilizando DTO reales y sin `any`.
- [x] **T-026 (GPR-05)** Añadir `updateRolePermissions` al cliente de roles usando PATCH `/roles/{roleId}/permisos` y mapper existente.
- [x] **T-027 (GPR-03)** Parametrizar query keys del catálogo por search/module y conservar infinite pagination de hasta 100 por página.
- [x] **T-028 (GPR-05/08/09)** Añadir mutación sin retry automático; actualizar detalle/listas e invalidar `SESSION_QUERY_KEY` tras éxito.
- [x] **T-029 (GPR-02/03)** Conservar snapshot seleccionado mientras cambian páginas/búsqueda y acumular metadata por ID sin duplicados.

## Frontend — selector, diff y página

- [x] **T-030 (GPR-03/04/12)** Extraer `RolePermissionSelector` compartido sin romper `RoleForm` create/edit.
- [x] **T-031 (GPR-03)** Agrupar por `module`; mostrar description/action/code reales, carga adicional y búsqueda remota con debounce.
- [x] **T-032 (GPR-04)** Implementar función pura de diff para altas/bajas y cubrir combinación/sin cambios.
- [x] **T-033 (GPR-02/04/11)** Crear `PermissionManagementPage` con identidad del rol, selector, resumen, guardar/cancelar y estados loading/empty/error/success.
- [x] **T-034 (GPR-11)** Prevenir doble submit, bloquear controles durante PATCH y mostrar progreso/éxito/error accesible.
- [x] **T-035 (GPR-11)** Reutilizar `Prompt`/`AppConfirmDialog` para salida con dirty state; limpiar aviso tras commit o recarga confirmada.
- [x] **T-036 (GPR-08/11)** En 409 conservar borrador, explicar conflicto y ofrecer recargar snapshot; no mezclar cambios automáticamente.
- [x] **T-037 (GPR-11)** Manejar errores tipados y mensajes seguros; la matriz E2E completa permanece en T-051/T-053.

## Frontend — navegación y responsive

- [x] **T-038 (GPR-01)** Registrar `/admin/roles/:roleId/permissions` antes del detalle dinámico, exigiendo `roles.read` + `roles.manage` + `permisos.read` con política all.
- [x] **T-039 (GPR-01/07)** Añadir “Gestionar permisos” en detalle y ocultar para roles system/capacidades incompletas; se omite en fila para conservar claridad móvil.
- [ ] **T-040 (GPR-01/07)** Probar deep link, query faltante/manipulada, action visibility y defensa backend independiente del guard Ionic.
- [x] **T-041 (GPR-03/11)** Aplicar tokens/componentes Ionic existentes y layout responsive del módulo sin dependencia nueva.
- [x] **T-042 (GPR-11/12)** Confirmar que `/admin/permissions` sigue siendo catálogo/placeholder de solo lectura y no aparece un CRUD de Permission.

## Pruebas backend

- [ ] **T-043 (GPR-02/03)** Lectura de permisos del rol y catálogo: asignados, vacío, páginas, búsqueda/module y rol inexistente.
- [ ] **T-044 (GPR-05/06)** Asignación, retirada, combinación, vacío, duplicados, inexistente/desaparecido, persistencia M:N y rollback.
- [ ] **T-045 (GPR-01/07)** Autorización: solo lectura, sin manage, sin catálogo, IDOR, system/super admin y autoescalamiento.
- [ ] **T-046 (GPR-08/10)** Concurrencia, auditoría transaccional, mass assignment y error remoto/interno sanitizado.
- [ ] **T-047 (GPR-09/12)** Sesión activa tras añadir/retirar y regresión de usuarios, asignación de roles, auth web/nativa, menú/guards.

## Pruebas frontend

- [x] **T-048 (GPR-02/03/11)** Añadir pruebas focalizadas de página/sistema y función de diff; ampliar interacción Ionic completa permanece pendiente.
- [x] **T-049 (GPR-04/05)** Validar selección cliente, diff altas/bajas y conjunto vacío; E2E de payload/éxito permanece en T-053.
- [ ] **T-050 (GPR-01/07)** Guards/acciones/deep link para permisos parciales, role system, URL manual y sesión expirada.
- [ ] **T-051 (GPR-08/11)** Doble envío, progreso, dirty/cancelar, 409 con borrador, 403/404, red/500 y retry manual.
- [ ] **T-052 (GPR-11/12)** Viewports móvil/escritorio, accesibilidad básica y regresión del `RoleForm`, RoleDetail, roles list y UserRolesEditor.
- [ ] **T-053 (GPR-05/07/09/12)** Flujo integrado real: detalle → gestionar → altas/bajas → guardar → siguiente request autorizado/denegado.

## Documentación Swagger (obligatorio)

_Debe verificarse/corregirse en paralelo con el contrato; no como paso final._

- [x] **T-054 (GPR-05/06)** Registrar/verificar componentes Zod de request/response para permisos de rol en `documentation/schemas/roles-permisos.ts`.
- [x] **T-055 (GPR-01–08)** Registrar/verificar GET y PATCH `/roles/{roleId}/permisos` y GET `/permisos` con método, path, tag, security, params/body y respuestas reales.
- [x] **T-056 (GPR-12)** Conservar export desde `documentation/schemas/index.ts`.
- [ ] **T-057 (GPR-12)** Verificar en `GET /api/docs` schemas, ejemplos, reemplazo completo, permisos requeridos y códigos de error.

## Cierre

- [ ] **T-058 (GPR-01–12)** Validar cada criterio de aceptación de `spec.md` con evidencia enlazable.
- [ ] **T-059 (GPR-12)** Backend: `yarn lint && yarn typecheck && yarn test && yarn build`.
- [ ] **T-060 (GPR-12)** Ionic: `yarn lint && yarn typecheck && yarn test && yarn build`.
- [ ] **T-061 (GPR-11/12)** Ejecutar `yarn cap:sync`/build Android-iOS solo si se tocó configuración o código nativo; en caso contrario registrar “no aplica”.
- [ ] **T-062 (GPR-12)** Actualizar ambos roadmaps solo tras implementación completa; no alterar el estado de 018/019 sin sus propios gates.

## Mantenimiento (checklist recurrente)

- [ ] Al agregar un `Permission` al seed, confirmar que aparece desde el catálogo sin cambios en Ionic y revisar su concesión al Administrador.
- [ ] Al cambiar `RolePermission`, actualizar schema, servicio, OpenAPI, DTO Ionic, diff y pruebas en el mismo cambio.
- [ ] Al crear un rol `isSystem`, verificar que detalle lo marca protegido y ninguna ruta/acción permite gestionar sus permisos.
- [ ] Al cambiar resolución de sesión/caché, redefinir y probar el plazo máximo de revocación/concesión.
- [ ] Al introducir flags de Permission o reglas de dependencia futuras, crear/actualizar SPEC antes de filtrarlas o validarlas.
