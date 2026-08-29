# 018 · Gestión Administrativa de Roles — Plan

_Cómo se implementa lo descrito en `spec.md`, respetando las constituciones de `canchago` y `canchago-ionic`._

## Enfoque

La implementación se divide en dos gates. Primero se corrige el contrato backend y se demuestra su seguridad con pruebas. Después Ionic actualiza sus tipos/cliente y reemplaza el placeholder `/admin/roles` por un módulo real. No se consume un contrato propuesto antes de existir y estar documentado.

Se preservan las rutas actuales. `GET /api/roles` se amplía de forma compatible; POST/PATCH mantienen sus paths pero pasan a schemas estrictos, autorización scoped, transacciones y concurrencia. `GET /api/permisos` sigue siendo catálogo global paginado. No se agrega una librería, un CRUD de permisos ni un segundo estado global.

## Implementación

### Gate 0 — precondiciones y contrato

1. **Reconciliar deuda de migraciones de `canchago`** — Resolver primero el checksum divergente de `20260630185000_add_roles_permissions_fields`; no ejecutar reset, `db push` ni una migración nueva sobre historial inconsistente.
2. **Revalidar Next.js 16.2.9** — Leer las guías relevantes en `canchago/node_modules/next/dist/docs/` antes de tocar API Routes, según `AGENTS.md`.
3. **Congelar ejemplos reales** — Capturar shapes actuales de lista/detalle/create/update/permisos y convertirlos en tests de compatibilidad antes del refactor.
4. **Actualizar SPEC si deriva el código** — Si modelos, permisos, envelopes o sesión difieren al iniciar implementación, ajustar estos tres documentos antes de código.

### Backend: integridad y auditoría

5. **`canchago/prisma/schema.prisma`** — Agregar únicamente infraestructura necesaria:
   - `Role.normalizedName` interno para unicidad normalizada por organización.
   - constraint único de `Role` por `[organizationId, normalizedName]` y por `[organizationId, code]` para roles tenant; resolver explícitamente el comportamiento de `NULL` para roles globales en SQL/seed sin modificar migraciones aplicadas.
   - `AuditLog` (o el nombre genérico aprobado por la convención final) con actor, organización nullable, entidad/tipo, entityId, acción enum/string cerrado, diff JSON y `createdAt`; FKs/onDelete e índices explícitos.
6. **Migración aditiva** — Backfill determinista de `normalizedName`; detectar y reportar colisiones antes de crear índices. Nunca renombrar códigos existentes ni sobrescribir roles globales. Aplicar solo después de resolver el gate 0.
7. **`canchago/prisma/seed-dev.ts`** — Ajustar seeds idempotentes para poblar `normalizedName` si el modelo lo exige; conservar `Administrador`, `Futbolista`, `Gestor de Cancha`, códigos y bootstrap actuales.

### Backend: validación y autorización

8. **`canchago/validations/roles-permisos/role.validation.ts`** — Separar schemas de query, params, create y update; `.strict()` en bodies; trim/colapso de espacios, caracteres Unicode permitidos, límites reales, IDs UUID únicos, `expectedUpdatedAt` ISO obligatorio en PATCH. Whitelist de `search`, `isSystem`, `orderBy`, `order`, `page`, `pageSize`.
9. **`canchago/validations/roles-permisos/permission.validation.ts`** — Rechazar IDs duplicados y claves extra; compartir el schema de `permissionIds` con create/update.
10. **Normalizadores puros** — Ubicar `normalizeRoleName`/`toRoleCode` en el módulo permitido por la arquitectura real (`helper/` o validación); cubrir Unicode/espacios. El code se crea una vez y no se recalcula en PATCH.
11. **Scope RBAC central** — Crear/reutilizar un guard de servicio/database que autorice `organizationId` mediante el `UserRole` efectivo del actor o el rol global Administrador. Un recurso fuera de tenant termina en 404 opaco; el query nunca concede alcance por sí mismo.
12. **Jerarquía por capacidades** — Guard central para mutaciones:
    - bloquear siempre `Role.isSystem` por HTTP;
    - salvo Administrador global, exigir que permisos actuales y solicitados del rol sean subconjunto de `req.user.permissions`;
    - validar nuevamente todos los permissionIds en base dentro de la transacción;
    - no usar nombres de rol en la ruta/UI ni introducir prioridad ficticia.
13. **Organizaciones visibles** — Endurecer el catálogo que alimenta el selector para devolver solo organizaciones dentro del alcance efectivo del actor, preservando acceso global del Administrador. Si este cambio afecta otros consumidores, crear una proyección/query explícita aprobada y pruebas de regresión; no aceptar un organizationId manual sin catálogo.

### Backend: acceso de datos y servicios

14. **`canchago/database/roles-permisos/role.db.ts`** — Mantener Prisma encapsulado; implementar listado paginado con búsqueda/filtro/orden whitelist y un select fijo. `_count.permissions` se obtiene en la consulta; no agregar conteo de usuarios. Añadir compare-and-update por `id + organizationId + updatedAt + deletedAt:null`.
15. **`canchago/database/roles-permisos/permission.db.ts`** — Paginación real y orden estable por `module/action/code`; búsqueda/filtro solo si se aprueba en contrato. Validar IDs en una sola consulta.
16. **`canchago/database/roles-permisos/role-permission.db.ts`** — Dejar de abrir una transacción independiente cuando forma parte de create/update; aceptar el transaction client y reemplazar relaciones dentro de la transacción exterior. El GET por rol pagina en DB, no con `Array.slice` después de cargar todo.
17. **`canchago/database/audit/`** — Encapsular inserción del evento durable con el mismo transaction client. El diff registra campos cambiados e IDs/códigos añadidos/removidos, nunca sesión, token, cookie ni payload completo.
18. **`canchago/services/roles-permisos/role.service.ts`** — Eliminar queries Prisma directas del servicio. Crear/editar coordina scope, protección, unicidad, permisos, role/RolePermission, touch de `updatedAt` y auditoría en una sola `$transaction`. Recibir `actingUser` explícito. Mapear P2002/versión obsoleta a `ConflictError` sin comparar strings de errores.
19. **`canchago/services/roles-permisos/permission.service.ts`** — Retornos públicos tipados; validación de permisos reutilizable dentro de transacción. No aceptar una lista blanca hardcodeada distinta de la tabla `Permission`.

### Backend: rutas y OpenAPI

20. **`canchago/pages/api/roles/index.ts`** — GET/POST conservan auth/access y delegan schemas/servicio. GET amplía query compatible; POST pasa `req.user`, usa mapper estricto y responde 201 solo tras commit.
21. **`canchago/pages/api/roles/[roleId].ts`** — GET/PATCH validan params/query con Zod. PATCH exige `expectedUpdatedAt`; DELETE no se presenta en Ionic y debe aplicar scope/protección si se conserva.
22. **`canchago/pages/api/roles/[roleId]/permisos/index.ts`** — GET pagina en DB. PATCH puede mantenerse por compatibilidad, pero comparte exactamente guardias, versión, transacción y auditoría; el formulario integrado usa un único contrato atómico, no dos escrituras sucesivas.
23. **`canchago/pages/api/permisos/index.ts`** — Mantener `permisos.read`, paginación y select fijo; añadir filtros únicamente si los consume la UI aprobada.
24. **`canchago/documentation/schemas/roles-permisos.ts`** — Quitar `@ts-nocheck` solo cuando se resuelva la deuda OpenAPI; registrar schemas y paths reales con 200/201/400/401/403/404/409/500, ejemplos sin UUIDs que parezcan válidos pero inexistentes. Conservar export en `documentation/schemas/index.ts` y verificar `/api/docs`.
25. **Logging** — Pino registra acción y IDs no sensibles después del commit/rollback controlado. Auditoría durable permanece dentro de la transacción y es la fuente histórica.

### Frontend: contrato y datos

26. **`canchago-ionic/spec/constitution/api-integration.md`** — Registrar antes del consumo los queries, DTOs, body estricto, errores, scope, protección system, concurrencia y auditoría implementados.
27. **`src/types/api/roles.ts`** — Extender sin romper `UserRolesEditor`: `RoleListItemDto`, `RoleDetailDto`, permission DTO, list query, create/update requests y responses. Normalizar `_count.permissions` únicamente en `services/api/`.
28. **`src/validation/roles.ts`** — Schema Zod UX espejo: nombre/descripcion/permissionIds; `expectedUpdatedAt` se obtiene del snapshot y no se edita. La validación cliente no sustituye backend.
29. **`src/services/api/endpoints/roles.ts`** — Mantener `getRoles`; agregar `getRole`, `createRole`, `updateRole` y, si sigue necesario, `getRolePermissions`. Una función por endpoint real, sin Axios fuera de esta capa.
30. **`src/services/api/endpoints/permissions.ts`** — Cliente paginado del catálogo global. No incrustar permisos en el bundle ni llamar una vez por fila/permiso.
31. **`src/features/roles/hooks/`** — Queries por organización/filtros/detalle/catálogo y mutaciones. Query keys incluyen `organizationId`; al éxito actualizar detalle y luego invalidar prefijos precisos. Mutaciones sin retry automático.

### Frontend: módulo y UX

32. **`src/features/roles/pages/RolesModule.tsx`** — Router interno: `/admin/roles`, `/admin/roles/new`, `/admin/roles/:roleId`, `/admin/roles/:roleId/edit`; rutas ordenadas para React Router 5 y protegidas por permisos reales.
33. **`RolesListPage.tsx`** — Selector de organización autorizado, búsqueda con `AppSearchInput`, filtro Todos/Sistema/Personalizado, orden, página remota, botón crear con `PermissionGuard('roles.manage')` y `AppDataList` para los cuatro estados.
34. **`RoleListItem.tsx`** — Renderizar solo campos aprobados y acciones Consultar/Editar; roles system muestran badge protegido y no acción de edición. No mostrar estado ni user count.
35. **`RoleDetailPage.tsx`** — Información general + permisos agrupados; estados 404/403/error; acción editar solo si corresponde.
36. **`RoleForm.tsx`** — Único componente create/edit con React Hook Form + Zod. Secciones “Información general” y “Permisos”; errores por campo, carga paginada del catálogo, selección agrupada, submit bloqueado y Guardar/Cancelar.
37. **`RoleFormPage.tsx`** — Orquestar snapshot, `expectedUpdatedAt`, éxito, 409 con recarga, 404 y mensajes de error. Confirmar cambios pendientes con el patrón ya usado por `AdminUserProfileForm`.
38. **`src/layouts/AdminLayout.tsx`** — Reemplazar solo el placeholder `/admin/roles` por `RolesModule`; mantener `/admin/permissions` como catálogo pendiente/futuro. No duplicar `IonPage` dentro del shell.
39. **Navegación/capacidades** — Ajustar la política de permisos para que la entrada/pantalla pueda exigir las capacidades necesarias (`roles.read` y acceso al catálogo organizacional); si se extiende `AdminRoute` a política `all`, conservar y probar los consumidores actuales.
40. **Estilos** — Crear/reutilizar CSS del módulo sobre tokens existentes: una columna móvil, controles táctiles, grid moderado en escritorio, dark mode/safe areas/reduced motion. Sin paleta ni dependencia nueva.

### Pruebas y cierre

41. **Backend unitario** — Normalización, schemas strict, queries whitelist, guards tenant/system/capabilities, servicios transaccionales, conflicto y auditoría.
42. **Backend integración** — Endpoints con sesión/permiso, IDOR, mass assignment, rollback, permisos inválidos, concurrencia y regresión de sesiones/usuarios/super admin.
43. **Frontend unitario/componente** — Tipos/mappers, schema/form, lista/estados, permisos, system read-only, doble submit, dirty state, 409 e invalidación selectiva.
44. **Frontend integración/E2E** — Flujo menú → lista → crear → detalle → editar, manipulación de URL, sesión expirada, 403, móvil/escritorio y respuesta actualizada sin reload global, usando Vitest/Testing Library/Cypress existentes.
45. **Calidad** — Backend e Ionic: `yarn lint && yarn typecheck && yarn test && yarn build`. Verificar `/api/docs`; `yarn cap:sync` y prueba Android/iOS solo si se toca configuración/código nativo (no previsto).
46. **Roadmaps** — Solo al completar implementación y evidencia: mover 018 a Hecho en el backend, retirar el backlog Ionic de roles y registrar allí la contraparte frontend implementada.

## Matriz requisito → diseño → tareas

| Requisito | Diseño | Tareas |
| --- | --- | --- |
| GAR-01 | shell/rutas/guards existentes | 32, 38–39, 43–44 |
| GAR-02/03 | listado DB + query tipada + UI remota | 8, 14, 20, 27, 29, 31, 33, 41–44 |
| GAR-04 | scope guard + detalle | 11, 14, 21, 29, 32, 35, 42–44 |
| GAR-05/06 | form compartido + normalización/constraints | 5–10, 18, 27–29, 36–37, 41–44 |
| GAR-07/08 | catálogo/jerarquía/system guard | 12, 15–19, 22–23, 30, 34–37, 41–44 |
| GAR-09 | strict mapper + transacción | 8–9, 16–22, 41–42 |
| GAR-10 | updatedAt compare-and-update | 8, 14, 18, 21, 27, 37, 41–44 |
| GAR-11 | sesión dinámica + invalidación precisa | 18, 31, 42–44 |
| GAR-12 | componentes/tokens/estados | 32–40, 43–45 |
| GAR-13 | AuditLog transaccional | 5–7, 17–18, 25, 41–42 |
| GAR-14 | compatibilidad y gates | 1–4, 18–24, 27, 41–46 |

## Decisiones

- **Feature 018 vive en `canchago`** — Sigue la secuencia del repositorio backend y documenta el contrato y hardening que deben existir antes de que Ionic reemplace su placeholder administrativo.
- **Sin columna estado** — `Role` solo tiene soft delete y las queries normales ocultan borrados. Inventar activo/inactivo alteraría modelo y reglas sin requisito imprescindible.
- **Sin conteo de usuarios en v1** — `_count.userRoles` no equivale con certeza a usuarios únicos activos por ausencia de constraint de alcance. Mostrarlo sería información falsa; se difiere con trazabilidad explícita.
- **`isSystem` implica protegido y read-only por HTTP** — Reutiliza el modelo real; no se agrega `isProtected`, `type` o jerarquía. Incluso el super admin mantiene estos roles mediante mecanismos controlados, no desde el formulario.
- **Code inmutable** — Los IDs preservan relaciones, pero existen guards/seeds/scripts que usan códigos. Renombrar la etiqueta sin cambiar code evita regresiones; editar code se descarta.
- **Jerarquía por subconjunto de permisos** — No existe prioridad numérica. Comparar capacidades actuales/solicitadas con el actor impide escalamiento sin inventar niveles.
- **Una mutación atómica por guardado** — Datos y permisos forman el agregado Role. Dos PATCH sucesivos permitirían estado parcial y conflictos difíciles de resolver.
- **Concurrencia con `updatedAt` existente** — Evita un campo version nuevo; el servicio toca el timestamp cuando solo cambian permisos.
- **Auditoría durable mínima** — La misión exige trazabilidad de cambios de permisos y no existe infraestructura. Se justifica una migración aditiva, bloqueada hasta reconciliar el historial; Pino solo complementa.
- **Sin caché backend nueva** — La sesión lee DB en cada request y no existe caché activa en roles. TanStack Query se invalida de forma selectiva; agregar Redis no aporta al alcance actual.

## Riesgos

- **Historial Prisma divergente** — Bloquea cualquier cambio de schema. Mitigación: gate 0; jamás resetear datos ni usar `db push`.
- **Cambiar unicidad revela datos duplicados** — El backfill puede encontrar colisiones por caso/espacios. Mitigación: reporte no destructivo y resolución aprobada antes del índice.
- **Scope RBAC actual incompleto** — `SessionUser.roles` omite alcance, aunque `UserRole` lo conserva. Mitigación: resolver autorización en backend por actorId/DB; no confiar en query ni UI.
- **Consumidores existentes de `getRoles`** — `UserRolesEditor` depende del DTO actual. Mitigación: ampliación compatible, mapper de servicio y tests de gestión de usuarios.
- **Roles system tenant existentes** — `Gestor de Cancha` sembrado tiene `isSystem: true`; quedará visible pero no editable. Mitigación: conducta explícita y mantenimiento por seed/script.
- **Catálogo de permisos crece** — Una página no garantiza selección completa. Mitigación: paginación/load-more y selección estable; nunca una llamada por permiso.
- **Carrera entre scope y escritura** — El alcance del actor podría cambiar durante la operación. Mitigación: verificación dentro de la misma transacción o aislamiento documentado.
- **Auditoría con información excesiva** — Un diff crudo podría guardar payloads sensibles. Mitigación: mapper cerrado de campos e IDs/códigos; pruebas negativas.
- **Build OpenAPI preexistente** — `@ts-nocheck` y Zod/OpenAPI son deuda conocida. Mitigación: no declarar cierre hasta que build y `/api/docs` estén verdes.
